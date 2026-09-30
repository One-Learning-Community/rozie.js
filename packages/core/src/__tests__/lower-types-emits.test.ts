import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { compile } from '../compile.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

const src = (emits: string, script: string, template = '<div></div>', types = '') =>
  `<rozie name="Probe">\n${types}\n${emits}\n<script>\n${script}\n</script>\n<template>\n${template}\n</template>\n</rozie>\n`;
function lower(s: string) {
  const { ast, diagnostics: pd } = parse(s, { filename: 'Probe.rozie' });
  const { ir, diagnostics } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return { ir: ir!, diagnostics: [...pd, ...diagnostics] };
}
const codes = (s: string) => compile(s, { target: 'vue', filename: 'Probe.rozie', sourceMap: false }).diagnostics.map((d) => d.code);

describe('lower <types>/<emits>', () => {
  it('builds emitDecls in declaration order and derives ir.emits from them', () => {
    const { ir } = lower(src(
      `<emits>\n{ reset: {}, ping: { payload: '{ count: number }', docs: { description: 'Pinged.' } } }\n</emits>`,
      `function a(){ $emit('ping', { count: 1 }); $emit('reset') }`,
    ));
    expect(ir.emitDecls!.map((d) => d.name)).toEqual(['reset', 'ping']);
    expect(ir.emits).toEqual(['reset', 'ping']);
    expect(ir.emitDecls![0]!.payload).toBeNull();
    expect(t.isTSTypeLiteral(ir.emitDecls![1]!.payload)).toBe(true);
    expect(ir.emitDecls![1]!.docs).toEqual({ description: 'Pinged.' });
  });
  it('no <emits> ⇒ emitDecls null, emits inferred as today', () => {
    const { ir } = lower(src('', `function a(){ $emit('ping', 1) }`));
    expect(ir.emitDecls).toBeNull();
    expect(ir.emits).toEqual(['ping']);
  });
  it('collects exported <types> names', () => {
    const { ir } = lower(src('', '', '<div></div>',
      `<types>\nimport type { A } from 'a'\nexport interface P { x: A }\ntype Local = 1\nexport type { A }\nexport type Q = P[]\n</types>`));
    expect(ir.types!.exportedNames).toEqual(['P', 'A', 'Q']);
    expect(ir.types!.statements).toHaveLength(5);
  });
  it('ROZ151: $emit of an undeclared name — script AND template', () => {
    expect(codes(src(`<emits>\n{ ping: {} }\n</emits>`, `function a(){ $emit('pong') }`))).toContain(RozieErrorCode.EMIT_UNDECLARED);
    expect(codes(src(`<emits>\n{ ping: {} }\n</emits>`, `function a(){ $emit('ping') }`, `<button @click="$emit('zap')">x</button>`)))
      .toContain(RozieErrorCode.EMIT_UNDECLARED);
  });
  it('ROZ152: a declared name never emitted (warning)', () => {
    const { diagnostics } = lower(src(`<emits>\n{ ping: {}, idle: {} }\n</emits>`, `function a(){ $emit('ping') }`));
    const d = diagnostics.find((x) => x.code === RozieErrorCode.EMIT_DECLARED_UNUSED);
    expect(d?.severity).toBe('warning');
    expect(d?.message).toContain('idle');
  });
  it('a template-only emit counts as used', () => {
    expect(codes(src(`<emits>\n{ ping: {} }\n</emits>`, '', `<button @click="$emit('ping')">x</button>`)))
      .not.toContain(RozieErrorCode.EMIT_DECLARED_UNUSED);
  });
  it.each([
    ['non-object entry', `{ ping: 1 }`, RozieErrorCode.INVALID_EMIT_DECL],
    ['unknown key', `{ ping: { payloud: 'x' } }`, RozieErrorCode.INVALID_EMIT_DECL],
    ['non-literal payload', `{ ping: { payload: X } }`, RozieErrorCode.INVALID_EMIT_DECL],
    ['computed key', `{ [k]: {} }`, RozieErrorCode.INVALID_EMIT_DECL],
    ['bad payload type', `{ ping: { payload: '(x: => 1' } }`, RozieErrorCode.INVALID_AUTHORED_TYPE],
    ['bad docs', `{ ping: { docs: { description: 3 } } }`, RozieErrorCode.INVALID_EMIT_DOCS_SHAPE],
  ])('%s', (_l, body, code) => {
    expect(codes(src(`<emits>\n${body}\n</emits>`, `function a(){ $emit('ping') }`))).toContain(code);
  });
});
