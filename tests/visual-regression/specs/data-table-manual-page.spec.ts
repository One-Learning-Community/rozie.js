import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick task 260921-tsu — A-04, and the `manual` server-side pagination contract it sits on.
 *
 * A-04: `totalRowCount()` (gridFocusNav.rzts) read `getFilteredRowModel().rows.length`. Under
 * `manual` table-core holds ONLY the page the consumer handed it, so that length IS the page
 * size — `aria-rowcount` advertised 11 (1 header + a 10-row page) for a 137-row server dataset.
 * The body rows meanwhile carry `aria-rowindex` offset by `pageIndex * pageSize`
 * (`ariaPageOffset`), so from page 2 onward a screen reader was handed indices LARGER than the
 * advertised count — an internally inconsistent grid, not merely an understated one. The fix
 * prefers the counts the consumer passes for exactly this purpose: `rowCount`, else
 * `pageCount * pageSize`.
 *
 * The surrounding coverage gap is the reason A-04 shipped. The 260910 audit's zero-coverage
 * list names "`rowCount`/`pageCount` and the whole `manual` server-side contract (no demo
 * passes either prop)" — measured again here before writing this file: zero `:rowCount` /
 * `:pageCount` bindings existed anywhere in `examples/`, the docs demos or the VR specs. Three
 * documented props with no exercise at all.
 *
 * Fixture: examples/demos/DataTableManualPageDemo.rozie — two `<DataTable>` mounts, one per
 * count source, each fed a locally sliced 10-row page out of a 137-row master array (which is
 * exactly what a server-paginated consumer does, and what makes table-core see a 10-row
 * dataset):
 *   - `manual-rowcount`  — `:manual` + `:rowCount="137"`  → aria-rowcount 138 (137 + 1 header)
 *   - `manual-pagecount` — `:manual` + `:pageCount="14"`  → aria-rowcount 141 (14*10 + 1)
 *
 * 137 is deliberately NOT a multiple of the page size, so the two count sources cannot
 * accidentally agree: `pageCount * pageSize` is a strict over-count (140 vs 137). An
 * over-count is the safe direction — an `aria-rowindex` can never exceed it — and asserting
 * the two DIFFERENT numbers is what proves each source is actually consulted rather than one
 * of them shadowing the other.
 *
 * RED on the pre-fix build: both tables report `aria-rowcount="11"`.
 *
 * The `Next` assertions are not decoration. Without a count table-core pins `getPageCount()`
 * to -1 and `getCanNextPage()` to false, so a `manual` consumer can never leave page 0 — the
 * whole reason these two props exist. `Next` being enabled, and the page-change readout
 * advancing, is the proof the props reach table-core at all.
 *
 * DOM assertions only — no PNG baseline. The family has no pixel baseline on any target
 * (`matrix.spec.ts` has zero data-table entries); a screenshot could not read an ARIA
 * attribute anyway.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// Empty known-failing set — `totalRowCount` lives in a shared `.rzts` partial consumed
// identically by all six emitters, so a single-target failure would be a real finding.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

async function gotoDemo(page: Page, target: Target): Promise<void> {
  await page.goto(`/?example=DataTableManualPage&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  // Both mounts must be up before any assertion: the master array is built in $onMount, so a
  // first paint can legitimately show two empty tables.
  await expect
    .poll(async () => await bodyRowCount(page, 'manual-rowcount'), { timeout: 15_000 })
    .toBe(10);
  await expect
    .poll(async () => await bodyRowCount(page, 'manual-pagecount'), { timeout: 15_000 })
    .toBe(10);
}

/**
 * Shadow-piercing walker, INLINED into every `page.evaluate` below rather than imported from
 * `./_shadow-utils`: Playwright serializes an evaluate callback with
 * `Function.prototype.toString()` and re-executes the text in the browser, so an imported
 * helper referenced from inside it throws `ReferenceError`. On Lit the `<th>`/`<td>` sit TWO
 * shadow roots deep (the demo component has one, the `<rozie-data-table>` inside it another),
 * so a plain `document.querySelector` finds nothing there.
 */
/** The `aria-rowcount` the table root advertises for one mount ('' when absent). */
async function ariaRowCount(page: Page, testid: string): Promise<string> {
  return page.evaluate((id) => {
    const deepAll = (root: Document | ShadowRoot | Element, sel: string): Element[] => {
      const out: Element[] = [...root.querySelectorAll(sel)];
      for (const el of root.querySelectorAll('*')) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) out.push(...deepAll(sr, sel));
      }
      return out;
    };
    const host = deepAll(document, `[data-testid="${id}"]`)[0];
    if (!host) return '';
    const table = deepAll(host, 'table.rozie-data-table')[0];
    return table ? table.getAttribute('aria-rowcount') || '' : '';
  }, testid);
}

/** Rendered body-row count for one mount. */
async function bodyRowCount(page: Page, testid: string): Promise<number> {
  return page.evaluate((id) => {
    const deepAll = (root: Document | ShadowRoot | Element, sel: string): Element[] => {
      const out: Element[] = [...root.querySelectorAll(sel)];
      for (const el of root.querySelectorAll('*')) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) out.push(...deepAll(sr, sel));
      }
      return out;
    };
    const host = deepAll(document, `[data-testid="${id}"]`)[0];
    if (!host) return -1;
    return deepAll(host, 'tbody tr.rdt-tr').length;
  }, testid);
}

/** The `aria-rowindex` values the rendered body rows carry, in order. */
async function bodyRowIndices(page: Page, testid: string): Promise<string[]> {
  return page.evaluate((id) => {
    const deepAll = (root: Document | ShadowRoot | Element, sel: string): Element[] => {
      const out: Element[] = [...root.querySelectorAll(sel)];
      for (const el of root.querySelectorAll('*')) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) out.push(...deepAll(sr, sel));
      }
      return out;
    };
    const host = deepAll(document, `[data-testid="${id}"]`)[0];
    if (!host) return [];
    return deepAll(host, 'tbody tr.rdt-tr').map((tr) => tr.getAttribute('aria-rowindex') || '');
  }, testid);
}

/** `{ disabled }` for one mount's pagination Next button, plus the page-status text. */
async function pagerState(
  page: Page,
  testid: string,
): Promise<{ nextDisabled: boolean; status: string }> {
  return page.evaluate((id) => {
    const deepAll = (root: Document | ShadowRoot | Element, sel: string): Element[] => {
      const out: Element[] = [...root.querySelectorAll(sel)];
      for (const el of root.querySelectorAll('*')) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) out.push(...deepAll(sr, sel));
      }
      return out;
    };
    const host = deepAll(document, `[data-testid="${id}"]`)[0];
    if (!host) return { nextDisabled: true, status: '' };
    const next = deepAll(host, 'button.rdt-page-next')[0] as HTMLButtonElement | undefined;
    const status = deepAll(host, '.rdt-page-status')[0];
    return {
      nextDisabled: next ? next.disabled : true,
      status: status ? (status.textContent || '').trim() : '',
    };
  }, testid);
}

/** Click one mount's Next button, shadow-piercingly. */
async function clickNext(page: Page, testid: string): Promise<void> {
  await page.evaluate((id) => {
    const deepAll = (root: Document | ShadowRoot | Element, sel: string): Element[] => {
      const out: Element[] = [...root.querySelectorAll(sel)];
      for (const el of root.querySelectorAll('*')) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) out.push(...deepAll(sr, sel));
      }
      return out;
    };
    const host = deepAll(document, `[data-testid="${id}"]`)[0];
    if (!host) return;
    const next = deepAll(host, 'button.rdt-page-next')[0] as HTMLButtonElement | undefined;
    if (next) next.click();
  }, testid);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// A-04 — `rowCount` is the server-side total, and aria-rowcount must report it.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-manual-page [${target}]: manual + rowCount reports the SERVER total in aria-rowcount`, async ({
    page,
  }) => {
    await gotoDemo(page, target);

    // 137 data rows + 1 header row. Pre-fix this was '11' — the 10-row page table-core holds
    // plus the header — on all six.
    await expect
      .poll(async () => await ariaRowCount(page, 'manual-rowcount'), { timeout: 15_000 })
      .toBe('138');

    // The count reached table-core too: ⌈137/10⌉ = 14 pages, so Next is live. Without a count
    // getPageCount() is -1, getCanNextPage() false, and the consumer is stuck on page 0.
    const pager = await pagerState(page, 'manual-rowcount');
    expect(pager.nextDisabled).toBe(false);
    expect(pager.status).toBe('Page 1 of 14');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// A-04 — `pageCount` is the fallback source, and it yields a DIFFERENT number (140 + header),
// which is what proves it is consulted in its own right rather than shadowed by `rowCount`.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-manual-page [${target}]: manual + pageCount derives the total from pages x pageSize`, async ({
    page,
  }) => {
    await gotoDemo(page, target);

    // 14 pages x pageSize 10 = 140, + 1 header = 141. Deliberately NOT 138: the real dataset is
    // 137, so this is the documented upper bound, and the difference is the assertion's value.
    await expect
      .poll(async () => await ariaRowCount(page, 'manual-pagecount'), { timeout: 15_000 })
      .toBe('141');

    const pager = await pagerState(page, 'manual-pagecount');
    expect(pager.nextDisabled).toBe(false);
    expect(pager.status).toBe('Page 1 of 14');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// The consistency invariant A-04 actually breaks: on page 2 the body rows carry
// aria-rowindex 12..21 while the pre-fix aria-rowcount was 11. A count SMALLER than an index
// it advertises is invalid per WAI-ARIA, not merely imprecise.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-manual-page [${target}]: page 2 aria-rowindex values stay within aria-rowcount`, async ({
    page,
  }) => {
    await gotoDemo(page, target);

    await clickNext(page, 'manual-rowcount');

    // The consumer refetched: page-change fired and handed back rows 11-20.
    await expect
      .poll(async () => (await page.getByTestId('page-a-readout').textContent() || '').trim(), {
        timeout: 15_000,
      })
      .toBe('1');

    // aria-rowindex = headerRowCount(1) + absolute 0-based index + 1 → 12..21 on page 2.
    await expect
      .poll(async () => (await bodyRowIndices(page, 'manual-rowcount')).join(','), {
        timeout: 15_000,
      })
      .toBe('12,13,14,15,16,17,18,19,20,21');

    // The invariant, stated as an invariant rather than as a literal: every rendered index is
    // within the advertised count. Pre-fix max index 21 > count 11.
    const count = Number(await ariaRowCount(page, 'manual-rowcount'));
    const indices = (await bodyRowIndices(page, 'manual-rowcount')).map(Number);
    expect(Math.max(...indices)).toBeLessThanOrEqual(count);
  });
}
