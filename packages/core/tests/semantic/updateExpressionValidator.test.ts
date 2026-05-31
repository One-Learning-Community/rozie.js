// ROZ203 — Expression-context mutation of reactive state (260530).
//
// Companion to propWriteValidator.test.ts (ROZ200). Detects `++`/`--`/compound/
// plain mutation of reactive state ($data.<key> or model:true $props.<key>)
// whose VALUE IS CONSUMED (parent is not an ExpressionStatement) — the
// setter-based targets can't read the value back from a setter. Statement
// context (`$data.x++;` on its own line) still lowers cleanly (cb341f12) and
// must NOT trip the check.
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/parse.js';
import { analyzeAST } from '../../src/semantic/analyze.js';
import { renderDiagnostic } from '../../src/diagnostics/frame.js';
import { compile, type CompileTarget } from '../../src/compile.js';

function analyzeSource(source: string, filename = 'test.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return { src: source, ast, parseDiags, ...analyzeAST(ast) };
}

function filterByCode(diags: { code: string }[], code: string) {
  return diags.filter((d) => d.code === code);
}

const ALL_TARGETS: CompileTarget[] = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'];

// A component declaring $data.count (state) and a model:true $props.value, plus
// a non-model $props.step, so each case can target the relevant accessor.
function wrap(scriptBody: string): string {
  return `<rozie name="X">
<props>{ value: { type: Number, default: 0, model: true }, step: { type: Number, default: 1 } }</props>
<data>{ count: 0 }</data>
<script>
const f = () => { ${scriptBody} }
</script>
<template><div>{{ count }}</div></template>
</rozie>`;
}

describe('updateExpressionValidator — ROZ203 (expression-context reactive mutation)', () => {
  it('flags expression-context $data.count++ (const y = $data.count++)', () => {
    const { diagnostics } = analyzeSource(wrap('const y = $data.count++; return y'));
    const roz203 = filterByCode(diagnostics, 'ROZ203');
    expect(roz203.length).toBe(1);
    const d = roz203[0]!;
    expect(d.severity).toBe('error');
    expect(d.message).toContain('$data.count');
    expect(d.hint).toBeDefined();
    expect(d.loc.start).toBeGreaterThan(0);
    expect(d.loc.end).toBeGreaterThan(d.loc.start);
  });

  it('flags expression-context model $props.value++ (const y = $props.value++)', () => {
    const { diagnostics } = analyzeSource(wrap('const y = $props.value++; return y'));
    const roz203 = filterByCode(diagnostics, 'ROZ203');
    expect(roz203.length).toBe(1);
    expect(roz203[0]!.message).toContain('$props.value');
  });

  it('flags expression-context $data.count++ in a subscript (arr[$data.count++])', () => {
    const { diagnostics } = analyzeSource(wrap('const arr = [1,2,3]; return arr[$data.count++]'));
    expect(filterByCode(diagnostics, 'ROZ203').length).toBe(1);
  });

  it('flags both prefix and postfix forms', () => {
    for (const form of ['$data.count++', '++$data.count', '$data.count--', '--$data.count']) {
      const { diagnostics } = analyzeSource(wrap(`const y = ${form}; return y`));
      expect(
        filterByCode(diagnostics, 'ROZ203').length,
        `form ${form} should produce one ROZ203`,
      ).toBe(1);
    }
  });

  it('flags expression-context COMPOUND assignment (const y = ($data.count += 1))', () => {
    const { diagnostics } = analyzeSource(wrap('const y = ($data.count += 1); return y'));
    expect(filterByCode(diagnostics, 'ROZ203').length).toBe(1);
  });

  it('flags expression-context PLAIN assignment value-consume (const y = ($data.count = 5))', () => {
    const { diagnostics } = analyzeSource(wrap('const y = ($data.count = 5); return y'));
    expect(filterByCode(diagnostics, 'ROZ203').length).toBe(1);
  });

  it('flags model $props.value compound in expression context', () => {
    const { diagnostics } = analyzeSource(wrap('const y = ($props.value += 2); return y'));
    expect(filterByCode(diagnostics, 'ROZ203').length).toBe(1);
  });

  // --- Negative cases: statement context must NOT trip ROZ203 (don't regress cb341f12) ---

  it('does NOT flag statement-context $data.count++ (bare statement)', () => {
    const { diagnostics } = analyzeSource(wrap('$data.count++'));
    expect(filterByCode(diagnostics, 'ROZ203')).toEqual([]);
  });

  it('does NOT flag statement-context $data.count += 1 / = 5 (bare statements)', () => {
    for (const stmt of ['$data.count += 1', '$data.count = 5', '$data.count--']) {
      const { diagnostics } = analyzeSource(wrap(stmt));
      expect(filterByCode(diagnostics, 'ROZ203'), `stmt: ${stmt}`).toEqual([]);
    }
  });

  it('does NOT flag statement-context model $props.value++ / += (bare statements)', () => {
    for (const stmt of ['$props.value++', '$props.value += 1']) {
      const { diagnostics } = analyzeSource(wrap(stmt));
      expect(filterByCode(diagnostics, 'ROZ203'), `stmt: ${stmt}`).toEqual([]);
    }
  });

  it('does NOT flag expression-context ++ on a plain non-reactive local (const y = t++)', () => {
    const { diagnostics } = analyzeSource(wrap('let t = 0; const y = t++; return y'));
    expect(filterByCode(diagnostics, 'ROZ203')).toEqual([]);
  });

  it('does NOT flag non-model $props.step expression-context update (ROZ200 owns it)', () => {
    // $props.step lacks model:true — any write is ROZ200, never double-emitted as ROZ203.
    const { diagnostics } = analyzeSource(wrap('const y = $props.step++; return y'));
    expect(filterByCode(diagnostics, 'ROZ203')).toEqual([]);
    expect(filterByCode(diagnostics, 'ROZ200').length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT throw on any input (D-08)', () => {
    const inputs = [
      wrap('const y = $data.count++; return y'),
      wrap('$data.count++'),
      `<rozie name="X"></rozie>`,
    ];
    for (const src of inputs) {
      const { ast } = parse(src, { filename: 'edge.rozie' });
      if (!ast) continue;
      expect(() => analyzeAST(ast)).not.toThrow();
    }
  });

  it('renderDiagnostic produces a code-frame with ROZ203 + offending source', () => {
    const { src, diagnostics } = analyzeSource(wrap('const y = $data.count++; return y'));
    const roz203 = filterByCode(diagnostics, 'ROZ203');
    expect(roz203.length).toBe(1);
    const rendered = renderDiagnostic(roz203[0]!, src);
    expect(rendered).toContain('ROZ203');
    expect(rendered).toContain('$data.count');
  });

  // --- End-to-end through compile() on every target ---

  describe('compile() end-to-end', () => {
    it.each(ALL_TARGETS)('expression-context $data.count++ raises ROZ203 on %s', (target) => {
      const result = compile(wrap('const y = $data.count++; return y'), {
        target,
        filename: 'X.rozie',
      });
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors.some((d) => d.code === 'ROZ203')).toBe(true);
    });

    it.each(ALL_TARGETS)(
      'statement-context $data.count++ compiles cleanly (no ROZ203, no errors) on %s',
      (target) => {
        const result = compile(wrap('$data.count++'), { target, filename: 'X.rozie' });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors.filter((d) => d.code === 'ROZ203')).toEqual([]);
        expect(errors, `errors on ${target}: ${JSON.stringify(errors)}`).toEqual([]);
        expect(result.code.length).toBeGreaterThan(0);
      },
    );
  });
});
