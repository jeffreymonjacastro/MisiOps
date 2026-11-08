// EnvironmentStack assertions (T008, T026, T029, T036, T040): NFR-007 security properties and the
// contract in specs/012-aws-deployment/contracts/cdk-stacks.md, without touching an AWS account.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { EnvName, readContext } from '../lib/config.js';
import { EnvironmentStack } from '../lib/environment-stack.js';

function synth(envName: EnvName): Template {
  const app = new App({ context: { env: envName, imageTag: 'test', alertEmail: 'test@example.com' } });
  const ctx = readContext(app);
  return Template.fromStack(new EnvironmentStack(app, `MisiOps-${envName}`, ctx));
}
const dev = synth('dev');
const prod = synth('prod');
const devJson = dev.toJSON();

const securityGroupId = (t: Template, description: string): string => {
  const ids = Object.keys(t.findResources('AWS::EC2::SecurityGroup', { Properties: Match.objectLike({ GroupDescription: description }) }));
  assert.equal(ids.length, 1, `one security group "${description}"`);
  return ids[0];
};
const ingressRulesFor = (t: Template, groupId: string) =>
  Object.values(t.findResources('AWS::EC2::SecurityGroupIngress')).filter((r) => r.Properties.GroupId?.['Fn::GetAtt']?.[0] === groupId);
const taskDefinition = (t: Template, container: string) => {
  const found = Object.values(t.findResources('AWS::ECS::TaskDefinition')).filter((r) => r.Properties.ContainerDefinitions[0].Name === container);
  assert.equal(found.length, 1);
  return found[0].Properties;
};

test('network: no NAT gateway, two AZs', () => {
  dev.resourceCountIs('AWS::EC2::NatGateway', 0);
  dev.resourceCountIs('AWS::EC2::Subnet', 4);
});

test('ALB security group has exactly one ingress rule: TCP 80', () => {
  const albSg = securityGroupId(dev, 'MisiOps ALB');
  const inline = devJson.Resources[albSg].Properties.SecurityGroupIngress;
  assert.equal(inline.length, 1);
  assert.deepEqual({ IpProtocol: inline[0].IpProtocol, FromPort: inline[0].FromPort, ToPort: inline[0].ToPort }, { IpProtocol: 'tcp', FromPort: 80, ToPort: 80 });
  assert.equal(ingressRulesFor(dev, albSg).length, 0);
});

test('database security group accepts only the backend security group (FR-005)', () => {
  const dbSg = securityGroupId(dev, 'MisiOps database');
  const backendSg = securityGroupId(dev, 'MisiOps backend tasks');
  assert.equal(devJson.Resources[dbSg].Properties.SecurityGroupIngress, undefined);
  const rules = ingressRulesFor(dev, dbSg);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].Properties.SourceSecurityGroupId['Fn::GetAtt'][0], backendSg);
  assert.equal(rules[0].Properties.CidrIp, undefined);
  assert.equal(rules[0].Properties.FromPort, 5432);
});

test('service security groups accept traffic only from the ALB', () => {
  const albSg = securityGroupId(dev, 'MisiOps ALB');
  for (const description of ['MisiOps backend tasks', 'MisiOps frontend tasks']) {
    const sg = securityGroupId(dev, description);
    assert.equal(devJson.Resources[sg].Properties.SecurityGroupIngress, undefined);
    const rules = ingressRulesFor(dev, sg);
    assert.ok(rules.length >= 1);
    for (const rule of rules) assert.equal(rule.Properties.SourceSecurityGroupId['Fn::GetAtt'][0], albSg);
  }
});

test('Aurora Serverless v2 PostgreSQL 16: 0-1 ACU, auto-pause, encrypted, 7-day backups, private', () => {
  dev.hasResourceProperties('AWS::RDS::DBCluster', {
    Engine: 'aurora-postgresql',
    EngineVersion: Match.stringLikeRegexp('^16\\.'),
    StorageEncrypted: true,
    BackupRetentionPeriod: 7,
    DatabaseName: 'misiops',
    ServerlessV2ScalingConfiguration: { MinCapacity: 0, MaxCapacity: 1, SecondsUntilAutoPause: 600 },
  });
  dev.hasResourceProperties('AWS::RDS::DBInstance', { DBInstanceClass: 'db.serverless', PubliclyAccessible: false });
  dev.hasResource('AWS::RDS::DBCluster', { DeletionPolicy: 'Delete', UpdateReplacePolicy: 'Delete', Properties: Match.objectLike({ DeletionProtection: false }) });
  const subnetGroup = Object.values(dev.findResources('AWS::RDS::DBSubnetGroup'))[0];
  for (const subnet of subnetGroup.Properties.SubnetIds) {
    assert.match(subnet.Ref, /isolated/i);
  }
});

test('both task definitions run on Linux/ARM64 Fargate', () => {
  dev.resourceCountIs('AWS::ECS::TaskDefinition', 2);
  dev.allResourcesProperties('AWS::ECS::TaskDefinition', {
    RuntimePlatform: { CpuArchitecture: 'ARM64', OperatingSystemFamily: 'LINUX' },
    Cpu: '256',
    Memory: '512',
  });
});

test('backend secrets come from Secrets Manager only; no secret in plain environment (FR-006)', () => {
  const backend = taskDefinition(dev, 'backend').ContainerDefinitions[0];
  assert.deepEqual(backend.Secrets.map((s: any) => s.Name).sort(), ['POSTGRES_DB', 'POSTGRES_PASSWORD', 'POSTGRES_SERVER', 'POSTGRES_USER', 'SECRET_KEY']);
  const envNames = backend.Environment.map((e: any) => e.Name);
  assert.deepEqual(envNames, ['ACCESS_TOKEN_EXPIRE_MINUTES']);
  const serialized = JSON.stringify(devJson);
  assert.ok(!/"SecretString"\s*:/.test(serialized), 'no SecretString key in the template');
  assert.ok(!/\.SecretString/.test(serialized), 'no Fn::GetAtt of SecretString');
});

test('task execution role may read exactly the two secrets', () => {
  const statements = Object.values(dev.findResources('AWS::IAM::Policy')).flatMap((p) => p.Properties.PolicyDocument.Statement as any[]);
  const secretStatements = statements.filter((s) => [s.Action].flat().includes('secretsmanager:GetSecretValue'));
  const resources = new Set(secretStatements.flatMap((s) => [s.Resource].flat()).map((r) => JSON.stringify(r)));
  assert.equal(resources.size, 2);
});

test('frontend task is configured by APP_ENV at runtime', () => {
  assert.deepEqual(taskDefinition(dev, 'frontend').ContainerDefinitions[0].Environment, [{ Name: 'APP_ENV', Value: 'dev' }]);
  assert.deepEqual(taskDefinition(prod, 'frontend').ContainerDefinitions[0].Environment, [{ Name: 'APP_ENV', Value: 'prod' }]);
});

test('ECS services: circuit breaker with rollback, 100/200 healthy percent (FR-013, FR-014)', () => {
  dev.resourceCountIs('AWS::ECS::Service', 2);
  dev.allResourcesProperties('AWS::ECS::Service', {
    DesiredCount: 1,
    DeploymentConfiguration: { DeploymentCircuitBreaker: { Enable: true, Rollback: true }, MinimumHealthyPercent: 100, MaximumPercent: 200 },
    NetworkConfiguration: { AwsvpcConfiguration: Match.objectLike({ AssignPublicIp: 'ENABLED' }) },
  });
});

test('ALB: HTTP listener, API paths to the backend (priority 10), health checks on /, 30 s deregistration', () => {
  dev.resourceCountIs('AWS::ElasticLoadBalancingV2::Listener', 1);
  dev.hasResourceProperties('AWS::ElasticLoadBalancingV2::Listener', { Port: 80, Protocol: 'HTTP' });
  dev.hasResourceProperties('AWS::ElasticLoadBalancingV2::ListenerRule', {
    Priority: 10,
    Conditions: [{ Field: 'path-pattern', PathPatternConfig: { Values: ['/api/*', '/openapi.json', '/docs', '/redoc'] } }],
  });
  dev.resourceCountIs('AWS::ElasticLoadBalancingV2::TargetGroup', 2);
  dev.allResourcesProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
    HealthCheckPath: '/',
    HealthCheckIntervalSeconds: 30,
    HealthyThresholdCount: 2,
    TargetType: 'ip',
    TargetGroupAttributes: Match.arrayWith([{ Key: 'deregistration_delay.timeout_seconds', Value: '30' }]),
  });
});

test('CloudFront: no caching and full header forwarding by default, HTTPS redirect, static assets cached', () => {
  dev.hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      PriceClass: 'PriceClass_100',
      DefaultCacheBehavior: Match.objectLike({
        CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
        OriginRequestPolicyId: 'b689b0a8-53d0-40ab-baf2-68738e2966ac',
        ViewerProtocolPolicy: 'redirect-to-https',
        AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
      }),
      CacheBehaviors: [Match.objectLike({ PathPattern: '/_next/static/*', ViewerProtocolPolicy: 'redirect-to-https' })],
      Origins: [Match.objectLike({ CustomOriginConfig: Match.objectLike({ OriginProtocolPolicy: 'http-only' }) })],
    }),
  });
});

test('log groups per service, 30-day retention, deleted with the stack (FR-016)', () => {
  for (const service of ['backend', 'frontend']) {
    dev.hasResource('AWS::Logs::LogGroup', {
      DeletionPolicy: 'Delete',
      Properties: { LogGroupName: `/misiops/dev/${service}`, RetentionInDays: 30 },
    });
    const logConfig = taskDefinition(dev, service).ContainerDefinitions[0].LogConfiguration;
    assert.equal(logConfig.LogDriver, 'awslogs');
    assert.match(logConfig.Options['awslogs-group'].Ref, new RegExp(`^${service}Logs`));
  }
});

test('monthly 60 USD budget notifies the alert e-mail at 80 % actual and 100 % forecast (FR-018)', () => {
  dev.hasResourceProperties('AWS::Budgets::Budget', {
    Budget: Match.objectLike({ BudgetType: 'COST', TimeUnit: 'MONTHLY', BudgetLimit: { Amount: 60, Unit: 'USD' } }),
    NotificationsWithSubscribers: [
      { Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: 80 }), Subscribers: [{ SubscriptionType: 'EMAIL', Address: 'test@example.com' }] },
      { Notification: Match.objectLike({ NotificationType: 'FORECASTED', Threshold: 100 }), Subscribers: [{ SubscriptionType: 'EMAIL', Address: 'test@example.com' }] },
    ],
  });
});

test('outputs expose the public URL and the operational names', () => {
  for (const key of ['PublicUrl', 'AlbDnsName', 'BackendLogGroup', 'FrontendLogGroup', 'ClusterName', 'BackendServiceName', 'FrontendServiceName']) {
    assert.ok(devJson.Outputs[key], `output ${key}`);
  }
});

test('prod: snapshot on delete, deletion protection, same topology as dev (FR-002)', () => {
  prod.hasResource('AWS::RDS::DBCluster', { DeletionPolicy: 'Snapshot', UpdateReplacePolicy: 'Snapshot', Properties: Match.objectLike({ DeletionProtection: true }) });
  const count = (t: Template) => {
    const counts: Record<string, number> = {};
    for (const r of Object.values(t.toJSON().Resources) as any[]) counts[r.Type] = (counts[r.Type] ?? 0) + 1;
    return counts;
  };
  assert.deepEqual(count(prod), count(dev));
});

test('context validation fails fast', () => {
  assert.throws(() => readContext(new App({ context: { env: 'staging', imageTag: 'x', alertEmail: 'a@b.c' } })), /"env" must be one of dev, prod/);
  assert.throws(() => readContext(new App({ context: { env: 'dev', alertEmail: 'a@b.c' } })), /"imageTag" is required/);
  assert.throws(() => readContext(new App({ context: { env: 'dev', imageTag: 'x' } })), /"alertEmail" is required/);
});
