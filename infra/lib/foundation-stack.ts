// Account-wide resources, deployed once by an administrator (specs/012-aws-deployment/contracts/cdk-stacks.md).
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export const REPOSITORY_NAMES = { backend: 'misiops-backend', frontend: 'misiops-frontend' } as const;
export const DEFAULT_GITHUB_REPO = 'jeffreymonjacastro/MisiOps';
const GITHUB_OIDC_URL = 'https://token.actions.githubusercontent.com';
const GITHUB_OIDC_AUDIENCE = 'sts.amazonaws.com';

export interface FoundationStackProps extends StackProps {
  /** `<owner>/<repo>` allowed to assume the deploy role (R9). */
  githubRepo?: string;
}

export class FoundationStack extends Stack {
  readonly backendRepository: ecr.Repository;
  readonly frontendRepository: ecr.Repository;
  readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: FoundationStackProps = {}) {
    super(scope, id, props);
    const githubRepo = props.githubRepo ?? DEFAULT_GITHUB_REPO;

    // --- Image registry (R10): immutable tags = commit SHA, scanned on push, kept on stack deletion.
    const repository = (name: string) =>
      new ecr.Repository(this, name, {
        repositoryName: name,
        imageTagMutability: ecr.TagMutability.IMMUTABLE,
        imageScanOnPush: true,
        lifecycleRules: [{ maxImageCount: 20, description: 'keep the last 20 images' }],
        removalPolicy: RemovalPolicy.RETAIN,
      });
    this.backendRepository = repository(REPOSITORY_NAMES.backend);
    this.frontendRepository = repository(REPOSITORY_NAMES.frontend);

    // --- GitHub OIDC identity (R9, FR-011, FR-012): short-lived credentials, no stored keys.
    const provider = new iam.OidcProviderNative(this, 'GithubOidc', {
      url: GITHUB_OIDC_URL,
      clientIds: [GITHUB_OIDC_AUDIENCE],
    });
    const subjects = [
      `repo:${githubRepo}:ref:refs/heads/develop`,
      `repo:${githubRepo}:ref:refs/heads/main`,
      // Jobs running inside a GitHub Environment carry no branch in `sub`; the environment's
      // "deployment branches" rule (dev -> develop, prod -> main) binds it (FR-012).
      `repo:${githubRepo}:environment:dev`,
      `repo:${githubRepo}:environment:prod`,
    ];
    this.deployRole = new iam.Role(this, 'DeployRole', {
      roleName: 'MisiOpsGithubDeploy',
      description: `GitHub Actions deploy role for ${githubRepo} (develop -> dev, main -> prod)`,
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.OpenIdConnectPrincipal(provider, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': GITHUB_OIDC_AUDIENCE },
        StringLike: { 'token.actions.githubusercontent.com:sub': subjects },
      }),
    });
    const repositoryArns = [this.backendRepository.repositoryArn, this.frontendRepository.repositoryArn];
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'AssumeCdkBootstrapRoles',
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-hnb659fds-*-${this.account}-${this.region}`],
      }),
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({ sid: 'EcrLogin', actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }),
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'EcrPushPull',
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:CompleteLayerUpload',
          'ecr:InitiateLayerUpload',
          'ecr:PutImage',
          'ecr:UploadLayerPart',
          'ecr:BatchGetImage',
          'ecr:GetDownloadUrlForLayer',
          'ecr:DescribeImages',
        ],
        resources: repositoryArns,
      }),
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({ sid: 'DescribeStacks', actions: ['cloudformation:DescribeStacks'], resources: ['*'] }),
    );

    new CfnOutput(this, 'DeployRoleArn', { value: this.deployRole.roleArn });
    new CfnOutput(this, 'BackendRepositoryUri', { value: this.backendRepository.repositoryUri });
    new CfnOutput(this, 'FrontendRepositoryUri', { value: this.frontendRepository.repositoryUri });
  }
}
