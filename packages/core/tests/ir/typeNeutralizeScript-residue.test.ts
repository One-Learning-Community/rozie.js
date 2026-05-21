// Phase 9 Plan 09-02 Task 3 — typeNeutralizeScript residue-only inversion.
//
// `typeNeutralizeScript` used to neutralize an untyped `<script>` Program
// wholesale (annotate every untyped declarator/param/catch with `: any`, wrap
// every for-of iterable in `as any`). Phase 9 introduces `<script lang="ts">`,
// so the pass becomes RESIDUE-ONLY: it fills only the untyped residue and
// preserves author annotations. The four per-node guards (annotateParam,
// CatchClause, VariableDeclaration, ForOfStatement idempotency) check
// `typeAnnotation` presence per node, so they are residue-correct for
// declarators/params/catch.
//
// WR-05 (Phase 9 code review) — the `ForOfStatement` wrap is PER-STATEMENT,
// not lang-gated. An earlier design skipped the `as any` wrap wholesale for
// `<script lang="ts">`; that was too coarse, since a typed script can still
// contain a genuinely-untyped iterable (`Array.from(someAny)`) that needs the
// `unknown`-defeating wrap. The pass has no type info, so it wraps EVERY
// for-of iterable and skips ONLY when `right` is already an author assertion
// (`as T` / `<T>expr`) — typed and untyped scripts behave identically.
//
// These tests cover the residue-only cases:
//   1. untyped Program → identical mutated AST as before (the no-regression
//      anchor protecting the 264-cell dist-parity gate),
//   2. typed Program, author-typed declarator → annotation preserved verbatim,
//   3. typed Program, untyped residue → still gets `: any`,
//   4. for-of over a bare iterable → wrapped in `as any` (typed AND untyped),
//   5. for-of over an author-asserted iterable → NOT re-wrapped (WR-05).
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
    typeNeutralizeScript(file);
    const out = emit(file);
    expect(out).toContain('let editor: any = null');
    expect(out).toContain('function handle(ch: any)');
    expect(out).toContain('catch (err: any)');
  });

  it('untyped Program: for-of iterable is STILL wrapped in `as any`', () => {
    const file = parseJs('for (const f of files) { void f; }');
    typeNeutralizeScript(file);
    expect(emit(file)).toContain('files as any');
  });

  // ── Case 2: typed Program — author annotations preserved verbatim ────────
  it('typed Program: an author-typed declarator is left untouched', () => {
    const file = parseTs('let editor: Editor | null = null;');
    typeNeutralizeScript(file);
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
    typeNeutralizeScript(file);
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
    typeNeutralizeScript(file);
    const out = emit(file);
    // Author annotation kept; the untyped residue still filled.
    expect(out).toContain('let typed: Editor | null = null');
    expect(out).toContain('let bare: any = null');
  });

  // ── Case 4: WR-05 — for-of wrap is per-statement, not lang-gated ─────────
  it('typed Program: a bare for-of iterable IS wrapped in `as any` (WR-05)', () => {
    // The pre-WR-05 design skipped the wrap wholesale for typed scripts. The
    // wrap defeats `unknown` widening (TS18046) and the hazard exists in typed
    // scripts too, so a bare iterable must still be wrapped there.
    const file = parseTs('for (const f of files) { void f; }');
    typeNeutralizeScript(file);
    const out = emit(file);
    expect(out).toContain('files as any');
  });

  it('typed Program: an untyped `Array.from` for-of iterable IS wrapped (WR-05)', () => {
    // The WR-05 regression case: a typed `<script lang="ts">` containing a
    // genuinely-untyped iterable. `Array.from(someAny)` widens its element to
    // `unknown`; without the wrap every member access on the loop variable is
    // TS18046. The wrap — `for (const f of (Array.from(someAny) as any))` —
    // defeats that, and it must NOT be suppressed just because the script is
    // typed. EMITTED CODE is inspected here, not a diagnostic.
    const file = parseTs(
      'declare const someAny: any;\nfor (const f of Array.from(someAny)) { f.doThing(); }',
    );
    typeNeutralizeScript(file);
    const out = emit(file);
    expect(out).toContain('Array.from(someAny) as any');
    // The loop variable member access survives — the wrap makes `f` an `any`.
    expect(out).toContain('f.doThing()');
  });

  // ── Case 5: WR-05 — author-asserted iterable is NOT re-wrapped ───────────
  it('typed Program: an author-asserted for-of iterable is NOT re-wrapped (WR-05)', () => {
    // When the author already asserted the iterable (`as Foo[]`), the wrap is
    // skipped — wrapping `as any` would downgrade the author-owned type. The
    // emitted code keeps the author assertion and gains no `as any`.
    const file = parseTs(
      'for (const f of (raw as string[])) { void f; }',
    );
    typeNeutralizeScript(file);
    const out = emit(file);
    expect(out).toContain('raw as string[]');
    expect(out).not.toContain('as any');
  });

  it('the for-of wrap is idempotent — a second run adds no extra `as any`', () => {
    const file = parseTs('for (const f of files) { void f; }');
    typeNeutralizeScript(file);
    typeNeutralizeScript(file);
    const out = emit(file);
    // Exactly one `as any` — the second run sees its own assertion and skips.
    expect(out.match(/as any/g)?.length).toBe(1);
  });
});
