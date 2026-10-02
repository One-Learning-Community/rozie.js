// Phase 75 Plan 01 Task 2 — buildManifest(ir): pure IR → RozieManifest
// serializer (D-03), proven against the real Combobox IR (the pair this
// phase graduates from vendored-B to published-A composition).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import type { IRComponent } from '../ir/types.js';
import { buildManifest } from './buildManifest.js';
import { MANIFEST_SCHEMA_VERSION } from './schema.js';

// This file lives at packages/core/src/manifest/buildManifest.test.ts →
// four `..` segments reach the repo root.
const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);

function loadComboboxIR() {
  const file = path.join(repoRoot, 'packages/ui/combobox/src/Combobox.rozie');
  const source = readFileSync(file, 'utf8');
  const { ast, diagnostics: parseDiags } = parse(source, {
    filename: 'Combobox.rozie',
  });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for Combobox.rozie: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) {
    throw new Error('lowerToIR() returned null IR for Combobox.rozie');
  }
  return ir;
}

describe('buildManifest', () => {
  it('performs no I/O (source contains no readFileSync/process.env/Date.now)', () => {
    const src = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'buildManifest.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/readFileSync/);
    expect(src).not.toMatch(/process\.env/);
    expect(src).not.toMatch(/Date\.now/);
  });

  it('derives schemaVersion === MANIFEST_SCHEMA_VERSION from the real Combobox IR', () => {
    const ir = loadComboboxIR();
    const manifest = buildManifest(ir);
    expect(manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    expect(manifest.schemaVersion).toBe(2);
  });

  it("derives emits === ['search', 'change', 'create'] from the real Combobox IR", () => {
    // Release-0.8.0: Combobox declares its events in an `<emits>` block, so the
    // manifest follows the block's DECLARATION order (it used to follow the
    // first textual `$emit` in the script: create, change, search). This
    // fixture test hardcodes the live component's surface, so it must track it.
    const ir = loadComboboxIR();
    const manifest = buildManifest(ir);
    expect(manifest.emits.map((e) => e.name)).toEqual(['search', 'change', 'create']);
  });

  it("derives expose === ['focus', 'clear', 'seedQuery', 'pinOpen', 'activeOption'] from the real Combobox IR", () => {
    const ir = loadComboboxIR();
    const manifest = buildManifest(ir);
    expect(manifest.expose.map((e) => e.name)).toEqual(['focus', 'clear', 'seedQuery', 'pinOpen', 'activeOption']);
  });

  it('at least one slot has non-empty params for the combobox scoped slots', () => {
    // Combobox's #option/#empty slots carry :option/:index/:active/:selected/
    // :disabled and :query scope bindings — these are the "scoped slots" D-01
    // requires the manifest to carry (the SlotDecl.params half of the
    // contract). NOTE: SlotDecl.paramTypes itself (a TSType[] populated from
    // `<script lang="ts">`) is a reserved-but-currently-unwired field — no
    // lowerer in this codebase populates it yet (verified: every slot on the
    // real, `<script lang="ts">`-authored Combobox.rozie IR has
    // `paramTypes === undefined`), so it is not asserted against the real IR
    // here. The paramTypes string round-trip mechanism itself is proven
    // below against a synthetic SlotDecl.
    const ir = loadComboboxIR();
    const manifest = buildManifest(ir);
    const scopedSlot = manifest.slots.find((s) => s.params.length > 0);
    expect(scopedSlot).toBeDefined();
    expect(scopedSlot!.params.map((p) => p.name)).toContain('option');
  });

  it('slot.paramTypes is null when the source SlotDecl.paramTypes is undefined', () => {
    // Release-0.8.0: every Combobox slot now authors `:param-types`, so the
    // undefined case is exercised by stripping them from a copy of the IR.
    const ir = loadComboboxIR();
    const stripped = { ...ir, slots: ir.slots.map((s) => ({ ...s, paramTypes: undefined })) };
    const manifest = buildManifest(stripped);
    for (const slot of manifest.slots) {
      expect(slot.paramTypes).toBeNull();
    }
    // ...and the authored ones serialize.
    expect(buildManifest(ir).slots.every((s) => s.paramTypes !== null)).toBe(true);
  });

  it('serializes a SlotDecl.paramTypes TSType[] into TS source strings (synthetic fixture)', () => {
    // buildManifest is a pure (ir) => manifest function — a synthetic minimal
    // IRComponent exercises the paramTypes serialization path directly,
    // independent of whether any lowerer currently populates this field from
    // real `.rozie` source.
    const stringType = t.tsStringKeyword();
    const numberType = t.tsNumberKeyword();
    const ir = {
      type: 'IRComponent',
      types: null,
      emitDecls: null,
      name: 'ParamTypesProbe',
      props: [],
      slots: [
        {
          type: 'SlotDecl',
          name: 'option',
          defaultContent: null,
          params: [
            { type: 'ParamDecl', name: 'label', valueExpression: { type: 'Identifier', name: 'label' } },
            { type: 'ParamDecl', name: 'index', valueExpression: { type: 'Identifier', name: 'index' } },
          ],
          paramTypes: [stringType, numberType],
          presence: 'always',
          nestedSlots: [],
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      emits: [],
      expose: [],
    } as unknown as IRComponent;

    const manifest = buildManifest(ir);
    expect(manifest.slots).toHaveLength(1);
    expect(manifest.slots[0]!.paramTypes).toEqual(['string', 'number']);
  });

  it('props map 1:1 from ir.props preserving order and load-bearing fields', () => {
    const ir = loadComboboxIR();
    const manifest = buildManifest(ir);
    expect(manifest.props.map((p) => p.name)).toEqual(ir.props.map((p) => p.name));
    for (let i = 0; i < ir.props.length; i++) {
      expect(manifest.props[i]!.isModel).toBe(ir.props[i]!.isModel);
      expect(manifest.props[i]!.required).toBe(ir.props[i]!.required);
      expect(typeof manifest.props[i]!.type).toBe('string');
    }
  });

  it('is deterministic — two calls on the same IR produce byte-identical JSON', () => {
    const ir = loadComboboxIR();
    const a = JSON.stringify(buildManifest(ir));
    const b = JSON.stringify(buildManifest(ir));
    expect(a).toBe(b);
  });
});
