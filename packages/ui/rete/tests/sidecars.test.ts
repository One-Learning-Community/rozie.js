/**
 * sidecars.test.ts — the IDE-sidecar guard gate.
 *
 * GUARDS THE `4a095fdd` FAILURE MODE. `scripts/codegen.mjs` reads the leaf
 * `package.json` `version` AT GENERATION TIME when it builds the Vue leaf's
 * `web-types.json`. That makes the generator correct by construction but leaves a
 * WORKFLOW hole: a version bump that lands WITHOUT a codegen regen leaves a stale
 * committed sidecar, which then silently re-dirties every subsequent whole-repo
 * build (exactly what commit `4a095fdd` had to clean up for tiptap-vue, 0.1.1 →
 * 0.2.0). This suite converts that silent re-dirtying into a RED TEST.
 *
 * It also pins the package.json wiring (`web-types` / `customElements` fields plus
 * their `files` entries — the guarded push must not duplicate) and the 3-component
 * coverage, so dropping a component from a sidecar fails loudly.
 *
 * The Lit tag assertions are deliberately NOT a restatement of a constant: each
 * `tagName` in the manifest is checked against the `@customElement('…')` literal
 * actually present in the corresponding emitted leaf source. That makes this a real
 * guard against the manifest and the emitted element drifting apart.
 *
 * Files are read with readFileSync + JSON.parse (matching surface.test.ts's style)
 * rather than a `resolveJsonModule` import, so no tsconfig change is needed.
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

/** The components the family ships, in codegen (COMPONENTS) order. */
const COMPONENTS = ['FlowCanvas', 'NodeType', 'Port'];
/** Their custom-element tags, same order. */
const TAGS = ['rozie-flow-canvas', 'rozie-node-type', 'rozie-port'];

const countOf = (arr: string[], v: string) => arr.filter((x) => x === v).length;

describe('vue leaf — web-types.json sidecar', () => {
  // THE 4a095fdd GUARD. If this fails, a version bump landed without a codegen
  // regen: run `pnpm --filter @rozie-ui/rete build` and commit the regenerated
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

  it('covers all three components, in order', () => {
    const names = webTypes.contributions.html['vue-components'].map(
      (c: { name: string }) => c.name,
    );
    expect(names).toEqual(COMPONENTS);
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

  it('declares all three custom elements, in order', () => {
    const tags = cem.modules[0].declarations.map((d: { tagName: string }) => d.tagName);
    expect(tags).toEqual(TAGS);
  });

  // The real guard: the manifest tag must match the tag the EMITTED leaf actually
  // registers, not just a constant in this file.
  it.each(COMPONENTS.map((name, i) => [name, TAGS[i]] as const))(
    '%s tagName matches the @customElement literal in the emitted leaf source',
    (name, tag) => {
      const src = readFileSync(resolve(LIT_DIR, 'src', `${name}.ts`), 'utf8');
      const m = src.match(/@customElement\(\s*'([^']+)'\s*\)/);
      expect(m, `no @customElement(...) found in lit/src/${name}.ts`).not.toBeNull();
      expect(m?.[1]).toBe(tag);

      const decl = cem.modules[0].declarations.find(
        (d: { name: string }) => d.name === name,
      );
      expect(decl, `no CEM declaration for ${name}`).toBeTruthy();
      expect(decl.tagName).toBe(tag);
    },
  );

  // Three `default` exports would be a malformed manifest AND a lie about the
  // barrel, whose default is FlowCanvas. The codegen merge drops the children's.
  it('exports exactly one `default` — the barrel default (FlowCanvas)', () => {
    const defaults = cem.modules[0].exports.filter(
      (e: { kind: string; name: string }) => e.kind === 'js' && e.name === 'default',
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].declaration.name).toBe('FlowCanvas');
  });

  it('exports one custom-element-definition per tag', () => {
    const defs = cem.modules[0].exports
      .filter((e: { kind: string }) => e.kind === 'custom-element-definition')
      .map((e: { name: string }) => e.name);
    expect(defs).toEqual(TAGS);
  });
});
