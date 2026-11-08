# Contract: CDK Stacks

**Region**: `us-east-1` | **Account**: `CDK_DEFAULT_ACCOUNT` | **App**: `infra/bin/misiops.ts`

## `MisiOps-Foundation` (once per account)

| Resource | Construct | Key properties |
| --- | --- | --- |
| GitHub OIDC provider | `iam.OidcProviderNative` | url `https://token.actions.githubusercontent.com`, clientIds `[sts.amazonaws.com]` |
| Deploy role | `iam.Role` | assumedBy `OpenIdConnectPrincipal` with `StringEquals aud=sts.amazonaws.com`, `StringLike sub` ∈ {`repo:<githubRepo>:ref:refs/heads/develop`, `…:ref:refs/heads/main`, `…:environment:dev`, `…:environment:prod`}; maxSessionDuration 1 h; policy: `sts:AssumeRole` on `arn:aws:iam::<account>:role/cdk-hnb659fds-*`, `ecr:GetAuthorizationToken` (`*`), push/pull actions on the two repositories, `cloudformation:DescribeStacks` (`*`) |
| ECR `misiops-backend`, `misiops-frontend` | `ecr.Repository` | `imageTagMutability: IMMUTABLE`, `imageScanOnPush: true`, lifecycle keep last 20, `removalPolicy: RETAIN` |

Outputs: `DeployRoleArn`, `BackendRepositoryUri`, `FrontendRepositoryUri`.

Repository variables set by hand from the outputs (not secrets): `AWS_ACCOUNT_ID`, `AWS_DEPLOY_ROLE_ARN`, `ALERT_EMAIL`.

## `MisiOps-<env>` (per environment; `env` ∈ {`dev`, `prod`})

Context: `env`, `imageTag`, `alertEmail` (all required). The stack references the Foundation ECR repositories by name (`ecr.Repository.fromRepositoryName`), so it has no cross-stack export and can be deployed on its own.

| Area | Construct | Contract |
| --- | --- | --- |
| Network | `ec2.Vpc` | `availabilityZones: [us-east-1a, us-east-1b]` (fixed, no lookup), `natGateways: 0`, subnets `PUBLIC /24` + `PRIVATE_ISOLATED /24` |
| ALB SG | `ec2.SecurityGroup` | ingress TCP 80 from `0.0.0.0/0` (demo simplification, NFR-008 SHOULD) |
| Service SGs | `ec2.SecurityGroup` ×2 | ingress 8000 / 3000 from ALB SG only |
| DB SG | `ec2.SecurityGroup` | ingress 5432 from backend SG only |
| Database | `rds.DatabaseCluster` | Aurora PostgreSQL 16.9 (`VER_16_9`, 0 ACU supported), `writer: ClusterInstance.serverlessV2('writer')`, `serverlessV2MinCapacity: 0`, `serverlessV2MaxCapacity: 1`, `serverlessV2AutoPauseDuration: 10 min`, isolated subnets, `storageEncrypted: true`, `backup.retention: 7d`, `defaultDatabaseName: misiops`, credentials `fromGeneratedSecret('misiops', excludeCharacters = CDK default set `` %+~`#$&*()|[]{}:;<>?!'/@"\ ``, a superset of `/@":%+ ` so the password is valid verbatim in the backend's URL)`, secret name `misiops/<env>/db`; `dev`: DESTROY, `prod`: SNAPSHOT + `deletionProtection: true`. Fallback: `rds.DatabaseInstance` `db.t4g.micro` (R6) |
| App secret | `secretsmanager.Secret` | name `misiops/<env>/app`, 64 chars, `excludePunctuation: true` |
| Logs | `logs.LogGroup` ×2 | `/misiops/<env>/backend`, `/misiops/<env>/frontend`, `ONE_MONTH`, DESTROY |
| Cluster | `ecs.Cluster` | `containerInsightsV2: DISABLED` |
| Backend task | `ecs.FargateTaskDefinition` | 256/512, `runtimePlatform` LINUX/ARM64, image `ecr:<imageTag>` from `misiops-backend`, port 8000, `secrets` = {`POSTGRES_USER`:username, `POSTGRES_PASSWORD`:password, `POSTGRES_SERVER`:host, `POSTGRES_DB`:dbname, `SECRET_KEY`:app}, `environment` = {`ACCESS_TOKEN_EXPIRE_MINUTES`:`1440`}, awslogs |
| Frontend task | `ecs.FargateTaskDefinition` | 256/512, `runtimePlatform` LINUX/ARM64, image `ecr:<imageTag>` from `misiops-frontend`, port 3000, `environment` = {`APP_ENV`:`<env>`}, awslogs |
| Services | `ecs.FargateService` ×2 | `desiredCount: 1`, `assignPublicIp: true`, PUBLIC subnets, `circuitBreaker: {enable: true, rollback: true}`, `minHealthyPercent: 100`, `maxHealthyPercent: 200` |
| ALB | `elbv2.ApplicationLoadBalancer` | internet-facing, PUBLIC subnets, listener HTTP:80 |
| Target groups | `elbv2.ApplicationTargetGroup` ×2 | HTTP, health `GET /` 200, interval 30 s, healthy threshold 2, `deregistrationDelay: 30 s` |
| Listener rules | `elbv2.ApplicationListenerRule` | priority 10, paths `/api/*`, `/openapi.json`, `/docs`, `/redoc` → backend TG; default → frontend TG |
| CDN | `cloudfront.Distribution` | origin `LoadBalancerV2Origin(alb, HTTP_ONLY)`; default behaviour: `CACHING_DISABLED`, `ALL_VIEWER_EXCEPT_HOST_HEADER`, `ALLOW_ALL` methods, `REDIRECT_TO_HTTPS`; `/_next/static/*`: `CACHING_OPTIMIZED`, `REDIRECT_TO_HTTPS`; default certificate; `PriceClass_100` |
| Budget | `budgets.CfnBudget` | COST, MONTHLY, 60 USD; notifications ACTUAL ≥ 80 % and FORECASTED ≥ 100 % → `alertEmail` |

Outputs: `PublicUrl` (`https://<domain>`), `AlbDnsName`, `BackendLogGroup`, `FrontendLogGroup`, `ClusterName`, `BackendServiceName`, `FrontendServiceName`.

## Commands

```bash
# one-time (admin, local)
cdk bootstrap aws://<ACCOUNT_ID>/us-east-1
cdk deploy MisiOps-Foundation
# per environment (CI; also valid locally)
cdk deploy MisiOps-dev -c env=dev -c imageTag=<sha> -c alertEmail=<email> --require-approval never --outputs-file outputs.json
cdk destroy MisiOps-dev -c env=dev -c imageTag=<sha> -c alertEmail=<email>
```

Synth with no credentials (CI): no account or region variables needed; the stacks contain no context lookups.
