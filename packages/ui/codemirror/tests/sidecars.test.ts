/**
 * sidecars.test.ts — the IDE-sidecar guard gate (D-05).
 *
 * GUARDS THE `4a095fdd` FAILURE MODE. `scripts/codegen.mjs` reads the leaf
 * `package.json` `version` AT GENERATION TIME when it builds the Vue leaf's
 * `web-types.json` / the Lit leaf's `custom-elements.json`. That makes the
 * generator correct by construction but leaves a WORKFLOW hole: a version bump
 * that lands WITHOUT a codegen regen leaves a stale committed sidecar, which
 * then silently re-dirties every subsequent whole-repo build (exactly what
 * commit `4a095fdd` had to clean up for tiptap-vue, 0.1.1 → 0.2.0). This suite
 * converts that silent re-dirtying into a RED TEST.
 *
 * It also pins the package.json wiring (`web-types` / `customElements` fields
 * plus their `files` entries — the guarded push must not duplicate).
 *
 * The Lit tag assertion is deliberately NOT a restatement of a constant: the
 * manifest `tagName` is checked against the `@customElement('…')` literal
 * actually present in the emitted leaf source. That makes this a real guard
 * against the manifest and the emitted element drifting apart.
 *
 * Files are read with readFileSync + JSON.parse (matching surface.test.ts's
 * style) rather than a `resolveJsonModule` import, so no tsconfig change is
 * needed.
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

const TAG = 'rozie-code-mirror';

describe('vue leaf — web-types.json sidecar', () => {
  // THE 4a095fdd GUARD. If this fails, a version bump landed without a codegen
  // regen: run `pnpm --filter @rozie-ui/codemirror build` and commit the
  // regenerated sidecar. Do NOT hand-edit web-types.json — it is a generated
  // artifact.
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
    expect(vuePkg.files.filter((f: string) => f === 'web-types.json')).toHaveLength(1);
  });

  it('covers the CodeMirror component with all 10 props', () => {
    const comps = webTypes.contributions.html['vue-components'];
    expect(comps).toHaveLength(1);
    expect(comps[0].name).toBe('CodeMirror');
    expect(comps[0].props.map((p: { name: string }) => p.name)).toHaveLength(10);
  });

  it('lists the value prop\'s update:value model event', () => {
    const events = webTypes.contributions.html['vue-components'][0].js.events.map(
      (e: { name: string }) => e.name,
    );
    expect(events).toContain('update:value');
  });

  it('lists all 5 portal slots', () => {
    const slots = webTypes.contributions.html['vue-components'][0].slots.map(
      (s: { name: string }) => s.name,
    );
    expect(slots.sort()).toEqual(
      ['decoration', 'gutter', 'panel', 'tooltip', 'topPanel'].sort(),
    );
  });
});

describe('lit leaf — custom-elements.json manifest', () => {
  it('package.json wires the `customElements` field', () => {
    expect(litPkg.customElements).toBe('custom-elements.json');
  });

  it('package.json ships custom-elements.json in `files`, exactly once', () => {
    expect(litPkg.files).toContain('custom-elements.json');
    expect(litPkg.files.filter((f: string) => f === 'custom-elements.json')).toHaveLength(1);
  });

  it('declares the rozie-code-mirror custom element', () => {
    const decls = cem.modules[0].declarations;
    expect(decls).toHaveLength(1);
    expect(decls[0].tagName).toBe(TAG);
    expect(decls[0].name).toBe('CodeMirror');
  });

  // The real guard: the manifest tag must match the tag the EMITTED leaf
  // actually registers, not just a constant in this file.
  it('tagName matches the @customElement literal in the emitted leaf source', () => {
    const src = readFileSync(resolve(LIT_DIR, 'src', 'CodeMirror.ts'), 'utf8');
    const m = src.match(/@customElement\(\s*'([^']+)'\s*\)/);
    expect(m, 'no @customElement(...) found in lit/src/CodeMirror.ts').not.toBeNull();
    expect(m?.[1]).toBe(TAG);
  });

  it('lists all 12 exposed methods as CEM class members', () => {
    const members = cem.modules[0].declarations[0].members.filter(
      (m: { kind: string }) => m.kind === 'method',
    );
    expect(members).toHaveLength(12);
  });

  it('lists the value-change model event (Lit two-way writeback)', () => {
    const events = cem.modules[0].declarations[0].events.map((e: { name: string }) => e.name);
    expect(events).toContain('value-change');
  });

  it('exports the default + the custom-element-definition', () => {
    const exports = cem.modules[0].exports;
    const defaults = exports.filter(
      (e: { kind: string; name: string }) => e.kind === 'js' && e.name === 'default',
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].declaration.name).toBe('CodeMirror');

    const ceDefs = exports.filter((e: { kind: string }) => e.kind === 'custom-element-definition');
    expect(ceDefs).toHaveLength(1);
    expect(ceDefs[0].name).toBe(TAG);
  });
});
