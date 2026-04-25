# codeartifact

AWS CDK infrastructure for a private Cargo registry backed by AWS CodeArtifact, with a CloudFront proxy to expose it at a custom domain.

## Architecture

```
Cargo clients
     │
     ▼  HTTPS (bearer token)
artifacts.{sandbox.}nakomis.com   ← CloudFront distribution
     │
     ▼  HTTPS (forwarded Authorization header)
nakomis{-sandbox}-{account}.d.codeartifact.eu-west-2.amazonaws.com
     │
     ▼  upstream
public:crates-io
```

CodeArtifact doesn't support custom domains natively, so a CloudFront distribution proxies all requests — caching is disabled and the `Authorization` header is forwarded so Cargo bearer tokens reach CodeArtifact intact.

## Stacks

| Stack | Region | Purpose |
|-------|--------|---------|
| `CodeArtifactStack` | eu-west-2 | CodeArtifact domain, `cargo` repo, `crates-io-proxy` upstream, IAM managed policies |
| `CodeArtifactCertificateStack` | us-east-1 | ACM certificate for the custom domain (must be in us-east-1 for CloudFront) |
| `CodeArtifactProxyStack` | eu-west-2 | CloudFront distribution + Route53 A/AAAA alias records |

## Environments

| Environment | Domain | AWS Profile |
|-------------|--------|-------------|
| sandbox | `artifacts.sandbox.nakomis.com` | `nakom.is-sandbox` |
| prod | `artifacts.nakomis.com` | `nakom.is` |

## Deploying

```bash
# Deploy to sandbox (default)
./scripts/deploy

# Deploy to prod
./scripts/deploy prod
```

Requires an active AWS SSO session (`aws sso login --profile <profile>`).

## Configuring Cargo

Use the helper scripts in the `rotary-dial` repo to configure `~/.cargo/config.toml` and obtain a short-lived auth token:

```bash
# Sandbox
rotary-dial/scripts/configure-cargo.sh

# Prod
rotary-dial/scripts/configure-cargo.sh prod
```

## Support

If you find this useful, a small donation is very welcome:

[![Donate via PayPal](https://www.paypalobjects.com/en_GB/i/btn/btn_donate_LG.gif)](https://www.paypal.com/donate?hosted_button_id=Q3BESC73EWVNN&custom=codeartifact)
