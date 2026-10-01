// Typed-surface P1 Task 15 — manifest schema v2 (typed emits / expose
// signatures / <types> / slot paramTypesAuthored); reader accepts v1 AND v2.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { printTSType } from '../codegen/renderAuthoredType.js';
import { lowerSlotParamType } from '../codegen/slotParamTypeLowering.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { buildManifest } from './buildManifest.js';
import { parseManifest } from './readManifest.js';
import { MANIFEST_SCHEMA_VERSION, SUPPORTED_MANIFEST_SCHEMA_VERSIONS } from './schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../../');

function irOf(source: string, filename: string) {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) throw new Error(diagnostics.map((d) => d.message).join(', '));
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('null IR');
  return ir;
}

function roundTrip(source: string, filename: string) {
  const wire = JSON.parse(JSON.stringify(buildManifest(irOf(source, filename))));
  return { wire, ...parseManifest(wire) };
}

const typedEvents = readFileSync(path.join(repoRoot, 'examples/TypedEvents.rozie'), 'utf8');

describe('manifest v2 — constants', () => {
  it('writes v2, reads 1 and 2', () => {
    expect(MANIFEST_SCHEMA_VERSION).toBe(2);
    expect([...SUPPORTED_MANIFEST_SCHEMA_VERSIONS]).toEqual([1, 2]);
  });
});

describe('manifest v2 — TypedEvents round-trip', () => {
  const { wire, surface, error } = roundTrip(typedEvents, 'TypedEvents.rozie');

  it('wire shape', () => {
    expect(wire.schemaVersion).toBe(2);
    expect(wire.emits.map((e: { name: string }) => e.name)).toEqual(['ping', 'reset', 'select', 'row-open']);
    expect(wire.emits[0].payload).toBe('PingPayload');
    expect(wire.emits[1].payload).toBeNull();
    expect(wire.emits[0].docs).toEqual({ description: 'Fired on every bump with the running count.' });
    expect(wire.props.every((p: { tsType: unknown }) => p.tsType === null)).toBe(true);
    expect(wire.types).toContain('PingPayload');
  });

  it('reader keeps emits names/order, payloads, expose signatures, types, slot paramTypes', () => {
    expect(error).toBeNull();
    expect(surface!.emits).toEqual(['ping', 'reset', 'select', 'row-open']);
    expect(printTSType(surface!.emitPayloads.get('ping')!)).toBe('PingPayload');
    expect(surface!.emitPayloads.get('reset')).toBeNull();
    expect(printTSType(surface!.emitPayloads.get('row-open')!)).toContain('index: number');
    const sig = Object.fromEntries(
      surface!.expose.map((e) => [e.name, e.signature ? printTSType(e.signature) : null]),
    );
    expect(sig.getCount).toBe('() => number');
    expect(sig.jump).toBe('(to: number) => void');
    expect(sig.clear).toBeNull();
    expect(surface!.types).toContain('interface PingPayload');
    const row = surface!.slots.find((s) => s.name === 'row')!;
    expect(row.paramTypes!.map(printTSType)).toEqual(['Count', 'string']);
    expect(row.paramTypesAuthored).toBe(true);
  });
});

describe('manifest v2 — R8 authored function slot param survives the manifest', () => {
  const producer = `<rozie name="Prod">
<template>
  <div><slot name="head" :toggle="toggle" :label="'x'" :param-types="{ toggle: '() => void', label: 'string' }" /></div>
</template>
<script>
function toggle() {}
</script>
</rozie>`;

  it('consumer-side printed type is the authored function type, not (...args: any[]) => any', () => {
    const { wire, surface, error } = roundTrip(producer, 'Prod.rozie');
    expect(error).toBeNull();
    expect(wire.slots[0].paramTypesAuthored).toBe(true);
    const slot = surface!.slots[0]!;
    expect(slot.paramTypesAuthored).toBe(true);
    const printed = slot.paramTypes!.map((ty) => lowerSlotParamType(ty, slot.paramTypesAuthored === true));
    expect(printed[0]).toBe('() => void');
    // And the pre-fix behaviour for contrast:
    expect(lowerSlotParamType(slot.paramTypes![0], false)).toBe('(...args: any[]) => any');
  });
});

describe('manifest — v1 published leaf read by the v2 compiler (Review Focus #4)', () => {
  const v1 = JSON.parse(
    readFileSync(path.join(here, '__fixtures__/popover-v1.manifest.json'), 'utf8'),
  );

  it('accepts a real published v1 Popover manifest with no ROZ988', () => {
    expect(v1.schemaVersion).toBe(1);
    const { surface, error } = parseManifest(v1);
    expect(error).toBeNull();
    expect(surface!.emits).toEqual(['change']);
    expect(surface!.emitPayloads.get('change')).toBeNull();
    expect(surface!.types).toBeNull();
    expect(surface!.expose.every((e) => !e.signature)).toBe(true);
    expect(surface!.slots.every((s) => s.paramTypesAuthored !== true)).toBe(true);
  });

  it('schemaVersion 3 still fails with ROZ988', () => {
    const { surface, error } = parseManifest({ ...v1, schemaVersion: 3 });
    expect(surface).toBeNull();
    expect(error!.code).toBe(RozieErrorCode.MANIFEST_SCHEMA_VERSION_MISMATCH);
    expect(error!.message).toContain('1');
    expect(error!.message).toContain('2');
  });

  it('a bad v2 payload is dropped to null, not fatal', () => {
    const { surface, error } = parseManifest({
      schemaVersion: 2, name: 'X', props: [], slots: [], expose: [], types: null,
      emits: [{ name: 'a', payload: 'not a (type', docs: null }],
    });
    expect(error).toBeNull();
    expect(surface!.emitPayloads.get('a')).toBeNull();
  });
});
