import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodeArtifactStack } from '../lib/codeartifact-stack';

function makeStack(deployEnv: 'sandbox' | 'prod') {
  const app = new cdk.App();
  return new CodeArtifactStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'eu-west-2' },
    deployEnv,
  });
}

describe('CodeArtifactStack (sandbox)', () => {
  const template = Template.fromStack(makeStack('sandbox'));

  test('creates a CodeArtifact domain named nakomis-sandbox', () => {
    template.hasResourceProperties('AWS::CodeArtifact::Domain', {
      DomainName: 'nakomis-sandbox',
    });
  });

  test('creates a private cargo repository', () => {
    template.hasResourceProperties('AWS::CodeArtifact::Repository', {
      RepositoryName: 'cargo',
      DomainName: 'nakomis-sandbox',
    });
  });

  test('creates a crates-io proxy repository', () => {
    template.hasResourceProperties('AWS::CodeArtifact::Repository', {
      RepositoryName: 'crates-io-proxy',
      ExternalConnections: ['public:crates-io'],
    });
  });

  test('cargo repo uses crates-io-proxy as upstream', () => {
    template.hasResourceProperties('AWS::CodeArtifact::Repository', {
      RepositoryName: 'cargo',
      Upstreams: ['crates-io-proxy'],
    });
  });

  test('creates read and publish managed policies', () => {
    template.resourceCountIs('AWS::IAM::ManagedPolicy', 2);
  });

  test('outputs domain name and repo name', () => {
    template.hasOutput('DomainName', {});
    template.hasOutput('CargoRepoName', {});
  });
});

describe('CodeArtifactStack (prod)', () => {
  const template = Template.fromStack(makeStack('prod'));

  test('creates a CodeArtifact domain named nakomis (no suffix)', () => {
    template.hasResourceProperties('AWS::CodeArtifact::Domain', {
      DomainName: 'nakomis',
    });
  });

  test('managed policies are suffixed with prod', () => {
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: 'CodeArtifactCargoRead-prod',
    });
    template.hasResourceProperties('AWS::IAM::ManagedPolicy', {
      ManagedPolicyName: 'CodeArtifactCargoPublish-prod',
    });
  });
});
