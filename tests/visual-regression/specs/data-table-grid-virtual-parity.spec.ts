import { test, expect, type Page, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 63 Wave-7 (B13 LOCKED: full parity) — the WINDOWED-tbody ⇄ NON-VIRTUAL-body parity
 * battery. The virtual (`:virtual`) render path windows the rows through
 * getPrePaginationRowModel(), but its <tbody> (DataTable.rozie ~1408-1545; lit ~1028-1042)
 * SILENTLY DROPPED the entire grouping/expand/#detail render path: no isExpanderColumn
 * chevron branch, no cellIsGrouped group toggle/(n)-count branch, no #detail <tr>, no
 * data-group-header/leaf/depth markers + rdt-group-header class, and the windowed <td> used
 * pinStyle() instead of bodyCellStyle() (so no depth indent). A virtual + expandable grid had
 * NO way to expand; a virtual + groupable grid rendered group rows as bare cells.
 *
 * This battery drives two virtual+feature fixtures (the host appends the 'Demo' suffix):
 *   - ?example=DataTableVirtualGroup  → examples/demos/DataTableVirtualGroupDemo.rozie
 *   - ?example=DataTableVirtualExpand → examples/demos/DataTableVirtualExpandDemo.rozie
 *
 * across ALL SIX targets, asserting the windowed body is at FULL parity with the non-virtual
 * body (the data-table-roundout.spec.ts non-virtual assertions are the oracle). Each parity
 * assertion is RED on the pre-63-07 build (the windowed body drops the branches) and GREEN
 * after the windowed-body parity fix (SC-1). DOM/behavioral, NOT screenshot (the
 * data-table-virtual.spec.ts precedent — windowing facts are exact DOM, not pixels).
 *
 * SHADOW-PIERCE (Lit, A1): the windowed <table> lives in the consumer host shadow root and
 * (Lit) the nested DataTable's OWN open shadow root. Plain Playwright locators auto-pierce
 * open shadow roots; the page.evaluate helpers walk the tree manually for the geometry reads.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// KNOWN_FAILING stays EMPTY (the P49/P53 precedent). An un-built target leg surfaces as a
// build-gated `runnerFor` placeholder, NOT a permanent fixme.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

/** Programmatically scroll a windowed container (found by testid scope) to `top`. */
async function scrollScopeTo(page: Page, testid: string, top: number): Promise<void> {
  await page.evaluate(
    ({ id, y }) => {
      const findScope = (root: Document | ShadowRoot): Element | null => {
        const direct = root.querySelector(`[data-testid="${id}"]`);
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) {
            const inner = findScope(sr);
            if (inner) return inner;
          }
        }
        return null;
      };
      const findScroll = (root: Document | ShadowRoot | Element): Element | null => {
        const direct = (root as ParentNode).querySelector('.rdt-scroll');
        if (direct) return direct;
        for (const el of Array.from((root as ParentNode).querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) {
            const inner = findScroll(sr);
            if (inner) return inner;
          }
        }
        return null;
      };
      const scope = findScope(document);
      if (!scope) return;
      const el = findScroll(scope) as HTMLElement | null;
      if (el) el.scrollTop = y;
    },
    { id: testid, y: top },
  );
}

/** The windowed body data rows (data-index) under a testid-scoped `.rdt-scroll`. */
function windowedRows(scope: Locator): Locator {
  return scope.locator('.rdt-scroll tbody.rdt-tbody > tr[data-index]');
}

// ════════════════════════════════════════════════════════════════════════════════════
// GROUP PARITY — DataTableVirtualGroup: a windowed group-header row renders the group
//   toggle + the (n) count + data-group-header + rdt-group-header; leaf rows carry
//   data-group-leaf + data-depth. RED on the pre-fix windowed body (bare cells).
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual-parity group [${target}]: windowed group-header has toggle + (n) count + markers; leaf carries data-group-leaf/depth`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualGroup&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 20_000 })
      .toBe('600');

    const scope = mount.getByTestId('virtual-group-table');
    const scroll = scope.locator('.rdt-scroll');
    await expect(scroll).toBeVisible({ timeout: 15_000 });
    await scrollScopeTo(page, 'virtual-group-table', 0);

    // A SMALL windowed slice renders for 600 grouped rows (windowing engaged).
    await expect.poll(async () => windowedRows(scope).count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // ── B13 — a windowed GROUP-HEADER row carries data-group-header + the rdt-group-header
    //    class (the pre-fix windowed <tr> omitted both → RED).
    const groupHeader = scope.locator('.rdt-scroll tbody.rdt-tbody > tr[data-group-header]');
    await expect.poll(async () => groupHeader.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(groupHeader.first()).toHaveClass(/rdt-group-header/);

    // ── B13 — the group-header row renders the group toggle (the cellIsGrouped branch's
    //    <button data-expander class="rdt-group-toggle">) + the (n) member count. Pre-fix the
    //    windowed body has neither (bare #cell value) → RED.
    await expect(groupHeader.first().locator('[data-expander].rdt-group-toggle')).toHaveCount(1);
    await expect(groupHeader.first().locator('.rdt-group-count')).toContainText(/\(\d+\)/);

    // ── B13 — leaf rows carry data-group-leaf + a data-depth marker (depth 1 under the
    //    single-level grouping). Pre-fix the windowed <tr> omitted both → RED.
    const leaf = scope.locator('.rdt-scroll tbody.rdt-tbody > tr[data-group-leaf]');
    await expect.poll(async () => leaf.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(leaf.first()).toHaveAttribute('data-depth', '1');
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// EXPAND PARITY — DataTableVirtualExpand (#detail region): a windowed expandable row renders
//   the expander chevron; clicking it renders a #detail <tr> WITHIN the window, and the detail
//   row does NOT shift the windowed body's data-index sequence. RED on the pre-fix body.
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual-parity expand [${target}]: windowed expander chevron toggles a #detail <tr>; detail row does not shift data-index`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualExpand&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 20_000 })
      .toBe('500');

    const scope = mount.getByTestId('detail-table');
    const scroll = scope.locator('.rdt-scroll');
    await expect(scroll).toBeVisible({ timeout: 15_000 });
    await scrollScopeTo(page, 'detail-table', 0);
    await expect.poll(async () => windowedRows(scope).count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // ── B13 — the auto-injected expander column renders the chevron <button data-expander>
    //    in the windowed body (pre-fix the isExpanderColumn branch was absent → 0 chevrons → RED).
    const chevron = scope.locator('.rdt-scroll tbody.rdt-tbody [data-expander]');
    await expect.poll(async () => chevron.count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // The first windowed body row's data-index is 0 (contiguous full-model map).
    const firstIndexBefore = await windowedRows(scope).first().getAttribute('data-index');
    expect(firstIndexBefore).toBe('0');

    // ── B13 — clicking the first chevron reveals a #detail <tr> WITHIN the window (pre-fix the
    //    rowShowsDetail #detail <tr> was absent from the windowed body → 0 detail rows → RED).
    await chevron.first().click();
    const detailRow = scope.locator('.rdt-scroll tbody.rdt-tbody > tr.rdt-detail-row');
    await expect.poll(async () => detailRow.count(), { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
    await expect(scope.getByTestId('detail-panel').first()).toBeVisible({ timeout: 10_000 });

    // ── T-63-07-01 — the #detail <tr> is NOT a navigable/measurable row: it carries no
    //    data-index / data-row, so it does NOT shift the windowed body's data-index sequence.
    await expect(detailRow.first()).not.toHaveAttribute('data-index', /.*/);
    const firstIndexAfter = await windowedRows(scope).first().getAttribute('data-index');
    expect(firstIndexAfter).toBe('0');
  });
}

// ════════════════════════════════════════════════════════════════════════════════════
// BODYCELLSTYLE INDENT — DataTableVirtualExpand (getSubRows region): the windowed <td> uses
//   bodyCellStyle() (a depth-proportional padding-left on the expander cell) NOT pinStyle(),
//   so a depth-1 child row's expander cell carries an inline padding-left. RED on the pre-fix
//   body (pinStyle → no padding-left).
// ════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-virtual-parity indent [${target}]: windowed <td> uses bodyCellStyle — depth-1 expander cell has a padding-left indent (not pinStyle)`, async ({
    page,
  }) => {
    await page.goto(`/?example=DataTableVirtualExpand&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const mount = page.getByTestId('rozie-mount');
    await expect
      .poll(async () => page.getByTestId('row-count').textContent(), { timeout: 20_000 })
      .toBe('500');

    const scope = mount.getByTestId('subrow-table');
    const scroll = scope.locator('.rdt-scroll');
    await expect(scroll).toBeVisible({ timeout: 15_000 });
    await scrollScopeTo(page, 'subrow-table', 0);
    await expect.poll(async () => windowedRows(scope).count(), { timeout: 15_000 }).toBeGreaterThan(0);

    // Expand the first parent (top of the window) via its chevron → its depth-1 children
    // flatten into the windowed row model right below it (the windowed isExpanderColumn branch
    // must render a working chevron — pre-fix it was absent so this click target would not exist).
    const firstChevron = scope.locator('.rdt-scroll tbody.rdt-tbody [data-expander]').first();
    await expect(firstChevron).toBeVisible({ timeout: 10_000 });
    await firstChevron.click();

    const depthRow = scope.locator('.rdt-scroll tbody.rdt-tbody > tr[data-depth="1"]');
    await expect.poll(async () => depthRow.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(depthRow.first()).toContainText('Child');

    // ── B13 — the windowed depth-1 row's EXPANDER cell uses bodyCellStyle() (which adds a
    //    depth-proportional padding-left: 0.5 + depth*1.25 rem) NOT pinStyle(). pinStyle() never
    //    adds padding-left → pre-fix the windowed expander <td> has no padding-left → RED.
    const expanderTd = depthRow.first().locator('td[data-col="__rdt_expander"]');
    await expect(expanderTd).toHaveCount(1);
    // Solid parity note: prior to the runtime-solid `parseInlineStyle` fix (LB6 SEAM 3,
    // 4d269e89), a dynamic `:style` CSS string was camelCased before being handed to Solid's
    // `style` prop, so `padding-left:…rem` became `{ paddingLeft }` → a silent
    // `CSSStyleDeclaration.setProperty('paddingLeft', …)` no-op (multi-word declarations
    // dropped; single-word ones like `overflow` survived). `parseInlineStyle` now passes a CSS
    // string through verbatim so Solid's `style()` routes it to `cssText`, where the browser
    // parses every kebab-case declaration correctly — padding-left reaches the DOM on Solid too.
    await expect
      .poll(async () => (await expanderTd.getAttribute('style')) ?? '', { timeout: 15_000 })
      .toContain('padding-left');
  });
}
