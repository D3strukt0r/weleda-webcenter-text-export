# -----------------------------------------------------------------------------
# Base image with common dependencies for prod & dev and node installation
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS base

# Switch shell to bash for better support
SHELL ["/bin/bash", "-e", "-u", "-x", "-o", "pipefail", "-c"]

ARG NODE_VERSION=20
# Fix apt warning "TERM is not set" (https://stackoverflow.com/a/35976127/4156752)
ARG DEBIAN_FRONTEND=noninteractive

# Download and cache apt packages
RUN rm -f /etc/apt/apt.conf.d/docker-clean \
    && echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' >/etc/apt/apt.conf.d/keep-cache
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    # Update system first
    apt-get update -qq \
    && apt-get dist-upgrade -qq >/dev/null \
    \
    # apt-utils to fix "debconf: delaying package configuration, since apt-utils is not installed" but also needs "DEBIAN_FRONTEND=noninteractive"
    && apt-get -qq install \
        apt-utils >/dev/null \
    \
    # Install additional packages
    && apt-get -qq install \
        bash-completion \
        openssl \
        ca-certificates \
        curl \
        gnupg \
        wget \
        git \
        ncdu \
        vim \
        neovim \
        nano \
        # To run multiple processes simultaneously
        supervisor \
        # For the envsubst command
        gettext-base \
        # For the wait-for.sh which uses nc to check for server
        netcat-traditional \
        # For the 'top' command
        procps \
        # For the dig command
        dnsutils >/dev/null \
    \
    # Install Node.js
    && mkdir --parents /etc/apt/keyrings \
    && curl --fail --silent --show-error --location https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_VERSION.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update -qq \
    && apt-get -qq install \
        nodejs >/dev/null \
    \
    # Install Nginx
    && apt-get -qq install \
        nginx \
        brotli

RUN \
    # Use Node.js corepack to enable pnpm
    corepack enable \
    \
    # Smoke tests
    && node --version \
    && pnpm --version \
    && nginx -v \
    \
    # Change pnpm store dir to be outside /usr/local/src/app (currently defaults to /usr/local/src/app/.pnpm-store) (https://pnpm.io/configuring)
    && pnpm config set store-dir /var/cache/pnpm \
    \
    && { \
        # Add custom PS1
        # https://strasis.com/documentation/limelight-xe/reference/ecma-48-sgr-codes
        echo 'export PS1="🐳 ${debian_chroot:+($debian_chroot)}\[\e[38;5;46m\]\u@\h\[\e[0m\]:\[\e[38;5;33m\]\w\[\e[0m\]\\$ "'; \
        # Add bash auto completion
        echo 'source /etc/profile.d/bash_completion.sh'; \
    } >>"$HOME/.bashrc" \
    \
    # Create non-root user/group (1000:1000) for app
    && useradd --create-home --shell /bin/bash app \
    && mkdir --parents /usr/local/src/app \
    && { \
        # Same as above (except bash completion, because it's already in the bashrc)
        echo 'export PS1="🐳 ${debian_chroot:+($debian_chroot)}\[\e[38;5;46m\]\u@\h\[\e[0m\]:\[\e[38;5;33m\]\w\[\e[0m\]\\$ "'; \
    } >>/home/app/.bashrc \
    \
    # Forward request and error logs to docker log collector
    && ln --symbolic --force /dev/stdout /var/log/nginx/access.log \
    && ln --symbolic --force /dev/stderr /var/log/nginx/error.log \
    # Fix nginx package doesn't use file endings for sites
    && mv /etc/nginx/sites-available/default /etc/nginx/sites-available/default.conf \
    && rm /etc/nginx/sites-enabled/default \
    && ln --symbolic --force ../sites-available/default.conf /etc/nginx/sites-enabled/default.conf

COPY pwa/.docker/rootfs /

WORKDIR /usr/local/src/app

EXPOSE 80

#HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD curl --fail http://127.0.0.1 || exit 1

# Start supervisor (http://supervisord.org) as root
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/supervisord.conf"]

# -----------------------------------------------------------------------------
# Dev environment with HMR server (only has HTTPS server)
# -----------------------------------------------------------------------------
FROM base AS dev

# -----------------------------------------------------------------------------
# Prod build (Build is done in separate stage)
# -----------------------------------------------------------------------------
# Keep prod dependencies in prod environemnt
FROM base AS prod-deps
COPY pwa/package.json pwa/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --prod --frozen-lockfile

# Build PWA application
FROM base AS build
COPY pwa/package.json pwa/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --frozen-lockfile
COPY pwa/.browserslistrc \
     pwa/index.html \
     pwa/postcss.config.js \
     pwa/tailwind.config.ts \
     pwa/tsconfig.json \
     pwa/tsconfig.node.json \
     pwa/vite.config.ts \
     ./
COPY pwa/public public
COPY pwa/src src
RUN pnpm run build

# Prod build
FROM base AS prod
COPY --from=prod-deps /usr/local/src/app .
COPY --from=build /usr/local/src/app .
COPY pwa .
RUN \
    # Clean up after copying files to /usr/local/src/app
    rm -rf \
        .docker \
        public \
        src \
    && rm -f \
        .browserslistrc \
        .eslintrc.cjs \
        .gitignore \
        index.html \
        postcss.config.js \
        README.md \
        tailwind.config.ts \
        tsconfig.json \
        tsconfig.node.json \
        vite.config.ts
