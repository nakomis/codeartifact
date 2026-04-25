#!/bin/bash
# Reference functions for working with the nakomis CodeArtifact Cargo registry.
#
# Copy this file into your project and adapt as needed — do not source it
# from this repo directly (paths break in CI).
#
# Your project's .cargo/config.toml must contain:
#
#   [registries.nakomis_codeartifact]
#   index = "sparse+https://artifacts.sandbox.nakomis.com/cargo/cargo/"
#   credential-provider = "cargo:token-from-stdout aws codeartifact get-authorization-token --domain nakomis-sandbox --domain-owner 975050268859 --region eu-west-2 --query authorizationToken --output text"
#
# Registry name MUST use underscore (nakomis_codeartifact) — Cargo derives
# the registry name from CARGO_REGISTRIES_NAKOMIS_CODEARTIFACT_* env vars by
# uppercasing and replacing hyphens with underscores.
#
# With token-from-stdout, Cargo calls the AWS CLI automatically and no manual
# token management is needed for local dev or CI (as long as AWS credentials
# are configured).
#
# Usage in your project's scripts:
#   cargo publish -p <package> --registry nakomis_codeartifact
#   # or use cargo_publish below for a prod/sandbox wrapper
#
# For CI: configure AWS credentials via OIDC (aws-actions/configure-aws-credentials)
# then run cargo commands directly — no separate auth step needed.

_codeartifact_env() {
  local env="${1:-sandbox}"
  case "$env" in
    prod)    echo "nakom.is nakomis 637423226886 eu-west-2 https://artifacts.nakomis.com/cargo/cargo/" ;;
    sandbox) echo "nakom.is-sandbox nakomis-sandbox 975050268859 eu-west-2 https://artifacts.sandbox.nakomis.com/cargo/cargo/" ;;
    *)
      echo "Unknown environment: '$env'. Use 'sandbox' (default) or 'prod'." >&2
      return 1
      ;;
  esac
}

# Publish a crate to the given environment.
# Uses cargo:token-from-stdout; no manual token step needed.
cargo_publish() {
  local package="${1:?Usage: cargo_publish <package> [prod]}"
  local env="${2:-sandbox}"
  local profile domain owner region index
  read -r profile domain owner region index <<< "$(_codeartifact_env "$env")" || return 1

  local cred_provider="cargo:token-from-stdout AWS_PROFILE=${profile} aws codeartifact get-authorization-token --domain ${domain} --domain-owner ${owner} --region ${region} --query authorizationToken --output text"

  echo "==> Publishing ${package} to nakomis_codeartifact (${env})..." >&2
  cargo publish -p "$package" --registry nakomis_codeartifact \
    --config "registries.nakomis_codeartifact.index='${index}'" \
    --config "registries.nakomis_codeartifact.credential-provider='${cred_provider}'"
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file rather than running it directly:" >&2
  echo "  source ${0}" >&2
  exit 1
fi
