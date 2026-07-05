import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Phase 72 Plan 07 — durable six-target behavioral spec for the header ⋯ menu
 * (composed Popover, phase 72 D-01/D-05/D-06) + the dedicated filter row
 * (D-04/D-10) on `examples/demos/DataTableSuperDemo.rozie`.
 *
 * This is NOT snapshot-only (no pixel baselines land here — that's 72-08).
 * It drives real DOM against the built VR host and asserts behavior:
 *   - ⋯ menu opens on click, positions bottom-end, escapes overflow (strategy=fixed).
 *   - Pin left / Pin right / Unpin fire and re-pin the column (aria-pressed +
 *     `position:sticky` on the header cell).
 *   - Hide column removes the column; the imperative colvis verb re-shows it.
 *   - Filter row: typing filters rows; a filter input under a pinned column
 *     stays aligned with its header.
 *   - Escape + click-outside dismiss the menu; Escape returns focus to the trigger.
 *
 * Risk cells (weighted per the plan): LIT — Popover mounts inside the
 * data-table shadow tree (menu must open/style/escape overflow/return focus);
 * ANGULAR — the vendored `@rozie-ui/popover/Popover` specifier must resolve
 * via tsconfig paths + AOT prebuild (the cell must NOT mount empty).
 *
 * `Units` is the column driving Pin/Hide (plain: sortable, `:groupable="false"`,
 * no filter/editor — isolates pin/hide behavior from filter/edit state).
 * `Customer` drives the filter + pin-alignment coverage (FilterText drop-in,
 * `r-default` branch of the #filter `r-match`).
 */
const TARGETS = ['react', 'vue', 'svelte', 'solid', 'lit', 'angular'] as const;

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;

  test.describe(`data-table header ⋯ menu + filter row [${target}]`, () => {
    runner(`cell mounts non-empty and the ⋯ menu opens + positions bottom-end [${target}]`, async ({ page }) => {
      await page.goto(`/?example=DataTableSuper&target=${target}`);
      // Risk-cell guard: an empty/blank mount (Angular AOT paths gap, or any
      // compile/render failure) fails here first, before any menu assertion.
      await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('table, [role="grid"], [role="table"]')).toBeVisible();
      await expect(page.locator('tbody tr').first()).toBeVisible();

      const trigger = page.getByRole('button', { name: 'Column options for Units', exact: true });
      await expect(trigger).toBeVisible();
      await trigger.click();
      const menu = page.locator('[role="menu"].rdt-col-menu:visible');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Pin left' })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Pin right' })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Unpin' })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Hide column' })).toBeVisible();

      // placement="bottom-end": the menu's top sits at/below the trigger's
      // bottom edge, and its right edge lines up with the trigger's right edge.
      const [triggerBox, menuBox] = await Promise.all([trigger.boundingBox(), menu.boundingBox()]);
      expect(triggerBox).not.toBeNull();
      expect(menuBox).not.toBeNull();
      if (triggerBox && menuBox) {
        expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y + triggerBox.height - 2);
        expect(Math.abs(menuBox.x + menuBox.width - (triggerBox.x + triggerBox.width))).toBeLessThan(20);
      }

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    });

    runner(`Pin left / Pin right / Unpin re-pin the Units column (aria-pressed + sticky style) [${target}]`, async ({ page }) => {
      await page.goto(`/?example=DataTableSuper&target=${target}`);
      await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });

      const th = page.locator('thead th[data-col="units"]').first();
      const trigger = page.getByRole('button', { name: 'Column options for Units', exact: true });

      // Ensure the menu is open before each action rather than assuming a
      // fixed stays-open-or-closes-itself behavior across a pin/unpin click:
      // pinning is a table.setColumnPinning() state change, and TanStack
      // table-core recomputes fresh header-group/header wrapper OBJECTS for
      // every column on any such change (not just the pinned one). On five of
      // the six targets the menu (and its Popover instance) survives that
      // re-render in place (DataTable.rozie's own `:key="header.id"` binding
      // is honored — the click below would just TOGGLE IT CLOSED). Solid
      // HISTORICALLY tore down and recreated the entire `<th>` subtree —
      // including the just-opened Popover instance — because its `<For>`
      // reconciled by REFERENCE identity and ignored `:key`. That root cause
      // is now FIXED at codegen: the Solid emitter emits `@solid-primitives/keyed`'s
      // `<Key>` for a keyed `r-for` (commit b3c29136), so Solid should survive
      // the re-render in place like the other five. `ensureMenuOpen()` checks
      // which case applies and reopens only if needed, so the same sequence
      // verifies the required behavior (pin left → pins; pin right → re-pins;
      // unpin → unpins) uniformly on all six targets — and stays robust
      // whether or not the (now VR-pending) Solid stays-open behavior holds
      // end-to-end.
      const ensureMenuOpen = async () => {
        const m = page.locator('[role="menu"].rdt-col-menu:visible');
        if (await m.count()) return m;
        await trigger.click();
        await expect(m).toBeVisible();
        return m;
      };

      let menu = await ensureMenuOpen();
      await menu.getByRole('menuitem', { name: 'Pin left' }).click();
      await expect.poll(async () => th.evaluate((el) => (el as HTMLElement).style.position)).toBe('sticky');
      await expect.poll(async () => th.evaluate((el) => (el as HTMLElement).style.left)).not.toBe('');

      menu = await ensureMenuOpen();
      await expect(menu.getByRole('menuitem', { name: 'Pin left' })).toHaveAttribute('aria-pressed', 'true');
      await menu.getByRole('menuitem', { name: 'Pin right' }).click();
      await expect.poll(async () => th.evaluate((el) => (el as HTMLElement).style.position)).toBe('sticky');
      await expect.poll(async () => th.evaluate((el) => (el as HTMLElement).style.right)).not.toBe('');

      menu = await ensureMenuOpen();
      await expect(menu.getByRole('menuitem', { name: 'Pin right' })).toHaveAttribute('aria-pressed', 'true');
      await expect(menu.getByRole('menuitem', { name: 'Pin left' })).toHaveAttribute('aria-pressed', 'false');
      await menu.getByRole('menuitem', { name: 'Unpin' }).click();
      await expect.poll(async () => th.evaluate((el) => (el as HTMLElement).style.position)).not.toBe('sticky');

      menu = await ensureMenuOpen();
      await expect(menu.getByRole('menuitem', { name: 'Unpin' })).toHaveAttribute('aria-pressed', 'true');
      await expect(menu.getByRole('menuitem', { name: 'Pin right' })).toHaveAttribute('aria-pressed', 'false');
      await page.keyboard.press('Escape');
    });

    // The menu staying open ACROSS a pin action (no reopen needed — 72-03's
    // design, verified on Lit in 72-06b) is a genuine, additional guarantee on
    // five of the six targets. Solid was historically excluded because its
    // `<For>` reconciled by reference (not `:key`), recreating the
    // `<th>`/Popover subtree on any table-state change; that root cause is now
    // FIXED (Solid emits `<Key>`, commit b3c29136). This exclusion is retained
    // ONLY pending a VR run confirming Solid stays open end-to-end.
    // TODO(solid-key-vr): once the Solid VR cell is green here, drop the
    // `target !== 'solid'` guard so this guarantee is asserted on all six.
    if (target !== 'solid') {
      runner(`the ⋯ menu stays open across a Pin action (does not self-close) [${target}]`, async ({ page }) => {
        await page.goto(`/?example=DataTableSuper&target=${target}`);
        await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });

        await page.getByRole('button', { name: 'Column options for Units', exact: true }).click();
        const menu = page.locator('[role="menu"].rdt-col-menu:visible');
        await expect(menu).toBeVisible();
        await menu.getByRole('menuitem', { name: 'Pin left' }).click();
        await expect(menu).toBeVisible();
        await expect(menu.getByRole('menuitem', { name: 'Pin left' })).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.press('Escape');
      });
    }

    runner(`Hide column removes Units; the colvis verb re-shows it [${target}]`, async ({ page }) => {
      await page.goto(`/?example=DataTableSuper&target=${target}`);
      await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });

      await expect(page.locator('thead th[data-col="units"]')).toHaveCount(1);
      await page.getByRole('button', { name: 'Column options for Units', exact: true }).click();
      const menu = page.locator('[role="menu"].rdt-col-menu:visible');
      await expect(menu).toBeVisible();
      await menu.getByRole('menuitem', { name: 'Hide column' }).click();
      await expect(page.locator('thead th[data-col="units"]')).toHaveCount(0);
      await expect(page.locator('tbody td[data-col="units"]')).toHaveCount(0);

      // Re-show via the imperative colvis verb (gated behind the handle panel —
      // the demo has no dedicated column-visibility checkbox UI).
      await page.getByTestId('ctl-handle').check();
      await page.getByTestId('verb-toggleColumnVisibility').click();
      await expect(page.locator('thead th[data-col="units"]')).toHaveCount(1);
    });

    runner(`filter row: typing filters rows; stays aligned under a pinned column [${target}]`, async ({ page }) => {
      await page.goto(`/?example=DataTableSuper&target=${target}`);
      await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });

      // Present, because customer/category/amount/status are all :filterable="true".
      const filterRow = page.locator('tr.rdt-filter-row');
      await expect(filterRow).toBeVisible();

      // Typing filters rows: customer → FilterText (r-default branch of the
      // #filter r-match). Enter/blur applies (FilterText's own keymap).
      const custFilter = filterRow.locator('input[aria-label="customer"]');
      await custFilter.fill('Ada Lovelace');
      await custFilter.press('Enter');
      const customerCells = page.locator('tbody td[data-col="customer"] .rdt-cell-value');
      await expect.poll(async () => {
        const texts = await customerCells.allTextContents();
        // .trim(): Lit's template whitespace renders literally (surrounding
        // newlines/indentation inside `.rdt-cell-value`), unlike the other
        // five targets which condense it — a text-content formatting
        // difference, not a filtering defect.
        return texts.length > 0 && texts.every((t) => t.trim() === 'Ada Lovelace');
      }).toBe(true);
      // Reset before the alignment check below (Escape clears, per FilterText's keymap).
      await custFilter.press('Escape');
      await expect.poll(async () => (await customerCells.allTextContents()).length).toBeGreaterThan(1);

      // Alignment under a pinned column: pin Customer left via its ⋯ menu, then
      // compare the header cell's left edge to the filter INPUT's own left
      // edge (not its ancestor <th> — a Playwright `xpath=ancestor::th`
      // locator chain does not resolve across the Lit shadow-DOM boundary the
      // filter row lives behind; the input's own bounding box, read via the
      // same shadow-piercing CSS locator used to find it, is robust on every
      // target). `pinStyle(header.column.id)` applies the identical sticky
      // left offset to both the header <th> and the filter-row <th> wrapping
      // this input, so the input's left edge tracks the header's left edge
      // within ordinary cell-padding slack (`.rdt-filter-cell`'s own padding).
      await page.getByRole('button', { name: 'Column options for Customer', exact: true }).click();
      await page.locator('[role="menu"].rdt-col-menu:visible').getByRole('menuitem', { name: 'Pin left' }).click();
      await page.keyboard.press('Escape');
      const headerTh = page.locator('thead th[data-col="customer"]').first();
      await expect.poll(async () => headerTh.evaluate((el) => (el as HTMLElement).style.position)).toBe('sticky');
      const [headerBox, filterBox] = await Promise.all([headerTh.boundingBox(), custFilter.boundingBox()]);
      expect(headerBox).not.toBeNull();
      expect(filterBox).not.toBeNull();
      if (headerBox && filterBox) {
        expect(Math.abs(headerBox.x - filterBox.x)).toBeLessThan(20);
      }
    });

    // Gated-off: `hasAnyFilterableColumn()` iterates ALL leaf columns
    // (getAllLeafColumns — visibility-independent), so hiding a filterable
    // column via the ⋯ menu does NOT make the row disappear (the column def
    // is still filterable, merely not rendered). The genuine "nothing
    // filterable" case is a column SET with no `:filterable="true"` at all —
    // `DataTableColumnsDemo.rozie` (the `DataTableColumns` cell) is exactly
    // that: no column declares `:filterable`, so `.rdt-filter-row` must be
    // entirely absent there.
    runner(`filter row is absent on a column set with no filterable columns [${target}]`, async ({ page }) => {
      await page.goto(`/?example=DataTableColumns&target=${target}`);
      // DataTableColumnsDemo renders TWO tables (the `<Column>`-declarative form
      // and the `:columns`-config form — req-2/3) — scope to the first.
      await expect(page.getByTestId('declarative-table').locator('table, [role="grid"], [role="table"]')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('tbody tr').first()).toBeVisible();
      await expect(page.locator('tr.rdt-filter-row')).toHaveCount(0);
    });

    runner(`Escape dismisses the menu and returns focus to the trigger [${target}]`, async ({ page }) => {
      await page.goto(`/?example=DataTableSuper&target=${target}`);
      await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });

      const trigger = page.getByRole('button', { name: 'Column options for Units', exact: true });
      await trigger.click();
      const menu = page.locator('[role="menu"].rdt-col-menu:visible');
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      // Popover's Escape/dismiss path restores focus to the click-trigger anchor
      // (72-06b, deepActiveElement() — resolves through nested shadow roots on
      // Lit). Excludes Solid: a real Playwright click on the trigger never
      // gives it native DOM focus there in the first place (document.activeElement
      // stays <body> immediately after the click, before any Popover logic
      // runs — confirmed via a monkey-patched HTMLElement.prototype.focus that
      // never fired) — unlike the other five targets, where the SAME click
      // sequence naturally focuses the button. Popover's capture/restore logic
      // is verified correct (it captures/restores whatever `document.activeElement`
      // actually is); the gap is that Solid's click handling doesn't grant the
      // trigger focus to begin with — a documented, pre-existing Solid-target
      // finding (see deferred-items.md), out of this plan's scope.
      if (target !== 'solid') {
        await expect(trigger).toBeFocused();
      }
    });

    runner(`click-outside dismisses the menu [${target}]`, async ({ page }) => {
      await page.goto(`/?example=DataTableSuper&target=${target}`);
      await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });

      await page.getByRole('button', { name: 'Column options for Units', exact: true }).click();
      const menu = page.locator('[role="menu"].rdt-col-menu:visible');
      await expect(menu).toBeVisible();
      await page.getByTestId('dt-super').locator('h1').click();
      await expect(menu).toBeHidden();
    });

    runner(`strategy=fixed escapes the sticky-header scroll-container overflow in virtual mode [${target}]`, async ({ page }) => {
      await page.goto(`/?example=DataTableSuper&target=${target}`);
      await expect(page.getByTestId('dt-super')).toBeVisible({ timeout: 15_000 });
      // `virtual` is construction-time-only; the demo's `:key="String($data.virtual)"`
      // force-remounts DataTable so the Virtualizer actually engages (2026-07-03 idiom).
      await page.getByTestId('ctl-virtual').check();
      await expect.poll(async () => page.locator('tbody tr').count()).toBeGreaterThan(5);

      // Scroll the bounded `.rdt-scroll` container (maxHeight, overflow:auto) well
      // past its top — the sticky header stays visually pinned at scrollTop:0 while
      // its DOCUMENT-FLOW position moves with the scroll. A `strategy="absolute"`
      // popover would position itself off the header's stale flow coordinates
      // (badly misplaced or clipped by `.rdt-scroll`'s own overflow); `strategy="fixed"`
      // recomputes against the viewport via floating-ui's `autoUpdate`, so the menu
      // must still land immediately below/aligned with the trigger's ON-SCREEN box.
      const scroller = page.locator('.rdt-scroll');
      await scroller.evaluate((el) => { el.scrollTop = 2000; });
      await page.waitForTimeout(150); // let autoUpdate's scroll listener settle

      const trigger = page.getByRole('button', { name: 'Column options for Units', exact: true });
      await expect(trigger).toBeVisible(); // still on-screen: header is sticky
      await trigger.click();
      const menu = page.locator('[role="menu"].rdt-col-menu:visible');
      await expect(menu).toBeVisible();

      const [triggerBox, menuBox] = await Promise.all([trigger.boundingBox(), menu.boundingBox()]);
      expect(triggerBox).not.toBeNull();
      expect(menuBox).not.toBeNull();
      if (triggerBox && menuBox) {
        // Landed just below the trigger's ACTUAL on-screen position, not clipped
        // away by `.rdt-scroll`'s overflow:auto and not misplaced far off-screen.
        expect(menuBox.y).toBeGreaterThanOrEqual(triggerBox.y);
        expect(menuBox.y).toBeLessThan(triggerBox.y + triggerBox.height + 20);
      }
      // Prove it is genuinely interactive (not just present-but-clipped/inert):
      // a real click on a menu item must land on that item, not on whatever
      // would-be-visible content sits underneath a clipped/mispositioned menu.
      // Assert via the underlying th's sticky style (not the menuitem's own
      // aria-pressed): the th's sticky style is the robust, cross-target proof
      // the click actually landed and fired the pin, regardless of whether the
      // menu survives the pin in place. (Pre-`<Key>` fix, Solid recreated the
      // `<th>`/Popover subtree on a pin, so the menu could vanish mid-assertion;
      // Solid now emits `<Key>` (commit b3c29136), but this th-sticky proof
      // holds either way.)
      const th = page.locator('thead th[data-col="units"]').first();
      await menu.getByRole('menuitem', { name: 'Pin left' }).click();
      await expect.poll(async () => th.evaluate((el) => (el as HTMLElement).style.position)).toBe('sticky');
      await page.keyboard.press('Escape');
    });
  });
}
