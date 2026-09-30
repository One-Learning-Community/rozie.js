import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { printTSType } from '../codegen/renderAuthoredType.js';

const src = (slot: string) =>
  `<rozie name="Probe">\n<data>{ n: 1, rows: [] }</data>\n<template>\n<div>${slot}</div>\n</template>\n</rozie>\n`;
const slots = (s: string) => {
  const { ast } = parse(s, { filename: 'Probe.rozie' });
  return lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() }).ir!.slots;
};
const codes = (s: string) => compile(s, { target: 'react', filename: 'Probe.rozie', sourceMap: false }).diagnostics.map((d) => d.code);

describe(':param-types', () => {
  it('types scoped-attr params; omitted params are any; param-types is not a param', () => {
    const [slot] = slots(src(`<slot name="row" :row="$data.rows" :index="$data.n" :param-types="{ row: 'Row[]' }" />`));
    expect(slot!.params.map((p) => p.name)).toEqual(['row', 'index']);
    expect(slot!.paramTypes!.map(printTSType)).toEqual(['Row[]', 'any']);
  });
  it('types portal :params', () => {
    const [slot] = slots(src(`<slot name="event" portal :params="['arg']" :param-types="{ arg: 'EventContentArg' }" />`));
    expect(slot!.paramTypes!.map(printTSType)).toEqual(['EventContentArg']);
  });
  it('no :param-types => paramTypes stays undefined (byte-identity)', () => {
    const [slot] = slots(src(`<slot name="row" :row="$data.rows" />`));
    expect(slot!.paramTypes).toBeUndefined();
  });
  it('ROZ153 unknown key', () => {
    expect(codes(src(`<slot name="row" :row="$data.rows" :param-types="{ nope: 'number' }" />`))).toContain(RozieErrorCode.SLOT_PARAM_TYPES_UNKNOWN_KEY);
  });
  it.each([`"{ row: T }"`, `"['number']"`, `"{ ...x }"`])('ROZ154 invalid %s', (v) => {
    expect(codes(src(`<slot name="row" :row="$data.rows" :param-types=${v} />`))).toContain(RozieErrorCode.SLOT_PARAM_TYPES_INVALID);
  });
  it('ROZ022 on a bad type string', () => {
    expect(codes(src(`<slot name="row" :row="$data.rows" :param-types="{ row: '(x: => 1' }" />`))).toContain(RozieErrorCode.INVALID_AUTHORED_TYPE);
  });
  it.each(['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const)(
    'param-types and its type strings never reach %s output',
    (target) => {
      const r = compile(
        src(`<slot name="row" :row="$data.rows" :param-types="{ row: 'ZzzUniqueRow[]' }" />`),
        { target, filename: 'Probe.rozie', sourceMap: false },
      );
      const code = typeof r.code === 'string' ? r.code : JSON.stringify(r);
      expect(code.length).toBeGreaterThan(0);
      expect(code).not.toContain('param-types');
      expect(code).not.toContain('paramTypes');
      // Typed-surface P1 (Task 8): the authored type now legitimately appears in
      // TYPE positions (slot ctx interfaces). What must never leak is the
      // compile-time type STRING as a runtime value (a quoted literal).
      expect(code).not.toContain(`'ZzzUniqueRow[]'`);
      expect(code).not.toContain(`"ZzzUniqueRow[]"`);
    },
  );
});
