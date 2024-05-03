/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import svgr from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr(),
  ],
  build: {
    target: browserslistToEsbuild(),
  },
  server: {
    host: '0.0.0.0',
    port: 80,
    strictPort: true,
    watch: {
      ignored: ['**/.pnpm-store/**'],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest-setup.js',
  },
});
