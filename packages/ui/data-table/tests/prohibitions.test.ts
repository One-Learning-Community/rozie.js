/**
 * prohibitions.test.ts — the machine-enforced D-05 gate (Phase 87 87-02).
 *
 * D-05 replaces ALL 14 verified live truthiness reads of the windowing prop
 * (`$props.virtual`) in data-table + the shared `windowing.rzts` engine with
 * `rowsWindowed()` / `colsWindowed()` / `isWindowed()`. Under 87-03's widened
 * string grammar, `'columns'` is truthy — so a future bare
 * `if ($props.virtual)` would silently take the row-windowing path
 * (`windowSource()` flips to the pre-pagination model, `pageRowOffset()`
 * returns 0, the pagination chrome disappears) even when only the column
 * axis was requested. This test blocks a regression to that bare read from
 * ever reaching CI green.
 *
 * Structure mirrors `packages/ui/combobox/tests/prohibitions.test.ts`: a pure
 * checking function (`findForbiddenViolations`) that takes a source string
 * and returns every violation it finds — never a boolean baked into the
 * function itself — driven by both a synthetic positive fixture (proving the
 * gate actually fires) and a real-source scan (proving the gate is clean).
 *
 * The forbidden identifier lives ONLY in the `FORBIDDEN_IDENTIFIER` constant
 * below (the combobox gate's own discipline) — restating it in a comment or
 * docs page elsewhere in this file would ship the very pattern the rule
 * forbids into the tree this test itself scans.
 *
 * Also carries the Task 2 (A2) invariant assertion: `colIndexOf`,
 * `visibleColCount`, `columnIdAt`, `cellValueAt`, and `beginEdit` all resolve
 * columns through the UNSLICED `visibleCellsFor(row)` / `getVisibleCells()` —
 * never a windowed slice (D-09). Encoded as a source-level check for the
 * identifier `windowedCells` in the five files whose functions the A2
 * premise covers; if a later plan makes one of those five read a windowed
 * slice, this goes red and the "premise false" branch (a `colOffset()`-style
 * bridge, modelled on `pageRowOffset()`) is forced into the open instead of
 * being silently absorbed.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_TABLE_SRC = resolve(HERE, '..', 'src');
const WINDOWING_RZTS = resolve(HERE, '..', '..', 'headless-core', 'src', 'windowing.rzts');

const SCANNED_EXTENSIONS = ['.rozie', '.rzts', '.ts'];

interface SourceFile {
  id: string;
  path: string;
  source: string;
}

/**
 * Recursively collect every file under `dir` whose extension is one of
 * `SCANNED_EXTENSIONS` — the `packages/ui/data-table/src/**\/*.{rozie,rzts,ts}`
 * glob the task action describes, hand-walked (no new glob dependency).
 */
function collectSourceFiles(dir: string): SourceFile[] {
  const out: SourceFile[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full));
      continue;
    }
    if (SCANNED_EXTENSIONS.some((ext) => full.endsWith(ext))) {
      // Skip codegen's regenerated per-component shims. `scripts/codegen.mjs` emits a
      // `<Component>.ts` next to each `<Component>.rozie` in this directory; those are
      // build output (gitignored via `packages/ui/data-table/src/*.ts`), not sources.
      // Walking them made this suite's `it.each` case count a function of BUILD state
      // rather than source state — it read 57 cases with a warm build and 56 after the
      // shim for one component went missing, which is exactly the kind of silent count
      // drift that trains a reader to ignore a real coverage drop. A `.rozie` sibling is
      // the total discriminator here: every generated shim has one, no real source does
      // (`src/helpers/*.ts`, the D-22 extraction, live a directory down and are untouched
      // by this rule). Prohibition violations in emitted output are emitter bugs and
      // belong to the target suites, not to this source-level gate.
      if (full.endsWith('.ts') && existsSync(full.slice(0, -3) + '.rozie')) continue;
      out.push({ id: full.slice(DATA_TABLE_SRC.length + 1), path: full, source: readFileSync(full, 'utf8') });
    }
  }
  return out;
}

const dataTableSources: SourceFile[] = collectSourceFiles(DATA_TABLE_SRC);
const windowingSource: SourceFile = {
  id: 'windowing.rzts',
  path: WINDOWING_RZTS,
  source: readFileSync(WINDOWING_RZTS, 'utf8'),
};
const allScannedSources: SourceFile[] = [...dataTableSources, windowingSource];

// ── Prohibition: no bare truthiness read of the windowing prop ──

const FORBIDDEN_IDENTIFIER = '$props.virtual';

// The ONE line the D-05 predicate layer's `resolveVirtual()` (virtualization.rzts)
// legitimately reads the raw prop on — the single canonical resolution point every
// other read normalizes through. Any OTHER occurrence of the forbidden identifier
// is a violation.
const ALLOWED_LINE = /^\s*const\s+v\s*=\s*\$props\.virtual\s*$/;

interface ForbiddenViolation {
  line: number;
  text: string;
}

/**
 * Strip `//` line comments and `/* *\/` block comments before matching
 * (comment-only mentions are not violations) — WITHOUT treating a `//`
 * inside a string literal (single-, double-, or backtick-quoted) as a
 * comment start (WR-03). A naive `line.indexOf('//')` truncates everything
 * after a `//` found inside a URL string, silently dropping a genuine
 * violation that sits later on the same line.
 *
 * This is a small hand-rolled character scanner, not a full JS tokenizer —
 * it tracks "am I inside a quote / block comment right now" character by
 * character, honoring backslash-escaped quotes, and carries that state
 * across line boundaries (so a multi-line template literal or block
 * comment doesn't have its interior misread as code). That is enough to
 * make this gate reliable against the actual shapes it scans
 * (`.rozie`/`.rzts`/`.ts` source with URL strings and regular comments) —
 * a full AST-based strip is deliberately not needed here.
 */
function stripLineComments(source: string): string[] {
  const out: string[] = [];
  let quote: '\'' | '"' | '`' | null = null;
  let inBlockComment = false;

  for (const rawLine of source.split('\n')) {
    let result = '';
    let i = 0;
    while (i < rawLine.length) {
      const ch = rawLine[i];
      const next = rawLine[i + 1];

      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i += 2;
        } else {
          i += 1;
        }
        continue;
      }

      if (quote) {
        result += ch;
        if (ch === '\\' && next !== undefined) {
          // Escaped character inside a string — consume both without
          // letting the escaped char close the quote or start a comment.
          result += next;
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        i += 1;
        continue;
      }

      // Not inside a string or block comment.
      if (ch === '/' && next === '/') break; // rest of the line is a line comment
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (ch === '\'' || ch === '"' || ch === '`') {
        quote = ch;
        result += ch;
        i += 1;
        continue;
      }

      result += ch;
      i += 1;
    }
    out.push(result);
  }
  return out;
}

/**
 * Pure checking function. Takes a source string, returns every bare
 * truthiness read of the windowing prop that is NOT the one allow-listed
 * `resolveVirtual()` resolution line (empty array = clean).
 */
function findForbiddenViolations(source: string): ForbiddenViolation[] {
  const violations: ForbiddenViolation[] = [];
  const lines = stripLineComments(source);
  lines.forEach((line, idx) => {
    if (line.includes(FORBIDDEN_IDENTIFIER) && !ALLOWED_LINE.test(line)) {
      violations.push({ line: idx + 1, text: line.trim() });
    }
  });
  return violations;
}

describe('data-table prohibition gate (D-05, Phase 87 87-02)', () => {
  describe('No bare truthiness read of the windowing prop', () => {
    it.each(allScannedSources.map((f) => [f.id, f] as const))(
      '%s carries no bare truthiness read of the windowing prop',
      (_id, f) => {
        expect(findForbiddenViolations(f.source)).toEqual([]);
      },
    );
  });

  describe('Negative-path proof: the checker is not vacuous', () => {
    it('reports exactly 1 violation for a synthetic bare truthiness read', () => {
      const synthetic = `
        const windowSource = () => {
          if ($props.virtual) return table.getPrePaginationRowModel().rows
          return table.getRowModel().rows
        }
      `;
      const violations = findForbiddenViolations(synthetic);
      expect(violations.length).toBe(1);
      expect(violations[0].text).toContain('$props.virtual');
    });

    it('reports nothing for a synthetic source that reads only through rowsWindowed()/colsWindowed()', () => {
      const clean = `
        const resolveVirtual = () => {
          const v = $props.virtual
          return v === true ? 'rows' : 'off'
        }
        const rowsWindowed = () => resolveVirtual() === 'rows'
        const colsWindowed = () => resolveVirtual() === 'columns'
        const windowSource = () => {
          if (rowsWindowed()) return table.getPrePaginationRowModel().rows
          return table.getRowModel().rows
        }
      `;
      expect(findForbiddenViolations(clean)).toEqual([]);
    });

    it('ignores a comment-only mention of the forbidden identifier', () => {
      const commentOnly = `
        // legacy note: this used to read $props.virtual directly
        const rowsWindowed = () => resolveVirtual() === 'rows'
      `;
      expect(findForbiddenViolations(commentOnly)).toEqual([]);
    });

    // WR-03 (87-15): a naive `line.indexOf('//')` comment stripper treats the
    // `//` inside a URL string literal as a comment start and truncates
    // everything after it — silently dropping a genuine violation that sits
    // later on the SAME line. This proves the stripper is string-literal
    // aware: a `//` inside a quoted string must not swallow a real
    // `$props.virtual` read that follows it.
    it('does not let a // inside a string literal swallow a later genuine violation on the same line', () => {
      const tainted = `
        const help = 'see https://example.com/docs' + ($props.virtual ? a : b)
      `;
      const violations = findForbiddenViolations(tainted);
      expect(violations.length).toBe(1);
      expect(violations[0].text).toContain('$props.virtual');
    });

    it('still strips a real // comment that follows a closed string literal on the same line', () => {
      const mixed = `
        const label = 'https://example.com' // just a trailing comment, no forbidden identifier here
      `;
      expect(findForbiddenViolations(mixed)).toEqual([]);
    });
  });
});

// ── A2 invariant (Task 2): the five column-index functions read the UNSLICED
// cell list, never a windowed slice ──

const A2_COVERED_FILES = ['gridFocusNav.rzts', 'editCellLifecycle.rzts', 'rangeSelection.rzts', 'clipboardFill.rzts'];

describe('A2 invariant (D-09): colIndexOf/visibleColCount/columnIdAt/cellValueAt/beginEdit read the unsliced cell list', () => {
  it.each(A2_COVERED_FILES.map((name) => [name] as const))(
    '%s never resolves a column through a `windowedCells` slice',
    (name) => {
      const file = dataTableSources.find((f) => f.id === name);
      expect(file, `expected ${name} to be present in the scanned tree`).toBeTruthy();
      const hits = (file as SourceFile).source.match(/windowedCells/g) ?? [];
      expect(hits.length).toBe(0);
    },
  );

  it('negative-path proof: the windowedCells check is not vacuous', () => {
    const synthetic = `const colIndexOf = (row, cellCtx) => windowedCells(row).indexOf(cellCtx)`;
    const hits = synthetic.match(/windowedCells/g) ?? [];
    expect(hits.length).toBeGreaterThan(0);
  });
});

// ── B2 invariant (Task 2, quick 260906-afh; extended Task 1, quick 260906-cvo C3): every
// #cell / #selectCell / #editor scoped-slot site routes `:row` through cellSlotRow(...) ──
//
// A POSITIVE count assertion, deliberately — never a negative grep for the old `row.original`/
// `wr.row.original` binding, since a future refactor could rename or reshape that binding
// without ever routing through cellSlotRow, and a negative grep would stay silently green.
// Counting the literal `:row="cellSlotRow(` occurrences pins the actual fix in place: exactly
// 12 sites — the 2 virtual-body + 2 non-virtual-body `#selectCell`/`#editor` call sites (cvo
// C3), PLUS the 4 `#cell` call sites (afh) EACH NOW DOUBLED to 2 occurrences apiece (phase 88
// plan 04, D-04b): the `cell-<columnId>` family slot nests directly around the pre-existing
// generic `#cell` slot as its inline fallback, and both tiers carry the identical scoped params
// — including `:row="cellSlotRow(...)"`. 4 sites × 2 tiers = 8, plus the unchanged 4 editor
// sites = 12. A future edit that drops or bypasses either tier at any site is caught
// immediately. `#detail` is DELIBERATELY EXCLUDED: it is already guarded by
// `rowShowsDetail`'s `!rowIsGrouped(row)` check, so a group-header row can never reach
// `#detail`'s `:row="row.original"` binding at all — routing it through cellSlotRow would be a
// no-op wrapped around dead code, not a fix.

describe('B2/C3 invariant: every #cell/#selectCell/#editor slot site binds :row through cellSlotRow(...)', () => {
  it('DataTable.rozie carries exactly 12 `:row="cellSlotRow(` occurrences', () => {
    const dataTableRozie = dataTableSources.find((f) => f.id === 'DataTable.rozie');
    expect(dataTableRozie, 'expected DataTable.rozie to be present in the scanned tree').toBeTruthy();
    const hits = (dataTableRozie as SourceFile).source.match(/:row="cellSlotRow\(/g) ?? [];
    expect(hits.length).toBe(12);
  });

  it('negative-path proof: the cellSlotRow-count check is not vacuous', () => {
    const synthetic = `<slot name="cell" :row="cellSlotRow(row)" />`;
    const hits = synthetic.match(/:row="cellSlotRow\(/g) ?? [];
    expect(hits.length).toBe(1);
  });
});

// ── C1 invariant (Task 2, quick 260906-cvo): every edit/write guard calls the SINGLE
// rowIndexIsGrouped(...) predicate ──
//
// A POSITIVE count assertion, deliberately — a negative grep for an inline
// `getIsGrouped()` re-implementation would miss a NEW guard written without the shared
// predicate just as easily as it would miss one written with it. Comment lines are
// stripped before counting (this repo's grep-gate hygiene rule — a comment MENTIONING the
// symbol, e.g. explaining why a guard is redundant-but-kept, must not satisfy the gate).
// The five call sites: isActiveCellEditable, beginEdit, isEditing, toggleActiveBooleanCell
// (editCellLifecycle.rzts) + beginRowEdit (editRowLifecycle.rzts).

function countNonCommentOccurrences(source: string, needle: string): number {
  const stripped = source
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
  return (stripped.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

describe('C1 invariant: rowIndexIsGrouped(...) is the single shared edit/write row guard', () => {
  const C1_COVERED_FILES = ['filterPaginationRowChrome.rzts', 'editCellLifecycle.rzts', 'editRowLifecycle.rzts', 'gridKeydownHandlers.rzts'];

  it('rowIndexIsGrouped( appears at least 5 times in non-comment source across the covered files', () => {
    let total = 0;
    for (const name of C1_COVERED_FILES) {
      const file = dataTableSources.find((f) => f.id === name);
      expect(file, `expected ${name} to be present in the scanned tree`).toBeTruthy();
      total += countNonCommentOccurrences((file as SourceFile).source, 'rowIndexIsGrouped(');
    }
    expect(total).toBeGreaterThanOrEqual(5);
  });

  it('negative-path proof: a comment-only mention does not satisfy the gate', () => {
    const synthetic = `// rowIndexIsGrouped(rowIndex) is redundant here but kept for defense-in-depth\nconst x = 1`;
    expect(countNonCommentOccurrences(synthetic, 'rowIndexIsGrouped(')).toBe(0);
  });

  it('negative-path proof: the count check is not vacuous against real code', () => {
    const synthetic = `if (rowIndexIsGrouped(rowIndex)) return`;
    expect(countNonCommentOccurrences(synthetic, 'rowIndexIsGrouped(')).toBe(1);
  });
});
