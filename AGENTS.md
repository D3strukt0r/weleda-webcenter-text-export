# AGENTS.md

Guidance for AI coding agents (Claude Code, Cursor, Copilot, Codex, …) working in this repository.

## Commands

```shell
pnpm install
pnpm dev                # http://localhost:5173, HMR
pnpm build              # SSR build → build/client + build/server
SSR=false pnpm build    # static / SPA build → build/client only
pnpm preview            # serve the static build locally (4173)
pnpm typecheck          # react-router typegen && tsc --noEmit
pnpm lint               # eslint
pnpm test               # vitest run
pnpm test:watch         # vitest in watch mode
```

Single test: `pnpm test app/lib/xml-to-text/convert.test.ts`
or `pnpm vitest run -t "preserves document order"` for one case by name.

TypeScript 6 and 7 run side by side, so don't collapse the two aliased devDependencies into one. `@typescript/native` *is* TypeScript 7 and owns the `tsc` binary that `pnpm typecheck` executes; the `typescript` entry is aliased to `@typescript/typescript6` so everything importing the `typescript` *module* gets a 6.x API — typescript-eslint via `@iwf-web/eslint-coding-standard`, plus `@react-router/dev` (peer `^5.1.0 || ^6.0.0`). TypeScript 7.0 deliberately ships no programmatic API (it arrives in 7.1), so a plain `typescript@7` makes `pnpm lint` crash on module load. The 6.x compiler stays reachable as `tsc6`, and `pnpm peers check` reporting an unmet `typescript` peer is expected, since peers match by package name while the alias resolves to `@typescript/typescript6`.

OCI image (Nix-built, no Dockerfile): `nix build .#dockerImage && docker load < result && docker run --rm -p 3000:3000 d3strukt0r/weleda-webcenter-text-export:latest`. On Windows / macOS without a host Nix install, run the `nix build` step inside `nixos/nix:2.34.6` (see README → Building the OCI image locally).

## Local development paths

Three ways to run the app locally; all produce Vite on port 5173 (or the SSR runtime on 3000):

1. **Host** — `pnpm install && pnpm dev`. Plain Node, no Docker.
2. **Devcontainer (Docker outside of Docker)** — `.devcontainer/devcontainer.json` provisions Node 24, the DooD feature (`moby: false`), `act`, common-utils. Open in VS Code → "Reopen in Container", then either:
   - `pnpm dev` directly inside the devcontainer, or
   - `docker compose up dev` to spin up a sibling Vite container. This works because the devcontainer exports `LOCAL_WORKSPACE_FOLDER=${localWorkspaceFolder}` via `remoteEnv`, and `compose.yml`'s bind mount uses `"${LOCAL_WORKSPACE_FOLDER:-.}:/opt/weleda-webcenter-text-export"` so the host docker daemon sees a path it can resolve.
3. **Vagrant VM** — `vagrant up` boots `bento/debian-12`, installs Docker, runs `mkcert` on the host for `weleda-webcenter-text-export.test`, then `docker compose -f compose.vm.yml up`. Traefik on `:443` routes to the dev container. App reachable at `https://weleda-webcenter-text-export.test`.

Compose files:
- `compose.yml` — host + devcontainer dev (Vite only, no Traefik). Runs `nix develop --command sh -c "pnpm install && pnpm run dev --host 0.0.0.0"` inside `nixos/nix`. Source bind-mounted; `node_modules/` and `/nix` are named volumes.
- `compose.vm.dist.yml` → copied to `compose.vm.yml` on first `vagrant up`. Traefik + dev profile. The synced `/vagrant` folder makes `compose.vm.yml` visible on the host too; it's gitignored so user customisation doesn't leak into commits.

## Architecture

### Dual-mode build is the central design fork

`react-router.config.ts` reads `process.env.SSR`. Default is SSR (Node host, Docker). GitHub Pages has no Node runtime, so `deploy-gh-pages.yml` sets `SSR=false`, which produces a pure SPA in `build/client/`. CI runs both builds. When debugging deployment issues, check which mode the failing path actually targets — they take different code paths through `react-router build`.

The split also gates the **no-JS fallback path**: the server-side `action()` on the home route only exists in the SSR build. The SPA build still ships the `<noscript>` form markup, but a POST to GitHub Pages would 404 — accept that, it's consistent with the SPA-mode constraint.

### XML → text conversion (`app/lib/xml-to-text/convert.ts`)

This is the only non-trivial logic in the app. Behaviour is locked down by `convert.test.ts` against `__fixtures__/sample.xml` + `expected.txt`. Four deliberate decisions:

1. **Scoped to `<textContent>` subtrees only.** The GS1 `StandardBusinessDocumentHeader`, `<artworkContentLocale>`, `<sourceReference>` etc. are skipped — those carry timestamps and IDs that would pollute the leaflet text.
2. **Paragraph-aware.** Each `<p>` and `<li>` becomes one output paragraph. Inline elements (`<b>`, `<i>`, …) bubble up; `<br/>` becomes a soft `\n` inside the same paragraph. The renderer relies on `.output p { white-space: pre-line }` to display those soft breaks without a `<br>` element.
3. **Document order, never `<instanceSequence>` sorting.** The fixture deliberately puts `instanceSequence=3` before `=2` so any sort would break the round-trip test.
4. **`fast-xml-parser` with `preserveOrder: true`, not `DOMParser`.** Means the same code runs unchanged in Vitest (Node), SSR, and the browser — no environment branching. Don't reach for `DOMParser` here; jsdom's namespace handling has surprised the project before. The fact that conversion is Node-compatible is what enables the no-JS server action below.

### State and event flow

`routes/home.tsx` is the only meaningful route. It owns:

- **`action({request})`** (SSR-only) — parses `multipart/form-data`, validates extension/type, calls `xmlToText` server-side. Returns either `{paragraphs, text, html, fileName, fileSize}` or `{error: 'no-file' | 'not-xml' | 'no-content'}`. See [No-JS fallback](#no-js-fallback) below.
- **`useActionData<typeof action>()`** seeds the client store via `useConverter(initial)` so a server-rendered result hydrates into the same state. `useActionData` widens literal unions through React Router's serialization — narrow with a runtime helper (`if (code === 'no-file') return …`), not a `Record<…>` lookup, otherwise TS will fail with "string undefined cannot be used as index".
- **`useConverter(initial?)`** — file → `{paragraphs, text, html, fileName, fileSize}` + stats. The async `loadFile` reads with `FileReader`, then dispatches to `loadXml` (which calls `xmlToText`). Returns `{ok, reason}` on failure or `{ok: true, nonEmpty}` so the caller can toast on `not-xml` / `read-failed` and on parses that produced zero `<textContent>` paragraphs — all without the hook touching i18n. The optional `initial` param exists so a server-rendered action result seeds the same `useState` slot on first render.
- **`usePageDragDrop()`** — window-level dragenter/over/leave/drop with a depth counter and a `Files`-only guard (so dragging text/HTML across the page doesn't trigger the overlay). Drop anywhere → `handleFile`.
- **`usePasteXml()`** — Ctrl/Cmd+V handling with two paths:
  1. **Standard `paste` event** (something on the page is focused, *or* in newer Chromium even when body is focused). Inspects `clipboardData.files` first — supports pasting a file copied from Explorer/Finder, passes it straight to `handleFile`. Falls back to `text/xml` → `application/xml` → `text/plain` for raw-XML pastes.
  2. **`keydown` fallback** (only when `document.activeElement` is `<body>`/`<html>`, where Chromium often *doesn't* fire a paste event). Uses `navigator.clipboard.readText()`, which prompts for permission once.
  The two paths coordinate via a `lastPasteHandledAt` timestamp so a single Ctrl+V can't double-toast (the keydown's `await readText()` continuation is async; the synchronous paste event runs in between and sets the timestamp). The hook also accepts an `onShortcutClipboardNotUsable` callback so the keydown path can toast "this isn't XML" — the standard path stays silent because the user might be pasting into the search box.
- **`useToast()`** — single-slot toast with auto-hide.
- **`useTheme()`** — `useSyncExternalStore`-backed; reads `html.dark` class (set by the bootstrap script before first paint), writes localStorage `weleda-konverter:theme`. Module-level `subscribers` Set means every consumer re-renders on toggle. Exports `THEME_COLOR_LIGHT` / `THEME_COLOR_DARK` (oklch strings) reused by the JSX meta tags, the bootstrap IIFE, and `applyTheme`. See [Theme system](#theme-system) below.

The `Result` component owns search/copy/download locally. Two patterns worth knowing:

- **`useDeferredValue` over setTimeout debounce.** The search query is fed through `useDeferredValue(query)`; the deferred value drives the highlight + match-count `useMemo`. Replaces the previous `setTimeout`/`debounceRef` machinery — same behaviour, less code, scheduler-aware.
- **"Adjust state in render" instead of a reset effect.** The search query clears when a new file loads via:
  ```ts
  const [prevText, setPrevText] = useState(text);
  if (text !== prevText) {
    setPrevText(text);
    setQuery('');
  }
  ```
  Lifted straight from [react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes). Avoids the `react-hooks-extra/no-direct-set-state-in-use-effect` lint warning and one extra re-render.

### Theme system

The theme is controlled by `html.dark` / `html.light` class on `<html>` (not `<body>`). The cascade is split across three places:

1. **`app/styles/_tokens.scss`** declares the runtime CSS variables on `:root` (light) and `html.dark` (dark), plus a **no-JS fallback** block: `@media (prefers-color-scheme: dark) { html:not(.light):not(.dark) { … } }`. Same dark token values as the `html.dark` block — applies only when neither class is set (no JS = bootstrap didn't run). Lets a no-JS user follow their OS preference and have it update reactively if they change it.
2. **`app/styles/tailwind.css`** aliases each runtime var to Tailwind's `--color-*` token via `@theme` (`--color-bg: var(--bg)` etc.). The `var()` reference is preserved in the output, so utilities like `bg-bg`, `text-ink`, `border-line` re-resolve at use time as the cascade flips.
3. **`app/root.tsx`** ships the `themeBootstrap` IIFE inside `<head>` **before `<Meta />` and `<Links />`**. The script:
   - Reads `localStorage['weleda-konverter:theme']`, falls back to `prefers-color-scheme`
   - Adds `html.light` or `html.dark` AND `html.js`
   - Overrides every `<meta name="theme-color">`'s `content` to match the resolved palette (the JSX renders both light + dark metas with `media` queries; the bootstrap overwrites both so whichever the browser picks shows the right colour)

The IIFE is intentionally minified to one line so it parses inline before stylesheets evaluate (avoids the theme FOUC). Two `eslint-disable-next-line` comments on it — keep them.

`useTheme.ts` uses `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`. `getSnapshot` reads `documentElement.classList.contains('dark')`. `applyTheme` writes localStorage, toggles classes on `documentElement`, rewrites every `meta[name="theme-color"]`, then notifies all subscribers. The shared subscriber Set means every consumer re-renders in lockstep when the theme flips.

#### Theme toggle icons are CSS-driven, not React-rendered

`ThemeToggle.tsx` keeps **both** the moon and the sun in the DOM at all times. Visibility is decided by the `dark:` Tailwind custom variant (`@custom-variant dark (&:where(html.dark, html.dark *))` in `tailwind.css`), which reads the same `html.dark` class the bootstrap set. The icons cross-fade + rotate-swap via `transition-[translate,rotate,opacity] duration-300 ease-soft`. React's `isDark` only drives `aria-label` / `title` / `aria-pressed`. Visual state is CSS; the correct icon shows from frame one regardless of SSR/client divergence — no hydration-flash.

### Styling: Tailwind v4 utilities + scoped SCSS

Visual rules are split across five files in `app/styles/`:

- **`tailwind.css`** — `@import "tailwindcss"` + a regular `@theme` block (font / radius / shadow alias / `--ease-soft` / `--text-display` / `--container-prose-narrow`) + a `@theme inline` block (the `--color-*` runtime-var aliases) + `@utility duration-theme { transition-duration: var(--theme-transition) }` + `@custom-variant dark` + `@custom-variant no-js` + `@utility container` (stepped caps 39/47/61.25 rem to top out at 980 px on lg+).
- **`_mixins.scss`** — `@mixin dark` (top-level) + `@mixin in-dark` (nested with `&`). Both emit `html.dark` + the no-JS `@media (prefers-color-scheme: dark) html:not(.dark):not(.light)` fallback. Use these instead of writing the selectors by hand.
- **`_tokens.scss`** — `:root` with the runtime CSS vars + `--theme-transition` motion token + a single `@include dark { … }` block (collapses what used to be a duplicated `html.dark` + no-JS-dark `@media` pair).
- **`_base.scss`** — element resets (`*`, `html`, `body`), `body { transition: background-color var(--theme-transition) ease }` (bg only — see Theme crossfade below), the property-split `@layer base` per-utility transition rule, `[&_em]:text-accent-d` / `[&_kbd]:text-ink-soft` descendant rules, and accessibility media queries (`@media (prefers-reduced-motion)` blanket transition kill, `@media (prefers-reduced-transparency)` opacity overrides + `backdrop-filter: none`).
- **`_components.scss`** — what couldn't be expressed as utilities: `.no-js-submit` + `.no-js-selected-hint` + the two `:has()` Dropzone form rules, `.file-stats span::before` separator counter, `.output` prose typography (`p` + `mark`) with their own theme transitions, `.result-panel` multi-property transition (opacity/transform at 250 ms + bg/border at `--theme-transition`), one `@media (max-width: 640px) { .output { … } }` responsive override. Everything else is Tailwind utilities directly on the JSX.
- **`main.scss`** is just `@use 'tokens'; @use 'base'; @use 'components';`.

Component-level patterns:

- **Use Tailwind utilities first.** Map to named scale (`text-xs`, `rounded-md`, `size-8`) — don't reach for `[Npx]` arbitrary values. For project-specific values that don't snap, add a `@theme` token (e.g. `--text-display`).
- **`classnames` lib for conditional class strings.** When composing variants/states inside a component, use `classNames(...)` from `classnames` rather than `.filter(Boolean).join(' ')`. Inline the strings in the `className` arg list — only extract to module-level consts (`const VARIANTS: Record<...>`) when there's a real lookup table.
- **State machines via React props + ternary, no `.is-*` strings.** `Toast`, `DragOverlay`, `Result` article, `Button` (copied) compose visible/hidden/variant classes in the component body. Avoids React-toggled `.is-active` selectors that would otherwise live in SCSS.
- **`<Button>` component** absorbs the previous `.btn` family. Props: `variant: 'default' | 'primary' | 'icon'`, optional `copied?: boolean`. Use it everywhere a button is needed (Result Copy/Download/Close, Dropzone no-JS submit). Don't recreate the same utility chains by hand.
- **`<FallbackPage title message>`** renders the 404 / ErrorBoundary body. Used by `routes/not-found.tsx` and the `ErrorBoundary` in `root.tsx`.
- **`group` + `group-hover:`** for parent-hover-affects-child. See `Dropzone.tsx` — the label has `group`, the icon-wrap has `group-hover:bg-paper-hover group-hover:text-accent-d`.

#### Header: sticky + blurred translucent

`Topbar.tsx`'s outer `<header>` has `sticky top-0 z-30 bg-header backdrop-blur-md border-b border-line-soft`. The inner content is wrapped in `<div className="container …">` so brand row and main content share the same left edge across breakpoints. `--header-bg` is a translucent token (light `oklch(... / 0.7)`, dark `... / 0.75`). `bg-header` is the `@theme` alias. Under `prefers-reduced-transparency: reduce`, `_base.scss` flips `--header-bg` to a fully opaque variant (and the same `backdrop-filter: none !important` blanket removes the blur). `z-30` sits below the `.drag-overlay` (`z-index: 100`) and `.toast` (`z-index: 200`) in `_components.scss`.

#### Accessibility: prefers-reduced-motion + prefers-reduced-transparency

Both handled centrally in `_base.scss`:

- **`@media (prefers-reduced-motion: reduce)`** — site-wide blanket rule that snaps every transition + animation to `0.01ms !important` (kept above zero so `transitionend` listeners still fire). Catches every Tailwind utility transition + SCSS rule.
- **`@media (prefers-reduced-transparency: reduce)`** — flips `--accent-glow` to `transparent`, flips `--header-bg` to its opaque counterpart for `:root` AND `html.dark` AND the no-JS-dark selector (specificity 0,2,1 — needs the nested `@media (prefers-color-scheme: dark) { html:not(.light):not(.dark) { … } }` to win over the no-JS-dark translucent rule), and applies `backdrop-filter: none !important` to every element so the header's `backdrop-blur-md` drops cleanly.

#### Theme crossfade mechanics

The theme flip is driven by **one runtime variable**, `--theme-transition` (default `400ms`), and three rules in `_base.scss`:

1. **`body { transition: background-color var(--theme-transition) ease }`** — body bg fades smoothly. `color` is **deliberately NOT in body's transition**. A `color` transition on body retargets every descendant's own `color` transition every frame against body's animating inherited colour, stalling each descendant for the full theme window then playing back over a second window (~2× lag, visible as "icon stays bright while page goes dark, then quickly snaps at the end"). Body bg snap is fine; the contrast change is what matters.
2. **`@layer base` per-utility transition rule, property-split.** `:is(.bg-bg, .bg-paper, …, .border-line, …)` transitions `background-color` + `border-color` only — no `color`. `.text-ink, .text-ink-soft, …, .text-toast-fg` transitions all three (`color` + `background-color` + `border-color`). The text rule comes after, so elements with both `text-*` AND `bg-*` (e.g. Button's `bg-paper text-ink`) win the cascade and get the full list. Sections / headers that only set `bg-*` / `border-*` don't drag `color` through, so they don't stall their text descendants.
3. **`-webkit-text-fill-color` workaround for `[&_<child>]:text-<themed>` variants.** Tailwind's child-selector variant (e.g. `[&_em]:text-accent-d` on the Lede h1, `[&_kbd]:text-ink-soft` on Dropzone's keyboard-shortcut tip) paints `color: var(--…)` on the descendant via a child selector. Animating that `color` directly retargets against the parent's `color` transition. `_base.scss` has dedicated rules:

   ```scss
   [class*="[&_em]:text-accent-d"] em {
     -webkit-text-fill-color: var(--accent-d);
     transition: -webkit-text-fill-color var(--theme-transition) ease;
   }
   [class*="[&_kbd]:text-ink-soft"] kbd {
     -webkit-text-fill-color: var(--ink-soft);
     transition:
       -webkit-text-fill-color var(--theme-transition) ease,
       background-color        var(--theme-transition) ease,
       border-color            var(--theme-transition) ease;
   }
   ```

   `-webkit-text-fill-color` is a different property than the parent's transitioning `color`, so Chrome doesn't retarget. `currentColor` doesn't trigger transitions (it's a keyword), so reference the variable directly. `background-color` / `border-color` on the same descendant ARE property-independent of parent `color`, so they use regular transitions in the same rule.

`--theme-transition` is tested correct at 200 ms, 400 ms, 4 s, 8 s — behaviour scales linearly with no element drifting out of sync. Tune it in `_tokens.scss` and every transition stays coherent.

**Interactive components** (Button, ThemeToggle, Dropzone) use Tailwind utilities like `transition-[background-color,border-color,color] duration-theme ease`. **Don't use `transition-colors`** — its expanded property list (color, bg, border, outline-color, text-decoration-color, fill, stroke, gradient stops) was shown to cause subtle issues on the ThemeToggle in the sister project. Explicit list of themed properties only.

**Reveal-style wrappers (Result panel)** can't use Tailwind's bare `transition` shorthand — it drops themed bg/border from the property list. `.result-panel` in `_components.scss` declares the full transition explicitly: `opacity` + `transform` at `250ms` for the panel reveal, `bg-color` + `border-color` at `var(--theme-transition)` for the theme flip. Add similar CSS for any future wrapper that animates entrance AND wraps themed surfaces.

#### duration-theme is an @utility, not an @theme token

`tailwind.css` declares it as `@utility duration-theme { transition-duration: var(--theme-transition) }`. Tailwind v4 only mints `.duration-*` utilities from literal `<time>` values; declaring `--duration-theme: var(--theme-transition)` in a `@theme` block silently doesn't emit a utility (the class falls through to Tailwind's 150 ms default, causing a 3-frame snap). The explicit `@utility` bypasses the namespace heuristic.

#### --color-* aliases live in @theme inline

`tailwind.css` has two `@theme` blocks: a regular one for value tokens (font / radius / shadow / ease / text-display / container-prose-narrow) and a separate `@theme inline { … }` block for all `--color-*` aliases. With `inline`, Tailwind substitutes the right-hand-side directly into utilities (`.text-ink { color: var(--ink) }`) instead of going through a `--color-ink: var(--ink)` alias. The alias chain interferes with theme transitions: consumers can see a stale value mid-animation in some browsers.

### `no-js:` Tailwind variant — hide JS-only UI

`@custom-variant no-js (&:where(html:not(.js), html:not(.js) *))` is defined in `tailwind.css`. Use `no-js:hidden` on anything that has no useful no-JS behaviour. Currently applied to: ThemeToggle button, Result actions row (Copy / Download / Close), Result search bar. The bootstrap script adds `.js` to `<html>` before first paint, so JS users see the elements normally; no-JS users (Mensa scrapers, JS-disabled, script blocked) see only the working subset.

### No-JS fallback

Reachable only from the SSR build. The `Dropzone` component renders a real `<form method="post" action="?index" encType="multipart/form-data">` wrapping the existing label + hidden file input (the hidden input gets `name="file"` and `required`). The submit button + "file selected" hint live inside `<noscript>`, so:

- **With JS:** browsers parse `<noscript>` contents as text-only — those elements are not in the live DOM, the JS `onChange` handler intercepts file selection, the form is never submitted.
- **Without JS:** `<noscript>` contents materialize as real elements. User picks a file via the dropzone label, the `:has(input[type=file]:valid)` CSS rule reveals the "✓ Datei ausgewählt" hint and un-dims the Hochladen button (the `required` attribute is what makes `:valid` mean "file present"). Click Hochladen → POST → server runs `action()` → page re-renders SSR with the converted result.

Two non-obvious requirements:

1. **`action="?index"` is mandatory.** React Router treats `POST /` as ambiguous between the root layout and the index route, returning 405. The `?index` query disambiguates to the index action. Without it, you get a `405 Method Not Allowed` rendered through the root `ErrorBoundary`.
2. **`required` on the file input is structural, not just validation.** Stripping it would break the `:has(input:valid)` CSS feedback because file inputs are unconditionally `:valid` without `required`.

Search, copy, and download are JS-only by nature (search reruns the highlight memo, copy uses the Clipboard API, download uses Blob URLs). Their containers carry `no-js:hidden` so they don't render at all without JS — the user reads / select-copies the text manually. Don't try to polyfill them.

### i18n is mandatory for all UI strings

Every user-facing string lives in `app/locales/de.yml`. Components import `useTranslation` from `react-i18next` and call `t('key')`. The `meta()` export in `routes/home.tsx` calls `i18n.t(...)` directly because it runs outside React. To add a string: add a key to `de.yml`, reference it via `t('…')` — never inline German in TSX.

**HMR for translations.** `app/i18n.ts` has `if (import.meta.hot) { import.meta.hot.accept('./locales/de.yml', …) }` that re-bundles the resource and calls `i18n.changeLanguage(i18n.language)` to re-render. Without this, the `!i18n.isInitialized` guard would skip re-init on YAML edit and Dev would show stale strings.

Action-side error codes use the same keys as toasts: `not-xml` → `toast.not_xml`, `no-content` → `toast.no_content`, `no-file` → `toast.no_file`. The mapping is a runtime if-chain in `home.tsx` (not a `Record`) so TS can narrow string literal returns — see the note under State and event flow about `useActionData` widening.

### Icons (extracted SVGs)

Per-icon files in `app/assets/icons/*.svg`, imported as React components via the `?react` query (vite-plugin-svgr, configured in `vite.config.ts`). Example:

```tsx
import CheckIcon from '~/assets/icons/check.svg?react';
// …
<CheckIcon width={14} height={14} />
```

- Default stroke width is `1.8`; override per call site with `<UploadIcon strokeWidth={1.6} />` when needed.
- `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"` — so icons re-theme via CSS `color`.
- Indentation in the SVG source files is 4 spaces.
- The svgr plugin in `vite.config.ts` rewrites `#575756` → `currentColor` so the same source SVG renders fixed-grey as a favicon (`?url` import) and re-themes when used inline.
- Ambient type declarations for `*.svg?react` and `*.svg?url` are in `app/globals.d.ts`.

### Build-emitted favicons + PWA manifest

`public/` does not exist in the repo. All static artefacts are emitted by Vite plugins under `app/vite/plugins/`:

- **`favicon-rasters.ts`** — runs in the client build only. Reads `app/assets/favicon.svg`, walks its inline `<style>` block and inlines class-based `fill`/`stroke` rules as element attributes (libvips doesn't resolve external CSS rules during SVG rasterisation). Renders PNG fallbacks via `sharp` (density 384 for 16–512 px), bakes a multi-resolution `favicon.ico` via `png-to-ico` (16/32/48 BMP-encoded). Output icon list is shared with `web-manifest.ts` via `app/config/web-manifest.ts`. Emits `favicon.svg`, `favicon-96x96.png`, `apple-touch-icon.png`, `web-app-manifest-{192,512}x*.png`, `favicon.ico` to `build/client/`.
- **`web-manifest.ts`** — reads `app/locales/de.yml`, pulls `brand.name` for the manifest's `name` field. Combines with `app/config/web-manifest.ts`'s `WEB_MANIFEST` (description, theme/bg colors, display mode) and the shared `WEB_MANIFEST_ICONS` list. Emits `site.webmanifest` to `build/client/`. A single edit in `de.yml` propagates to the installed-PWA title.
- **`spa-fallback.ts`** — copies `build/client/index.html` to `build/client/404.html` so GitHub Pages serves the SPA shell on any deep URL. SSR builds emit no `index.html` in this dir, so the `existsSync` guard makes it a no-op there.
- **`copyright-from-license.ts`** — pulls year(s) + holder from `LICENSE.txt`, exposes them as `__COPYRIGHT_YEARS__` / `__COPYRIGHT_HOLDER__` build-time globals consumed by `AppFooter.tsx`.
- **`strip-spa-server-exports.ts`** — strips the `action` export from `routes/home.tsx` in the SPA build (React Router 7's Vite plugin rejects an `action` export in SPA-mode route modules, but the SSR build needs it for the no-JS form POST).

The footer also carries a `footer.weleda_credit` line crediting Weleda AG for the logo + brand name.

### `SITE_HOST` + `BASE_PATH` for sitemap + robots + sub-path

**SPA (GitHub Pages):** `deploy-gh-pages.yml` queries `gh api repos/<repo>/pages` and exports `SITE_HOST` + `BASE_PATH` for `SSR=false pnpm build`: a configured `.cname` → that host at the root (`BASE_PATH=/`); otherwise the `.html_url` host + project sub-path (`/<repo>/`). It no longer fails on a null cname. `vite.config.ts` reads `process.env.SITE_HOST?.trim()` (falls back to `localhost`) and `BASE_PATH`, bakes the (sub-path-aware) `https://${SITE_HOST}` URL into the static `sitemap.xml` / `robots.txt` — each emitted by its own build plugin (`app/vite/plugins/{sitemap,robots}.ts`, via `this.emitFile`) **only in SPA mode** (gated on `SSR === 'false'`) — and sets Vite `base` + the React Router `basename` from `BASE_PATH` so assets and routing resolve under the sub-path. No `CNAME` file is written or committed; the host comes from the Pages API at build time.

**SSR image:** no build-time host. `sitemap.xml` / `robots.txt` are served as **resource routes** (`app/routes/{sitemap-xml,robots-txt}.ts`, registered only when SSR) that import each plugin's `render*` fn and resolve the host **per request** via `resolveSiteUrl` in `app/lib/site-url.ts`: explicit `SITE_HOST` env (e.g. set in `compose`) wins, else the `X-Forwarded-Host` / `Host` header, else the request URL host. `docker.yml` therefore no longer fetches the Pages domain.

### Path alias

`~` resolves to `app/` (in both `tsconfig.json` paths and `vite.config.ts` resolve.alias). Use `~/components/Foo` rather than `../../components/Foo`.

### YAML imports

`app/locales/*.yml` are loaded as ES modules through `@modyfi/vite-plugin-yaml` at runtime. The `web-manifest.ts` Vite plugin reads YAML at build time via the `yaml` npm package (since `@modyfi/vite-plugin-yaml` only exposes a runtime loader). The ambient `*.yml` declaration lives in `app/globals.d.ts`.

## Production image (Nix-built OCI)

**No Dockerfile.** Image produced by `flake.nix` via `pkgs.dockerTools.streamLayeredImage`, post-processed by `nix-utils`' `fixOciImageHistory` so layers show per-step Commands in Dive and Trivy stops flagging the synthetic `HEALTHCHECK` (DS-0026).

- **Build**: `nix build .#dockerImage` → `./result` is a docker-load-able tarball.
- **Two derivations**: `weleda-webcenter-text-export` builds the SSR bundle (`pnpm.fetchDeps` FOD, build, prune, lay at `$out/opt/weleda-webcenter-text-export/`). `dockerImage` wraps it via `dockerImageStream` piped through `fixOciImageHistory`.
- **Runtime contents**: `usrBinEnv` + `fakeNss` (with appended nonroot user) + `bashInteractive` + `coreutils` + `gnused` + `which` (pnpm bin shims) + `nodejs-slim_24` + a stripped `curlSlim` + the app derivation. `bashInteractive` (not plain bash) because nodejs-slim transitively pulls it; adding plain bash would ship two shells.
- **Runtime layout**: app lives at `/opt/weleda-webcenter-text-export/{build,node_modules,package.json}`. User `nonroot:65532`; `/tmp` mode 1777 created in `extraCommands`. CMD `react-router-serve ./build/server/index.js`, found via `PATH=/opt/weleda-webcenter-text-export/node_modules/.bin:/bin:/usr/bin`. Healthcheck `curl -fsS http://localhost:3000/` every 30 s.
- **Reproducibility**: `created = createdFromDate self.lastModifiedDate` — clean tree = HEAD commit time → identical config-blob digest from identical sources.
- **Hardening tricks** (don't undo):
  - `dontFixup`/`dontStrip`/`dontPatchShebangs`/`dontPatchELF = true`. Without them, `patchShebangs` rewrites every `#!/usr/bin/env node` in `node_modules` to absolute `/nix/store/<hash>-nodejs-24…` paths, dragging full nodejs + stdenv + perl + python + gcc-libs into the runtime closure. Plain `/usr/bin/env <prog>` shebangs work because the image ships `usrBinEnv` + `nodejs-slim_24` + `bashInteractive` + `coreutils` + `gnused`.
  - `disallowedReferences = [ pkgs.nodejs_24 ]` — hard-fails the build if the full nodejs sneaks back in.
  - `enableFakechroot = true` — `extraCommands` paths resolve relative to image root.
- **`weleda-webcenter-text-export` is in `streamLayeredImage.contents`** — only safe because its `installPhase` nests output under `$out/opt/weleda-webcenter-text-export/`. dockerTools symlinks every top-level path of each contents package into rootfs; don't move files back to `$out/` root.
- **`pnpmDeps.hash`** is a fixed-output hash. Every lockfile change → new hash. First build with a stale hash fails with `specified: X / got: Y` — copy the `got` value in. Auto-bumped via `bump-pnpm-hash.yml` (Workflows).

## Workflows

- **`ci.yml`** — lint + typecheck + build + tests on every PR / push, plus a Trivy / Grype scan of the OCI image.
- **`deploy-gh-pages.yml`** — derives `SITE_HOST` + `BASE_PATH` from the GH Pages REST API (custom domain → root; else `html_url` host + project sub-path), runs `SSR=false pnpm build` with that env (Vite `base` + RR `basename` from `BASE_PATH`), then `actions/upload-pages-artifact@v5` → `actions/deploy-pages@v5` on push to `master`.
- **`docker.yml`** — multi-arch (`amd64`, `arm64`, `riscv64`) Nix-built OCI image to Docker Hub. The image resolves its host at runtime (resource routes), so the build no longer reads the Pages domain. Same `setup → build → manifest → attest` pipeline as `d3strukt0r/d3strukt0r.github.io`: build matrix has no Docker Hub creds, manifest job uses a `registry:3` service container + `skopeo` + `imagetools create`, cosign + attest per arch + per manifest-list tag. `paths-ignore: [pnpm-lock.yaml, package.json]` skips lockfile-only Dependabot merges (the follow-up bump commit re-fires the workflow).
- **`bump-pnpm-hash.yml`** — push-triggered on `master`/`develop` when `pnpm-lock.yaml`/`package.json` changes. Runs `.github/scripts/bump-pnpm-hash.sh`: swaps `pnpmDeps.hash` with `lib.fakeHash`, runs `nix build` to provoke the FOD mismatch, extracts the real value from the `got:` line, writes it back, commits + pushes under `github-actions[bot]`. **Requires `GH_PAT`** — plain `GITHUB_TOKEN` commits don't trigger downstream workflows (docker.yml would stay queued).
- **`release.yml`** — `googleapis/release-please-action@v5` on push to `master`. Scans conventional commits, opens a release PR with version bump + `CHANGELOG.md`; on merge cuts a GitHub Release + git tag. The tag triggers `docker.yml`. Managed files: `package.json` (`version`) + `flake.nix` (`version = "X.Y.Z"; # x-release-please-version`). Uses `GH_PAT`.
- `dependabot-validate.yml` / `dependabot-automerge.yml` / `dockerhub-description.yml` / `greetings.yml` / `label.yml` / `stale.yml` — peripheral automation.

## Devcontainer

`.devcontainer/devcontainer.json` — `mcr.microsoft.com/devcontainers/base:debian` + features: `common-utils`, `node:1` (v24), `docker-outside-of-docker` (`moby: false`), `github-cli`-equivalent, `devcontainers-extra/features/act`. Forwards 5173/4173/3000. `postCreateCommand: corepack enable && pnpm install`. **Nix is not preinstalled** — for image builds, run inside `nixos/nix:2.34.6` (see `compose.yml`) or install ad-hoc.

## Gotchas

- **`POST /` returns 405** unless the form has `action="?index"`. React Router treats it as ambiguous between root layout and index route. See No-JS fallback above.
- **`useActionData<typeof action>()` widens literal unions.** Narrow with explicit if-chains, not `Record<'no-file'|'not-xml'|'no-content', string>` lookups — TS reports `Argument of type 'string | undefined' is not assignable to parameter of type 'string'` on the index.
- **Don't put a `<button type=submit>` inside the dropzone `<label>`.** Clicking the button would also trigger the label's file picker. Submit lives as a sibling inside the wrapping `<form>`, gated by `<noscript>`.
- **`<noscript>` contents are text-only in JS mode.** When testing the no-JS path in JS-enabled browsers, you have to re-inject the noscript innerHTML as live elements (see how we verify CSS state in the Chrome DevTools MCP path). Don't expect `document.querySelector('form.no-js-form')` to find anything.
- **`pnpmDeps.hash`** — every `pnpm-lock.yaml` change needs a paired hash bump in `flake.nix`. `bump-pnpm-hash.yml` handles it on `master`/`develop`. For local manual `pnpm add`/`update`, run `./.github/scripts/bump-pnpm-hash.sh`.
- **pnpm via Corepack** (host/devcontainer/CI only). `packageManager` field in `package.json` pins the version. `corepack enable` once on dev machines; don't `npm i -g pnpm`. Production image bypasses Corepack — uses `pkgs.pnpm_10` at build time, ships zero pnpm at runtime.
- **The `themeBootstrap` IIFE in `root.tsx`** is intentionally minified to a single line so it parses inline before hydration (avoids the theme FOUC). It MUST stay in `<head>` and run **before `<Meta />` + `<Links />`** so the `html.dark` / `html.light` / `html.js` classes are on `<html>` before any stylesheet evaluates. Two `eslint-disable-next-line` comments on the same const + the `<script dangerouslySetInnerHTML>` — both have a `--` rationale; keep them when editing.
- **`useSyncExternalStore` for `useTheme`.** `getServerSnapshot` returns `'light'`; the first client render also uses the server snapshot for hydration consistency. Don't refactor it back to `useState` + `useEffect` — every consumer would lose the shared-state guarantee (see the `subscribers` Set).
- **CSS `bg-bg` / `text-ink` / etc. cascade through the Tailwind `@theme` alias.** `--color-bg: var(--bg)` is preserved as a `var()` reference in the compiled CSS; the inner `var(--bg)` resolves at the consuming element, so `html.dark` / `prefers-color-scheme: dark` overrides cascade through. Don't replace the alias with hardcoded `oklch()` values in `@theme`.
- **`react-hooks-extra/no-direct-set-state-in-use-effect`** trips on the canonical SSR-hydration mounted marker (`useEffect(() => setMounted(true), [])`). The suppression on `ThemeToggle.tsx` is intentional; don't rewrite it.
- **`ts/promise-function-async` on `wrapSegment`** — React 19's `ReactNode` includes `Promise<ReactNode>`, which trips the rule on synchronous renderers. Suppression has a `--` rationale; adding `async` would wrap each node in a Promise React can't render.
- **`release.yml`-managed lines** — the `version = "X.Y.Z"; # x-release-please-version` line in `flake.nix` is bot-managed. Hand-edits get overwritten on the next release PR.
- **Don't reach for `[Npx]` arbitrary Tailwind values.** Snap to the named scale (`text-xs`, `rounded-md`, `size-8`) when close enough; for project-specific values that don't fit, add a `@theme` token (e.g. `--text-display`, `--container-prose-narrow`). Arbitrary values are reserved for genuine one-offs where no named scale comes close (e.g. `translate-y-[120%]` on the theme-icon swap).
- **Theme crossfade is property-split: body bg, then per-utility for everything else.** `body` transitions `background-color` ONLY (a `color` transition on body retargets every descendant's color transition each frame → ~2× lag). Element color/bg/border transitions live in the `@layer base` per-utility rule. **Don't put `color` in body's transition** and **don't drop `color` from the `.text-*` rule** in `@layer base`.
- **`@layer base` per-utility rule is property-split.** `:is(.bg-*, .border-*)` gets bg + border only; `.text-*` gets color + bg + border. Order: `.text-*` LAST so elements with both `text-*` AND `bg-*` (Button's `bg-paper text-ink`) win the shorthand cascade with the full property list. Sections / Topbar / wrappers that only set `bg-*` / `border-*` don't drag `color` through, so they don't stall their themed text descendants.
- **`duration-theme` must be declared via `@utility`, not `@theme --duration-theme`.** Tailwind v4 only mints `.duration-*` from literal `<time>` values; `var()` references are silently skipped (utility falls through to 150 ms default, causing a 3-frame snap on theme flip).
- **`--color-*` aliases live in `@theme inline`, not a regular `@theme` block.** Regular `@theme` serves a stale alias through the chain during a theme transition; `inline` substitutes `var(--ink)` directly into the utility.
- **`-webkit-text-fill-color` workaround for `[&_<child>]:text-<themed>` variants.** Tailwind's child-selector variant paints color on the descendant via a parent selector, with no transition declared. Animating the descendant's `color` directly retargets against the parent's `color` transition. Paint via `-webkit-text-fill-color: var(--themed)` (different property, no retargeting) and transition that. Rules in `_base.scss` for `[&_em]:text-accent-d` (Lede h1) and `[&_kbd]:text-ink-soft` (Dropzone tip).
- **Don't use `transition-colors` Tailwind utility on interactive elements.** Use an explicit themed-property list: `transition-[background-color,border-color,color] duration-theme ease`. The `transition-colors` expanded property list (outline-color, text-decoration-color, fill, stroke, gradient stops) was shown to cause subtle issues on the ThemeToggle in the sister project.
- **`.result-panel` declares its full transition in CSS, not via Tailwind's bare `transition` utility.** The Tailwind shorthand drops themed bg/border. Use per-property durations in CSS for any wrapper that needs both an entrance animation AND themed surface transitions. Same pattern would apply to any future Reveal-like wrapper.
- **Don't put `transition: fill, stroke` on `body *`.** Icon SVGs use `stroke="currentColor"`; a per-element stroke transition on them retargets against the parent's animating `color` every frame, causing a visible "icon stays bright then snaps at the end" lag.
- **Don't write `html.dark` or `html.dark &` directly.** Use `@include dark { ... }` (top-level) or `@include in-dark { ... }` (nested) from `_mixins.scss` so the no-JS `prefers-color-scheme` fallback selector is emitted too.
- **Reduced-transparency cascade has a no-JS-dark gap.** The `_base.scss` reduced-transparency block contains a nested `@media (prefers-color-scheme: dark) { html:not(.light):not(.dark) { --header-bg: opaque-dark } }`. Without it, the no-JS dark fallback rule (specificity 0,2,1) outranks the literal `:root` opaque override (0,1,0) and the header bleeds through under reduced-transparency + JS-disabled + OS-dark. Don't remove that nested rule.
