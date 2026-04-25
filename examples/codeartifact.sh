#!/bin/bash
# Reference functions for working with the nakomis CodeArtifact Cargo registry.
#
# Copy this file into your project and adapt as needed — do not source it
# from this repo directly (paths break in CI).
#
# Your project's .cargo/config.toml must also contain:
#
#   [registries.nakomis_codeartifact]
#   index = "sparse+https://artifacts.sandbox.nakomis.com/cargo/cargo/"
#   credential-provider = "cargo:token"
#
# Both keys must be present — Cargo 1.74+ won't associate the credential-provider
# with a registry that has no index in config.toml (env-var-only index is not enough).
# The registry name MUST use underscore (nakomis_codeartifact) to match what Cargo
# derives from the CARGO_REGISTRIES_NAKOMIS_CODEARTIFACT_* env vars (hyphens → underscores).
# The sandbox URL is a sensible default; cargo_authenticate overrides it at runtime.
#
# Usage in your project's scripts:
#   source ./scripts/codeartifact.sh
#   cargo_authenticate [prod]
#   cargo_publish <package> [prod]
#
# Or inline in a CI step:
#   TOKEN=$(codeartifact_token sandbox)
#   export CARGO_REGISTRIES_NAKOMIS_CODEARTIFACT_INDEX="sparse+https://artifacts.sandbox.nakomis.com/cargo/cargo/"
#   export CARGO_REGISTRIES_NAKOMIS_CODEARTIFACT_TOKEN="Bearer ${TOKEN}"

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

# Echo a raw bearer token (no "Bearer " prefix).
codeartifact_token() {
  local profile domain owner region index
  read -r profile domain owner region index <<< "$(_codeartifact_env "${1:-sandbox}")" || return 1
  AWS_PROFILE="$profile" aws codeartifact get-authorization-token \
    --domain "$domain" \
    --domain-owner "$owner" \
    --region "$region" \
    --query authorizationToken \
    --output text
}

# Export CARGO_REGISTRIES_NAKOMIS_CODEARTIFACT_{INDEX,TOKEN} for the current shell.
# Nothing is written to disk.
cargo_authenticate() {
  local env="${1:-sandbox}"
  local profile domain owner region index token
  read -r profile domain owner region index <<< "$(_codeartifact_env "$env")" || return 1
  token=$(AWS_PROFILE="$profile" aws codeartifact get-authorization-token \
    --domain "$domain" --domain-owner "$owner" --region "$region" \
    --query authorizationToken --output text) || return 1
  export CARGO_REGISTRIES_NAKOMIS_CODEARTIFACT_INDEX="$index"
  export CARGO_REGISTRIES_NAKOMIS_CODEARTIFACT_TOKEN="Bearer ${token}"
  echo "==> Authenticated to nakomis_codeartifact (${env}). Token valid for 12 hours." >&2
}

# Authenticate then publish a crate.
cargo_publish() {
  local package="${1:?Usage: cargo_publish <package> [prod]}"
  local env="${2:-sandbox}"
  cargo_authenticate "$env" || return 1
  cargo publish -p "$package" --registry nakomis_codeartifact
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file rather than running it directly:" >&2
  echo "  source ${0}" >&2
  exit 1
fi
