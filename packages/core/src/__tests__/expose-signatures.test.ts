import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import { printTSType } from '../codegen/renderAuthoredType.js';

const SRC = (second: string, wrap = (s: string) => s, lang = '') => `<rozie name="Probe">
<script${lang}>
function getApi() { return null }
function jump(...a) { return a }
${wrap(`$expose({ getApi, jump }${second})`)}
</script>
<template><div></div></template>
</rozie>
`;
const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

describe('$expose signatures', () => {
  it('attaches a TSFunctionType to typed verbs only', () => {
    const { ast } = parse(SRC(`, { getApi: '() => Calendar | null' }`), { filename: 'Probe.rozie' });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    const byName = Object.fromEntries(ir!.expose.map((m) => [m.name, m.signature]));
    expect(printTSType(byName.getApi!)).toBe('() => Calendar | null');
    expect(byName.jump).toBeUndefined();
  });
  it.each([
    ['plain', (s: string) => s, ''],
    ['cast', (s: string) => `(${s} as void)`, ' lang="ts"'],
  ])('the second argument never reaches an emitted module (all six targets, %s)', (_n, wrap, lang) => {
    for (const target of TARGETS) {
      const { code, diagnostics } = compile(
        SRC(`, { getApi: '() => Calendar | null', jump: '(d: DateInput) => void' }`, wrap, lang),
        { target, filename: 'Probe.rozie', sourceMap: false },
      );
      expect(diagnostics.filter((d) => d.severity === 'error'), target).toEqual([]);
      // Typed-surface P1 (Task 8): the signature now legitimately appears as a
      // TYPE (handle interface members). What must never leak is the
      // compile-time signature STRING as a runtime value (a quoted literal).
      for (const q of [`'`, `"`]) {
        expect(code, target).not.toContain(`${q}() => Calendar | null${q}`);
        expect(code, target).not.toContain(`${q}(d: DateInput) => void${q}`);
      }
      expect(code, target).not.toContain('$expose(');
    }
  });
  it.each([
    [`, { nope: '() => void' }`, RozieErrorCode.EXPOSE_SIGNATURE_UNKNOWN_VERB],
    [`, sigs`, RozieErrorCode.EXPOSE_SIGNATURES_INVALID],
    [`, { getApi: someVar }`, RozieErrorCode.EXPOSE_SIGNATURES_INVALID],
    [`, { getApi: 'number' }`, RozieErrorCode.EXPOSE_SIGNATURES_INVALID],
    [`, { ...x }`, RozieErrorCode.EXPOSE_SIGNATURES_INVALID],
    [`, { getApi: '(x: => 1' }`, RozieErrorCode.INVALID_AUTHORED_TYPE],
  ])('diagnostic for %s', (second, code) => {
    const { diagnostics } = compile(SRC(second), { target: 'react', filename: 'Probe.rozie', sourceMap: false });
    expect(diagnostics.map((d) => d.code)).toContain(code);
  });
});
