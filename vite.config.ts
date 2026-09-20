/// <reference types="vitest" />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import path from 'path';
import fs from 'fs';

/**
 * onnxruntime-web loads its wasm/mjs pair at runtime from `env.backends.onnx.wasm.wasmPaths`.
 * MV3 forbids remote code, so the files transformers.js would otherwise fetch from a
 * CDN are copied into dist/wasm/ and served from the extension origin.
 */
export const ORT_WASM_FILES = ['ort-wasm-simd-threaded.asyncify.mjs', 'ort-wasm-simd-threaded.asyncify.wasm'];

function copyOrtWasm(): Plugin {
  return {
    name: 'rezbuilder-copy-ort-wasm',
    apply: 'build',
    closeBundle() {
      const src = path.resolve(__dirname, 'node_modules/onnxruntime-web/dist');
      const dest = path.resolve(__dirname, 'dist/wasm');
      fs.mkdirSync(dest, { recursive: true });
      for (const file of ORT_WASM_FILES) {
        const from = path.join(src, file);
        if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dest, file));
      }
      // Rollup also emits the .wasm ORT references via import.meta.url; the runtime
      // is pointed at dist/wasm/, so that 23 MB duplicate is dead weight.
      const assets = path.resolve(__dirname, 'dist/assets');
      if (fs.existsSync(assets)) {
        for (const f of fs.readdirSync(assets)) {
          if (/^ort-wasm-simd-threaded.*\.wasm$/.test(f)) fs.rmSync(path.join(assets, f));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyOrtWasm(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5173,
    },
  },
  build: {
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        offscreen: 'src/offscreen/index.html',
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  },
});
