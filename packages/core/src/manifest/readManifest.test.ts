// Phase 75 Plan 01 Task 3 — parseManifest(json): validate schema-version
// loudly (D-04) + deserialize into a threadParamTypes/validateTwoWayBindings-
// consumable producer surface. Never throws (D-08-style collected-not-thrown
// discipline extended to the manifest boundary).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { buildManifest } from './buildManifest.js';
import { parseManifest } from './readManifest.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);

function loadComboboxManifest() {
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
  return buildManifest(ir);
}

describe('parseManifest — round-trip identity', () => {
  it('buildManifest → JSON.stringify → JSON.parse → parseManifest round-trips the real Combobox manifest', () => {
    const manifest = loadComboboxManifest();
    const wire = JSON.parse(JSON.stringify(manifest));
    const { surface, error } = parseManifest(wire);

    expect(error).toBeNull();
    expect(surface).not.toBeNull();
    expect(surface!.props.map((p) => p.name)).toEqual(manifest.props.map((p) => p.name));
    expect(surface!.props.map((p) => p.isModel)).toEqual(manifest.props.map((p) => p.isModel));
    expect(surface!.expose.map((e) => e.name)).toEqual(manifest.expose.map((e) => e.name));
    // Slot params + paramTypes COUNT match the source manifest (identity fixture).
    expect(surface!.slots.length).toBe(manifest.slots.length);
    for (let i = 0; i < manifest.slots.length; i++) {
      expect(surface!.slots[i]!.name).toBe(manifest.slots[i]!.name);
      expect(surface!.slots[i]!.params.length).toBe(manifest.slots[i]!.params.length);
      expect(surface!.slots[i]!.params.map((p) => p.name)).toEqual(
        manifest.slots[i]!.params.map((p) => p.name),
      );
      const wantParamTypesLen = manifest.slots[i]!.paramTypes === null ? 0 : manifest.slots[i]!.paramTypes!.length;
      const gotParamTypesLen = surface!.slots[i]!.paramTypes === undefined ? 0 : surface!.slots[i]!.paramTypes!.length;
      expect(gotParamTypesLen).toBe(wantParamTypesLen);
    }
  });

  it('round-trips a synthetic manifest with a non-null paramTypes slot (string/number)', () => {
    const wire = {
      schemaVersion: 1,
      name: 'ParamTypesProbe',
      props: [{ name: 'value', isModel: true, required: false, type: 'String' }],
      slots: [
        {
          name: 'option',
          params: [{ name: 'label' }, { name: 'index' }],
          paramTypes: ['string', 'number'],
          isPortal: false,
          isReactive: false,
        },
      ],
      emits: ['change'],
      expose: [{ name: 'focus' }],
    };
    const { surface, error } = parseManifest(wire);
    expect(error).toBeNull();
    expect(surface).not.toBeNull();
    expect(surface!.slots[0]!.paramTypes).toHaveLength(2);
    expect(surface!.slots[0]!.paramTypes![0]!.type).toBe('TSStringKeyword');
    expect(surface!.slots[0]!.paramTypes![1]!.type).toBe('TSNumberKeyword');
    expect(surface!.props).toEqual([{ name: 'value', isModel: true }]);
    expect(surface!.expose).toEqual([{ name: 'focus' }]);
  });
});

describe('parseManifest — schema-version mismatch fails closed (D-04)', () => {
  it('schemaVersion: 999 returns MANIFEST_SCHEMA_VERSION_MISMATCH, never a partial surface', () => {
    const wire = {
      schemaVersion: 999,
      name: 'Foo',
      props: [],
      slots: [],
      emits: [],
      expose: [],
    };
    const { surface, error } = parseManifest(wire);
    expect(surface).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.code).toBe(RozieErrorCode.MANIFEST_SCHEMA_VERSION_MISMATCH);
  });

  it('a missing schemaVersion field returns MALFORMED_MANIFEST (not a silent degrade)', () => {
    const { surface, error } = parseManifest({ name: 'Foo', props: [], slots: [], emits: [], expose: [] });
    expect(surface).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.code).toBe(RozieErrorCode.MALFORMED_MANIFEST);
  });
});

describe('parseManifest — malformed input never throws', () => {
  it('null returns { surface: null, error: MALFORMED_MANIFEST }', () => {
    expect(() => parseManifest(null)).not.toThrow();
    const { surface, error } = parseManifest(null);
    expect(surface).toBeNull();
    expect(error!.code).toBe(RozieErrorCode.MALFORMED_MANIFEST);
  });

  it('{} returns { surface: null, error: MALFORMED_MANIFEST }', () => {
    expect(() => parseManifest({})).not.toThrow();
    const { surface, error } = parseManifest({});
    expect(surface).toBeNull();
    expect(error!.code).toBe(RozieErrorCode.MALFORMED_MANIFEST);
  });

  it('an array, a string, and a number all return MALFORMED_MANIFEST without throwing', () => {
    for (const bad of [[], 'not-an-object', 42, undefined]) {
      expect(() => parseManifest(bad)).not.toThrow();
      const { surface, error } = parseManifest(bad);
      expect(surface).toBeNull();
      expect(error!.code).toBe(RozieErrorCode.MALFORMED_MANIFEST);
    }
  });

  it('structurally malformed props/slots/emits/expose entries return MALFORMED_MANIFEST', () => {
    const base = { schemaVersion: 1, name: 'Foo', props: [], slots: [], emits: [], expose: [] };
    expect(parseManifest({ ...base, props: 'not-an-array' }).error!.code).toBe(
      RozieErrorCode.MALFORMED_MANIFEST,
    );
    expect(parseManifest({ ...base, props: [{ name: 'x' }] }).error!.code).toBe(
      RozieErrorCode.MALFORMED_MANIFEST,
    ); // missing isModel
    expect(parseManifest({ ...base, slots: [{ name: 'x' }] }).error!.code).toBe(
      RozieErrorCode.MALFORMED_MANIFEST,
    ); // missing params/paramTypes/isPortal/isReactive
    expect(parseManifest({ ...base, emits: [1, 2] }).error!.code).toBe(
      RozieErrorCode.MALFORMED_MANIFEST,
    );
    expect(parseManifest({ ...base, expose: [{ notName: 'x' }] }).error!.code).toBe(
      RozieErrorCode.MALFORMED_MANIFEST,
    );
  });

  it('a crafted garbage paramType string is dropped without throwing (T-75-02)', () => {
    const wire = {
      schemaVersion: 1,
      name: 'Foo',
      props: [],
      slots: [
        {
          name: 'option',
          params: [{ name: 'a' }],
          paramTypes: ['{{{{not valid ts at all!!!', 'string'],
          isPortal: false,
          isReactive: false,
        },
      ],
      emits: [],
      expose: [],
    };
    expect(() => parseManifest(wire)).not.toThrow();
    const { surface, error } = parseManifest(wire);
    expect(error).toBeNull();
    expect(surface).not.toBeNull();
    // The garbage entry is dropped; the valid 'string' entry survives.
    expect(surface!.slots[0]!.paramTypes).toHaveLength(1);
    expect(surface!.slots[0]!.paramTypes![0]!.type).toBe('TSStringKeyword');
  });

  it('an oversized paramType string is dropped without throwing or hanging (T-75-02)', () => {
    const oversized = '(' .repeat(50000);
    const wire = {
      schemaVersion: 1,
      name: 'Foo',
      props: [],
      slots: [
        {
          name: 'option',
          params: [],
          paramTypes: [oversized],
          isPortal: false,
          isReactive: false,
        },
      ],
      emits: [],
      expose: [],
    };
    expect(() => parseManifest(wire)).not.toThrow();
    const { surface, error } = parseManifest(wire);
    expect(error).toBeNull();
    expect(surface).not.toBeNull();
    expect(surface!.slots[0]!.paramTypes).toHaveLength(0);
  });

  it('a __proto__-keyed manifest never pollutes Object.prototype (T-75-03)', () => {
    const wire = JSON.parse(
      '{"schemaVersion":1,"name":"Foo","props":[],"slots":[],"emits":[],"expose":[],"__proto__":{"polluted":true}}',
    );
    const { surface, error } = parseManifest(wire);
    expect(error).toBeNull();
    expect(surface).not.toBeNull();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('@rozie/core barrel exports the manifest surface', () => {
  it('imports buildManifest, parseManifest, MANIFEST_SCHEMA_VERSION from @rozie/core', async () => {
    const core = await import('@rozie/core');
    expect(typeof core.buildManifest).toBe('function');
    expect(typeof core.parseManifest).toBe('function');
    expect(core.MANIFEST_SCHEMA_VERSION).toBe(1);
  });
});
