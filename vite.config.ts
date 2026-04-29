import ViteYaml from '@modyfi/vite-plugin-yaml';
import {reactRouter} from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';
import {defineConfig} from 'vitest/config';

const isVitest = process.env.VITEST === 'true';

export default defineConfig({
  plugins: [
    tailwindcss(),
    // react-router's vite plugin clashes with vitest's environment setup, so
    // skip it when running tests.
    ...(isVitest ? [] : [reactRouter()]),
    ViteYaml(),
    // `import Mark from '~/assets/foo.svg?react'` returns a React component;
    // `?url` keeps the URL form (used for the favicon link). The replaceAttrValues
    // entry rewrites the brand-grey fill to currentColor in the React variant,
    // so the same source SVG renders fixed-grey as a favicon and re-themes
    // when used inline.
    svgr({
      include: '**/*.svg?react',
      svgrOptions: {replaceAttrValues: {'#575756': 'currentColor'}},
    }),
  ],
  resolve: {
    tsconfigPaths: true,
    alias: {
      '~': new URL('./app', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['app/**/*.{test,spec}.{ts,tsx}'],
  },
});
