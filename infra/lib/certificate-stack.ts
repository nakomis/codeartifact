import * as cdk from 'aws-cdk-lib';
import * as cm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface CertificateStackProps extends cdk.StackProps {
  deployEnv: 'sandbox' | 'prod';
  domainName: string;
  rootDomain: string;
}

export class CertificateStack extends cdk.Stack {
  readonly certificate: cm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZoneLookup', {
      domainName: props.rootDomain,
    });

    this.certificate = new cm.Certificate(this, 'Certificate', {
      domainName: props.domainName,
      validation: cm.CertificateValidation.fromDns(hostedZone),
    });
  }
}
