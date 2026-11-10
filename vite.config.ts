import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Modo normal: web estática desplegable en cualquier hosting.
// Modo "artifact": un único HTML con React cargado por CDN (ver scripts/build-artifact.mjs).
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact';
  return {
    base: './',
    esbuild: { jsx: 'transform', jsxInject: "import React from 'react'" },
    plugins: artifact ? [viteSingleFile()] : [],
    build: artifact
      ? {
          outDir: 'dist-artifact',
          rollupOptions: {
            external: ['react', 'react-dom', 'react-dom/client'],
            output: {
              format: 'iife',
              globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' },
            },
          },
        }
      : { outDir: 'dist' },
    test: { environment: 'node' },
  } as any;
});
