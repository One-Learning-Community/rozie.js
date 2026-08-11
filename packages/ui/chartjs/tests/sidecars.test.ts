/**
 * sidecars.test.ts — the IDE-sidecar guard gate (D-05).
 *
 * GUARDS THE `4a095fdd` FAILURE MODE. `scripts/codegen.mjs` reads the leaf
 * `package.json` `version` AT GENERATION TIME when it builds the Vue leaf's
 * `web-types.json` / the Lit leaf's `custom-elements.json`. That makes the
 * generator correct by construction but leaves a WORKFLOW hole: a version bump
 * that lands WITHOUT a codegen regen leaves a stale committed sidecar, which
 * then silently re-dirties every subsequent whole-repo build (exactly what
 * commit `4a095fdd` had to clean up for tiptap-vue). This suite converts that
 * silent re-dirtying into a RED TEST.
 *
 * It also pins the package.json wiring (`web-types` / `customElements` fields
 * plus their `files` entries) and — the one invariant no earlier
 * `@rozie-ui` family needed — that BOTH sidecars enumerate all NINE
 * components (the generic `Chart` plus the 8 per-type variants), each with the
 * correct per-variant prop count (10, not 11 — no `type`).
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

const COMPONENT_NAMES = ['Chart', 'Line', 'Bar', 'Pie', 'Doughnut', 'PolarArea', 'Radar', 'Scatter', 'Bubble'];
const VARIANT_NAMES = COMPONENT_NAMES.filter((n) => n !== 'Chart');
const TAGS: Record<string, string> = {
  Chart: 'rozie-chart',
  Line: 'rozie-line',
  Bar: 'rozie-bar',
  Pie: 'rozie-pie',
  Doughnut: 'rozie-doughnut',
  PolarArea: 'rozie-polar-area',
  Radar: 'rozie-radar',
  Scatter: 'rozie-scatter',
  Bubble: 'rozie-bubble',
};

describe('vue leaf — web-types.json sidecar', () => {
  // THE 4a095fdd GUARD. If this fails, a version bump landed without a codegen
  // regen: run `pnpm --filter @rozie-ui/chartjs build` and commit the
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

  it('covers all nine components (generic Chart + 8 per-type variants)', () => {
    const comps = webTypes.contributions.html['vue-components'];
    expect(comps).toHaveLength(9);
    expect(comps.map((c: { name: string }) => c.name).sort()).toEqual([...COMPONENT_NAMES].sort());
  });

  it('the generic Chart carries all 11 props', () => {
    const comp = webTypes.contributions.html['vue-components'].find(
      (c: { name: string }) => c.name === 'Chart',
    );
    expect(comp.props).toHaveLength(11);
    expect(comp.props.map((p: { name: string }) => p.name)).toContain('type');
  });

  it.each(VARIANT_NAMES)('%s variant carries 10 props (no `type`)', (name) => {
    const comp = webTypes.contributions.html['vue-components'].find(
      (c: { name: string }) => c.name === name,
    );
    expect(comp, `no vue-components entry for ${name}`).toBeDefined();
    expect(comp.props).toHaveLength(10);
    expect(comp.props.map((p: { name: string }) => p.name)).not.toContain('type');
  });

  it('every component lists the same 3 events (click/hover/dataset-click, kebab-cased by IR passthrough)', () => {
    for (const name of COMPONENT_NAMES) {
      const comp = webTypes.contributions.html['vue-components'].find(
        (c: { name: string }) => c.name === name,
      );
      const events = comp.js.events.map((e: { name: string }) => e.name).sort();
      expect(events, `${name} events`).toEqual(['click', 'datasetClick', 'hover']);
    }
  });

  it('every component lists both slots (fallback, tooltip)', () => {
    for (const name of COMPONENT_NAMES) {
      const comp = webTypes.contributions.html['vue-components'].find(
        (c: { name: string }) => c.name === name,
      );
      const slots = comp.slots.map((s: { name: string }) => s.name).sort();
      expect(slots, `${name} slots`).toEqual(['fallback', 'tooltip']);
    }
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

  it('declares all nine custom elements (generic Chart + 8 per-type variants)', () => {
    const decls = cem.modules.flatMap((m: { declarations: unknown[] }) => m.declarations);
    expect(decls).toHaveLength(9);
    expect(decls.map((d: { name: string }) => d.name).sort()).toEqual([...COMPONENT_NAMES].sort());
  });

  // The real guard: each manifest tag must match the tag the EMITTED leaf
  // actually registers, not just a constant in this file.
  it.each(COMPONENT_NAMES)('%s: tagName matches the @customElement literal in the emitted leaf source', (name) => {
    const decl = cem.modules
      .flatMap((m: { declarations: { name: string; tagName: string }[] }) => m.declarations)
      .find((d: { name: string }) => d.name === name);
    expect(decl, `no CEM declaration for ${name}`).toBeDefined();
    expect(decl.tagName).toBe(TAGS[name]);

    const srcFile = name === 'Chart' ? 'Chart.ts' : `${name}.ts`;
    const src = readFileSync(resolve(LIT_DIR, 'src', srcFile), 'utf8');
    const m = src.match(/@customElement\(\s*'([^']+)'\s*\)/);
    expect(m, `no @customElement(...) found in lit/src/${srcFile}`).not.toBeNull();
    expect(m?.[1]).toBe(TAGS[name]);
  });

  it('the generic Chart declares all 15 expose verbs as CEM class members', () => {
    const decl = cem.modules
      .flatMap((m: { declarations: { name: string; members: { kind: string }[] }[] }) => m.declarations)
      .find((d: { name: string }) => d.name === 'Chart');
    const members = decl.members.filter((m: { kind: string }) => m.kind === 'method');
    expect(members).toHaveLength(15);
  });

  it.each(VARIANT_NAMES)('%s variant declares 10 fields (no `type`) and the same 15 expose verbs', (name) => {
    const decl = cem.modules
      .flatMap((m: { declarations: { name: string; members: { kind: string; name: string }[] }[] }) => m.declarations)
      .find((d: { name: string }) => d.name === name);
    const fields = decl.members.filter((m: { kind: string }) => m.kind === 'field');
    const methods = decl.members.filter((m: { kind: string }) => m.kind === 'method');
    expect(fields).toHaveLength(10);
    expect(fields.map((f: { name: string }) => f.name)).not.toContain('type');
    expect(methods).toHaveLength(15);
  });

  it('every declaration exports its own default + custom-element-definition (no shared/dropped defaults)', () => {
    for (const name of COMPONENT_NAMES) {
      const mod = cem.modules.find(
        (m: { declarations: { name: string }[] }) => m.declarations[0]?.name === name,
      );
      expect(mod, `no module for ${name}`).toBeDefined();
      const defaults = mod.exports.filter(
        (e: { kind: string; name: string }) => e.kind === 'js' && e.name === 'default',
      );
      expect(defaults, `${name} default export`).toHaveLength(1);
      const ceDefs = mod.exports.filter((e: { kind: string }) => e.kind === 'custom-element-definition');
      expect(ceDefs, `${name} custom-element-definition export`).toHaveLength(1);
      expect(ceDefs[0].name).toBe(TAGS[name]);
    }
  });
});
