import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Quick task 260908-vcy — six-target coverage for the per-column `pinned` declaration as a
 * REAL initial columnPinning seed.
 *
 * Until this task `pinned` was carried onto every ColumnDef by columnBuilders.rzts and read by
 * nobody: `column.getIsPinned()` returned false for a column declared `pinned="left"`, so the
 * documented per-column API was inert and `r-model:columnPinning` was the only mechanism that
 * actually pinned anything. `docs/components/data-table-columns.md` had to carry an explicit
 * "Currently inert as an initial-pin seed" caveat. seedColumnPinning() (stateAssembly.rzts)
 * applies the declaration once, as initial state, and this file is its behavioural proof.
 *
 * Fixture: examples/demos/DataTablePinnedSeedDemo.rozie — three independent `<DataTable>`
 * mounts, one per contract:
 *   - `seed-declarative` — `<Column pinned="right">`. The children form registers DURING mount
 *     (`$data.colReg` is empty when $onMount runs), so this mount specifically exercises the
 *     re-feed-watch call site rather than the $onMount one. Both call sites are required; a
 *     regression that drops either would show up here or in `seed-config` but not both.
 *   - `seed-config` — the `:columns` config-array form with `pinned: 'left'`, plus the
 *     one-shot probe.
 *   - `seed-preempted` — the consumer binds `r-model:columnPinning` with `name` already pinned
 *     AND declares `pinned="right"` on `amount`; the consumer's pin must win outright.
 *
 * Why REORDER is the primary assertion rather than the sticky style: table-core's
 * `getVisibleCells()` returns [left-pinned, center, right-pinned], so a genuine pin MOVES the
 * column. A style-only assertion would pass against a cosmetic `position: sticky` that never
 * reached table-core's real columnPinning state — which is precisely the failure mode that
 * shipped before this fix (every `<th>` already carries `position: sticky` from the
 * sticky-header CSS, so "is it sticky" proves nothing at all here). Each case therefore asserts
 * column ORDER first and the pin offset (`left: 0px` / `right: 0px`) second.
 *
 * The `config-pinning` / `preempted-pinning` readouts render the live two-way model, so the
 * seed is proven to reach the CONSUMER'S OWN binding, not merely the internal state — the seed
 * writes both the uncontrolled holder and `$model.columnPinning` for exactly that reason.
 *
 * DOM assertions only — no PNG baseline. A screenshot cannot distinguish "table-core reordered
 * the columns" from "CSS moved them", which is the whole ambiguity these assertions remove.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

// Empty known-failing set — the seed lives in a shared `.rzts` partial consumed identically by
// all six emitters, so a single-target failure would be a real finding, not something to fixme.
const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>([]);

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return !built || KNOWN_FAILING.has(target) ? test.fixme : test;
}

async function gotoDemo(page: Page, target: Target): Promise<void> {
  await page.goto(`/?example=DataTablePinnedSeed&target=${target}`);
  await expect(page.getByTestId('rozie-mount')).toBeVisible();
  await expect(
    page.getByTestId('seed-declarative').locator('table.rozie-data-table'),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Column ids in RENDERED order for one mount, each tagged with its pin side as resolved from
 * the inline offset the component writes (`pinStyle`, columnChrome.rzts): 'L' for a left rail
 * member, 'R' for a right rail member, '-' for unpinned. Reads `left: 0px` / `right: 0px`
 * rather than `position: sticky` because the sticky-header CSS makes EVERY `<th>` sticky, so a
 * `position` check would report every column as pinned on every target.
 *
 * Shadow-piercing is REQUIRED, and doubly so on Lit: the demo component has its own shadow root
 * AND the `<rozie-data-table>` inside it has another, so the `<th>`s sit two roots deep. A plain
 * `document.querySelector` returns nothing there (measured: all four cases returned '' on lit
 * while passing on the five light-DOM targets).
 *
 * The walker is INLINED rather than imported from `./_shadow-utils`: `page.evaluate` serializes
 * this callback via `Function.prototype.toString()` and re-executes the text in the browser, so
 * an imported helper referenced from inside it throws `ReferenceError` at runtime. That
 * constraint is documented at the top of `_shadow-utils.ts`; its exports are designed to be
 * passed directly AS the evaluate callback, which does not fit this two-step
 * (find-section-then-collect-within) shape.
 */
async function columnsOf(page: Page, testid: string): Promise<string[]> {
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
    return deepAll(host, 'thead th').map((th) => {
      // Whitespace-tolerant: Lit serializes the same pinStyle() string WITHOUT spaces
      // (`width:150px;position:sticky;left:0px;`) while the other five emit
      // `width: 150px; position: sticky; left: 0px;`. A space-sensitive match reports every
      // Lit column as unpinned — measured, and exactly the false negative this comment exists
      // to stop the next person re-introducing.
      const style = th.getAttribute('style') || '';
      const side = /(^|;)\s*left:\s*0px/.test(style)
        ? 'L'
        : /(^|;)\s*right:\s*0px/.test(style)
          ? 'R'
          : '-';
      return `${th.getAttribute('data-col')}:${side}`;
    });
  }, testid);
}

async function readoutJson(page: Page, testid: string): Promise<unknown> {
  const raw = await page.getByTestId(testid).textContent();
  return JSON.parse((raw || '').trim());
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// `<Column pinned="right">` — the children declaration form (re-feed-watch call site).
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-pinned-seed [${target}]: <Column pinned="right"> right-pins the column`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // `amount` is declared LAST and pinned right, so a correct seed leaves it last but makes it
    // a right-rail member. The ordering assertion alone cannot distinguish seeded-from-inert
    // here (last either way) — the `:R` tag is what carries the proof for this form.
    await expect
      .poll(async () => (await columnsOf(page, 'seed-declarative')).join(' '), { timeout: 15_000 })
      .toBe('name:- status:- amount:R');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// `:columns` `pinned: 'left'` — the config-array form ($onMount call site). Proven by the
// REORDER: `amount` is declared third and must render FIRST once genuinely pinned.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-pinned-seed [${target}]: :columns pinned:'left' left-pins AND reorders`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await expect
      .poll(async () => (await columnsOf(page, 'seed-config')).join(' '), { timeout: 15_000 })
      .toBe('amount:L name:- status:-');
    // The seed must reach the consumer's own two-way binding, not just internal state.
    await expect.poll(async () => readoutJson(page, 'config-pinning'), { timeout: 15_000 })
      .toEqual({ left: ['amount'], right: [] });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// One-shot: an interactive unpin must NOT be re-seeded by the re-feed that follows it.
// This is the regression this design exists to prevent — a seed folded into the pinning
// read path (rather than latched) would silently restore the pin here.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-pinned-seed [${target}]: unpinning a seeded column is not re-seeded`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    await expect
      .poll(async () => (await columnsOf(page, 'seed-config')).join(' '), { timeout: 15_000 })
      .toBe('amount:L name:- status:-');

    await page.getByTestId('unpin-amount').click();

    // Back to declaration order, nothing pinned — and it must STAY that way.
    await expect
      .poll(async () => (await columnsOf(page, 'seed-config')).join(' '), { timeout: 15_000 })
      .toBe('name:- status:- amount:-');
    await expect.poll(async () => readoutJson(page, 'config-pinning'), { timeout: 15_000 })
      .toEqual({ left: [], right: [] });
    // Settle past any further re-feed flush before re-reading, so a late re-seed cannot slip
    // through after the assertion above.
    await page.waitForTimeout(500);
    expect((await columnsOf(page, 'seed-config')).join(' ')).toBe('name:- status:- amount:-');
  });
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// A consumer who has expressed a pin owns the slice — the declaration stands down.
// ═══════════════════════════════════════════════════════════════════════════════════════
for (const target of TARGETS) {
  runnerFor(target)(`data-table-pinned-seed [${target}]: a consumer pin pre-empts the declaration`, async ({
    page,
  }) => {
    await gotoDemo(page, target);
    // `name` is pinned by the consumer's bound model; `amount` declares pinned="right" and must
    // be ignored entirely — neither reordered nor given a pin offset.
    await expect
      .poll(async () => (await columnsOf(page, 'seed-preempted')).join(' '), { timeout: 15_000 })
      .toBe('name:L status:- amount:-');
    await expect.poll(async () => readoutJson(page, 'preempted-pinning'), { timeout: 15_000 })
      .toEqual({ left: ['name'], right: [] });
  });
}
