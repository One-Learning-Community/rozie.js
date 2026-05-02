// Phase 3 Plan 06 Task 1 — Wave 0 spike for D-25 transform-only path.
//
// Verifies the highest-risk Phase 3 assumption: that `@vitejs/plugin-vue`
// will pick up our `.vue`-shaped transform output for an id ending in `.rozie`
// when our plugin is registered with `enforce: 'pre'`. If this passes, Plan 06
// commits to path-d25; if it fails we fall back to path-virtual (resolveId →
// `\0rozie:<path>.vue`).
import { describe, it, expect } from 'vitest';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'node:path';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

function spikePluginD25() {
  return {
    name: 'rozie-spike-d25',
    enforce: 'pre' as const,
    transform(_code: string, id: string) {
      if (!id.endsWith('.rozie')) return null;
      return {
        code: '<template><div id="spike">hi</div></template>\n<script setup>\nconst x = 1;\n</script>\n',
        map: null,
      };
    },
  };
}

describe('D-25 spike — transform-only path (no virtual module)', () => {
  it('produces a Vue component module from a .rozie id', async () => {
    const tmpRoot = resolve(tmpdir(), 'rozie-spike-d25-' + Date.now());
    mkdirSync(tmpRoot, { recursive: true });
    try {
      const rozieFile = resolve(tmpRoot, 'Spike.rozie');
      writeFileSync(rozieFile, '<rozie name="Spike"></rozie>\n');

      const server = await createServer({
        root: tmpRoot,
        configFile: false,
        logLevel: 'error',
        plugins: [spikePluginD25(), vue()],
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
