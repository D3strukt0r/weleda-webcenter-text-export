import type {Config} from '@react-router/dev/config';
import {copyFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import process from 'node:process';

// Router basename, derived from BASE_PATH (set by deploy-gh-pages.yml) and
// normalised to EXACTLY match Vite's `base`: '/' for the root-served
// Cloudflare/Docker builds, '/<repo>/' for the GitHub Pages sub-path build.
// React Router requires `basename` to begin with Vite's `base`, and Vite's
// `base` always carries a trailing slash — so keep one here too.
const trimmedBase = (process.env.BASE_PATH ?? '').replace(/^\/+|\/+$/g, '');
const BASENAME = trimmedBase === '' ? '/' : `/${trimmedBase}/`;

export default {
  // SSR by default. GitHub Pages has no Node runtime, so its workflow sets
  // SSR=false to force SPA output (index.html + client bundle only).
  ssr: process.env.SSR !== 'false',
  // Matches Vite's `base` (set from BASE_PATH) so routing works under a project
  // sub-path; '/' for the root-served Cloudflare/Docker builds.
  basename: BASENAME,
  // Emit the SPA-fallback 404.html (a verbatim copy of index.html). Runs in
  // React Router's post-build hook because RR writes the SPA index.html AFTER
  // every Vite hook, so a Vite plugin can't see it on RR8. No-op for SSR builds.
  async buildEnd() {
    const index = join(process.cwd(), 'build', 'client', 'index.html');
    if (existsSync(index)) {
      copyFileSync(index, join(process.cwd(), 'build', 'client', '404.html'));
    }
  },
} satisfies Config;
