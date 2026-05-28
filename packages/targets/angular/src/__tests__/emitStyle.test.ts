/**
 * emitStyle (angular) — :deep() byte-slice fidelity + Phase 17 ::part strip.
 *
 * Angular's `stringifyRules` byte-slices each scoped rule verbatim, only
 * reparsing when the slice contains `:deep(` (→ `::ng-deep` lowering, quick
 * task 260526-mk4). Everything else is preserved byte-for-byte (Risk 5 floor).
 *
 * Phase 17 Plan 03 (SPEC-R1 non-Lit arm / SPEC-R4a): a consumer
 * `<child>::part(name)` rule is a cross-shadow mechanism with meaning only on
 * Lit. Without intervention Angular would byte-slice it verbatim into
 * `styles: [...]` as meaningless/broken CSS. `stringifyRules` must DROP any
 * rule whose slice contains `::part(` BEFORE the `:deep(` lowering branch (so
 * it is never passed to `lowerDeepToNgDeep` and never joined — no stray empty
 * line). The drop is independent of the `:deep` path (SPEC-R5).
 */
import { describe, expect, it } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitStyle } from '../emit/emitStyle.js';

function compileStyle(css: string): ReturnType<typeof emitStyle> {
  const src = [
    '<rozie name="X">',
    '<template><div /></template>',
    '<style>',
    css,
    '</style>',
    '</rozie>',
  ].join('\n');
  const result = parse(src, { filename: 'X.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return emitStyle(lowered.ir.styles, src);
}

describe('emitStyle (angular) — :deep() → ::ng-deep lowering (SPEC-R5 baseline)', () => {
  it('.outer :deep(.inner) lowers to `.outer ::ng-deep .inner`', () => {
    const out = compileStyle('.outer :deep(.inner) { color: red; }');
    expect(out.stylesArrayBody).toContain('::ng-deep');
    expect(out.stylesArrayBody).toContain('.inner');
    expect(out.stylesArrayBody).not.toContain(':deep(');
    expect(out.diagnostics).toEqual([]);
  });

  it('top-level :deep(.x) lowers to `::ng-deep .x`', () => {
    const out = compileStyle(':deep(.x) { color: red; }');
    expect(out.stylesArrayBody).toContain('::ng-deep');
    expect(out.stylesArrayBody).toContain('.x');
    expect(out.stylesArrayBody).not.toContain(':deep(');
  });
});

describe('emitStyle (angular) — ::part() cross-shadow no-op strip (SPEC-R4a)', () => {
  it('omits a `<child>::part(body)` rule from the styles array body', () => {
    const out = compileStyle('rozie-part-card::part(body) { color: red; }');
    expect(out.stylesArrayBody).not.toContain('::part(');
    expect(out.stylesArrayBody).not.toContain('color: red');
    expect(out.diagnostics).toEqual([]);
  });

  it('drops ONLY the ::part rule — a co-present ordinary rule still survives', () => {
    const out = compileStyle(
      'rozie-part-card::part(body) { color: red; }\n.card-body { padding: 1rem; }',
    );
    expect(out.stylesArrayBody).not.toContain('::part(');
    expect(out.stylesArrayBody).not.toContain('color: red');
    // Co-present ordinary rule survives.
    expect(out.stylesArrayBody).toContain('.card-body');
    expect(out.stylesArrayBody).toContain('padding: 1rem');
    // No stray empty line left where the ::part rule was.
    expect(out.stylesArrayBody).not.toMatch(/\n\n\n/);
    expect(out.diagnostics).toEqual([]);
  });

  it(':deep regression guard — a sibling :deep rule still lowers to ::ng-deep, ::part rule gone', () => {
    const out = compileStyle(
      '.outer :deep(.inner) { color: red; }\nrozie-part-card::part(body) { color: blue; }',
    );
    // :deep → ::ng-deep lowering unchanged (SPEC-R5).
    expect(out.stylesArrayBody).toContain('::ng-deep');
    expect(out.stylesArrayBody).toContain('.inner');
    // ::part rule dropped — never passed to lowerDeepToNgDeep, never joined.
    expect(out.stylesArrayBody).not.toContain('::part(');
    expect(out.stylesArrayBody).not.toContain('color: blue');
    expect(out.diagnostics).toEqual([]);
  });
});
