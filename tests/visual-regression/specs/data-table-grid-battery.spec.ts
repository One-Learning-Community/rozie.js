import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-10 — the GRID BEHAVIORAL-BATTERY COVERAGE AUDIT (SC-7 completeness gate).
 *
 * This is NOT another behavioral cell — it is the META gate that enumerates every grid
 * FEATURE SET the phase-63 grid-mode hardening shipped and asserts each one has at least one
 * corresponding BEHAVIORAL spec in the battery (a real DOM/focus/model assertion spec, NOT a
 * pixel-snapshot cell). It FAILS if any feature set has no behavioral coverage — so a future
 * feature added to grid mode without a behavioral spec, or a battery spec deleted/relaxed to a
 * screenshot, trips this audit.
 *
 * The mapping below is the canonical <phase_battery_inventory> (63-10-PLAN.md): every grid
 * feature set → the phase-63 behavioral spec(s) that cover it ×6, plus the host example cell(s)
 * those specs drive. The audit asserts, for each feature set:
 *   1. the mapped spec file(s) exist on disk;
 *   2. each carries a REAL behavioral assertion (imports @playwright/test, uses `expect`, and
 *      is NOT a snapshot-only cell — no `toHaveScreenshot`);
 *   3. the feature-set keyword(s) appear in the spec text (the assertion is about that feature);
 *   4. the host example cell(s) the spec drives are registered in the VR host EXAMPLES.
 * A final no-gap assertion proves the union of covered feature sets equals the full inventory.
 *
 * Greenness ×6 of each mapped cell is proven by RUNNING the battery (Task 3, the pinned Linux
 * Docker) — this audit guarantees the battery is COMPLETE; the run proves it PASSES.
 */

const SPECS_DIR = __dirname;
const HOST_MAIN = resolve(__dirname, '../host/main.ts');

/** Read a spec file's text (empty string if absent — the existence assertion catches it). */
function readSpec(file: string): string {
  const p = resolve(SPECS_DIR, file);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

/** The VR host EXAMPLES registry text (for the cell-registration assertion). */
const hostMainText = existsSync(HOST_MAIN) ? readFileSync(HOST_MAIN, 'utf8') : '';

/**
 * The canonical grid feature-set → behavioral-coverage inventory. Each `keywords` entry is a
 * literal that MUST appear in at least one mapped spec (the assertion is about that feature);
 * `specs` are the behavioral spec files that cover it ×6; `cells` are the host example cells
 * those specs drive (registered in EXAMPLES).
 */
interface FeatureSet {
  readonly featureSet: string;
  readonly keywords: readonly string[];
  readonly specs: readonly string[];
  readonly cells: readonly string[];
}

const FEATURE_SETS: readonly FeatureSet[] = [
  {
    featureSet: 'range-selection (extend/clear/clamp)',
    keywords: ['range', 'extendRange'],
    specs: ['data-table-grid-clipboard.spec.ts', 'data-table-grid-emit.spec.ts'],
    cells: ['DataTableGridClipboard', 'DataTableGridEmit'],
  },
  {
    featureSet: 'clipboard copy/cut/paste + escaping/coercion/tiling',
    keywords: ['clipboard', 'Cut', 'tiling'],
    specs: ['data-table-grid-clipboard.spec.ts'],
    cells: ['DataTableGridClipboard'],
  },
  {
    featureSet: 'fill-drag (per-column fill-down)',
    keywords: ['fill-drag', 'fill'],
    specs: ['data-table-grid-clipboard.spec.ts'],
    cells: ['DataTableGridClipboard'],
  },
  {
    featureSet: 'edit-under-grid-nav (cell-edit cluster)',
    keywords: ['edit-under', 'commit'],
    specs: ['data-table-grid-edit.spec.ts'],
    cells: ['DataTableGridEdit'],
  },
  {
    featureSet: 'row-edit (row Tab containment + commit-under-sort)',
    keywords: ['row-edit', 'rowedit'],
    specs: ['data-table-grid-rowedit.spec.ts'],
    cells: ['DataTableGridRowEdit'],
  },
  {
    featureSet: 'grouping-nav (roving tab-stop across grouped headers)',
    keywords: ['grouping', 'group'],
    specs: ['data-table-grid-treegrid.spec.ts', 'data-table-grid-navedge.spec.ts'],
    cells: ['DataTableGroupTreegrid', 'DataTableGridGroupedHeader'],
  },
  {
    featureSet: 'treegrid-a11y (aria-level/aria-expanded; Enter toggles group)',
    keywords: ['treegrid', 'aria-expanded', 'aria-level'],
    specs: ['data-table-grid-treegrid.spec.ts'],
    cells: ['DataTableGroupTreegrid'],
  },
  {
    featureSet: 'expand (#detail + getSubRows in the windowed body)',
    keywords: ['expand', 'detail'],
    specs: ['data-table-grid-virtual-parity.spec.ts'],
    cells: ['DataTableVirtualExpand'],
  },
  {
    featureSet: 'virtual + groups/expand parity (B13)',
    keywords: ['virtual', 'parity'],
    specs: ['data-table-grid-virtual-parity.spec.ts'],
    cells: ['DataTableVirtualGroup', 'DataTableVirtualExpand'],
  },
  {
    featureSet: 'empty/all-filtered keyboard-reachability (B6)',
    keywords: ['empty', 'tab-stop'],
    specs: ['data-table-grid-navedge.spec.ts'],
    cells: ['DataTableGridEmpty'],
  },
  {
    featureSet: 'header-active guards (clipboard/edit no-op on a header cell)',
    keywords: ['header', 'no-op'],
    specs: ['data-table-grid-clipboard.spec.ts', 'data-table-grid-emit.spec.ts'],
    cells: ['DataTableGridClipboard', 'DataTableGridEmit'],
  },
  {
    featureSet: 'aria-rowindex (absolute-index addressing, B27)',
    keywords: ['aria-rowindex'],
    specs: ['data-table-grid-absindex.spec.ts'],
    cells: ['DataTableGridAbsIndex'],
  },
  {
    featureSet: 'emit-contract (activecell-change / isGrid gating / PageDown / refocus)',
    keywords: ['activecell-change', 'isGrid'],
    specs: ['data-table-grid-emit.spec.ts'],
    cells: ['DataTableGridEmit'],
  },
  {
    featureSet: 'RTL logical-nav contract (C4)',
    keywords: ['rtl', 'logical'],
    specs: ['data-table-grid-rtl.spec.ts'],
    cells: ['DataTableGridRtl'],
  },
] as const;

/** A spec is "behavioral" if it drives DOM/focus/model assertions and is NOT a pixel cell. */
function assertBehavioralSpec(file: string): void {
  const text = readSpec(file);
  expect(text, `${file} must exist on disk`).not.toBe('');
  expect(text, `${file} must be a Playwright behavioral spec`).toContain('@playwright/test');
  expect(text, `${file} must carry real assertions`).toContain('expect');
  // Behavioral, NOT a snapshot cell — the battery is DOM/behavior assertions, not pixels.
  expect(text, `${file} must be behavioral (no pixel snapshot)`).not.toContain('toHaveScreenshot');
}

for (const fs of FEATURE_SETS) {
  test(`data-table-grid-battery: feature set "${fs.featureSet}" has behavioral coverage ×6`, async () => {
    // 1 + 2 — every mapped spec exists and is a real behavioral (non-snapshot) spec.
    for (const spec of fs.specs) assertBehavioralSpec(spec);

    // 3 — each feature keyword appears in at least one mapped spec (the assertion is about
    //     THIS feature, not an unrelated one mapped by accident).
    const combined = fs.specs.map(readSpec).join('\n');
    for (const kw of fs.keywords) {
      expect(
        new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(combined),
        `feature set "${fs.featureSet}" — keyword "${kw}" not found in ${fs.specs.join(', ')}`,
      ).toBe(true);
    }

    // 4 — the host example cell(s) the spec drives are registered in the VR host EXAMPLES.
    for (const cell of fs.cells) {
      expect(
        hostMainText.includes(`'${cell}'`),
        `host cell "${cell}" not registered in tests/visual-regression/host/main.ts EXAMPLES`,
      ).toBe(true);
    }
  });
}

test('data-table-grid-battery: SC-7 no-gap — every inventory feature set is covered', async () => {
  // The complete inventory of grid feature sets the phase shipped. If a feature set is added
  // to grid mode it MUST be added here AND mapped to a behavioral spec above — this list is the
  // single source of truth for the completeness gate.
  const INVENTORY = [
    'range-selection (extend/clear/clamp)',
    'clipboard copy/cut/paste + escaping/coercion/tiling',
    'fill-drag (per-column fill-down)',
    'edit-under-grid-nav (cell-edit cluster)',
    'row-edit (row Tab containment + commit-under-sort)',
    'grouping-nav (roving tab-stop across grouped headers)',
    'treegrid-a11y (aria-level/aria-expanded; Enter toggles group)',
    'expand (#detail + getSubRows in the windowed body)',
    'virtual + groups/expand parity (B13)',
    'empty/all-filtered keyboard-reachability (B6)',
    'header-active guards (clipboard/edit no-op on a header cell)',
    'aria-rowindex (absolute-index addressing, B27)',
    'emit-contract (activecell-change / isGrid gating / PageDown / refocus)',
    'RTL logical-nav contract (C4)',
  ] as const;

  const covered = new Set(FEATURE_SETS.map((f) => f.featureSet));
  for (const item of INVENTORY) {
    expect(covered.has(item), `inventory feature set "${item}" has NO mapped behavioral coverage`).toBe(
      true,
    );
  }
  // And no stray mapping that is not in the inventory (the mapping and inventory are 1:1).
  expect(covered.size, 'feature-set mapping count must equal the inventory count').toBe(
    INVENTORY.length,
  );
});
