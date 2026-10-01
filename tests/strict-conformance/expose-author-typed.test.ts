/**
 * EXPOSE-AUTHOR-TYPED — typed public surface P1, final fix wave I1.
 *
 * In an opt-in component (at least one `$expose` signature), a verb whose
 * implementation carries the author's own types in `<script lang="ts">`
 * (`function add(by: number): string`, a return-typed arrow/function
 * expression, or an annotated `const mul: (by: number) => string = …`) keeps
 * those types on the consumer surface of EVERY target; only genuinely untyped
 * verbs fall back to `(...args: any[]) => any`. Shared fixture:
 * __fixtures__/expose-author-typed/AuthorExpose.rozie (also read by the
 * svelte/angular/vue typecheck suites). `@ts-expect-error` lines are the
 * negatives (TS2578 if one stops erroring).
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(resolve(HERE, '__fixtures__/expose-author-typed/AuthorExpose.rozie'), 'utf8');

/** The handle checks, over any `h` exposing the verbs. */
const HANDLE_CHECKS = (h: string) => `
export const s1: string = ${h}.add(1);
// @ts-expect-error — add takes a number
${h}.add('x');
export const s2: string = ${h}.sub(1);
// @ts-expect-error — sub takes a number
${h}.sub('x');
export const s3: string = ${h}.mul(2);
// @ts-expect-error — mul takes a number
${h}.mul('x');
export const s4: number = ${h}.half(4);
// @ts-expect-error — half takes a number
${h}.half('x');
${h}.reset();
// @ts-expect-error — reset takes no arguments
${h}.reset(1);
${h}.loose('anything', 2);
${h}.twice('anything');
`;

const REACT_CONSUMER = `import type { AuthorExposeHandle } from './AuthorExpose';
declare const h: AuthorExposeHandle;
${HANDLE_CHECKS('h')}`;
const SOLID_CONSUMER = REACT_CONSUMER;
const LIT_CONSUMER = `import AuthorExpose from './AuthorExpose';
declare const h: AuthorExpose;
${HANDLE_CHECKS('h')}`;

describe('EXPOSE-AUTHOR-TYPED — author-typed $expose verbs keep their types (I1)', () => {
  for (const [target, ext, consumer] of [
    ['react', 'tsx', REACT_CONSUMER],
    ['solid', 'tsx', SOLID_CONSUMER],
    ['lit', 'ts', LIT_CONSUMER],
  ] as const) {
    it(target, () => {
      const { code, diagnostics } = compile(FIXTURE, { target, filename: 'AuthorExpose.rozie', sourceMap: false });
      expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const { raw, inventory } = typecheckCompiled({
        target,
        files: { [`AuthorExpose.${ext}`]: code, [`Consumer.${ext}`]: consumer },
        nodeModulesFrom: `packages/ui/combobox/packages/${target}`,
      });
      expect(totalErrors(inventory), raw).toBe(0);
    });
  }
});
