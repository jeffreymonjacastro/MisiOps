// CDK app entry point (specs/012-aws-deployment/research.md R14).
//   cdk deploy MisiOps-Foundation                                   (once per account, administrator)
//   cdk deploy MisiOps-dev -c env=dev -c imageTag=<sha> -c alertEmail=<email>
import { App, Tags } from 'aws-cdk-lib';
import { REGION, readContext } from '../lib/config.js';
import { EnvironmentStack } from '../lib/environment-stack.js';
import { FoundationStack } from '../lib/foundation-stack.js';

const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: REGION };
Tags.of(app).add('Project', 'MisiOps');

new FoundationStack(app, 'MisiOps-Foundation', {
  env,
  githubRepo: app.node.tryGetContext('githubRepo'),
  githubRepoImmutable: app.node.tryGetContext('githubRepoImmutable'),
});

if (app.node.tryGetContext('env') !== undefined) {
  const ctx = readContext(app);
  const stack = new EnvironmentStack(app, `MisiOps-${ctx.envName}`, { env, ...ctx });
  Tags.of(stack).add('Environment', ctx.envName);
}
