import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface GithubCiStackProps extends cdk.StackProps {
  deployEnv: 'sandbox' | 'prod';
  /** ARN of the GitHub OIDC provider in this account. */
  githubOidcProviderArn: string;
  /** ARN of the CodeArtifactCargoRead-{env} managed policy. */
  cargoReadPolicyArn: string;
}

export class GithubCiStack extends cdk.Stack {
  /** Role ARN to paste into pish ci.yml. */
  public readonly pishCiRoleArn: string;

  constructor(scope: Construct, id: string, props: GithubCiStackProps) {
    super(scope, id, props);

    const { deployEnv, githubOidcProviderArn, cargoReadPolicyArn } = props;

    const githubOidc = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this, 'GithubOidc', githubOidcProviderArn,
    );

    const pishCiRole = new iam.Role(this, 'PishCiRole', {
      roleName: `pish-github-ci-${deployEnv}`,
      assumedBy: new iam.WebIdentityPrincipal(
        githubOidc.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': 'repo:nakomis/pish:*',
          },
        },
      ),
      description: `Assumed by pish GitHub Actions CI to pull from CodeArtifact (${deployEnv})`,
    });

    pishCiRole.addManagedPolicy(
      iam.ManagedPolicy.fromManagedPolicyArn(this, 'CargoReadPolicy', cargoReadPolicyArn),
    );

    this.pishCiRoleArn = pishCiRole.roleArn;

    new cdk.CfnOutput(this, 'PishCiRoleArn', {
      value: pishCiRole.roleArn,
      description: `IAM role for pish GitHub Actions CI (${deployEnv}) — paste into pish ci.yml`,
    });
  }
}
