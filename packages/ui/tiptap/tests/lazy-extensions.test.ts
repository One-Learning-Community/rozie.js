/**
 * lazy-extensions.test.ts — TipTap's optional peers must actually be optional.
 *
 * Reported from dogfooding (oinbox): `@tiptap/extension-character-count` is declared an
 * optional peer, yet a consumer that never sets `maxLength` still has to install it. True —
 * and for three more: character-count, floating-menu and image were all statically imported
 * by every leaf, so a missing one broke the consumer's build whatever the `optional` flag
 * said. Optional-to-install is not optional-to-ship (cf. rete/tests/lazy-arrange.test.ts).
 *
 * The contract now:
 *   - character-count (maxLength / #count), floating-menu (#floatingMenu) and image
 *     (uploadImage) are loaded with a dynamic `import()` only when their feature is used —
 *     never statically;
 *   - bubble-menu is NOT optional: the built-in link editor is a BubbleMenu surface mounted
 *     on every editor, so the leaves declare it a required peer instead of pretending.
 *
 * Asserted on the COMMITTED emitted leaf sources (hermetic, no build): each leaf's dist is a
 * pure function of its src, and the specifiers are external in every leaf bundler.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKGS = resolve(HERE, '..', 'packages');

const LEAVES: Array<[target: string, relPath: string]> = [
  ['react', 'react/src/TipTap.tsx'],
  ['vue', 'vue/src/TipTap.vue'],
  ['svelte', 'svelte/src/TipTap.svelte'],
  ['angular', 'angular/src/TipTap.ts'],
  ['solid', 'solid/src/TipTap.tsx'],
  ['lit', 'lit/src/TipTap.ts'],
];

const LAZY = ['@tiptap/extension-character-count', '@tiptap/extension-floating-menu', '@tiptap/extension-image'];
const REQUIRED = '@tiptap/extension-bubble-menu';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const staticImport = (pkg: string) => new RegExp(String.raw`^\s*import\s+[^(;]*?from\s*['"]${esc(pkg)}['"]`, 'm');
const dynamicImport = (pkg: string) => new RegExp(String.raw`\bimport\s*\(\s*['"]${esc(pkg)}['"]\s*\)`);

describe('TipTap conditional extensions are lazily loaded', () => {
  for (const [target, relPath] of LEAVES) {
    const src = readFileSync(resolve(PKGS, relPath), 'utf8');
    for (const pkg of LAZY) {
      it(`${target}: ${pkg} is imported lazily, never statically`, () => {
        expect(staticImport(pkg).test(src), `${relPath} statically imports ${pkg}`).toBe(false);
        expect(dynamicImport(pkg).test(src), `${relPath} has no import('${pkg}')`).toBe(true);
      });
    }
  }
});

describe('TipTap peer declarations tell the truth', () => {
  for (const [target] of LEAVES) {
    const pkg = JSON.parse(readFileSync(resolve(PKGS, target, 'package.json'), 'utf8'));
    it(`${target}: ${REQUIRED} is a REQUIRED peer (the link editor always mounts a BubbleMenu)`, () => {
      expect(pkg.peerDependencies?.[REQUIRED]).toBeTruthy();
      expect(pkg.peerDependenciesMeta?.[REQUIRED]?.optional ?? false).toBe(false);
    });
    it(`${target}: the lazily-loaded extensions are optional peers`, () => {
      for (const p of LAZY) expect(pkg.peerDependenciesMeta?.[p]?.optional, p).toBe(true);
    });
  }
});
