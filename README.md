# Weleda Web Center XML to Text Converter

Converts a GS1 `artwork_content:artworkContentMessage` XML (the format
exported from Esko Web Center) into a readable plain-text leaflet — the
kind that's easy to paste into Word for layouting. Everything runs locally
in the browser; no file ever leaves the machine.

Three ways to load an XML:

- **Drop it anywhere on the page** — the whole window is a drop target.
- **Click the dropzone** — opens a regular file picker.
- **Ctrl/Cmd+V** — paste either the *file* (copied with Ctrl+C in your
  file explorer) or the *raw XML text* directly.

[![License](https://img.shields.io/github/license/D3strukt0r/weleda-webcenter-text-export?label=License)](LICENSE.txt)
[![Docker Stars](https://img.shields.io/docker/stars/d3strukt0r/weleda-webcenter-text-export.svg?label=docker%20stars)][docker]
[![Docker Pulls](https://img.shields.io/docker/pulls/d3strukt0r/weleda-webcenter-text-export.svg?label=docker%20pulls)][docker]

[![CI](https://github.com/D3strukt0r/weleda-webcenter-text-export/actions/workflows/ci.yml/badge.svg?branch=master)][gh-action]
[![Pages](https://github.com/D3strukt0r/weleda-webcenter-text-export/actions/workflows/deploy-gh-pages.yml/badge.svg?branch=master)][gh-action]
[![Docker](https://github.com/D3strukt0r/weleda-webcenter-text-export/actions/workflows/docker.yml/badge.svg?branch=master)][gh-action]

## Stack

- [React Router v7](https://reactrouter.com/) (framework mode), React 19,
  TypeScript
- [Vite](https://vitejs.dev/) build, [Vitest](https://vitest.dev/) tests
- [Tailwind CSS v4](https://tailwindcss.com/) + [Sass](https://sass-lang.com/)
  (`api: modern-compiler`)
- [i18next](https://www.i18next.com/) — UI strings live in
  [`app/locales/de.yml`](app/locales/de.yml)
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser)
  — pure JS, runs in browser + Node, deterministic for tests
- [pnpm](https://pnpm.io/) (`packageManager` pinned)
- Dual-mode build: SSR for Docker, static (SPA) for GitHub Pages

## Getting started

### On the host (no Docker)

```shell
pnpm install
pnpm dev          # http://localhost:5173
```

### In a devcontainer (Docker outside of Docker)

VS Code → **Reopen in Container** (`.devcontainer/devcontainer.json` ships
Node 24, `act`, the DooD feature). Once it's up:

```shell
pnpm dev                  # Vite inside the devcontainer
# or
docker compose up dev     # Vite in a sibling container, host workspace
                          # bind-mounted via $LOCAL_WORKSPACE_FOLDER
```

### In a Vagrant VM (full HTTPS stack on a `.test` hostname)

Requires VirtualBox + Vagrant + [`mkcert`](https://github.com/FiloSottile/mkcert)
on the host (the Vagrantfile asks `mkcert` to mint local certs on first
boot).

```shell
vagrant up        # provisions Debian 12, Docker, brings up Traefik + dev
# app reachable at https://weleda-webcenter-text-export.test
# Traefik dashboard at https://traefik.weleda-webcenter-text-export.test
```

`compose.vm.yml.dist` is the template; it's copied to `compose.vm.yml`
inside the VM (gitignored). Switch between dev and prod with the compose
profiles:

```shell
docker compose -f compose.vm.yml --profile dev up    # Vite
docker compose -f compose.vm.yml --profile prod up   # SSR runtime
```

## Scripts

```shell
pnpm dev          # dev server with HMR
pnpm build        # production build (SSR by default — outputs build/client + build/server)
SSR=false pnpm build   # static / SPA build (build/client only)
pnpm preview      # preview the static build locally
pnpm typecheck    # react-router typegen + tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest run
pnpm test:watch   # vitest watch
```

## Build modes

`react-router.config.ts` toggles SSR via the `SSR` env var:

- **Docker / Node hosting (default):** `pnpm build` → SSR bundle, served
  by `react-router-serve` on port 3000.
- **GitHub Pages (no Node runtime):** `SSR=false pnpm build` → static SPA
  in `build/client/`. The
  [`deploy-gh-pages.yml`](.github/workflows/deploy-gh-pages.yml) workflow
  uploads that folder via `actions/deploy-pages`.

## Docker

```shell
docker build -t weleda-webcenter-text-export .
docker run --rm -p 3000:3000 weleda-webcenter-text-export
```

For local development inside Docker:

```shell
docker compose up dev    # http://localhost:5173
```

CI publishes signed multi-arch images to Docker Hub via
[`docker.yml`](.github/workflows/docker.yml) (cosign + Buildx, linux/amd64
and linux/arm64).

## XML conversion

The converter walks every `<textContent>` subtree and emits one paragraph
per `<p>` or `<li>`. `<b>`, `<i>` etc. bubble through; `<br/>` becomes a
soft line break inside the same paragraph. The GS1 standard business
document header and other metadata are ignored — the output reads like a
patient information leaflet, not an XML dump.

The full behaviour is locked down by a fixture-based Vitest spec at
[`app/lib/xml-to-text/convert.test.ts`](app/lib/xml-to-text/convert.test.ts)
plus [`__fixtures__/sample.xml`](app/lib/xml-to-text/__fixtures__/sample.xml)
+ [`expected.txt`](app/lib/xml-to-text/__fixtures__/expected.txt).

## Project layout

```
app/
  components/      # Topbar, Lede, Dropzone, DragOverlay, Result, Toast, AppFooter
  hooks/           # useConverter, usePageDragDrop, usePasteXml, useToast
  lib/
    xml-to-text/   # convert.ts + tests + fixtures
    format.ts      # size / number formatters, regex escape
  locales/de.yml   # all UI strings
  routes/          # home.tsx, not-found.tsx
  styles/          # main.scss (design tokens), tailwind.css
  i18n.ts          # i18next bootstrap
  root.tsx
  routes.ts        # manifest
public/            # served from /, includes Weleda logo + robots.txt
```

## Versioning

[SemVer](https://semver.org/). See the
[tags](https://github.com/D3strukt0r/weleda-webcenter-text-export/tags).

## License

[MIT](LICENSE.txt).

[docker]: https://hub.docker.com/r/d3strukt0r/weleda-webcenter-text-export
[gh-action]: https://github.com/D3strukt0r/weleda-webcenter-text-export/actions
