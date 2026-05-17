/**
 * emit-two-way tests — Phase 07.3 Wave 3 Plan 07.3-07 (TWO-WAY-03).
 *
 * Verifies the Solid target's `r-model:propName=` consumer-side two-way
 * binding emit shape:
 *
 *   `<Modal r-model:open="$data.open1">`
 *     → `<Modal open={open1()} onOpenChange={setOpen1}>`
 *
 * Key contract (D-01 + RESEARCH §Solid lines 179-184):
 *   - Local (getter) is invoked as Accessor: `open1()`
 *   - Setter is the createSignal Setter identifier (NOT invoked): `setOpen1`
 *   - Event prop name follows the `on${Capitalize(propName)}Change` convention
 *     (matches emitPropsInterface.ts:73)
 *   - Forwarding pattern (`$props.X` where X has model:true) reuses the
 *     createControllableSignal local/setter pair (NOT `local.${X}` / `local.onXChange`)
 *     because Solid's emitScript hoists the controllable pair into a
 *     local Accessor `open` / Setter `setOpen` — same as `$data.X`.
 *     This matches emitRModel.ts:60-62.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';

function compile(source: string, filename: string): string {
  const { ast } = parse(source, { filename });
  expect(ast).not.toBeNull();
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  expect(ir).not.toBeNull();
  const result = emitSolid(ir!, { filename, source });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  expect(errors, JSON.stringify(errors, null, 2)).toHaveLength(0);
  return result.code;
}

describe('emitSolid — r-model:propName= consumer-side two-way binding (TWO-WAY-03)', () => {
  it('Case 1: $data.open1 → `open={open1()} onOpenChange={setOpen1}`', () => {
    const source = `<rozie name="ModalConsumer">
<data>{ open1: true }</data>
<template>
  <Modal r-model:open="$data.open1" />
</template>
</rozie>`;
    const code = compile(source, 'ModalConsumer.rozie');
    // Exact emit-shape contract — literal match per acceptance criteria.
    expect(code).toContain('open={open1()} onOpenChange={setOpen1}');
  });

  it('Case 2: camelCase propName → `closeOnEscape={flag()} onCloseOnEscapeChange={setFlag}`', () => {
    const source = `<rozie name="ChildConsumer">
<data>{ flag: false }</data>
<template>
  <Modal r-model:closeOnEscape="$data.flag" />
</template>
</rozie>`;
    const code = compile(source, 'ChildConsumer.rozie');
    expect(code).toContain('closeOnEscape={flag()} onCloseOnEscapeChange={setFlag}');
  });

  it('Case 3: forwarding $props.open (model:true) → `open={open()} onOpenChange={setOpen}`', () => {
    // WrapperModal pattern: consumer's own `open` is model:true so it lowers
    // to a controllable signal pair (`open` / `setOpen`) — the inner
    // <Modal> just forwards into it.
    const source = `<rozie name="WrapperModal">
<props>{ open: { type: Boolean, default: false, model: true } }</props>
<template>
  <Modal r-model:open="$props.open" />
</template>
</rozie>`;
    const code = compile(source, 'WrapperModal.rozie');
    expect(code).toContain('open={open()} onOpenChange={setOpen}');
  });
});
