#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CodeArtifactError } from '../lib/codeartifact-error';
import { CodeArtifactStack } from '../lib/codeartifact-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { ProxyStack } from '../lib/proxy-stack';

const londonEnv = { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION } };
const nvirginiaEnv = { env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' } };

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

const isProd = deployEnv === 'prod';
const rootDomain = isProd ? 'nakomis.com' : 'sandbox.nakomis.com';
const artifactsDomain = `artifacts.${rootDomain}`;

const app = new cdk.App();

const codeArtifactStack = new CodeArtifactStack(app, 'CodeArtifactStack', {
  ...londonEnv,
  deployEnv,
  description: `CodeArtifact domain and Cargo repository (${deployEnv})`,
});

const certificateStack = new CertificateStack(app, 'CodeArtifactCertificateStack', {
  ...nvirginiaEnv,
  deployEnv,
  domainName: artifactsDomain,
  rootDomain,
  description: `ACM certificate for ${artifactsDomain} (must be in us-east-1 for CloudFront)`,
  crossRegionReferences: true,
});

new ProxyStack(app, 'CodeArtifactProxyStack', {
  ...londonEnv,
  deployEnv,
  certificate: certificateStack.certificate,
  domainName: artifactsDomain,
  rootDomain,
  codeArtifactHost: codeArtifactStack.domainHost,
  description: `CloudFront proxy for ${artifactsDomain} → CodeArtifact (${deployEnv})`,
  crossRegionReferences: true,
});
