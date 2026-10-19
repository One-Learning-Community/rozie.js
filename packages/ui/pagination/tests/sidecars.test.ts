/**
 * sidecars.test.ts — the IDE-sidecar guard gate (D-05, ported from the
 * wavesurfer/codemirror/rete precedent; quick 261018-vdu).
 *
 * GUARDS THE `4a095fdd` FAILURE MODE. `scripts/codegen.mjs` reads the leaf
 * `package.json` `version` AT GENERATION TIME when it builds the Vue leaf's
 * `web-types.json` / the Lit leaf's `custom-elements.json`. That makes the
 * generator correct by construction but leaves a WORKFLOW hole: a version bump
 * that lands WITHOUT a codegen regen leaves a stale committed sidecar, which
 * then silently re-dirties every subsequent whole-repo build. This suite
 * converts that silent re-dirtying into a RED TEST (after `changeset version`,
 * re-run `pnpm --filter @rozie-ui/pagination build` and commit the sidecars).
 *
 * It also pins the package.json wiring (`web-types` / `customElements` fields
 * plus their `files` entries — the guarded push must not duplicate).
 *
 * Every count and name below is derived from a FRESH `parse()`/`lowerToIR()` of
 * Pagination.rozie (the same primitive tests/surface.test.ts uses), never a
 * hardcoded number: a title or assertion that hand-counted the surface would be
 * the hand-count-rot class the audit flagged.
 *
 * The Lit assertions are deliberately NOT restatements of constants: the
 * manifest `tagName`, every attribute name and the model-change event are
 * checked against the `@customElement` / `attribute:` / `eventName:` literals
 * actually present in the emitted leaf source, so the manifest and the emitted
 * element cannot drift apart.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(HERE, '..', 'src', 'Pagination.rozie');
const PKGS = resolve(HERE, '..', 'packages');

const readJson = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
/** camelCase -> kebab-case, as the Lit emitter derives attribute / event names. */
const kebab = (name: string) =>
  name.replace(/([a-z0-9]|[A-Z](?=[A-Z][a-z]))([A-Z])/g, '$1-$2').toLowerCase();

const source = readFileSync(SRC, 'utf8');
const { ast } = parse(source, { filename: 'Pagination.rozie' });
const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });

const VUE_DIR = resolve(PKGS, 'vue');
const LIT_DIR = resolve(PKGS, 'lit');

const vuePkg = readJson(resolve(VUE_DIR, 'package.json'));
const litPkg = readJson(resolve(LIT_DIR, 'package.json'));
const webTypes = readJson(resolve(VUE_DIR, 'web-types.json'));
const cem = readJson(resolve(LIT_DIR, 'custom-elements.json'));

const TAG = 'rozie-pagination';
const modelNames: string[] = ir.props
  .filter((p: { isModel?: boolean }) => p.isModel)
  .map((p: { name: string }) => p.name);

describe('vue leaf — web-types.json sidecar', () => {
  // THE 4a095fdd GUARD. If this fails, a version bump landed without a
  // codegen regen: run `pnpm --filter @rozie-ui/pagination build` and commit
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

  it('covers the Pagination component with every prop from the IR', () => {
    const comps = webTypes.contributions.html['vue-components'];
    expect(comps).toHaveLength(1);
    expect(comps[0].name).toBe('Pagination');
    expect(comps[0].props.map((p: { name: string }) => p.name)).toEqual(
      ir.props.map((p: { name: string }) => kebab(p.name)),
    );
  });

  it("lists every model prop's update:<prop> event", () => {
    const events = webTypes.contributions.html['vue-components'][0].js.events.map(
      (e: { name: string }) => e.name,
    );
    expect(modelNames.length).toBeGreaterThan(0);
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

  it('lists every slot from the IR', () => {
    const slots = webTypes.contributions.html['vue-components'][0].slots.map(
      (s: { name: string }) => s.name,
    );
    expect(slots).toEqual(
      ir.slots.map((s: { name: string }) => (s.name === '' ? 'default' : s.name)),
    );
  });
});

describe('lit leaf — custom-elements.json manifest', () => {
  const litSource = readFileSync(resolve(LIT_DIR, 'src', 'Pagination.ts'), 'utf8');

  it('package.json wires the `customElements` field', () => {
    expect(litPkg.customElements).toBe('custom-elements.json');
  });

  it('package.json ships custom-elements.json in `files`, exactly once', () => {
    expect(litPkg.files).toContain('custom-elements.json');
    expect(litPkg.files.filter((f: string) => f === 'custom-elements.json')).toHaveLength(1);
  });

  it('declares the Pagination custom element', () => {
    const decls = cem.modules[0].declarations;
    expect(decls).toHaveLength(1);
    expect(decls[0].tagName).toBe(TAG);
    expect(decls[0].name).toBe('Pagination');
  });

  // The real guard: the manifest tag must match the tag the EMITTED leaf
  // actually registers, not just a constant in this file.
  it('tagName matches the @customElement literal in the emitted leaf source', () => {
    const m = litSource.match(/@customElement\(\s*'([^']+)'\s*\)/);
    expect(m, 'no @customElement(...) found in lit/src/Pagination.ts').not.toBeNull();
    expect(m?.[1]).toBe(TAG);
  });

  // Every manifest attribute must be the attribute the emitted element observes:
  // an explicit `attribute: '<name>'` literal, or (for a single lowercase word)
  // Lit's default, i.e. a `@property` field of that name.
  it('every attribute is one the emitted leaf actually observes', () => {
    const attrs = cem.modules[0].declarations[0].attributes as Array<{ name: string; fieldName: string }>;
    expect(attrs.map((a) => a.fieldName)).toEqual(ir.props.map((p: { name: string }) => p.name));
    for (const a of attrs) {
      const explicit = litSource.includes(`attribute: '${a.name}'`);
      const defaulted = new RegExp(`@property\\(\\{[^}]*\\}\\)\\s+${a.fieldName}\\b`).test(litSource);
      expect(explicit || (defaulted && a.name === a.fieldName.toLowerCase()), `attribute ${a.name}`).toBe(true);
    }
  });

  it('lists every exposed method from the IR as a CEM class member', () => {
    const members = cem.modules[0].declarations[0].members.filter(
      (m: { kind: string }) => m.kind === 'method',
    );
    expect(members).toHaveLength(ir.expose.length);
    const memberNames = members.map((m: { name: string }) => m.name).sort();
    expect(memberNames).toEqual([...ir.expose.map((e: { name: string }) => e.name)].sort());
  });

  it("lists every model prop's <prop>-change event, as the emitted element dispatches it", () => {
    const events = cem.modules[0].declarations[0].events.map((e: { name: string }) => e.name);
    for (const name of modelNames) {
      const evt = `${kebab(name)}-change`;
      expect(events).toContain(evt);
      expect(litSource).toContain(`'${evt}'`);
    }
  });

  it('lists every source emit, as the emitted element dispatches it', () => {
    const events = cem.modules[0].declarations[0].events.map((e: { name: string }) => e.name);
    for (const emitName of ir.emits) {
      expect(events).toContain(kebab(emitName));
      expect(litSource).toContain(`"${kebab(emitName)}"`);
    }
  });

  it('exports the default + the custom-element-definition', () => {
    const exports = cem.modules[0].exports;
    const defaults = exports.filter(
      (e: { kind: string; name: string }) => e.kind === 'js' && e.name === 'default',
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].declaration.name).toBe('Pagination');

    const ceDefs = exports.filter((e: { kind: string }) => e.kind === 'custom-element-definition');
    expect(ceDefs).toHaveLength(1);
    expect(ceDefs[0].name).toBe(TAG);
  });
});
