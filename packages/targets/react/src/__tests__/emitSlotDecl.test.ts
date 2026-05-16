/**
 * Plan 04-03 Task 2 — emitSlotDecl + refineSlotTypes behaviour tests.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSlotDecl } from '../emit/emitSlotDecl.js';
import { refineSlotTypes } from '../emit/refineSlotTypes.js';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

describe('refineSlotTypes — Plan 04-03 Task 2', () => {
  it('default slot, no params → propFieldName: children, propFieldType: ReactNode', () => {
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: '',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('children');
    expect(refined.propFieldType).toBe('ReactNode');
    expect(refined.ctxInterface).toBe(null);
    expect(refined.defaultLifting).toBe('none');
  });

  it('default slot WITH params → union ReactNode | ((ctx: ChildrenCtx) => ReactNode)', () => {
    // dropdown-react-default-slot bugfix (2026-05-15): the default slot with
    // params is a dual-shape union so consumers that pass ordinary JSX
    // children (e.g. DropdownDemo.rozie) typecheck alongside render-prop
    // consumers. The runtime call site discriminates by typeof === 'function'.
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: '',
      defaultContent: null,
      params: [
        { type: 'ParamDecl', name: 'item', valueExpression: { type: 'Identifier', name: 'item' } as never, sourceLoc: { start: 0, end: 0 } },
      ],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('children');
    expect(refined.propFieldType).toBe('ReactNode | ((ctx: ChildrenCtx) => ReactNode)');
    expect(refined.ctxInterface).toMatch(/interface ChildrenCtx \{ item: any; \}/);
  });

  it('named slot, no params → propFieldName: render<Pascal>, propFieldType: ReactNode', () => {
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: 'header',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('renderHeader');
    expect(refined.propFieldType).toBe('ReactNode');
  });

  it('named slot WITH params → renderTrigger?: (ctx: TriggerCtx) => ReactNode + interface', () => {
    // Named slots stay strict-function-only: consumers reach for renderTrigger={…}
    // deliberately so there's no ambiguity to bridge at the runtime call site.
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: 'trigger',
      defaultContent: null,
      params: [
        { type: 'ParamDecl', name: 'open', valueExpression: { type: 'Identifier', name: 'open' } as never, sourceLoc: { start: 0, end: 0 } },
        { type: 'ParamDecl', name: 'toggle', valueExpression: { type: 'Identifier', name: 'toggle' } as never, sourceLoc: { start: 0, end: 0 } },
      ],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('renderTrigger');
    expect(refined.propFieldType).toBe('(ctx: TriggerCtx) => ReactNode');
    expect(refined.ctxInterface).toMatch(/interface TriggerCtx \{ open: any; toggle: any; \}/);
  });
});

describe('emitSlotDecl — Plan 04-03 Task 2', () => {
  it('Modal: 2 named slots (header, footer) → 2 prop fields, no ctx interfaces (no params)', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div>
  <header><slot name="header"></slot></header>
  <footer><slot name="footer"></slot></footer>
</div>
</template>
</rozie>
`);
    const result = emitSlotDecl(ir);
    expect(result.slotPropFields.length).toBe(2);
    expect(result.slotPropFields.some((s) => s.includes('renderHeader'))).toBe(true);
    expect(result.slotPropFields.some((s) => s.includes('renderFooter'))).toBe(true);
    expect(result.slotCtxInterfaces.length).toBe(0);
  });

  it('Dropdown trigger: named slot WITH params → renderTrigger field + TriggerCtx interface', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ open: { type: Boolean, default: false } }</props>
<script>const toggle = () => {}</script>
<template>
<div><slot name="trigger" :open="$props.open" :toggle="toggle"></slot></div>
</template>
</rozie>
`);
    const result = emitSlotDecl(ir);
    expect(result.slotPropFields.some((s) => s.includes('renderTrigger?: (ctx: TriggerCtx) => ReactNode'))).toBe(true);
    expect(result.slotCtxInterfaces.some((s) => /interface TriggerCtx \{ open: any; toggle: any; \}/.test(s))).toBe(true);
  });
});
