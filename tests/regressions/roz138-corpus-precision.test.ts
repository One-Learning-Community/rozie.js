/**
 * roz138-corpus-precision.test.ts — quick task 260829-8w1.
 *
 * Pins the ROZ138 (React stale-read) warning count on the SHIPPED
 * `packages/ui` corpus. Before this task's fix, the validator's dominance
 * test was a raw textual offset comparison with no branch/loop reasoning,
 * and 24 of 24 live warnings across two files were false positives (see
 * `.planning/notes/roz138-triage.md` for the full per-site derivation).
 *
 * RED BY DESIGN at landing time (2026-08-29): this test is authored with the
 * POST-fix expectation — total 3, survivors at `gridKeydownHandlers.rzts`
 * lines 567/570/571 (the `gridEmptyFallback ⇒ activeIsHeader` cluster, the
 * one site in the corpus with a genuine — if harmless — React-vs-others
 * control-flow divergence). It is RED until Task 2
 * (`reactStaleReadValidator.ts`) lands the (A) abrupt-completion and (B)
 * branch-exclusivity narrowings. See 260829-8w1-SUMMARY.md for the verbatim
 * RED observation (actual total: 24) and the commit that turns this green.
 *
 * IMPORTANT: `tests/regressions` resolves `@rozie/core` through its published
 * `dist/index.mjs` (see package.json `main`/`module`/`exports` — no source
 * path), so this test only reflects a `reactStaleReadValidator.ts` source
 * change AFTER `pnpm --filter @rozie/core build` has been re-run. Running it
 * against a stale `dist/` re-observes the PRE-fix count even after the
 * source fix lands.
 *
 * Line-number resolution: `d.loc.filename` may point at a spliced `.rzts`
 * PARTIAL (the DataTable warnings surface inside `gridKeydownHandlers.rzts`
 * / `gridFocusNav.rzts`, not in `DataTable.rozie` itself) — `compile()`
 * backfills `d.filename` from `d.loc.filename ?? hostFilename`
 * (`stampFilename.ts`), so `d.filename` is always the correct origin file to
 * read line text from. This file computes line numbers locally (a tiny
 * reimplementation of the internal `offsetToLineCol` helper, which is not
 * part of `@rozie/core`'s public surface) rather than adding a new export
 * for one test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, RozieErrorCode } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
// tests/regressions -> repo root.
const ROOT = join(HERE, '..', '..');

const SORTABLE_LIST_PATH = join(
  ROOT,
  'packages/ui/sortable-list/src/SortableList.rozie',
);
const DATA_TABLE_PATH = join(ROOT, 'packages/ui/data-table/src/DataTable.rozie');

/**
 * 1-indexed line number of `offset` within `source`. Local reimplementation
 * of `packages/core/src/diagnostics/offsetToLineCol.ts` (not exported from
 * `@rozie/core`'s public surface).
 */
function lineOf(source: string, offset: number): number {
  let line = 1;
  const limit = Math.min(offset, source.length);
  for (let i = 0; i < limit; i++) {
    if (source.charCodeAt(i) === 10 /* '\n' */) line++;
  }
  return line;
}

interface Survivor {
  filename: string;
  line: number;
}

/** Cache of file text read for line resolution — bounded by files this test touches. */
const textCache = new Map<string, string>();
function readCached(path: string): string {
  const cached = textCache.get(path);
  if (cached !== undefined) return cached;
  const text = readFileSync(path, 'utf8');
  textCache.set(path, text);
  return text;
}

function roz138Survivors(sourcePath: string): Survivor[] {
  const source = readFileSync(sourcePath, 'utf8');
  const result = compile(source, { target: 'react', filename: sourcePath });
  return result.diagnostics
    .filter((d) => d.code === RozieErrorCode.REACT_STALE_READ)
    .map((d) => {
      const originPath = d.filename ?? d.loc.filename ?? sourcePath;
      const originText = originPath === sourcePath ? source : readCached(originPath);
      return {
        filename: originPath.replace(ROOT + '/', ''),
        line: lineOf(originText, d.loc.start),
      };
    });
}

describe('ROZ138 corpus precision (quick task 260829-8w1)', () => {
  it('the shipped packages/ui corpus carries exactly 3 ROZ138 warnings, at the named gridKeydownHandlers.rzts sites', () => {
    const survivors = [
      ...roz138Survivors(SORTABLE_LIST_PATH),
      ...roz138Survivors(DATA_TABLE_PATH),
    ];

    const summary = survivors
      .map((s) => `  ${s.filename}:${s.line}`)
      .join('\n');

    expect(survivors.length, `survivors:\n${summary}`).toBe(3);

    const survivorSet = survivors
      .map((s) => `${s.filename}:${s.line}`)
      .sort();
    expect(survivorSet).toEqual(
      [
        'packages/ui/data-table/src/gridKeydownHandlers.rzts:567',
        'packages/ui/data-table/src/gridKeydownHandlers.rzts:570',
        'packages/ui/data-table/src/gridKeydownHandlers.rzts:571',
      ].sort(),
    );
  });
});
