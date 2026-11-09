#!/usr/bin/env bash
# Authorizes one GitHub environment's deploy key (run as root):
#   deploy/server/add-deploy-key.sh <prod|stag> 'ssh-ed25519 AAAA... github-<env>'
# The key can only run omnicourse-deploy for that environment: no shell, no forwarding.
set -euo pipefail
env="${1:-}"; key="${2:-}"
[[ "$env" == prod || "$env" == stag ]] || { echo "usage: $0 prod|stag '<public key>'" >&2; exit 2; }
[[ "$key" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+( .*)?$ ]] || { echo "expected an ssh-ed25519 public key" >&2; exit 2; }
file=/home/omnicourse/.ssh/authorized_keys
touch "$file"
grep -v "omnicourse-deploy $env\"" "$file" >"$file.new" || true
echo "command=\"/usr/local/bin/omnicourse-deploy $env\",restrict $key" >>"$file.new"
mv "$file.new" "$file"
chown omnicourse:omnicourse "$file"; chmod 600 "$file"
echo "deploy key for $env installed"
