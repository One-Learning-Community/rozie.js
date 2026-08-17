/**
 * slotFamilyMatching.test.ts — Phase 79 Plan 79-07 Task 1 (R2 / D-12).
 *
 * RED-FIRST: at the point this file is authored, `threadParamTypes` has no
 * family-matching second pass and `SlotFillerDecl.matchedFamily` does not
 * exist — every assertion below fails until this task's `threadParamTypes.ts`
 * change lands.
 *
 * Task 2 (ROZ093 duplicate-prefix error + the ROZ941 tried-prefixes message)
 * extends this SAME file with two more `describe` blocks — not a new file.
 *
 * `threadParamTypes` is NOT part of `lowerToIR` — it is a separate
 * `compile()`-time post-pass requiring a real `IRCache` + `ProducerResolver`
 * (see `compile.ts:320`). This file therefore follows the established
 * sibling convention in THIS SAME directory (`threadProducerProps.test.ts`,
 * `threadProducerEmits.test.ts`) rather than the `lowerToIR`-only D-12
 * convention `slotDynamicName.test.ts` uses for a `lowerSlots`-only pass:
 * `compileAndThread` replicates `compile()`'s parse → lowerToIR →
 * threadParamTypes steps with real fixture `.rozie` files on disk, exercising
 * the REAL pass end to end.
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
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { RozieTarget } from '../../codegen/rewriteRozieImport.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { IRComponent, TemplateElementIR, TemplateNode } from '../types.js';

/**
 * Replicates `compile()`'s steps 1 → 2.5 (parse → lowerToIR →
 * threadParamTypes) with a real `IRCache` + `ProducerResolver`, returning the
 * MUTATED consumer `IRComponent` for direct inspection. Modelled 1:1 on
 * `threadProducerProps.test.ts`'s helper of the same name.
 */
function compileAndThread(
  src: string,
  filename: string,
  resolverRoot: string,
  target: RozieTarget = 'react',
): { ir: IRComponent; diagnostics: Diagnostic[] } {
  const registry = createDefaultRegistry();
  const { ast, diagnostics: parseDiags } = parse(src, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags.map((d) => d.code).join(', ')}`,
    );
  }
  const cache = new IRCache({ modifierRegistry: registry });
  const resolver = new ProducerResolver({ root: resolverRoot });
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: registry,
    resolver,
    filename,
  });
  if (!ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const acc: Diagnostic[] = [...parseDiags, ...irDiags];
  threadParamTypes(ir, filename, cache, resolver, target, acc);
  return { ir, diagnostics: acc };
}

/** DFS the lowered template for the first TemplateElement with `tagName`. */
function findElement(root: TemplateNode | null, tagName: string): TemplateElementIR | null {
  if (root === null) return null;
  if (root.type === 'TemplateElement') {
    if (root.tagName === tagName) return root;
    for (const child of root.children) {
      const found = findElement(child, tagName);
      if (found) return found;
    }
    if (root.slotFillers) {
      for (const filler of root.slotFillers) {
        for (const child of filler.body) {
          const found = findElement(child, tagName);
          if (found) return found;
        }
      }
    }
    return null;
  }
  if (root.type === 'TemplateConditional') {
    for (const branch of root.branches) {
      for (const child of branch.body) {
        const found = findElement(child, tagName);
        if (found) return found;
      }
    }
    return null;
  }
  if (root.type === 'TemplateLoop') {
    for (const child of root.body) {
      const found = findElement(child, tagName);
      if (found) return found;
    }
    return null;
  }
  if (root.type === 'TemplateFragment') {
    for (const child of root.children) {
      const found = findElement(child, tagName);
      if (found) return found;
    }
    return null;
  }
  return null;
}

function makeTmpDir(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'rozie-slot-family-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('threadParamTypes — family matching (Phase 79 Plan 79-07, R2 / AC-6)', () => {
  let tmpRoot: string;
  let cleanup: () => void;
  beforeEach(() => {
    ({ dir: tmpRoot, cleanup } = makeTmpDir());
  });
  afterEach(() => cleanup());

  it('AC-6: a fill with NO exact producer slot resolves against the producer family and is marked matchedFamily', () => {
    writeFileSync(
      path.join(tmpRoot, 'Producer.rozie'),
      `<rozie name="Producer">
<template>
  <slot :name="\`cell-\${col.key}\`" :row="row" :value="value">fallback</slot>
</template>
</rozie>
`,
      'utf8',
    );
    const consumerSrc = `<rozie name="Consumer">
<components>{ Producer: './Producer.rozie' }</components>
<template>
<Producer>
  <template #cell-status="{ row, value }">{{ value }}</template>
</Producer>
</template>
</rozie>
`;
    const consumerPath = path.join(tmpRoot, 'Consumer.rozie');
    writeFileSync(consumerPath, consumerSrc, 'utf8');

    const { ir, diagnostics } = compileAndThread(consumerSrc, consumerPath, tmpRoot);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const node = findElement(ir.template, 'Producer');
    expect(node).not.toBeNull();
    const filler = node!.slotFillers![0]!;
    expect(filler.matchedFamily).toBe(true);
    expect(filler.producerSlotParamCount).toBe(2);
  });

  it('AC-6: exact name ALWAYS wins over an overlapping family — matchedFamily is absent (key-presence assertion), and the STATIC slot\'s types are threaded', () => {
    writeFileSync(
      path.join(tmpRoot, 'Producer.rozie'),
      `<rozie name="Producer">
<template>
  <slot name="cell-total" :grandTotal="total">static fallback</slot>
  <slot :name="\`cell-\${col.key}\`" :row="row" :value="value">family fallback</slot>
</template>
</rozie>
`,
      'utf8',
    );
    const consumerSrc = `<rozie name="Consumer">
<components>{ Producer: './Producer.rozie' }</components>
<template>
<Producer>
  <template #cell-total="{ grandTotal }">{{ grandTotal }}</template>
</Producer>
</template>
</rozie>
`;
    const consumerPath = path.join(tmpRoot, 'Consumer.rozie');
    writeFileSync(consumerPath, consumerSrc, 'utf8');

    const { ir, diagnostics } = compileAndThread(consumerSrc, consumerPath, tmpRoot);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const node = findElement(ir.template, 'Producer');
    const filler = node!.slotFillers![0]!;
    // Key-presence assertion, NOT a truthiness assertion — a present-but-
    // undefined key would pass `!filler.matchedFamily` but must still fail
    // this test, per the additive-field discipline (never assigned false).
    expect('matchedFamily' in filler).toBe(false);
    // The STATIC slot's param count (1: grandTotal) threaded, not the
    // family's (2: row, value) — proves the exact-match branch short-
    // circuited before family matching ever ran.
    expect(filler.producerSlotParamCount).toBe(1);
  });

  it('AC-6: a fill equal to the prefix itself (`#cell-`) matches the family with an empty suffix', () => {
    writeFileSync(
      path.join(tmpRoot, 'Producer.rozie'),
      `<rozie name="Producer">
<template>
  <slot :name="\`cell-\${col.key}\`" :row="row">fallback</slot>
</template>
</rozie>
`,
      'utf8',
    );
    const consumerSrc = `<rozie name="Consumer">
<components>{ Producer: './Producer.rozie' }</components>
<template>
<Producer>
  <template #cell-="{ row }">{{ row }}</template>
</Producer>
</template>
</rozie>
`;
    const consumerPath = path.join(tmpRoot, 'Consumer.rozie');
    writeFileSync(consumerPath, consumerSrc, 'utf8');

    const { ir, diagnostics } = compileAndThread(consumerSrc, consumerPath, tmpRoot);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const node = findElement(ir.template, 'Producer');
    const filler = node!.slotFillers![0]!;
    expect(filler.matchedFamily).toBe(true);
    expect(filler.producerSlotParamCount).toBe(1);
  });

  it('AC-6: the LONGEST matching prefix wins among two overlapping families', () => {
    writeFileSync(
      path.join(tmpRoot, 'Producer.rozie'),
      `<rozie name="Producer">
<template>
  <slot :name="\`cell-\${col.key}\`" :row="row">short family</slot>
  <slot :name="\`cell-status-\${col.key}\`" :row="row" :value="value" :flag="flag">long family</slot>
</template>
</rozie>
`,
      'utf8',
    );
    const consumerSrc = `<rozie name="Consumer">
<components>{ Producer: './Producer.rozie' }</components>
<template>
<Producer>
  <template #cell-status-detail="{ row, value, flag }">{{ flag }}</template>
</Producer>
</template>
</rozie>
`;
    const consumerPath = path.join(tmpRoot, 'Consumer.rozie');
    writeFileSync(consumerPath, consumerSrc, 'utf8');

    const { ir, diagnostics } = compileAndThread(consumerSrc, consumerPath, tmpRoot);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const node = findElement(ir.template, 'Producer');
    const filler = node!.slotFillers![0]!;
    expect(filler.matchedFamily).toBe(true);
    // 3 (row, value, flag) — the LONGER 'cell-status-' family's param count,
    // not the shorter 'cell-' family's (1). Proves length-based selection,
    // not merely that SOME family matched.
    expect(filler.producerSlotParamCount).toBe(3);
  });

  it('AC-12/T-79-14: a producer with only a NO-PREFIX dynamic slot never participates in family matching — the fill is treated as unmatched', () => {
    writeFileSync(
      path.join(tmpRoot, 'Producer.rozie'),
      `<rozie name="Producer">
<template>
  <slot :name="col.key" :value="value">fallback</slot>
</template>
</rozie>
`,
      'utf8',
    );
    const consumerSrc = `<rozie name="Consumer">
<components>{ Producer: './Producer.rozie' }</components>
<template>
<Producer>
  <template #anything="{ value }">{{ value }}</template>
</Producer>
</template>
</rozie>
`;
    const consumerPath = path.join(tmpRoot, 'Consumer.rozie');
    writeFileSync(consumerPath, consumerSrc, 'utf8');

    const { ir, diagnostics } = compileAndThread(consumerSrc, consumerPath, tmpRoot);
    const node = findElement(ir.template, 'Producer');
    const filler = node!.slotFillers![0]!;
    expect('matchedFamily' in filler).toBe(false);
    const roz941 = diagnostics.find((d) => d.code === RozieErrorCode.UNKNOWN_SLOT_NAME);
    expect(roz941).toBeDefined();
  });

  it('AC-1/AC-13: a producer with ZERO dynamic-name slots produces exactly the pre-phase filler shape — no present-but-undefined matchedFamily key', () => {
    writeFileSync(
      path.join(tmpRoot, 'Producer.rozie'),
      `<rozie name="Producer">
<template>
  <slot name="header" :close="closeFn">default header</slot>
</template>
</rozie>
`,
      'utf8',
    );
    const consumerSrc = `<rozie name="Consumer">
<components>{ Producer: './Producer.rozie' }</components>
<template>
<Producer>
  <template #header="{ close }">{{ close }}</template>
</Producer>
</template>
</rozie>
`;
    const consumerPath = path.join(tmpRoot, 'Consumer.rozie');
    writeFileSync(consumerPath, consumerSrc, 'utf8');

    const { ir, diagnostics } = compileAndThread(consumerSrc, consumerPath, tmpRoot);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const node = findElement(ir.template, 'Producer');
    const filler = node!.slotFillers![0]!;
    expect(Object.keys(filler).sort()).toEqual(
      [
        'type',
        'name',
        'params',
        'body',
        'sourceLoc',
        'isPortal',
        'producerSlotParamCount',
        'isReactive',
        'producerPropCollision',
      ].sort(),
    );
  });

  it('a consumer-side `#[expr]` dynamic fill is still skipped by the pass and never acquires matchedFamily', () => {
    writeFileSync(
      path.join(tmpRoot, 'Producer.rozie'),
      `<rozie name="Producer">
<template>
  <slot :name="\`cell-\${col.key}\`" :row="row">fallback</slot>
</template>
</rozie>
`,
      'utf8',
    );
    const consumerSrc = `<rozie name="Consumer">
<components>{ Producer: './Producer.rozie' }</components>
<script>
const dynName = 'cell-status';
</script>
<template>
<Producer>
  <template #[dynName]>dynamic body</template>
</Producer>
</template>
</rozie>
`;
    const consumerPath = path.join(tmpRoot, 'Consumer.rozie');
    writeFileSync(consumerPath, consumerSrc, 'utf8');

    const { ir } = compileAndThread(consumerSrc, consumerPath, tmpRoot);
    const node = findElement(ir.template, 'Producer');
    const filler = node!.slotFillers![0]!;
    expect(filler.isDynamic).toBe(true);
    expect('matchedFamily' in filler).toBe(false);
  });
});
