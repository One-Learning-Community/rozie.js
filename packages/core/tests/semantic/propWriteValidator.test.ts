// Plan 02-02 Task 2 — live tests for propWriteValidator (SEM-02 / ROZ200).
//
// Detects writes to $props.foo where foo lacks `model: true`. Operator-
// agnostic (any AssignmentExpression operator) AND covers UpdateExpression
// (++/--) per Pitfall 3. Does NOT flag local-variable rebinds after
// destructuring.
//
// Phase 2 success criterion 2 anchor (ROZ200 named explicitly in
// .planning/ROADMAP.md).
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { analyzeAST } from '../../src/semantic/analyze.js';
import { renderDiagnostic } from '../../src/diagnostics/frame.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const SYNTHETIC = resolve(__dirname, '../fixtures/synthetic');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function loadSynthetic(name: string): string {
  return fs.readFileSync(resolve(SYNTHETIC, `${name}.rozie`), 'utf8');
}

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

describe('propWriteValidator — ROZ200 (SEM-02 / Phase 2 success criterion 2)', () => {
  it('Counter.rozie: zero ROZ200 ($props.value writes succeed because value has model: true)', () => {
    const { diagnostics } = analyzeSource(loadExample('Counter'), 'Counter.rozie');
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
  });

  it('Counter-with-step-write.rozie: emits exactly one ROZ200', () => {
    const { diagnostics } = analyzeSource(
      loadSynthetic('Counter-with-step-write'),
      'Counter-with-step-write.rozie',
    );
    const roz200 = filterByCode(diagnostics, 'ROZ200');
    expect(roz200.length).toBe(1);
    const d = roz200[0]!;
    expect(d.severity).toBe('error');
    expect(d.message).toContain('step');
    expect(d.message).toContain('model: true');
    // Loc covers the AssignmentExpression — start should be > 0 and end > start.
    expect(d.loc.start).toBeGreaterThan(0);
    expect(d.loc.end).toBeGreaterThan(d.loc.start);
    // related[0] points at the prop's declaration site.
    expect(d.related).toBeDefined();
    expect(d.related!.length).toBe(1);
    expect(d.related![0]!.message).toBe('Prop declared here');
    expect(d.related![0]!.loc.start).toBeGreaterThan(0);
  });

  it('Counter-with-step-write.rozie: renderDiagnostic produces a code-frame with ROZ200 + offending source', () => {
    const { src, diagnostics } = analyzeSource(
      loadSynthetic('Counter-with-step-write'),
      'Counter-with-step-write.rozie',
    );
    const roz200 = filterByCode(diagnostics, 'ROZ200');
    expect(roz200.length).toBe(1);
    const rendered = renderDiagnostic(roz200[0]!, src);
    expect(rendered).toContain('ROZ200');
    expect(rendered).toContain('step');
  });

  it('detects every AssignmentExpression operator (operator-agnostic per Pitfall 3)', () => {
    // Each operator is checked independently — no double-counting.
    const operators = ['=', '+=', '-=', '*=', '/=', '%=', '**=', '<<=', '>>=', '>>>=', '&=', '|=', '^=', '&&=', '||=', '??='];
    for (const op of operators) {
      const src = `<rozie name="X">
<props>{ step: { type: Number, default: 1 } }</props>
<script>
const f = () => { $props.step ${op} 1 }
</script>
</rozie>`;
      const { diagnostics } = analyzeSource(src, `op-${op}.rozie`);
      const roz200 = filterByCode(diagnostics, 'ROZ200');
      expect(
        roz200.length,
        `operator ${op} should produce exactly one ROZ200 (got ${roz200.length})`,
      ).toBe(1);
    }
  });

  it('detects UpdateExpression ++ and -- on $props.foo', () => {
    for (const op of ['++', '--']) {
      const src = `<rozie name="X">
<props>{ step: { type: Number, default: 1 } }</props>
<script>
const f = () => { $props.step${op} }
</script>
</rozie>`;
      const { diagnostics } = analyzeSource(src, `update-${op}.rozie`);
      const roz200 = filterByCode(diagnostics, 'ROZ200');
      expect(
        roz200.length,
        `UpdateExpression ${op} should produce exactly one ROZ200 (got ${roz200.length})`,
      ).toBe(1);
    }
  });

  it('does NOT flag destructured rebind: const { step } = $props; step = 5', () => {
    const src = `<rozie name="X">
<props>{ step: { type: Number, default: 1 } }</props>
<script>
const helper = () => {
  const { step } = $props
  let s = step
  s = 5
}
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
  });

  it('does NOT flag write to a model: true prop', () => {
    const src = `<rozie name="X">
<props>{ value: { type: Number, default: 0, model: true } }</props>
<script>
const f = () => { $props.value = 5 }
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
  });

  it('does NOT throw on any input (D-08)', () => {
    const inputs = [
      loadExample('Counter'),
      loadExample('Dropdown'),
      loadSynthetic('Counter-with-step-write'),
      // Bare wrapper, no script:
      `<rozie name="X"></rozie>`,
    ];
    for (const src of inputs) {
      const { ast } = parse(src, { filename: 'edge.rozie' });
      if (!ast) continue;
      expect(() => analyzeAST(ast)).not.toThrow();
    }
  });

  it('TodoList.rozie: writes to $props.items (model: true) — zero ROZ200', () => {
    const { diagnostics } = analyzeSource(loadExample('TodoList'), 'TodoList.rozie');
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
  });

  it('Dropdown.rozie: writes to $props.open (model: true) — zero ROZ200', () => {
    const { diagnostics } = analyzeSource(loadExample('Dropdown'), 'Dropdown.rozie');
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
  });

  it('does NOT double-emit ROZ200 + ROZ100 for write to unknown prop (write to undeclared prop is ROZ100 only)', () => {
    const src = `<rozie name="X">
<props>{ value: { type: Number, default: 0, model: true } }</props>
<script>
const f = () => { $props.bogus = 5 }
</script>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    // The unknownRefValidator emits ROZ100 for bogus; propWriteValidator should
    // skip silently (no decl to check isModel against).
    expect(filterByCode(diagnostics, 'ROZ200')).toEqual([]);
    expect(filterByCode(diagnostics, 'ROZ100').length).toBeGreaterThanOrEqual(1);
  });
});
