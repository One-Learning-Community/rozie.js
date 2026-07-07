// Spike-012 (target-agnostic silent miscompile) — ROZ143
// EVENT_HANDLER_NOT_EXPRESSION.
//
// A template `@event="..."` handler whose text fails to parse as a single JS
// EXPRESSION (dominant cause: a statement-body handler — `if (...) { a() }
// else { b() }`, a loop, a bare block) previously lowered SILENTLY to a no-op
// `undefined` handler on all six targets — no diagnostic at all. This is the
// ROZ977-class silent-compile-failure anti-pattern: the author's handler
// simply never fires, discoverable only by clicking the element and nothing
// happening. The fix keeps the `undefined` fallback (emit stays
// byte-identical) but ADDS a loud ROZ143 error diagnostic.
//
// Mirrors the `attr-fallthrough-diagnostics.test.ts` pattern: compile an
// inline `.rozie` source and assert on the returned `diagnostics` array.
import { describe, it, expect } from 'vitest';
import { compile } from '../compile.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';

/** Compile an inline `.rozie` source (Vue target) and return diagnostics. */
function compileDiagnostics(source: string): Diagnostic[] {
  return compile(source, {
    target: 'vue',
    filename: 'EventHandlerNotExpression.rozie',
    types: false,
    sourceMap: false,
  }).diagnostics;
}

function rozie(name: string, templateBody: string): string {
  return `<rozie name="${name}">
<template>
${templateBody}
</template>
</rozie>
`;
}

describe('event-handler-not-expression diagnostics (Spike-012 silent miscompile fix)', () => {
  it('a statement-body @click handler (if/else) produces a ROZ143 error', () => {
    const diags = compileDiagnostics(
      rozie(
        'StatementIfElse',
        `<button @click="if ($data.n > 0) { a() } else { b() }">Go</button>`,
      ),
    );
    const notExpr = diags.filter(
      (d) => d.code === RozieErrorCode.EVENT_HANDLER_NOT_EXPRESSION,
    );
    expect(
      notExpr.length,
      `expected a ROZ143 for a statement-body handler; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(notExpr[0]!.severity).toBe('error');
  });

  it('a statement-body @click handler (for loop) produces a ROZ143 error', () => {
    const diags = compileDiagnostics(
      rozie(
        'StatementForLoop',
        `<button @click="for (let i = 0; i < 3; i++) { a() }">Go</button>`,
      ),
    );
    const notExpr = diags.filter(
      (d) => d.code === RozieErrorCode.EVENT_HANDLER_NOT_EXPRESSION,
    );
    expect(
      notExpr.length,
      `expected a ROZ143 for a for-loop statement-body handler; got ${JSON.stringify(diags)}`,
    ).toBe(1);
    expect(notExpr[0]!.severity).toBe('error');
  });

  it('a normal call-expression @click handler produces no ROZ143', () => {
    const diags = compileDiagnostics(
      rozie('NormalCall', `<button @click="method()">Go</button>`),
    );
    const notExpr = diags.filter(
      (d) => d.code === RozieErrorCode.EVENT_HANDLER_NOT_EXPRESSION,
    );
    expect(notExpr, JSON.stringify(notExpr)).toEqual([]);
  });

  it('a normal assignment-expression @click handler produces no ROZ143', () => {
    const diags = compileDiagnostics(
      rozie('NormalAssignment', `<button @click="$data.n = 1">Go</button>`),
    );
    const notExpr = diags.filter(
      (d) => d.code === RozieErrorCode.EVENT_HANDLER_NOT_EXPRESSION,
    );
    expect(notExpr, JSON.stringify(notExpr)).toEqual([]);
  });

  it('a valueless @click handler (attr.value === null) produces no ROZ143', () => {
    const diags = compileDiagnostics(
      rozie('Valueless', `<button @click>Go</button>`),
    );
    const notExpr = diags.filter(
      (d) => d.code === RozieErrorCode.EVENT_HANDLER_NOT_EXPRESSION,
    );
    expect(notExpr, JSON.stringify(notExpr)).toEqual([]);
  });
});
