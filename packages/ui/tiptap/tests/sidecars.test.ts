/**
 * sidecars.test.ts — the IDE-sidecar guard gate (backport of rete's, the
 * `4a095fdd` failure mode's reference shape — see RELEASING.md §6 item 9).
 *
 * `scripts/codegen.mjs` reads the leaf `package.json` `version` AT GENERATION
 * TIME when it builds the Vue leaf's `web-types.json`. Correct by construction,
 * but a version bump that lands WITHOUT a codegen regen leaves a stale committed
 * sidecar that silently re-dirties every subsequent whole-repo build — exactly
 * what commit `4a095fdd` had to clean up for THIS family (tiptap-vue,
 * 0.1.1 → 0.2.0). This suite converts that silent re-dirtying into a RED TEST.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKGS = resolve(HERE, '..', 'packages');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

const VUE_DIR = resolve(PKGS, 'vue');
const LIT_DIR = resolve(PKGS, 'lit');

const vuePkg = readJson(resolve(VUE_DIR, 'package.json'));
const litPkg = readJson(resolve(LIT_DIR, 'package.json'));
const webTypes = readJson(resolve(VUE_DIR, 'web-types.json'));
const cem = readJson(resolve(LIT_DIR, 'custom-elements.json'));

const COMPONENT = 'TipTap';
const TAG = 'rozie-tip-tap';

const countOf = (arr: string[], v: string) => arr.filter((x) => x === v).length;

describe('vue leaf — web-types.json sidecar', () => {
  // THE 4a095fdd GUARD. If this fails, a version bump landed without a codegen
  // regen: run `pnpm --filter @rozie-ui/tiptap build` and commit the regenerated
  // sidecar. Do NOT hand-edit web-types.json — it is a generated artifact.
  it('version is in lockstep with the leaf package.json version', () => {
    expect(webTypes.version).toBe(vuePkg.version);
  });

  it('identifies the leaf package and the vue framework', () => {
    expect(webTypes.name).toBe(vuePkg.name);
    expect(webTypes.framework).toBe('vue');
  });

  it('package.json wires the `web-types` field', () => {
    expect(vuePkg['web-types']).toBe('./web-types.json');
  });

  it('package.json ships web-types.json in `files`, exactly once', () => {
    expect(vuePkg.files).toContain('web-types.json');
    expect(countOf(vuePkg.files, 'web-types.json')).toBe(1);
  });

  it('covers the component', () => {
    const names = webTypes.contributions.html['vue-components'].map(
      (c: { name: string }) => c.name,
    );
    expect(names).toEqual([COMPONENT]);
  });
});

describe('lit leaf — custom-elements.json manifest', () => {
  it('package.json wires the `customElements` field', () => {
    expect(litPkg.customElements).toBe('custom-elements.json');
  });

  it('package.json ships custom-elements.json in `files`, exactly once', () => {
    expect(litPkg.files).toContain('custom-elements.json');
    expect(countOf(litPkg.files, 'custom-elements.json')).toBe(1);
  });

  // The real guard: the manifest tag must match the tag the EMITTED leaf
  // actually registers, not just a constant in this file.
  it('tagName matches the @customElement literal in the emitted leaf source', () => {
    const src = readFileSync(resolve(LIT_DIR, 'src', `${COMPONENT}.ts`), 'utf8');
    const m = src.match(/@customElement\(\s*'([^']+)'\s*\)/);
    expect(m, `no @customElement(...) found in lit/src/${COMPONENT}.ts`).not.toBeNull();
    expect(m?.[1]).toBe(TAG);

    const tags = cem.modules[0].declarations.map((d: { tagName: string }) => d.tagName);
    expect(tags).toEqual([TAG]);
  });

  it('exports exactly one `default` and one custom-element-definition', () => {
    const defaults = cem.modules[0].exports.filter(
      (e: { kind: string; name: string }) => e.kind === 'js' && e.name === 'default',
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].declaration.name).toBe(COMPONENT);

    const defs = cem.modules[0].exports
      .filter((e: { kind: string }) => e.kind === 'custom-element-definition')
      .map((e: { name: string }) => e.name);
    expect(defs).toEqual([TAG]);
  });
});
