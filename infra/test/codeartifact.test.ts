import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { CodeArtifactStack } from '../lib/codeartifact-stack';
import { CertificateStack } from '../lib/certificate-stack';
import { ProxyStack } from '../lib/proxy-stack';
import * as cm from 'aws-cdk-lib/aws-certificatemanager';

function makeCodeArtifactStack(deployEnv: 'sandbox' | 'prod') {
  const app = new cdk.App();
  return new CodeArtifactStack(app, 'TestStack', {
    env: { account: '123456789012', region: 'eu-west-2' },
    deployEnv,
  });
}

function makeProxyStack(deployEnv: 'sandbox' | 'prod') {
  const app = new cdk.App();
  const certStack = new CertificateStack(app, 'CertStack', {
    env: { account: '123456789012', region: 'us-east-1' },
    deployEnv,
    domainName: deployEnv === 'prod' ? 'artifacts.nakomis.com' : 'artifacts.sandbox.nakomis.com',
    rootDomain: deployEnv === 'prod' ? 'nakomis.com' : 'sandbox.nakomis.com',
  });
  return new ProxyStack(app, 'ProxyStack', {
    env: { account: '123456789012', region: 'eu-west-2' },
    deployEnv,
    certificate: certStack.certificate,
    domainName: deployEnv === 'prod' ? 'artifacts.nakomis.com' : 'artifacts.sandbox.nakomis.com',
    rootDomain: deployEnv === 'prod' ? 'nakomis.com' : 'sandbox.nakomis.com',
    codeArtifactHost: 'nakomis-sandbox-123456789012.d.codeartifact.eu-west-2.amazonaws.com',
    originPath: '/cargo/cargo/',
    crossRegionReferences: true,
  });
}

describe('CodeArtifactStack (sandbox)', () => {
  const template = Template.fromStack(makeCodeArtifactStack('sandbox'));

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
  const template = Template.fromStack(makeCodeArtifactStack('prod'));

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

describe('CertificateStack (sandbox)', () => {
  const app = new cdk.App();
  const stack = new CertificateStack(app, 'CertStack', {
    env: { account: '123456789012', region: 'us-east-1' },
    deployEnv: 'sandbox',
    domainName: 'artifacts.sandbox.nakomis.com',
    rootDomain: 'sandbox.nakomis.com',
  });
  const template = Template.fromStack(stack);

  test('creates an ACM certificate for the artifacts domain', () => {
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: 'artifacts.sandbox.nakomis.com',
    });
  });
});

describe('ProxyStack (sandbox)', () => {
  const template = Template.fromStack(makeProxyStack('sandbox'));

  test('creates a CloudFront distribution', () => {
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('distribution uses HTTPS-only viewer protocol', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultCacheBehavior: {
          ViewerProtocolPolicy: 'https-only',
        },
      },
    });
  });

  test('creates A and AAAA Route53 alias records', () => {
    template.resourceCountIs('AWS::Route53::RecordSet', 2);
  });
});
