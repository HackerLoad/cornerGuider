import { defineConfig } from 'vite';

// Die Demo nutzt die Kernlogik der App (../src) direkt: GPX-Parser, Kurvenerkennung, Kurvengrafik.
export default defineConfig({
  base: './',
  server: { fs: { allow: ['..'] } },
  build: { target: 'es2020', outDir: 'dist', emptyOutDir: true },
});
