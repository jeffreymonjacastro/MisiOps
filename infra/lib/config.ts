// Per-environment parameters and CDK context readers (specs/012-aws-deployment/data-model.md §Environment).
import { App, RemovalPolicy } from 'aws-cdk-lib';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';

export type EnvName = 'dev' | 'prod';
export const ENV_NAMES: readonly EnvName[] = ['dev', 'prod'];
export const REGION = 'us-east-1';

export interface StackContext {
  envName: EnvName;
  imageTag: string;
  alertEmail: string;
}

/** Reads the required context keys; fails synth early with a clear message when one is missing. */
export function readContext(app: App): StackContext {
  const env = app.node.tryGetContext('env');
  if (!ENV_NAMES.includes(env)) {
    throw new Error(`Context "env" must be one of ${ENV_NAMES.join(', ')} (got ${JSON.stringify(env)}). Pass -c env=dev`);
  }
  return { envName: env, imageTag: requireString(app, 'imageTag'), alertEmail: requireString(app, 'alertEmail') };
}

function requireString(app: App, key: string): string {
  const value = app.node.tryGetContext(key);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Context "${key}" is required. Pass -c ${key}=<value>`);
  }
  return value;
}

export interface EnvConfig {
  taskCpu: number;
  taskMemoryMiB: number;
  desiredCount: number;
  dbMinAcu: number;
  dbMaxAcu: number;
  dbAutoPauseMinutes: number;
  budgetUsd: number;
  labelVisible: boolean;
  dbRemovalPolicy: RemovalPolicy;
  dbDeletionProtection: boolean;
  logRetention: RetentionDays;
}

/** The only differences between dev and prod are declared here (FR-002: same topology). */
export function envConfig(name: EnvName): EnvConfig {
  const prod = name === 'prod';
  return {
    taskCpu: 256,
    taskMemoryMiB: 512,
    desiredCount: 1,
    dbMinAcu: 0,
    dbMaxAcu: 1,
    dbAutoPauseMinutes: 10,
    budgetUsd: 60,
    labelVisible: !prod,
    dbRemovalPolicy: prod ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
    dbDeletionProtection: prod,
    logRetention: RetentionDays.ONE_MONTH,
  };
}
