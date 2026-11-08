// FoundationStack assertions (T007, T035): registry immutability and the GitHub OIDC trust policy (FR-011, FR-012).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { FoundationStack } from '../lib/foundation-stack.js';

const template = Template.fromStack(new FoundationStack(new App(), 'MisiOps-Foundation'));
const REPO = 'jeffreymonjacastro/MisiOps';

test('two ECR repositories: immutable tags, scan on push, retained on delete', () => {
  template.resourceCountIs('AWS::ECR::Repository', 2);
  for (const name of ['misiops-backend', 'misiops-frontend']) {
    template.hasResource('AWS::ECR::Repository', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({
        RepositoryName: name,
        ImageTagMutability: 'IMMUTABLE',
        ImageScanningConfiguration: { ScanOnPush: true },
      }),
    });
  }
});

test('GitHub OIDC provider for the STS audience', () => {
  template.hasResourceProperties('AWS::IAM::OIDCProvider', {
    Url: 'https://token.actions.githubusercontent.com',
    ClientIdList: ['sts.amazonaws.com'],
  });
});

test('deploy role trusts only this repository (develop, main, environments dev and prod), 1 h sessions', () => {
  const roles = template.findResources('AWS::IAM::Role', { Properties: Match.objectLike({ RoleName: 'MisiOpsGithubDeploy' }) });
  const [role] = Object.values(roles);
  assert.ok(role, 'deploy role exists');
  assert.equal(role.Properties.MaxSessionDuration, 3600);
  const statements = role.Properties.AssumeRolePolicyDocument.Statement;
  assert.equal(statements.length, 1);
  const [trust] = statements;
  assert.equal(trust.Action, 'sts:AssumeRoleWithWebIdentity');
  assert.deepEqual(trust.Condition.StringEquals, { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' });
  assert.deepEqual(trust.Condition.StringLike['token.actions.githubusercontent.com:sub'], [
    `repo:${REPO}:ref:refs/heads/develop`,
    `repo:${REPO}:ref:refs/heads/main`,
    `repo:${REPO}:environment:dev`,
    `repo:${REPO}:environment:prod`,
  ]);
});

test('deploy role policy: no wildcard actions; "*" resources only for ECR login and DescribeStacks', () => {
  const policies = template.findResources('AWS::IAM::Policy');
  const statements = Object.values(policies).flatMap((p) => p.Properties.PolicyDocument.Statement as any[]);
  assert.ok(statements.length >= 3);
  const allowedOnStar = new Set(['ecr:GetAuthorizationToken', 'cloudformation:DescribeStacks']);
  for (const statement of statements) {
    const actions: string[] = [statement.Action].flat();
    const resources = [statement.Resource].flat();
    for (const action of actions) {
      assert.ok(!action.startsWith('iam:'), `no IAM actions (${action})`);
      assert.ok(!action.includes('*'), `no wildcard actions (${action})`);
    }
    if (resources.includes('*')) {
      for (const action of actions) assert.ok(allowedOnStar.has(action), `"*" resource not allowed for ${action}`);
    }
  }
  const actions = new Set(statements.flatMap((s) => [s.Action].flat()));
  assert.ok(actions.has('sts:AssumeRole'));
  assert.ok(actions.has('ecr:PutImage'));
});
