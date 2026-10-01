/**
 * threadParamTypes re-thread symmetry (typed-surface P1, final fix wave L6).
 *
 * Every other producer→filler field is a symmetric overwrite (WR-05), but
 * `filler.paramTypes` / `filler.paramTypesAuthored` were only ever SET: a
 * re-thread (watch mode) against a producer that no longer carries slot
 * `paramTypes` left the stale authored types on the consumer's filler.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import { IRCache } from '../cache.js';
import { ProducerResolver } from '../../resolver/index.js';
import { threadParamTypes } from '../threadParamTypes.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { SlotFillerDecl, TemplateNode } from '../types.js';

const CHILD_TYPED = `<rozie name="Child">
<data>{ n: 1 }</data>
<template>
  <div><slot name="row" :count="$data.n" :param-types="{ count: 'number' }" /></div>
</template>
</rozie>
`;
const CHILD_UNTYPED = `<rozie name="Child">
<data>{ n: 1 }</data>
<template>
  <div><slot name="row" :count="$data.n" /></div>
</template>
</rozie>
`;
const PARENT = `<rozie name="Parent">
<components>{ Child: './Child.rozie' }</components>
<template>
  <Child><template #row="{ count }">{{ count }}</template></Child>
</template>
</rozie>
`;

function rowFiller(root: TemplateNode | null): SlotFillerDecl | null {
  if (root === null || typeof root !== 'object') return null;
  const node = root as unknown as { slotFillers?: SlotFillerDecl[]; children?: TemplateNode[] };
  for (const f of node.slotFillers ?? []) if (f.name === 'row') return f;
  for (const c of node.children ?? []) {
    const hit = rowFiller(c);
    if (hit) return hit;
  }
  return null;
}

describe('threadParamTypes — re-thread clears stale paramTypes (L6)', () => {
  let tmpRoot: string;
  beforeEach(() => {
    tmpRoot = mkdtempSync(path.join(tmpdir(), 'rozie-rethread-'));
  });
  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('drops filler.paramTypes + paramTypesAuthored when the producer no longer has paramTypes', () => {
    const registry = createDefaultRegistry();
    const parentFile = path.join(tmpRoot, 'Parent.rozie');
    writeFileSync(parentFile, PARENT, 'utf8');
    writeFileSync(path.join(tmpRoot, 'Child.rozie'), CHILD_TYPED, 'utf8');
    const { ast } = parse(PARENT, { filename: parentFile });
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry, filename: parentFile });
    const diags: Diagnostic[] = [];
    threadParamTypes(ir!, parentFile, new IRCache({ modifierRegistry: registry }), new ProducerResolver({ root: tmpRoot }), 'react', diags);
    const filler = rowFiller(ir!.template)!;
    expect(filler.paramTypes).toHaveLength(1);
    expect(filler.paramTypesAuthored).toBe(true);

    // Watch-mode edit: the producer drops its :param-types.
    writeFileSync(path.join(tmpRoot, 'Child.rozie'), CHILD_UNTYPED, 'utf8');
    threadParamTypes(ir!, parentFile, new IRCache({ modifierRegistry: registry }), new ProducerResolver({ root: tmpRoot }), 'react', diags);
    const after = rowFiller(ir!.template)!;
    const { ast: childAst } = parse(CHILD_UNTYPED, { filename: 'Child.rozie' });
    const { ir: childIr } = lowerToIR(childAst!, { modifierRegistry: registry });
    // Precondition: the untyped producer slot really carries no paramTypes.
    expect(childIr!.slots[0]!.paramTypes).toBeUndefined();
    expect(after.paramTypes).toBeUndefined();
    expect(after.paramTypesAuthored).toBeUndefined();
  });
});
