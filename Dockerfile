# syntax=docker/dockerfile:1.7

# ── Base image with Node.js and corepack (for pnpm) ──────
FROM node:24-slim AS base
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]
WORKDIR /app
RUN corepack enable

# ── Dev deps (incl. build tooling) ───────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Build (SSR bundle: build/client + build/server) ──────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# ── Production deps only ─────────────────────────────────
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ── Runtime (react-router-serve) ─────────────────────────
FROM node:24-slim AS runtime
SHELL ["/bin/bash", "-euxo", "pipefail", "-c"]
WORKDIR /app
ENV NODE_ENV=production PORT=3000

RUN <<EOT
    rm -f /etc/apt/apt.conf.d/docker-clean
    echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache
EOT

# Install wget (for HEALTHCHECK) and strip bundled npm; runtime uses
# react-router-serve directly.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked <<EOT
    apt-get update
    apt-get install -y --no-install-recommends wget
    rm -rf /usr/local/lib/node_modules/npm
    rm -f /usr/local/bin/npm /usr/local/bin/npx
EOT

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://localhost:3000/ || exit 1

CMD ["node_modules/.bin/react-router-serve", "./build/server/index.js"]
