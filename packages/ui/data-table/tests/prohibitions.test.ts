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
import { readFileSync, readdirSync, statSync } from 'node:fs';
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

/** Strip `//` line comments before matching (comment-only mentions are not violations). */
function stripLineComments(source: string): string[] {
  return source.split('\n').map((line) => {
    const idx = line.indexOf('//');
    return idx === -1 ? line : line.slice(0, idx);
  });
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
