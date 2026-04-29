# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Copilot, Codex, …) working in this repository.

## Commands

```shell
pnpm install
pnpm dev                # http://localhost:5173, HMR
pnpm build              # SSR build → build/client + build/server
SSR=false pnpm build    # static / SPA build → build/client only
pnpm preview            # serve the static build locally
pnpm typecheck          # react-router typegen && tsc --noEmit
pnpm lint               # eslint
pnpm test               # vitest run
pnpm test:watch         # vitest in watch mode
```

Single test: `pnpm test app/lib/xml-to-text/convert.test.ts`
or `pnpm vitest run -t "preserves document order"` for one case by name.

Docker (SSR): `docker build -t weleda-webcenter-text-export . && docker run --rm -p 3000:3000 …`

## Local development paths

Three ways to run the app locally; all produce Vite on port 5173 (or the SSR runtime on 3000):

1. **Host** — `pnpm install && pnpm dev`. Plain Node, no Docker.
2. **Devcontainer (Docker outside of Docker)** — `.devcontainer/devcontainer.json` provisions Node 24, the DooD feature (`moby: false`), `act`, common-utils. Open in VS Code → "Reopen in Container", then either:
   - `pnpm dev` directly inside the devcontainer, or
   - `docker compose up dev` to spin up a sibling Vite container. This works because the devcontainer exports `LOCAL_WORKSPACE_FOLDER=${localWorkspaceFolder}` via `remoteEnv`, and `compose.yml`'s bind mount uses `"${LOCAL_WORKSPACE_FOLDER:-.}:/app"` so the host docker daemon sees a path it can resolve.
3. **Vagrant VM** — `vagrant up` boots `bento/debian-12`, installs Docker, runs `mkcert` on the host for `weleda-webcenter-text-export.test`, then `docker compose -f compose.vm.yml --profile dev up`. Traefik on `:443` routes to the dev or prod container by profile. App reachable at `https://weleda-webcenter-text-export.test`.

Compose files:
- `compose.yml` — host + devcontainer dev (Vite only, no Traefik).
- `compose.vm.yml.dist` → copied to `compose.vm.yml` on first `vagrant up`. Traefik + dev/prod profiles. The synced `/vagrant` folder makes `compose.vm.yml` visible on the host too; it's gitignored so user customisation doesn't leak into commits.

## Architecture

### Dual-mode build is the central design fork

`react-router.config.ts` reads `process.env.SSR`. Default is SSR (Node host, Docker). GitHub Pages has no Node runtime, so `deploy-gh-pages.yml` sets `SSR=false`, which produces a pure SPA in `build/client/`. CI runs both builds. When debugging deployment issues, check which mode the failing path actually targets — they take different code paths through `react-router build`.

### XML → text conversion (`app/lib/xml-to-text/convert.ts`)

This is the only non-trivial logic in the app. Behaviour is locked down by `convert.test.ts` against `__fixtures__/sample.xml` + `expected.txt`. Four deliberate decisions:

1. **Scoped to `<textContent>` subtrees only.** The GS1 `StandardBusinessDocumentHeader`, `<artworkContentLocale>`, `<sourceReference>` etc. are skipped — those carry timestamps and IDs that would pollute the leaflet text.
2. **Paragraph-aware.** Each `<p>` and `<li>` becomes one output paragraph. Inline elements (`<b>`, `<i>`, …) bubble up; `<br/>` becomes a soft `\n` inside the same paragraph. The renderer relies on `.output p { white-space: pre-line }` to display those soft breaks without a `<br>` element.
3. **Document order, never `<instanceSequence>` sorting.** The fixture deliberately puts `instanceSequence=3` before `=2` so any sort would break the round-trip test.
4. **`fast-xml-parser` with `preserveOrder: true`, not `DOMParser`.** Means the same code runs unchanged in Vitest (Node), SSR, and the browser — no environment branching. Don't reach for `DOMParser` here; jsdom's namespace handling has surprised the project before.

### State and event flow

`routes/home.tsx` is the only meaningful route. It owns:

- `useConverter()` — file → `{paragraphs, text, fileName, fileSize}` + stats. The async `loadFile` reads with `FileReader`, then dispatches to `loadXml` (which calls `xmlToText`). Returns `{ok, reason}` on failure or `{ok: true, nonEmpty}` so the caller can toast on `not-xml` / `read-failed` and on parses that produced zero `<textContent>` paragraphs — all without the hook touching i18n.
- `usePageDragDrop()` — window-level dragenter/over/leave/drop with a depth counter and a `Files`-only guard (so dragging text/HTML across the page doesn't trigger the overlay). Drop anywhere → `handleFile`.
- `usePasteXml()` — Ctrl/Cmd+V handling with two paths:
  1. **Standard `paste` event** (something on the page is focused, *or* in newer Chromium even when body is focused). Inspects `clipboardData.files` first — supports pasting a file copied from Explorer/Finder, passes it straight to `handleFile`. Falls back to `text/xml` → `application/xml` → `text/plain` for raw-XML pastes.
  2. **`keydown` fallback** (only when `document.activeElement` is `<body>`/`<html>`, where Chromium often *doesn't* fire a paste event). Uses `navigator.clipboard.readText()`, which prompts for permission once.
  The two paths coordinate via a `lastPasteHandledAt` timestamp so a single Ctrl+V can't double-toast (the keydown's `await readText()` continuation is async; the synchronous paste event runs in between and sets the timestamp). The hook also accepts an `onShortcutClipboardNotUsable` callback so the keydown path can toast "this isn't XML" — the standard path stays silent because the user might be pasting into the search box.
- `useToast()` — single-slot toast with auto-hide.

The `Result` component owns search/copy/download locally (debounced query, Intl-formatted stats). It calls back via `onCopyFailed`/`onClear` so the route stays the source of truth for toast messages.

### i18n is mandatory for all UI strings

Every user-facing string lives in `app/locales/de.yml`. Components import `useTranslation` from `react-i18next` and call `t('key')`. The `meta()` export in `routes/home.tsx` calls `i18n.t(...)` directly because it runs outside React. To add a string: add a key to `de.yml`, reference it via `t('…')` — never inline German in TSX.

### Styling

All visual rules live in `app/styles/main.scss`. The design tokens are oklch CSS variables on `:root`. Tailwind v4 is wired via `@tailwindcss/vite` (utility classes are fine). **No inline `style={…}` on JSX** — give the element a class and add the rule to `main.scss` instead. The 404 / error fallbacks use `.fallback-page` for this reason.

### Path alias

`~` resolves to `app/` (in both `tsconfig.json` paths and `vite.config.ts` resolve.alias). Use `~/components/Foo` rather than `../../components/Foo`.

### YAML imports

`app/locales/*.yml` are loaded as ES modules through `@modyfi/vite-plugin-yaml`. The ambient `*.yml` declaration lives in `app/globals.d.ts`.
