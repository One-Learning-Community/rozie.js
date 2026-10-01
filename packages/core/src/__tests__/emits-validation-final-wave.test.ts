/**
 * Typed public surface P1 — final fix wave M6, M7, L1 (`<emits>` validation).
 *
 *   M7: ROZ151 points at the offending `$emit` call (script, template and
 *       listeners), not at the whole `<emits>` block.
 *   M6: ROZ157 (warning) — a `$emit` whose argument count disagrees with the
 *       declared payload (`$emit('reset', x)` for a no-payload event,
 *       `$emit('ping')` for a payload event, extra arguments).
 *   L1: a duplicate `<emits>` key, or a duplicate `payload`/`docs` sub-key, is
 *       a located ROZ021; a malformed entry no longer cascades into ROZ151 for
 *       its own name (nor ROZ157 for an invalid payload).
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';

const src = (emits: string, script: string, template = '<div></div>') =>
  `<rozie name="Probe">\n<emits>\n${emits}\n</emits>\n<script>\n${script}\n</script>\n<template>\n${template}\n</template>\n</rozie>\n`;

function diags(s: string) {
  const { ast, diagnostics: pd } = parse(s, { filename: 'Probe.rozie' });
  const { diagnostics } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return [...pd, ...diagnostics];
}

describe('M7 — ROZ151 is located at the $emit call', () => {
  it('script call', () => {
    const s = src(`{ ping: {} }`, `function a() { $emit('ping'); $emit('pong', 1) }`);
    const d = diags(s).find((x) => x.code === 'ROZ151')!;
    expect(s.slice(d.loc.start, d.loc.end)).toBe(`$emit('pong', 1)`);
  });
  it('template call', () => {
    const s = src(`{ ping: {} }`, `function a() { $emit('ping') }`, `<button @click="$emit('zap')">x</button>`);
    const d = diags(s).find((x) => x.code === 'ROZ151')!;
    expect(s.slice(d.loc.start, d.loc.end)).toBe(`$emit('zap')`);
  });
  it('one diagnostic per undeclared call site', () => {
    const s = src(`{ ping: {} }`, `function a() { $emit('ping'); $emit('pong'); $emit('pong') }`);
    expect(diags(s).filter((x) => x.code === 'ROZ151')).toHaveLength(2);
  });
});

describe('M6 — ROZ157 emit payload arity', () => {
  const ARITY = `{ ping: { payload: 'number' }, reset: {} }`;
  it.each([
    [`$emit('reset', 1)`, /no payload/],
    [`$emit('ping')`, /payload/],
    [`$emit('ping', 1, 2)`, /2 arguments/],
  ])('%s is a located ROZ157 warning', (call, msg) => {
    const s = src(ARITY, `function a() { $emit('ping', 1); $emit('reset'); ${call} }`);
    const ds = diags(s).filter((x) => x.code === 'ROZ157');
    expect(ds).toHaveLength(1);
    expect(ds[0]!.severity).toBe('warning');
    expect(ds[0]!.message).toMatch(msg);
    expect(s.slice(ds[0]!.loc.start, ds[0]!.loc.end)).toBe(call);
  });
  it('matching arity (and a spread argument) is silent; a template call is checked too', () => {
    expect(diags(src(ARITY, `function a(...xs) { $emit('ping', 1); $emit('reset'); $emit('ping', ...xs) }`)).filter((x) => x.code === 'ROZ157')).toEqual([]);
    const s = src(ARITY, `function a() { $emit('ping', 1) }`, `<button @click="$emit('reset', 3)">x</button>`);
    const d = diags(s).find((x) => x.code === 'ROZ157')!;
    expect(s.slice(d.loc.start, d.loc.end)).toBe(`$emit('reset', 3)`);
  });
  it('without <emits> nothing is checked', () => {
    const s = `<rozie name="P"><script>\nfunction a() { $emit('reset', 1); $emit('reset') }\n</script><template><div /></template></rozie>`;
    expect(diags(s).filter((x) => x.code === 'ROZ157')).toEqual([]);
  });
});

describe('L1 — duplicate keys and malformed-entry cascades', () => {
  it('a duplicate <emits> key is a located ROZ021 at the second key; one decl survives', () => {
    const s = src(`{ ping: {}, ping: { payload: 'number' } }`, `function a() { $emit('ping') }`);
    const ds = diags(s).filter((x) => x.code === 'ROZ021');
    expect(ds).toHaveLength(1);
    expect(ds[0]!.message).toMatch(/[Dd]uplicate/);
    expect(s.slice(ds[0]!.loc.start, ds[0]!.loc.start + 4)).toBe('ping');
    expect(ds[0]!.loc.start).toBeGreaterThan(s.indexOf('ping: {}'));
    const { ast } = parse(s, { filename: 'Probe.rozie' });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    expect(ir!.emitDecls!.map((d) => d.name)).toEqual(['ping']);
  });
  it.each([
    [`{ ping: { payload: 'number', payload: 'string' } }`],
    [`{ ping: { docs: { description: 'a' }, docs: { description: 'b' } } }`],
  ])('a duplicate sub-key is ROZ021: %s', (emits) => {
    const ds = diags(src(emits, `function a() { $emit('ping', 1) }`)).filter((x) => x.code === 'ROZ021');
    expect(ds).toHaveLength(1);
    expect(ds[0]!.message).toMatch(/more than once|[Dd]uplicate/);
  });
  it('a malformed entry reports ROZ021 only — no ROZ151 cascade for its name', () => {
    const codes = diags(src(`{ ping: 1 }`, `function a() { $emit('ping') }`)).map((d) => d.code);
    expect(codes).toContain('ROZ021');
    expect(codes).not.toContain('ROZ151');
  });
  it('an invalid payload type reports ROZ022 only — no ROZ157 arity noise', () => {
    const codes = diags(src(`{ ping: { payload: 'number |' } }`, `function a() { $emit('ping', 1) }`)).map((d) => d.code);
    expect(codes).toContain('ROZ022');
    expect(codes).not.toContain('ROZ157');
    expect(codes).not.toContain('ROZ151');
  });
});
