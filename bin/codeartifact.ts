#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CodeArtifactStack } from '../lib/codeartifact-stack';

const deployEnv = process.env.DEPLOY_ENV;
if (!deployEnv) {
  throw new Error('DEPLOY_ENV must be set. Use ./scripts/deploy or ./scripts/deploy prod');
}
if (deployEnv !== 'sandbox' && deployEnv !== 'prod') {
  throw new Error(`Unknown DEPLOY_ENV "${deployEnv}". Must be "sandbox" or "prod"`);
}

const app = new cdk.App();

new CodeArtifactStack(app, 'CodeArtifactStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'eu-west-2',
  },
  deployEnv,
  description: `CodeArtifact domain and Cargo registry (${deployEnv})`,
});
