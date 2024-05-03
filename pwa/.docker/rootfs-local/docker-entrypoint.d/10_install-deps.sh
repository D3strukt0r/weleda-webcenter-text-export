#!/bin/bash
set -e -u -o pipefail

# HOME is required to avoid "EACCES: permission denied, mkdir '/root/.cache/node/corepack"
su --preserve-environment \
   --command 'HOME=/home/app && pnpm config set store-dir /var/cache/pnpm && pnpm install || true' \
   app
