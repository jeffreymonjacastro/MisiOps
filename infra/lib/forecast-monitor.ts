import { ArnFormat, CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvName } from './config.js';
import { DEFAULT_GITHUB_REPO, DEFAULT_GITHUB_REPO_IMMUTABLE } from './foundation-stack.js';

interface MonitorProps {
  environment: EnvName;
  cluster: ecs.Cluster;
  vpc: ec2.Vpc;
  subnets: ec2.SubnetSelection;
  databaseGroup: ec2.SecurityGroup;
  databaseHost: string;
  password: secretsmanager.ISecret;
  image: ecs.ContainerImage;
  runtimePlatform: ecs.RuntimePlatform;
}

export function addForecastMonitor(scope: Construct, props: MonitorProps) {
  const { environment, cluster, vpc, subnets, password } = props;
  const stack = Stack.of(scope);
  const group = new ec2.SecurityGroup(scope, 'ForecastMonitorSg', {
    vpc, description: 'MisiOps forecast monitor tasks',
  });
  props.databaseGroup.addIngressRule(group, ec2.Port.tcp(5432), 'Forecast monitor to PostgreSQL');

  const logGroup = new logs.LogGroup(scope, 'ForecastMonitorLogs', {
    logGroupName: `/misiops/${environment}/forecast-monitor`,
    retention: logs.RetentionDays.THREE_MONTHS,
    removalPolicy: RemovalPolicy.DESTROY,
  });
  const task = new ecs.FargateTaskDefinition(scope, 'ForecastMonitorTask', {
    cpu: 256, memoryLimitMiB: 512, runtimePlatform: props.runtimePlatform,
  });
  task.addContainer('forecast-monitor', {
    image: props.image,
    command: ['python', '-m', 'core.monitor_job'],
    environment: {
      APP_ENV: environment, POSTGRES_USER: 'misiops_forecast_monitor',
      POSTGRES_SERVER: props.databaseHost, POSTGRES_DB: 'misiops',
    },
    logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'monitor' }),
    secrets: {
      POSTGRES_PASSWORD: ecs.Secret.fromSecretsManager(password),
    },
  });

  new events.Rule(scope, 'ForecastMonitorDaily', {
    schedule: events.Schedule.cron({ minute: '25', hour: '12' }),
    targets: [new targets.EcsTask({
      cluster, taskDefinition: task, assignPublicIp: true, subnetSelection: subnets,
      securityGroups: [group], platformVersion: ecs.FargatePlatformVersion.LATEST,
    })],
  });

  for (const [field, metricName, threshold] of [
    ['retrain', 'RetrainingRecommended', 1],
    ['drift', 'DriftDetected', 1],
  ] as const) {
    const filter = new logs.MetricFilter(scope, `Forecast${metricName}`, {
      logGroup, metricName, metricNamespace: `MisiOps/Forecast/${environment}`,
      filterPattern: logs.FilterPattern.numberValue(`$.${field}`, '>=', 0),
      metricValue: `$.${field}`,
    });
    new cloudwatch.Alarm(scope, `Forecast${metricName}Alarm`, {
      metric: filter.metric({ statistic: 'Maximum', period: Duration.hours(1) }),
      threshold, evaluationPeriods: 1, treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
  }
  new logs.MetricFilter(scope, 'ForecastMeanAbsoluteError', {
    logGroup, metricName: 'MeanAbsoluteErrorPEN', metricNamespace: `MisiOps/Forecast/${environment}`,
    filterPattern: logs.FilterPattern.numberValue('$.mae', '>=', 0),
    metricValue: '$.mae', dimensions: { Cutoff: '$.bucket' },
  });

  const providerArn = stack.formatArn({
    service: 'iam', region: '', resource: 'oidc-provider',
    resourceName: 'token.actions.githubusercontent.com', arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
  });
  const role = new iam.Role(scope, 'ForecastMonitorGitHubRole', {
    assumedBy: new iam.FederatedPrincipal(providerArn, {
      StringEquals: {
        'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        'token.actions.githubusercontent.com:sub': [DEFAULT_GITHUB_REPO, DEFAULT_GITHUB_REPO_IMMUTABLE]
          .map((repo) => `repo:${repo}:environment:${environment}`),
      },
    }, 'sts:AssumeRoleWithWebIdentity'),
  });
  role.addToPolicy(new iam.PolicyStatement({
    actions: ['ecs:RunTask'], resources: [task.taskDefinitionArn],
    conditions: { ArnEquals: { 'ecs:cluster': cluster.clusterArn } },
  }));
  role.addToPolicy(new iam.PolicyStatement({
    actions: ['iam:PassRole'], resources: [task.taskRole.roleArn, task.executionRole!.roleArn],
    conditions: { StringEquals: { 'iam:PassedToService': 'ecs-tasks.amazonaws.com' } },
  }));
  role.addToPolicy(new iam.PolicyStatement({
    actions: ['ecs:DescribeTasks'], resources: [stack.formatArn({
      service: 'ecs', resource: 'task', resourceName: `${cluster.clusterName}/*`,
      arnFormat: ArnFormat.SLASH_RESOURCE_NAME,
    })],
  }));
  role.addToPolicy(new iam.PolicyStatement({
    actions: ['cloudformation:DescribeStacks'], resources: [stack.stackId],
  }));
  role.addToPolicy(new iam.PolicyStatement({
    actions: ['logs:FilterLogEvents'], resources: [logGroup.logGroupArn],
  }));

  const outputs = {
    ForecastMonitorRoleArn: role.roleArn,
    ForecastMonitorTaskArn: task.taskDefinitionArn,
    ForecastMonitorNetwork: JSON.stringify({
      awsvpcConfiguration: {
        subnets: vpc.selectSubnets(subnets).subnetIds,
        securityGroups: [group.securityGroupId],
        assignPublicIp: 'ENABLED',
      },
    }),
    ForecastMonitorLogGroup: logGroup.logGroupName,
  };
  for (const [id, value] of Object.entries(outputs)) new CfnOutput(scope, id, { value });
}
