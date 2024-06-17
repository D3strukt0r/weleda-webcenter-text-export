# -----------------------------------------------------------------------------
# Improved node image with all my extra needs & unprivileged user
# https://github.com/nodejs/docker-node/blob/main/22/bookworm/Dockerfile
# https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md
# https://github.com/krallin/tini
# -----------------------------------------------------------------------------
FROM node:22-bookworm AS node

# Switch shell to bash for better support
SHELL ["/bin/bash", "-e", "-u", "-x", "-o", "pipefail", "-c"]

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
    # Install additional packages (curl, wget, git, gnupg already installed)
    && apt-get -qq install \
        bash-completion \
        ncdu \
        vim \
        neovim \
        nano \
        htop \
        # For init system
        tini

RUN \
    # Use Node.js corepack to enable pnpm
    corepack enable \
    \
    # Smoke tests
    && node --version \
    && pnpm --version \
    \
    # Change pnpm store dir to be outside /usr/local/src/app (currently defaults to /usr/local/src/app/.pnpm-store) (https://pnpm.io/configuring)
    && pnpm config set store-dir /var/cache/pnpm \
    \
    # Uncomment bash auto completion
    && sed -i '35,41 s/^#//' /etc/bash.bashrc \
    \
    && { \
        # Add custom PS1
        # https://strasis.com/documentation/limelight-xe/reference/ecma-48-sgr-codes
        echo 'export PS1="🐳 ${debian_chroot:+($debian_chroot)}\[\e[38;5;46m\]\u@\h\[\e[0m\]:\[\e[38;5;33m\]\w\[\e[0m\]\\$ "'; \
    } >>/etc/bash.bashrc \
    \
    # Change UID/GID of node user to 999
    && groupmod -g 999 node  \
    && usermod -u 999 -g 999 node

# Run as unprivileged user
USER node

WORKDIR /usr/local/src/app

# Required for Traefik to automatically pick up the service
EXPOSE 80

ENTRYPOINT ["tini", "--", "docker-entrypoint.sh"]

# -----------------------------------------------------------------------------
# Improved nginx image with all my extra needs & unprivileged user
# https://github.com/nginxinc/docker-nginx-unprivileged/blob/main/mainline/debian/Dockerfile
# https://github.com/krallin/tini
# -----------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-bookworm AS nginx

USER root

# Switch shell to bash for better support
SHELL ["/bin/bash", "-e", "-u", "-x", "-o", "pipefail", "-c"]

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
    # Install additional packages (curl already installed)
    && apt-get -qq install \
        bash-completion \
        ncdu \
        wget \
        vim \
        neovim \
        nano \
        htop \
        # For init system
        tini
# TODO: Figure out how to add brotli support

RUN \
    # Smoke tests
    nginx -v \
    \
    # Uncomment bash auto completion
    && sed -i '35,41 s/^#//' /etc/bash.bashrc \
    \
    && { \
        # Add custom PS1
        # https://strasis.com/documentation/limelight-xe/reference/ecma-48-sgr-codes
        echo 'export PS1="🐳 ${debian_chroot:+($debian_chroot)}\[\e[38;5;46m\]\u@\h\[\e[0m\]:\[\e[38;5;33m\]\w\[\e[0m\]\\$ "'; \
    } >>/etc/bash.bashrc \
    \
    # Move shell files to bin \
    && mv /docker-entrypoint.sh /usr/local/bin/ \
    \
    # Create app dir
    && mkdir --parents /usr/local/src/app

ENV NGINX_CLIENT_MAX_BODY_SIZE=100M

WORKDIR /usr/local/src/app

USER nginx

ENTRYPOINT ["tini", "--", "docker-entrypoint.sh"]
# Has to be redefined because of the ENTRYPOINT
CMD ["nginx", "-g", "daemon off;"]

# -----------------------------------------------------------------------------
# Dev environment with HMR server (only has HTTPS server)
# -----------------------------------------------------------------------------
FROM node AS dev

CMD ["pnpm", "run", "dev"]

# -----------------------------------------------------------------------------
# Prod build (Build is done in separate stage)
# -----------------------------------------------------------------------------
# Keep prod dependencies in prod environemnt
FROM node AS prod-deps
COPY pwa/package.json pwa/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --prod --frozen-lockfile

# Build PWA application
FROM node AS build
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
FROM nginx AS prod
USER root
COPY --from=prod-deps /usr/local/src/app .
COPY --from=build /usr/local/src/app .
COPY pwa .
COPY pwa/.docker/rootfs-prod /
RUN \
    # Fix permission for nginx files \
    chown -R nginx:root /etc/nginx \
    # Clean up after copying files to /usr/local/src/app
    && rm -rf \
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
USER nginx
