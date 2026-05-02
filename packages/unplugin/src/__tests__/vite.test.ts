// Phase 3 Plan 06 Task 2 — Vite end-to-end integration test.
//
// This test exercises the full path-virtual chain:
//   1. Consumer imports a `.rozie` file from a real `.vue` page.
//   2. Vite calls our resolveId → rewrites to `<abs>/Counter.rozie.vue`.
//   3. Vite calls our load → returns compiled .vue source.
//   4. @vitejs/plugin-vue (configured via plugins[]) processes the .vue source.
//   5. The resulting JS module exposes a Vue component.
//
// This is the canonical sanity test that the chosen path-virtual works
// end-to-end with vite-plugin-vue.
import { describe, it, expect } from 'vitest';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import Rozie from '../vite.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync, rmSync, copyFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

describe('@rozie/unplugin/vite — end-to-end with @vitejs/plugin-vue', () => {
  it('compiles Counter.rozie through the full plugin chain to a Vue component', async () => {
    // Place the tmp project INSIDE the workspace so node-resolution finds vue / runtime-vue.
    const tmpRoot = resolve(__dirname, '..', '..', '.tmp-vite-' + Date.now());
    mkdirSync(tmpRoot, { recursive: true });
    try {
      // Copy Counter.rozie alongside a wrapper Vue page that imports it.
      const counterRozie = resolve(tmpRoot, 'Counter.rozie');
      copyFileSync(resolve(EXAMPLES, 'Counter.rozie'), counterRozie);
      const wrapper = resolve(tmpRoot, 'wrapper.vue');
      writeFileSync(
        wrapper,
        '<template><Counter /></template>\n<script setup>\nimport Counter from \'./Counter.rozie\';\n</script>\n',
      );

      const server = await createServer({
        root: tmpRoot,
        configFile: false,
        logLevel: 'error',
        plugins: [Rozie({ target: 'vue' }), vue()],
        server: { middlewareMode: true },
        appType: 'custom',
      });

      try {
        const mod = await server.ssrLoadModule(wrapper);
        expect(mod).toBeDefined();
        expect(mod.default).toBeDefined();
        const def = mod.default as Record<string, unknown>;
        const hasComponentShape =
          typeof def.render === 'function' ||
          typeof def.setup === 'function' ||
          '__vccOpts' in def ||
          '__file' in def ||
          '__name' in def;
        expect(hasComponentShape).toBe(true);
      } finally {
        await server.close();
      }
    } finally {
      if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
    }
  }, 30_000);

  it('compiles Counter.rozie directly (without a wrapper) — virtual id flows through to vue plugin', async () => {
    const tmpRoot = resolve(__dirname, '..', '..', '.tmp-vite-direct-' + Date.now());
    mkdirSync(tmpRoot, { recursive: true });
    try {
      copyFileSync(resolve(EXAMPLES, 'Counter.rozie'), resolve(tmpRoot, 'Counter.rozie'));

      const server = await createServer({
        root: tmpRoot,
        configFile: false,
        logLevel: 'error',
        plugins: [Rozie({ target: 'vue' }), vue()],
        server: { middlewareMode: true },
        appType: 'custom',
      });

      try {
        const counterRozie = resolve(tmpRoot, 'Counter.rozie');
        const mod = await server.ssrLoadModule(counterRozie);
        expect(mod).toBeDefined();
        expect(mod.default).toBeDefined();
      } finally {
        await server.close();
      }
    } finally {
      if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
