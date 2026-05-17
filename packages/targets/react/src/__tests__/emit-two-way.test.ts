/**
 * Phase 07.3 Plan 07.3-06 — React target consumer-side two-way binding emit.
 *
 * Asserts that `<Modal r-model:open="$data.open1">` (Phase 07.3-02 IR variant
 * `kind: 'twoWayBinding'`) emits the React JSX attribute-pair
 * `open={open1} onOpenChange={setOpen1}` per D-01 (CONTEXT) and RESEARCH
 * §"Per-Target Consumer Two-Way Idiom — React".
 *
 * Three behavior cases:
 *   1. $data.X (useState-backed)           → `open={open1} onOpenChange={setOpen1}`
 *   2. camelCase propName                  → `closeOnEscape={flag} onCloseOnEscapeChange={setFlag}`
 *   3. Forwarding $props.X (model:true)    → `open={open} onOpenChange={setOpen}` (Plan 09 correction — local setter, not bare upstream callback)
 *
 * @experimental
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitTemplate } from '../emit/emitTemplate.js';
import { resolveTwoWayTarget } from '../emit/resolveTwoWayTarget.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import * as t from '@babel/types';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(ir: IRComponent) {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const result = emitTemplate(ir, collectors, createDefaultRegistry());
  return { ...result, collectors };
}

describe('React twoWayBinding emit — Phase 07.3 Plan 07.3-06', () => {
  it('case 1: $data.X (useState-backed) emits `open={open1} onOpenChange={setOpen1}`', () => {
    const ir = lowerInline(`
<rozie name="Consumer">
<data>{ open1: true }</data>
<template>
<Modal r-model:open="$data.open1" />
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).toContain('open={open1} onOpenChange={setOpen1}');
  });

  it('case 2: camelCase propName preserved + PascalCased event name', () => {
    const ir = lowerInline(`
<rozie name="Consumer">
<data>{ flag: false }</data>
<template>
<Modal r-model:closeOnEscape="$data.flag" />
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).toContain('closeOnEscape={flag} onCloseOnEscapeChange={setFlag}');
  });

  it('case 3: forwarding $props.X (model:true) emits `open={open} onOpenChange={setOpen}` (local setter, not bare onOpenChange)', () => {
    // Phase 07.3 Plan 09 corrected the original Plan 06 design — the
    // forwarding setter is the LOCAL useControllableState setter
    // (`setOpen`), not the bare upstream callback name (`onOpenChange`).
    // The local setter wires the inner Modal's onOpenChange through the
    // wrapper's useControllableState, which in turn invokes
    // `props.onOpenChange` via its `onValueChange` callback — the
    // canonical Radix/shadcn-style controllable-state forwarding contract.
    // See packages/targets/react/src/emit/resolveTwoWayTarget.ts comments.
    const ir = lowerInline(`
<rozie name="WrapperModal">
<props>{ open: { type: Boolean, model: true } }</props>
<template>
<Modal r-model:open="$props.open" />
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).toContain('open={open} onOpenChange={setOpen}');
  });
});

describe('resolveTwoWayTarget helper — Phase 07.3 Plan 07.3-06', () => {
  function makeIRWithState(stateName: string): IRComponent {
    return lowerInline(`
<rozie name="Consumer">
<data>{ ${stateName}: false }</data>
<template>
<div />
</template>
</rozie>
`);
  }

  function makeIRWithModelProp(propName: string): IRComponent {
    return lowerInline(`
<rozie name="WrapperModal">
<props>{ ${propName}: { type: Boolean, model: true } }</props>
<template>
<div />
</template>
</rozie>
`);
  }

  it('resolves $data.X → { local: X, setter: setX } for useState-backed state', () => {
    const ir = makeIRWithState('open1');
    // Build $data.open1
    const expr = t.memberExpression(
      t.identifier('$data'),
      t.identifier('open1'),
    );
    const result = resolveTwoWayTarget(expr, ir);
    expect(result).toEqual({ local: 'open1', setter: 'setOpen1' });
  });

  it('resolves $props.X (model:true) → { local: X, setter: setX } for forwarding pattern (Plan 09 correction)', () => {
    // Phase 07.3 Plan 09 corrected the original Plan 06 design — the
    // forwarding setter is the LOCAL useControllableState setter
    // (`setOpen`), not the bare `onOpenChange` upstream callback.
    // The local setter wires the inner Modal's onOpenChange through the
    // wrapper's useControllableState, which forwards via its
    // `onValueChange` to the upstream `props.onOpenChange`. Bare
    // `onOpenChange` is not in scope as a free identifier inside the
    // function body (it lives on `props.onOpenChange`).
    const ir = makeIRWithModelProp('open');
    // Build $props.open
    const expr = t.memberExpression(
      t.identifier('$props'),
      t.identifier('open'),
    );
    const result = resolveTwoWayTarget(expr, ir);
    expect(result).toEqual({ local: 'open', setter: 'setOpen' });
  });

  it('camelCase propName capitalized correctly in setter', () => {
    const ir = makeIRWithState('flag');
    const expr = t.memberExpression(
      t.identifier('$data'),
      t.identifier('flag'),
    );
    const result = resolveTwoWayTarget(expr, ir);
    expect(result).toEqual({ local: 'flag', setter: 'setFlag' });
  });
});
