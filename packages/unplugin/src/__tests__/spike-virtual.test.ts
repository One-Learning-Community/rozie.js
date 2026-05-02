// Phase 3 Plan 06 Task 1 — Wave 0 spike for path-virtual fallback.
//
// D-25 transform-only path failed in spike-d25.test.ts (vite-plugin-vue's
// transformInclude only matches *.vue ids; our .rozie id flowed through as JS
// and Vite's import-analysis rejected the SFC source). This spike verifies
// the path-virtual fallback: resolveId rewrites `Foo.rozie` to a virtual id
// ending in `.vue` so vite-plugin-vue's transformInclude (default `/\.vue$/`)
// matches, and load returns the .vue source.
//
// IMPORTANT: Vite's createFilter explicitly rejects ids containing `\0`
// (vite/dist/node/chunks/node.js line 1240: `if (id.includes("\0")) return false;`),
// so the conventional Rollup virtual-module prefix `\0` does NOT work here.
// We use a plain `<filename>.rozie.vue` synthetic-suffix id instead — no `\0`.
//
// If this passes, Plan 06 commits to path-virtual + amends D-25 in CONTEXT.md.
import { describe, it, expect } from 'vitest';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const VIRTUAL_SUFFIX = '.rozie.vue';

/**
 * Path-virtual variant: resolveId remaps `Foo.rozie` to `Foo.rozie.vue`,
 * load detects the synthetic suffix and reads the underlying `.rozie` file.
 * Because the virtual id ends with `.vue`, vite-plugin-vue's default
 * transformInclude regex `/\.vue$/` matches it naturally.
 */
function spikePluginVirtual() {
  return {
    name: 'rozie-spike-virtual',
    enforce: 'pre' as const,
    resolveId(id: string, importer: string | undefined) {
      if (id.endsWith('.rozie')) {
        const abs = id.startsWith('/') || /^[A-Z]:/.test(id)
          ? id
          : importer
            ? resolve(importer, '..', id)
            : resolve(id);
        return abs + '.vue'; // append .vue suffix so vite-plugin-vue picks it up
      }
      return null;
    },
    load(id: string) {
      if (!id.endsWith(VIRTUAL_SUFFIX)) return null;
      const filePath = id.slice(0, -'.vue'.length);
      void readFileSync(filePath, 'utf8');
      return {
        code: '<template><div id="spike">hi</div></template>\n<script setup>\nconst x = 1;\n</script>\n',
        map: null,
      };
    },
  };
}

describe('path-virtual spike — synthetic .vue-suffix virtual module', () => {
  it('produces a Vue component module from a .rozie id via virtual rewrite', async () => {
    // Place the tmpdir INSIDE the workspace so node-resolution finds vue.
    const tmpRoot = resolve(__dirname, '..', '..', '.tmp-spike-virtual-' + Date.now());
    mkdirSync(tmpRoot, { recursive: true });
    try {
      const rozieFile = resolve(tmpRoot, 'Spike.rozie');
      writeFileSync(rozieFile, '<rozie name="Spike"></rozie>\n');

      const server = await createServer({
        root: tmpRoot,
        configFile: false,
        logLevel: 'error',
        plugins: [spikePluginVirtual(), vue()],
        server: { middlewareMode: true },
        appType: 'custom',
      });

      try {
        const mod = await server.ssrLoadModule(rozieFile);
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
});
