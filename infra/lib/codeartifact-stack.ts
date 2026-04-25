import * as cdk from 'aws-cdk-lib';
import * as codeartifact from 'aws-cdk-lib/aws-codeartifact';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CodeArtifactStackProps extends cdk.StackProps {
  deployEnv: 'sandbox' | 'prod';
}

export class CodeArtifactStack extends cdk.Stack {
  /** ARN of the cargo repository — exported for use by CI stacks. */
  public readonly cargoRepoArn: string;
  /**
   * Raw CodeArtifact endpoint hostname — the CloudFront origin, NOT the public-facing
   * custom domain.  e.g. nakomis-sandbox-123456789012.d.codeartifact.eu-west-2.amazonaws.com
   * CodeArtifact doesn't support custom domains natively, so ProxyStack puts CloudFront
   * in front and exposes artifacts.{sandbox.}nakomis.com to clients instead.
   */
  public readonly domainHost: string;

  constructor(scope: Construct, id: string, props: CodeArtifactStackProps) {
    super(scope, id, props);

    const { deployEnv } = props;

    // One domain per environment so sandbox and prod are fully isolated.
    const domainName = deployEnv === 'prod' ? 'nakomis' : 'nakomis-sandbox';

    this.domainHost = `${domainName}-${this.account}.d.codeartifact.${this.region}.amazonaws.com`;

    const domain = new codeartifact.CfnDomain(this, 'CodeArtifactDomain', {
      domainName,
    });

    // Proxy upstream so `cargo add` can fetch public crates through this registry.
    const cratesIoProxy = new codeartifact.CfnRepository(this, 'CratesIoProxy', {
      repositoryName: 'crates-io-proxy',
      domainName: domain.domainName,
      domainOwner: this.account,
      externalConnections: ['public:crates-io'],
      description: 'Transparent proxy of crates.io',
    });
    cratesIoProxy.addDependency(domain);

    // Main private Cargo registry, with crates.io as an upstream fallback.
    const cargoRepo = new codeartifact.CfnRepository(this, 'CargoRepo', {
      repositoryName: 'cargo',
      domainName: domain.domainName,
      domainOwner: this.account,
      upstreams: [cratesIoProxy.repositoryName],
      description: `Private Cargo registry (${deployEnv})`,
    });
    cargoRepo.addDependency(cratesIoProxy);

    this.cargoRepoArn = cargoRepo.attrArn;

    // IAM managed policy — read access for CI and developer machines.
    const readPolicy = new iam.ManagedPolicy(this, 'CargoReadPolicy', {
      managedPolicyName: `CodeArtifactCargoRead-${deployEnv}`,
      description: `Read access to the ${deployEnv} Cargo CodeArtifact repository`,
      statements: [
        new iam.PolicyStatement({
          actions: [
            'codeartifact:GetAuthorizationToken',
            'codeartifact:GetRepositoryEndpoint',
            'codeartifact:ReadFromRepository',
          ],
          resources: [
            domain.attrArn,
            cargoRepo.attrArn,
            cratesIoProxy.attrArn,
          ],
        }),
        // GetAuthorizationToken also requires sts:GetServiceBearerToken
        new iam.PolicyStatement({
          actions: ['sts:GetServiceBearerToken'],
          resources: ['*'],
          conditions: {
            StringEquals: { 'sts:AWSServiceName': 'codeartifact.amazonaws.com' },
          },
        }),
      ],
    });

    // IAM managed policy — publish access for local developer use.
    const publishPolicy = new iam.ManagedPolicy(this, 'CargoPublishPolicy', {
      managedPolicyName: `CodeArtifactCargoPublish-${deployEnv}`,
      description: `Publish access to the ${deployEnv} Cargo CodeArtifact repository`,
      statements: [
        new iam.PolicyStatement({
          actions: [
            'codeartifact:GetAuthorizationToken',
            'codeartifact:GetRepositoryEndpoint',
            'codeartifact:PublishPackageVersion',
            'codeartifact:PutPackageMetadata',
            'codeartifact:ReadFromRepository',
          ],
          resources: [
            domain.attrArn,
            cargoRepo.attrArn,
          ],
        }),
        new iam.PolicyStatement({
          actions: ['sts:GetServiceBearerToken'],
          resources: ['*'],
          conditions: {
            StringEquals: { 'sts:AWSServiceName': 'codeartifact.amazonaws.com' },
          },
        }),
      ],
    });

    // Outputs — useful for configuring ~/.cargo/config.toml and CI.
    new cdk.CfnOutput(this, 'DomainName', { value: domain.domainName });
    new cdk.CfnOutput(this, 'CargoRepoName', { value: cargoRepo.repositoryName });
    new cdk.CfnOutput(this, 'CargoReadPolicyArn', { value: readPolicy.managedPolicyArn });
    new cdk.CfnOutput(this, 'CargoPublishPolicyArn', { value: publishPolicy.managedPolicyArn });
  }
}
