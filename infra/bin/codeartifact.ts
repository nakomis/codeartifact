#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import * as fs from 'fs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { CodeArtifactError } from '../lib/codeartifact-error';
import { CodeArtifactStack } from '../lib/codeartifact-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { ProxyStack } from '../lib/proxy-stack';
import { GithubCiStack } from '../lib/github-ci-stack';

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

// GitHub OIDC provider ARN — one per account; prod already exists, sandbox is created by sandboxsite.
const sandboxAccountId = '975050268859';
const prodAccountId = '637423226886';
const accountId = isProd ? prodAccountId : sandboxAccountId;
const githubOidcProviderArn = `arn:aws:iam::${accountId}:oidc-provider/token.actions.githubusercontent.com`;

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

new GithubCiStack(app, 'CodeArtifactGithubCiStack', {
  ...londonEnv,
  deployEnv,
  githubOidcProviderArn,
  roles: [
    {
      repo: 'nakomis/pish',
      policyArns: [codeArtifactStack.cargoReadPolicyArn],
      description: `Assumed by pish GitHub Actions CI to pull from CodeArtifact (${deployEnv})`,
    },
    {
      repo: 'nakomis/codeartifact',
      policyArns: [],
      description: `Assumed by codeartifact GitHub Actions CI to synth and deploy (${deployEnv})`,
      inlinePolicies: {
        CdkDeploy: new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            actions: ['sts:AssumeRole'],
            resources: [`arn:aws:iam::${accountId}:role/cdk-hnb659fds-*`],
          })],
        }),
      },
    },
  ],
  description: `GitHub Actions OIDC roles for CodeArtifact access (${deployEnv})`,
});

const { version: infraVersion } = JSON.parse(fs.readFileSync('./version.json', 'utf-8'));
cdk.Tags.of(app).add('MH-Project', 'codeartifact');
cdk.Tags.of(app).add('MH-Version', infraVersion);
