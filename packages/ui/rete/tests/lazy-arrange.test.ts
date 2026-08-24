/**
 * lazy-arrange.test.ts — the auto-arrange payload guard.
 *
 * GUARDS THE 260823-qgi FAILURE MODE. `rete-auto-arrange-plugin` and `elkjs` are
 * declared OPTIONAL peers in all six leaves, and the FlowCanvas source says in prose
 * that "only a consumer calling autoArrange() pulls these in". Before this guard
 * existed, that sentence was false: the import was STATIC and the plugin was
 * constructed unconditionally at mount, so every consumer of <FlowCanvas> — arranging
 * or not — resolved `elkjs@0.8.2/lib/elk.bundled.js` (1.5 MB of GWT-transpiled Java,
 * one opaque non-tree-shakeable blob) into their main chunk. Optional-to-INSTALL is
 * not optional-to-SHIP, and nothing in the battery noticed the difference.
 *
 * The assertion is on the COMMITTED emitted leaf sources rather than on `dist/`, so it
 * is hermetic — it runs in a clean checkout with no leaf build. Each leaf's dist is a
 * pure function of its src (the specifier is external in every leaf bundler config), so
 * a static import in src is what would put elk back in a consumer's main chunk.
 *
 * Read with readFileSync (matching sidecars.test.ts / surface.test.ts style) rather than
 * compiling — the point is to pin what actually ships, not what the compiler would do.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKGS = resolve(HERE, '..', 'packages');

/** The emitted FlowCanvas leaf source per target — the file that ships. */
const LEAVES: Array<[target: string, relPath: string]> = [
  ['react', 'react/src/FlowCanvas.tsx'],
  ['vue', 'vue/src/FlowCanvas.vue'],
  ['svelte', 'svelte/src/FlowCanvas.svelte'],
  ['angular', 'angular/src/FlowCanvas.ts'],
  ['solid', 'solid/src/FlowCanvas.tsx'],
  ['lit', 'lit/src/FlowCanvas.ts'],
];

const PLUGIN = 'rete-auto-arrange-plugin';

/**
 * A STATIC import of the arrange plugin — `import … from 'rete-auto-arrange-plugin'`.
 * Deliberately anchored to the statement form so the dynamic `import('…')` call
 * expression (which is the whole point of the fix) does NOT match: a static import
 * statement has no `(` between `import` and the specifier.
 */
const STATIC_IMPORT = new RegExp(String.raw`^\s*import\s+[^(;]*?from\s*['"]${PLUGIN}['"]`, 'm');

/** The lazy form: `import('rete-auto-arrange-plugin')` as a call expression. */
const DYNAMIC_IMPORT = new RegExp(String.raw`\bimport\s*\(\s*['"]${PLUGIN}['"]\s*\)`);

describe('auto-arrange engine is lazily loaded (elkjs stays out of the default bundle)', () => {
  for (const [target, relPath] of LEAVES) {
    const src = readFileSync(resolve(PKGS, relPath), 'utf8');

    it(`${target}: does not STATICALLY import ${PLUGIN}`, () => {
      const offender = src.split('\n').find((l) => STATIC_IMPORT.test(l));
      expect(
        offender ?? null,
        `${relPath} statically imports ${PLUGIN}, which drags elkjs (1.5 MB) into every ` +
          `consumer bundle whether or not autoArrange() is ever called. Load it on first ` +
          `call instead — see .planning/quick/260823-qgi-lazy-elkjs-auto-arrange/PLAN.md.`,
      ).toBeNull();
    });

    it(`${target}: loads ${PLUGIN} via a dynamic import`, () => {
      expect(
        DYNAMIC_IMPORT.test(src),
        `${relPath} has no dynamic import('${PLUGIN}') — autoArrange() cannot load its ` +
          `engine, so the verb would be dead.`,
      ).toBe(true);
    });
  }

  it('the arrange plugin is not constructed eagerly at mount on any target', () => {
    // `new AutoArrangePlugin()` reachable outside the lazy loader means the engine is
    // pulled in at mount again. The lazy form goes through the resolved module object
    // (`new m.AutoArrangePlugin()`), so a BARE `new AutoArrangePlugin(` is the tell.
    const eager = LEAVES.filter(([, relPath]) =>
      /\bnew\s+AutoArrangePlugin\s*\(/.test(readFileSync(resolve(PKGS, relPath), 'utf8')),
    ).map(([target]) => target);
    expect(eager, `eager AutoArrangePlugin construction on: ${eager.join(', ')}`).toEqual([]);
  });
});
