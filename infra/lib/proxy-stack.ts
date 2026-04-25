import * as cdk from 'aws-cdk-lib';
import * as cf from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';

export interface ProxyStackProps extends cdk.StackProps {
  deployEnv: 'sandbox' | 'prod';
  /** ACM certificate (must be in us-east-1). */
  certificate: cm.Certificate;
  /** e.g. artifacts.nakomis.com */
  domainName: string;
  /** e.g. nakomis.com or sandbox.nakomis.com — used for hosted-zone lookup. */
  rootDomain: string;
  /**
   * The CodeArtifact HTTPS endpoint hostname, e.g.
   * nakomis-123456789012.d.codeartifact.eu-west-2.amazonaws.com
   */
  codeArtifactHost: string;
  /** Path prefix on the CodeArtifact origin, e.g. /cargo/cargo/ */
  originPath: string;
}

export class ProxyStack extends cdk.Stack {
  readonly distribution: cf.Distribution;

  constructor(scope: Construct, id: string, props: ProxyStackProps) {
    super(scope, id, props);

    const distribution = new cf.Distribution(this, 'Distribution', {
      comment: `CodeArtifact Cargo registry proxy (${props.domainName})`,
      domainNames: [props.domainName],
      certificate: props.certificate,
      defaultBehavior: {
        origin: new origins.HttpOrigin(props.codeArtifactHost, {
          originPath: props.originPath,
          protocolPolicy: cf.OriginProtocolPolicy.HTTPS_ONLY,
        }),
        // Never cache — CodeArtifact manages its own caching and responses
        // are gated by the caller's auth token.
        cachePolicy: cf.CachePolicy.CACHING_DISABLED,
        // Forward Authorization so Cargo bearer tokens reach CodeArtifact.
        originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        allowedMethods: cf.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.HTTPS_ONLY,
      },
    });

    this.distribution = distribution;

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZoneLookup', {
      domainName: props.rootDomain,
    });

    new route53.ARecord(this, 'AliasA', {
      recordName: props.domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    new route53.AaaaRecord(this, 'AliasAAAA', {
      recordName: props.domainName,
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });
  }
}
