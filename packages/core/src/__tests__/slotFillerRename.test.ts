// Quick task 260526-ljo — slot-scope-param rename (`{ item: column }`).
//
// `<template #default="{ item: column }">` in a consumer SFC declares that the
// producer-supplied slot scope value at key `item` should be bound locally to
// the identifier `column`. The lowerer's `parseScopedParams` should populate
// `ParamDecl.bindAs` accordingly:
//
//   - `{ item }`                  → ParamDecl{ name: 'item', bindAs: undefined }
//   - `{ item: column }`          → ParamDecl{ name: 'item', bindAs: 'column' }
//   - `{ item: column, index: idx }`
//                                 → both ParamDecls carry bindAs values
//   - `{ item: { nested } }`      → param skipped + ROZ948 warning emitted
//
// The producer-side validator threadParamTypes (ROZ947) continues to match on
// `name` (`item`), NOT `bindAs` (`column`) — that contract is intentionally
// NOT exercised here (it's the emitters' concern in Task 2).
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type {
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
  SlotFillerDecl,
} from '../ir/types.js';

/**
 * Build a minimal consumer-SFC source that uses a `<Producer>` component-tag
 * and projects content via `<template #default="<paramsExpr>">`. The Producer
 * itself is a stub `.rozie` source we register via `<components>` block in the
 * caller; for this lowering-only test we don't need the resolver to succeed —
 * we only need `parseScopedParams` to run on the consumer's `<template>` attr
 * value, which happens regardless of whether the Producer tag resolves.
 */
function consumerSource(paramsExpr: string): string {
  return `<rozie name="Consumer">
<components>
{ Producer: './Producer.rozie' }
</components>
<template>
  <Producer>
    <template #default="${paramsExpr}">
      <span>x</span>
    </template>
  </Producer>
</template>
</rozie>
`;
}

/**
 * Lower a consumer source and walk the IR template to find the first
 * SlotFillerDecl. Returns its params + the full diagnostics list.
 */
function lowerFiller(
  source: string,
): { params: SlotFillerDecl['params']; diagnostics: ReturnType<typeof lowerToIR>['diagnostics'] } {
  const { ast, diagnostics: parseDiags } = parse(source);
  expect(ast, JSON.stringify(parseDiags)).not.toBeNull();
  const { ir, diagnostics } = lowerToIR(ast!, {
    modifierRegistry: createDefaultRegistry(),
  });
  expect(ir, JSON.stringify(diagnostics)).not.toBeNull();

  // Walk the template to find the first TemplateElement with slotFillers.
  const stack: IRTemplateNode[] = ir!.template ? [ir!.template] : [];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (cur.type === 'TemplateElement') {
      const el = cur as TemplateElementIR;
      if (el.slotFillers && el.slotFillers.length > 0) {
        return { params: el.slotFillers[0]!.params, diagnostics };
      }
      stack.push(...el.children);
    } else if (cur.type === 'TemplateFragment') {
      stack.push(...cur.children);
    } else if (cur.type === 'TemplateConditional' || cur.type === 'TemplateMatch') {
      for (const b of cur.branches) stack.push(...b.body);
    } else if (cur.type === 'TemplateLoop') {
      stack.push(...cur.body);
    }
  }
  throw new Error('no SlotFillerDecl found in IR');
}

describe('parseScopedParams — slot-scope-param rename (quick 260526-ljo)', () => {
  it('shorthand `{ item }` → ParamDecl{ name:"item", bindAs:undefined }', () => {
    const { params } = lowerFiller(consumerSource('{ item }'));
    expect(params.length).toBe(1);
    expect(params[0]!.name).toBe('item');
    expect(params[0]!.bindAs).toBeUndefined();
    // Identity binding survives — valueExpression still points at `item`.
    expect(t.isIdentifier(params[0]!.valueExpression)).toBe(true);
    expect((params[0]!.valueExpression as t.Identifier).name).toBe('item');
  });

  it('rename `{ item: column }` → ParamDecl{ name:"item", bindAs:"column" }', () => {
    const { params } = lowerFiller(consumerSource('{ item: column }'));
    expect(params.length).toBe(1);
    expect(params[0]!.name).toBe('item');
    expect(params[0]!.bindAs).toBe('column');
  });

  it('mixed `{ item: column, index: idx }` — both params carry bindAs values', () => {
    const { params } = lowerFiller(
      consumerSource('{ item: column, index: idx }'),
    );
    expect(params.length).toBe(2);
    expect(params[0]!.name).toBe('item');
    expect(params[0]!.bindAs).toBe('column');
    expect(params[1]!.name).toBe('index');
    expect(params[1]!.bindAs).toBe('idx');
  });

  it('mixed shorthand + rename `{ item, index: idx }` — first stays bindAs-less', () => {
    const { params } = lowerFiller(consumerSource('{ item, index: idx }'));
    expect(params.length).toBe(2);
    expect(params[0]!.name).toBe('item');
    expect(params[0]!.bindAs).toBeUndefined();
    expect(params[1]!.name).toBe('index');
    expect(params[1]!.bindAs).toBe('idx');
  });

  it('nested-pattern rename `{ item: { nested } }` — param dropped, ROZ948 emitted', () => {
    const { params, diagnostics } = lowerFiller(
      consumerSource('{ item: { nested } }'),
    );
    // Single property, non-identifier value → dropped → params is empty AND
    // ROZ948 SCOPED_PARAMS_ALL_DROPPED fires (every-property-non-simple branch).
    expect(params.length).toBe(0);
    const warn = diagnostics.find(
      (d) =>
        d.code === RozieErrorCode.SCOPED_PARAMS_ALL_DROPPED &&
        d.severity === 'warning',
    );
    expect(warn, 'expected a ROZ948 warning for nested destructure').toBeDefined();
  });
});
