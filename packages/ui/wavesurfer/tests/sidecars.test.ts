/**
 * sidecars.test.ts — the IDE-sidecar guard gate (D-05, ported from the
 * codemirror/rete precedent).
 *
 * GUARDS THE `4a095fdd` FAILURE MODE. `scripts/codegen.mjs` reads the leaf
 * `package.json` `version` AT GENERATION TIME when it builds the Vue leaf's
 * `web-types.json` / the Lit leaf's `custom-elements.json`. That makes the
 * generator correct by construction but leaves a WORKFLOW hole: a version bump
 * that lands WITHOUT a codegen regen leaves a stale committed sidecar, which
 * then silently re-dirties every subsequent whole-repo build. This suite
 * converts that silent re-dirtying into a RED TEST.
 *
 * It also pins the package.json wiring (`web-types` / `customElements` fields
 * plus their `files` entries — the guarded push must not duplicate).
 *
 * Every count assertion below is derived from a FRESH `parse()`/`lowerToIR()`
 * of Waveform.rozie (the same primitive tests/surface.test.ts uses), never a
 * hardcoded number — a title or assertion that hand-counted the surface would
 * be exactly the hand-count-rot class the 260811-kt2 audit flagged and fixed
 * elsewhere in this family.
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
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'Waveform.rozie');
const PKGS = resolve(HERE, '..', 'packages');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));

const source = readFileSync(SRC, 'utf8');
const { ast } = parse(source, { filename: 'Waveform.rozie' });
const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

const VUE_DIR = resolve(PKGS, 'vue');
const LIT_DIR = resolve(PKGS, 'lit');

const vuePkg = readJson(resolve(VUE_DIR, 'package.json'));
const litPkg = readJson(resolve(LIT_DIR, 'package.json'));
const webTypes = readJson(resolve(VUE_DIR, 'web-types.json'));
const cem = readJson(resolve(LIT_DIR, 'custom-elements.json'));

const TAG = 'rozie-waveform';

describe('vue leaf — web-types.json sidecar', () => {
  // THE 4a095fdd GUARD. If this fails, a version bump landed without a
  // codegen regen: run `pnpm --filter @rozie-ui/wavesurfer build` and commit
  // the regenerated sidecar. Do NOT hand-edit web-types.json — it is a
  // generated artifact.
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

  it('covers the Waveform component with every prop from the IR', () => {
    const comps = webTypes.contributions.html['vue-components'];
    expect(comps).toHaveLength(1);
    expect(comps[0].name).toBe('Waveform');
    expect(comps[0].props.map((p: { name: string }) => p.name)).toHaveLength(ir.props.length);
  });

  it('lists both model props\' update:<prop> events', () => {
    const events = webTypes.contributions.html['vue-components'][0].js.events.map(
      (e: { name: string }) => e.name,
    );
    const modelNames = ir.props.filter((p: { isModel?: boolean }) => p.isModel).map((p: { name: string }) => p.name);
    expect(modelNames.sort()).toEqual(['currentTime', 'regions']);
    for (const name of modelNames) {
      expect(events).toContain(`update:${name}`);
    }
  });

  it('lists every source emit as an event, alongside the model events', () => {
    const events = webTypes.contributions.html['vue-components'][0].js.events.map(
      (e: { name: string }) => e.name,
    );
    for (const emitName of ir.emits) {
      expect(events).toContain(emitName);
    }
  });

  it('declares no slots', () => {
    const slots = webTypes.contributions.html['vue-components'][0].slots;
    expect(slots).toHaveLength(0);
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

  it('declares the rozie-waveform custom element', () => {
    const decls = cem.modules[0].declarations;
    expect(decls).toHaveLength(1);
    expect(decls[0].tagName).toBe(TAG);
    expect(decls[0].name).toBe('Waveform');
  });

  // The real guard: the manifest tag must match the tag the EMITTED leaf
  // actually registers, not just a constant in this file.
  it('tagName matches the @customElement literal in the emitted leaf source', () => {
    const src = readFileSync(resolve(LIT_DIR, 'src', 'Waveform.ts'), 'utf8');
    const m = src.match(/@customElement\(\s*'([^']+)'\s*\)/);
    expect(m, 'no @customElement(...) found in lit/src/Waveform.ts').not.toBeNull();
    expect(m?.[1]).toBe(TAG);
  });

  it('lists every exposed method from the IR as a CEM class member', () => {
    const members = cem.modules[0].declarations[0].members.filter(
      (m: { kind: string }) => m.kind === 'method',
    );
    expect(members).toHaveLength(ir.expose.length);
    const memberNames = members.map((m: { name: string }) => m.name).sort();
    expect(memberNames).toEqual([...ir.expose.map((e: { name: string }) => e.name)].sort());
  });

  it('lists both model props\' <prop>-change writeback events', () => {
    const events = cem.modules[0].declarations[0].events.map((e: { name: string }) => e.name);
    expect(events).toContain('currentTime-change');
    expect(events).toContain('regions-change');
  });

  it('exports the default + the custom-element-definition', () => {
    const exports = cem.modules[0].exports;
    const defaults = exports.filter(
      (e: { kind: string; name: string }) => e.kind === 'js' && e.name === 'default',
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].declaration.name).toBe('Waveform');

    const ceDefs = exports.filter((e: { kind: string }) => e.kind === 'custom-element-definition');
    expect(ceDefs).toHaveLength(1);
    expect(ceDefs[0].name).toBe(TAG);
  });
});
