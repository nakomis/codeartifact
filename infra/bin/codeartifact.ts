#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CodeArtifactError } from '../lib/codeartifact-error';
import { CodeArtifactStack } from '../lib/codeartifact-stack';

const londonEnv = { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } };

const npmEnvironment = process.env.NPM_ENVIRONMENT;
if (npmEnvironment) {
  console.log('Deploying to ' + npmEnvironment);
} else {
  throw new CodeArtifactError({
    name: 'ENV_NOT_SET_ERROR',
    message: 'Please use `npm run deploy-prod` or `npm run deploy-sandbox` (or ./scripts/deploy [prod])',
  });
}

if (npmEnvironment !== 'sandbox' && npmEnvironment !== 'prod') {
  throw new CodeArtifactError({
    name: 'ENV_UNKNOWN_ERROR',
    message: `Unknown NPM_ENVIRONMENT "${npmEnvironment}". Must be "sandbox" or "prod"`,
  });
}

const deployEnv = npmEnvironment as 'sandbox' | 'prod';

const app = new cdk.App();

new CodeArtifactStack(app, 'CodeArtifactStack', {
  ...londonEnv,
  deployEnv,
  description: `CodeArtifact domain and Cargo registry (${deployEnv})`,
});
