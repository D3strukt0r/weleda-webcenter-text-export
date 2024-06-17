#!/bin/bash
set -e -u -o pipefail

pnpm config set store-dir /var/cache/pnpm
pnpm install || true
