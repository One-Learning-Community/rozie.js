// Phase 9 Plan 09-02 Task 3 — typeNeutralizeScript residue-only inversion.
//
// `typeNeutralizeScript` used to neutralize an untyped `<script>` Program
// wholesale (annotate every untyped declarator/param/catch with `: any`, wrap
// every for-of iterable in `as any`). Phase 9 introduces `<script lang="ts">`,
// so the pass becomes RESIDUE-ONLY: it fills only the untyped residue and
// preserves author annotations. The four per-node guards (annotateParam,
// CatchClause, VariableDeclaration, ForOfStatement idempotency) already check
// `typeAnnotation` presence per node, so they are residue-correct for
// declarators/params/catch. The one ADDITIVE change: a `lang`-gated
// ForOfStatement — the `as any` wrap is skipped entirely for typed scripts so
// the author's iterable element type survives.
//
// These tests cover all five `<behavior>` cases from the plan:
//   1. untyped Program → identical mutated AST as before (the no-regression
//      anchor protecting the 264-cell dist-parity gate),
//   2. typed Program, author-typed declarator → annotation preserved verbatim,
//   3. typed Program, untyped residue → still gets `: any`,
//   4. typed Program, for-of → NOT wrapped in `as any`,
//   5. untyped Program, for-of → STILL wrapped in `as any`.
import { describe, expect, it } from 'vitest';
import { parse as babelParse } from '@babel/parser';
import _generate from '@babel/generator';
import type { File } from '@babel/types';
import { typeNeutralizeScript } from '../../src/codegen/typeNeutralizeScript.js';

// @babel/generator ships a CJS default export some ESM resolvers wrap.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: GenerateFn }).default;

/** Parse JS (typescript plugin OFF) — the untyped `<script>` parse path. */
function parseJs(src: string): File {
  return babelParse(src, { sourceType: 'module', plugins: [] });
}

/** Parse TS (typescript plugin ON) — the `<script lang="ts">` parse path. */
function parseTs(src: string): File {
  return babelParse(src, { sourceType: 'module', plugins: ['typescript'] });
}

/** Emit source from a (possibly mutated) Babel File. */
function emit(file: File): string {
  return generate(file).code;
}

describe('typeNeutralizeScript — residue-only inversion (Task 3)', () => {
  // ── Case 1: untyped Program — byte-identical to the pre-Phase-9 behavior ──
  it('untyped Program: every untyped declarator / param / catch gets `: any`', () => {
    const file = parseJs(
      [
        'let editor = null;',
        'function handle(ch) { return ch; }',
        'try { editor = 1; } catch (err) { void err; }',
      ].join('\n'),
    );
    typeNeutralizeScript(file, false);
    const out = emit(file);
    expect(out).toContain('let editor: any = null');
    expect(out).toContain('function handle(ch: any)');
    expect(out).toContain('catch (err: any)');
  });

  it('untyped Program: for-of iterable is STILL wrapped in `as any`', () => {
    const file = parseJs('for (const f of files) { void f; }');
    typeNeutralizeScript(file, false);
    expect(emit(file)).toContain('files as any');
  });

  // ── Case 2: typed Program — author annotations preserved verbatim ────────
  it('typed Program: an author-typed declarator is left untouched', () => {
    const file = parseTs('let editor: Editor | null = null;');
    typeNeutralizeScript(file, true);
    const out = emit(file);
    expect(out).toContain('let editor: Editor | null = null');
    // The author type must NOT be clobbered with `any`.
    expect(out).not.toContain(': any');
  });

  it('typed Program: an author-typed param and catch binding are preserved', () => {
    const file = parseTs(
      [
        'function handle(ch: number) { return ch; }',
        'try { void 0; } catch (err: unknown) { void err; }',
      ].join('\n'),
    );
    typeNeutralizeScript(file, true);
    const out = emit(file);
    expect(out).toContain('handle(ch: number)');
    expect(out).toContain('catch (err: unknown)');
    expect(out).not.toContain(': any');
  });

  // ── Case 3: typed Program — untyped residue still neutralized ────────────
  it('typed Program: an untyped declarator in the residue STILL gets `: any`', () => {
    const file = parseTs(
      'let typed: Editor | null = null;\nlet bare = null;',
    );
    typeNeutralizeScript(file, true);
    const out = emit(file);
    // Author annotation kept; the untyped residue still filled.
    expect(out).toContain('let typed: Editor | null = null');
    expect(out).toContain('let bare: any = null');
  });

  // ── Case 4: typed Program — for-of NOT wrapped ───────────────────────────
  it('typed Program: a for-of iterable is NOT wrapped in `as any`', () => {
    const file = parseTs('for (const f of files) { void f; }');
    typeNeutralizeScript(file, true);
    const out = emit(file);
    expect(out).not.toContain('as any');
    expect(out).toContain('for (const f of files)');
  });
});
