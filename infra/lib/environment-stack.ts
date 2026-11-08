// One complete MisiOps environment (dev or prod). Resource contract:
// specs/012-aws-deployment/contracts/cdk-stacks.md; decisions: specs/012-aws-deployment/research.md.
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { EnvName, REGION, envConfig } from './config.js';
import { REPOSITORY_NAMES } from './foundation-stack.js';

export interface EnvironmentStackProps extends StackProps {
  envName: EnvName;
  /** Commit SHA of the images to run; must already exist in both ECR repositories (FR-009). */
  imageTag: string;
  /** Recipient of the monthly budget notifications (FR-018). */
  alertEmail: string;
}

const BACKEND_PORT = 8000;
const FRONTEND_PORT = 3000;
const API_PATHS = ['/api/*', '/openapi.json', '/docs', '/redoc'];
// CDK's default exclusion set for generated passwords: every character that would need
// URL-encoding in backend/core/config.py's DATABASE_URL f-string (FR-006).
const PASSWORD_EXCLUDE_CHARACTERS = ' %+~`#$&*()|[]{}:;<>?!\'/@"\\';

export class EnvironmentStack extends Stack {
  constructor(scope: Construct, id: string, props: EnvironmentStackProps) {
    super(scope, id, props);
    const { envName, imageTag, alertEmail } = props;
    const cfg = envConfig(envName);

    // --- Network (T009, R3): no NAT; tasks get public IPs, the database is isolated.
    // Fixed AZs instead of maxAzs: no context lookup, so synth is identical offline (CI) and at deploy (R12).
    const vpc = new ec2.Vpc(this, 'Vpc', {
      availabilityZones: [`${REGION}a`, `${REGION}b`],
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'isolated', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });
    const publicSubnets: ec2.SubnetSelection = { subnetGroupName: 'public' };
    const isolatedSubnets: ec2.SubnetSelection = { subnetGroupName: 'isolated' };

    const albSg = new ec2.SecurityGroup(this, 'AlbSg', { vpc, description: 'MisiOps ALB' });
    // ponytail: open HTTP listener; restricting to CloudFront's prefix list is the upgrade path (R3, NFR-008).
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP from anywhere (demo)');
    const backendSg = new ec2.SecurityGroup(this, 'BackendSg', { vpc, description: 'MisiOps backend tasks' });
    backendSg.addIngressRule(albSg, ec2.Port.tcp(BACKEND_PORT), 'ALB to backend');
    const frontendSg = new ec2.SecurityGroup(this, 'FrontendSg', { vpc, description: 'MisiOps frontend tasks' });
    frontendSg.addIngressRule(albSg, ec2.Port.tcp(FRONTEND_PORT), 'ALB to frontend');
    const dbSg = new ec2.SecurityGroup(this, 'DbSg', { vpc, description: 'MisiOps database', allowAllOutbound: false });
    dbSg.addIngressRule(backendSg, ec2.Port.tcp(5432), 'backend to PostgreSQL (FR-005)');

    // --- Secrets and database (T010, R6, R7): values live only in Secrets Manager (FR-006).
    const appSecret = new secretsmanager.Secret(this, 'AppSecret', {
      secretName: `misiops/${envName}/app`,
      description: `MisiOps ${envName} SECRET_KEY (token signing)`,
      generateSecretString: { passwordLength: 64, excludePunctuation: true },
    });
    const db = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_9 }),
      writer: rds.ClusterInstance.serverlessV2('writer', { publiclyAccessible: false }),
      serverlessV2MinCapacity: cfg.dbMinAcu,
      serverlessV2MaxCapacity: cfg.dbMaxAcu,
      serverlessV2AutoPauseDuration: Duration.minutes(cfg.dbAutoPauseMinutes),
      vpc,
      vpcSubnets: isolatedSubnets,
      securityGroups: [dbSg],
      storageEncrypted: true,
      backup: { retention: Duration.days(7) },
      defaultDatabaseName: 'misiops',
      credentials: rds.Credentials.fromGeneratedSecret('misiops', {
        secretName: `misiops/${envName}/db`,
        excludeCharacters: PASSWORD_EXCLUDE_CHARACTERS,
      }),
      removalPolicy: cfg.dbRemovalPolicy,
      deletionProtection: cfg.dbDeletionProtection,
    });
    const dbSecret = db.secret!;

    // --- Logs and cluster (T011, R13)
    const logGroup = (service: string) =>
      new logs.LogGroup(this, `${service}Logs`, {
        logGroupName: `/misiops/${envName}/${service}`,
        retention: cfg.logRetention,
        removalPolicy: RemovalPolicy.DESTROY,
      });
    const backendLogs = logGroup('backend');
    const frontendLogs = logGroup('frontend');
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc, containerInsightsV2: ecs.ContainerInsights.DISABLED });

    // --- Services (T012, T013, T031, R2): ARM64 Fargate, circuit breaker with rollback (FR-013, FR-014).
    const runtimePlatform: ecs.RuntimePlatform = {
      operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      cpuArchitecture: ecs.CpuArchitecture.ARM64,
    };
    const image = (name: string) =>
      ecs.ContainerImage.fromEcrRepository(ecr.Repository.fromRepositoryName(this, `${name}Repository`, name), imageTag);

    const backendTask = new ecs.FargateTaskDefinition(this, 'BackendTask', {
      cpu: cfg.taskCpu,
      memoryLimitMiB: cfg.taskMemoryMiB,
      runtimePlatform,
    });
    // FR-006 / R7: only the task execution role reads these two secrets, through the grants
    // ecs.Secret.fromSecretsManager adds; no other principal is granted access anywhere in this stack.
    backendTask.addContainer('backend', {
      image: image(REPOSITORY_NAMES.backend),
      portMappings: [{ containerPort: BACKEND_PORT }],
      logging: ecs.LogDrivers.awsLogs({ logGroup: backendLogs, streamPrefix: 'backend' }),
      environment: { ACCESS_TOKEN_EXPIRE_MINUTES: '1440' },
      secrets: {
        POSTGRES_USER: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
        POSTGRES_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        POSTGRES_SERVER: ecs.Secret.fromSecretsManager(dbSecret, 'host'),
        POSTGRES_DB: ecs.Secret.fromSecretsManager(dbSecret, 'dbname'),
        SECRET_KEY: ecs.Secret.fromSecretsManager(appSecret),
      },
    });

    const frontendTask = new ecs.FargateTaskDefinition(this, 'FrontendTask', {
      cpu: cfg.taskCpu,
      memoryLimitMiB: cfg.taskMemoryMiB,
      runtimePlatform,
    });
    frontendTask.addContainer('frontend', {
      image: image(REPOSITORY_NAMES.frontend),
      portMappings: [{ containerPort: FRONTEND_PORT }],
      logging: ecs.LogDrivers.awsLogs({ logGroup: frontendLogs, streamPrefix: 'frontend' }),
      environment: { APP_ENV: envName },
    });

    const service = (name: string, taskDefinition: ecs.FargateTaskDefinition, securityGroup: ec2.SecurityGroup) =>
      new ecs.FargateService(this, `${name}Service`, {
        cluster,
        taskDefinition,
        securityGroups: [securityGroup],
        desiredCount: cfg.desiredCount,
        assignPublicIp: true,
        vpcSubnets: publicSubnets,
        circuitBreaker: { enable: true, rollback: true },
        minHealthyPercent: 100,
        maxHealthyPercent: 200,
      });
    const backendService = service('Backend', backendTask, backendSg);
    const frontendService = service('Frontend', frontendTask, frontendSg);

    // --- Load balancer and routing (T014, R5): one origin, API paths to the backend, the rest to the web app (FR-003).
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
      vpcSubnets: publicSubnets,
      securityGroup: albSg,
    });
    const listener = alb.addListener('Http', { port: 80, open: false });
    const targetDefaults = {
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: { path: '/', interval: Duration.seconds(30), healthyThresholdCount: 2 },
      deregistrationDelay: Duration.seconds(30),
    };
    listener.addTargets('Frontend', { ...targetDefaults, port: FRONTEND_PORT, targets: [frontendService] });
    listener.addTargets('Backend', {
      ...targetDefaults,
      port: BACKEND_PORT,
      targets: [backendService],
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(API_PATHS)],
    });

    // --- Public HTTPS entry (T015, R4, NFR-008): no caching of dynamic responses, static assets cached.
    const origin = new origins.LoadBalancerV2Origin(alb, { protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY });
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: `MisiOps ${envName}`,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/_next/static/*': {
          origin,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
    });

    // --- Budget and outputs (T016, R13, R14, FR-018)
    // ponytail: the budget measures the whole account (no cost-allocation tags activated yet);
    // add costFilters on the Environment tag once tags are activated in Billing.
    const notify = (notificationType: 'ACTUAL' | 'FORECASTED', threshold: number) => ({
      notification: { notificationType, comparisonOperator: 'GREATER_THAN', threshold, thresholdType: 'PERCENTAGE' },
      subscribers: [{ subscriptionType: 'EMAIL', address: alertEmail }],
    });
    new budgets.CfnBudget(this, 'Budget', {
      budget: {
        budgetName: `misiops-${envName}`,
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: cfg.budgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [notify('ACTUAL', 80), notify('FORECASTED', 100)],
    });

    new CfnOutput(this, 'PublicUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'AlbDnsName', { value: alb.loadBalancerDnsName });
    new CfnOutput(this, 'BackendLogGroup', { value: backendLogs.logGroupName });
    new CfnOutput(this, 'FrontendLogGroup', { value: frontendLogs.logGroupName });
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'BackendServiceName', { value: backendService.serviceName });
    new CfnOutput(this, 'FrontendServiceName', { value: frontendService.serviceName });
  }
}
