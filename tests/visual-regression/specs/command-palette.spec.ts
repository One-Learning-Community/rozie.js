import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * CommandPalette behavioral smoke — the cmdk-style command menu (`CommandPalette`).
 *
 * `CommandPalette` is a pure-Rozie family (NO third-party engine). It COMPOSES a
 * vendored list primitive (Phase 999.4 Option B open-shadow vendoring) for the
 * search input + navigable results list + empty state, and owns the overlay,
 * the keyword filter (`internal/filterCommands.ts`), the close policy, and the
 * `select` event re-emit. This spec is the BEHAVIORAL GREEN GATE for Phase 64 P3
 * (D-03): it captures the migration-invariant behavior the family must preserve
 * when its vendored primitive is swapped (Listbox → Combobox). It asserts the
 * SAME facts before and after that migration:
 *   1. opening the palette renders all 8 commands (6 leaves + 2 navigating);
 *   2. typing filters (keyword-aware, via filterCommands) and echoes the query;
 *   3. arrow navigation + Enter selects and reports the chosen command (@select);
 *   4. selecting closes the palette (closeOnSelect);
 *   5. reopening resets the query and re-renders; Escape closes.
 *
 * A SECOND suite below (command-palette-levels, absorbs feature #4) proves the
 * nested-levels behavioral contract: push (selecting a navigating item), pop
 * (Backspace-on-empty AND Escape-at-depth vs close-at-root), query
 * clear-on-push + restore-on-pop (both the model AND the visible input text,
 * via combobox's seedQuery), async loading→settled→error/empty (race-drop +
 * debounce), the breadcrumb header, and openTo(path) deep-linking.
 *
 * `examples/demos/CommandPaletteBehaviorDemo.rozie` drives a two-way
 * r-model:open + r-model:query, a mixed 8-item list (6 leaves, a static
 * `children` level, and an async `source` level), an open button, an openTo
 * trigger, and @select/@navigate/@back readouts. The role/CSS locators
 * auto-pierce Lit's open shadow root; the `countOptions` page.evaluate walker
 * below RECURSIVELY pierces every open shadow root (the CommandPalette host
 * shadow PLUS the nested primitive's own open shadow root on Lit) — the
 * data-table-virtual.spec.ts shadow-pierce precedent.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Like listbox.spec.ts / combobox.spec.ts, this runs locally
 * on macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

// FORMERLY a PRE-EXISTING Lit gap (test.fixme'd): on Lit, CommandPalette's
// `onComboboxChange` handler binds `@change="onComboboxChange($event)"` on the
// vendored Combobox — a component tag whose OWN `$emit('change', { value,
// option })` name collides with the native DOM `change` event name. The Lit
// emitter's `isNativeDomEvent` denylist kept this handler UNWRAPPED (the raw
// `Event`/`CustomEvent` object, not its `.detail` payload), so
// `onComboboxChange`'s `e.option` read was always `undefined` — the palette
// silently never reported or closed on selection (confirmed live: the child
// Combobox itself DID commit the selection — `aria-selected` flipped, its own
// value model updated — but CommandPalette's re-emit of the PUBLIC `select`
// event never fired). Fixed by emitter-hardening backlog #6 (73-04): the Lit
// component-tag `@event` unwrap now decides `.detail` vs raw event at RUNTIME
// via `$event instanceof CustomEvent` instead of by event-name denylist, so a
// component's own `$emit`-under-a-native-colliding-name always unwraps
// correctly while a genuine native-event auto-fallthrough (ThemedButtonConsumer
// R4 shape) still receives the raw event. Verified green ×6 locally.
const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>([]);

/**
 * Count `[role="option"]` elements, RECURSIVELY piercing every open shadow root
 * (Lit: the CommandPalette host shadow + the nested vendored primitive's own open
 * shadow root). The plain Playwright locators auto-pierce open shadow roots for
 * the simple cases; this manual walker is the robust cross-target count and the
 * Lit shadow-pierce proof (data-table-virtual.spec.ts:73-89 pattern).
 */
async function countOptions(page: Page): Promise<number> {
  return page.evaluate(() => {
    let total = 0;
    const walk = (root: Document | ShadowRoot): void => {
      total += root.querySelectorAll('[role="option"]').length;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return total;
  });
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette [${target}]: opens, type-filters, arrow+Enter selects + reports, closeOnSelect, reopen + Escape closes`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openBtn = page.getByTestId('open-palette');
    const readoutQuery = page.getByTestId('readout-query');
    const readoutSelect = page.getByTestId('readout-select');

    await expect(readoutSelect).toHaveText('');

    // NOTE: the palette-open readout (`{{ $data.open }}`) is NOT a reliable signal —
    // React/Solid render a boolean child as nothing (""), so "open" vs "closed" is
    // asserted by the OPTION COUNT (closed → 0), which is uniform across all 6
    // targets. Likewise we DON'T assert an exact arrow-nav selection: opening
    // auto-activates the first option on the Listbox primitive but NOT on Combobox
    // (activeIndex stays -1 until input/arrow), so arrow+Enter would pick different
    // items pre- vs post-migration. The migration-INVARIANT keyboard-commit proof
    // is the deterministic "type to a single match, Enter commits it" path (the
    // combobox.spec.ts pattern, green ×6 incl. Lit).

    // ---- 1. open the palette → all 6 commands render ----
    await openBtn.click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    // Focus the search input so the composed list popup opens (its @focus opens it).
    await input.focus();
    // 8 = 6 leaf commands + 2 navigating items (`goto`'s children level +
    // `search-users`'s async level) — command-palette-levels.
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(8);

    // ---- 2. typing filters (keyword-aware, via filterCommands) + echoes the query ----
    await input.pressSequentially('cut', { delay: 30 });
    await expect
      .poll(async () => (await readoutQuery.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('cut');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('Cut');

    // ---- 3. Enter commits the single filtered match + reports it (@select) ----
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await readoutSelect.textContent())?.trim() ?? '', {
        timeout: 10_000,
        intervals: [100, 200, 400, 800],
      })
      .toBe('cut');

    // ---- 4. closeOnSelect → the palette closed (no options anywhere) ----
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);

    // ---- 5. reopen resets the query + re-renders the full list ----
    await openBtn.click();
    const input2 = page.locator('input[role="combobox"]').first();
    await expect(input2).toBeVisible({ timeout: 15_000 });
    await input2.focus();
    await expect
      .poll(async () => (await readoutQuery.textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('');
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(8);

    // ---- 6. Escape closes the palette ----
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });
}

/**
 * command-palette-levels — the nested-levels + async-source behavioral proof
 * (LVL-STACK/ASYNC/QUERY/NAV/RENDER, absorbs feature #4). Drives the demo's
 * static `goto` children level and async `search-users` source level.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-levels [${target}]: push/pop, query clear+restore, async loading/error, breadcrumb, openTo`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openBtn = page.getByTestId('open-palette');
    const openToUsersBtn = page.getByTestId('open-to-users');
    const readoutQuery = page.getByTestId('readout-query');
    const readoutNavigate = page.getByTestId('readout-navigate');
    const readoutDepth = page.getByTestId('readout-depth');
    const readoutBackCount = page.getByTestId('readout-back-count');
    const breadcrumbTitle = page.getByTestId('command-palette-title');
    const status = page.getByTestId('command-palette-status');

    // ---- open at root: 8 items, no breadcrumb, backCount=0 ----
    await openBtn.click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(8);
    await expect(readoutBackCount).toHaveText('0');
    await expect(breadcrumbTitle).toHaveCount(0);

    // ---- 1. type a query that uniquely matches the `goto` navigating item ----
    await input.pressSequentially('go', { delay: 30 });
    await expect
      .poll(async () => (await readoutQuery.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('go');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);

    // ---- 2. PUSH: selecting it drills into its 3 static children instead of ----
    //         emitting `select` — query clears, breadcrumb appears, @navigate fires.
    await page.locator('[role="option"]', { hasText: 'Go to page' }).click();
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(3);
    await expect
      .poll(async () => (await readoutQuery.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('');
    await expect(breadcrumbTitle).toHaveText('Go to page');
    await expect(readoutNavigate).toHaveText('goto');
    await expect(readoutDepth).toHaveText('1');

    // ---- 3. POP via Backspace-on-empty: RESTORES the parent query — BOTH the ----
    //         model (readoutQuery) AND the visible input text (seedQuery) — full undo.
    //         The restored 'go' query re-filters the ROOT list back down to the
    //         single matching command ("Go to page…"), count 1 — proving the
    //         restore drove the pipeline, not just the model.
    await page.keyboard.press('Backspace');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await expect
      .poll(async () => (await readoutQuery.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('go');
    await expect(input).toHaveValue('go');
    await expect(readoutBackCount).toHaveText('1');
    await expect(breadcrumbTitle).toHaveCount(0);

    // ---- 4. PUSH the ASYNC level: `search-users` enters 'loading' then settles ----
    //         to its default (query='') view — the empty-vs-search branch (#8).
    await input.fill('');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(8);
    await page.locator('[role="option"]', { hasText: 'Search users' }).click();
    await expect(breadcrumbTitle).toHaveText('Search users');
    await expect(readoutDepth).toHaveText('1');
    // Best-effort observation of the transient 'loading' frame (the demo's
    // source has a deliberate ~500ms delay). This is BEST-EFFORT, not strict:
    // the loading→settled DOM transition is racy by nature, and Angular's
    // composed-slot change-detection timing does not always surface the
    // sub-second frame to the DOM before it settles. The async status PIPELINE
    // is proven deterministically ×6 by (a) the unit tests (asyncSource +
    // levelStack), (b) the settled count-2 transition below (only reachable via
    // loading→settle), and (c) the strict `error` status assertion in step 5
    // (same `#empty` re-projection + currentStatus() render path).
    const sawLoading = await status
      .getAttribute('data-status', { timeout: 1_500 })
      .then((v) => v === 'loading')
      .catch(() => false);
    if (sawLoading) {
      await expect(status).toHaveAttribute('data-status', 'loading');
    }
    // Settled: the default (query='') view is the first 2 users.
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(2);
    await expect(status).toHaveCount(0);

    // ---- 5. ASYNC ERROR (strict ×6): the demo's source deliberately rejects on ----
    //         query==='error' (race-drop-safe — this is the LATEST request). The
    //         input stays usable; the #error slot renders via the same status
    //         pipeline that drives #loading, proving async status rendering ×6.
    await input.pressSequentially('error', { delay: 30 });
    await expect(status).toHaveAttribute('data-status', 'error', { timeout: 10_000 });
    await expect(status).toContainText('Search failed');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);

    // ---- 6. Escape at depth>0 POPS one level — does NOT close ----
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(8);
    await expect(readoutBackCount).toHaveText('2');
    await expect(breadcrumbTitle).toHaveCount(0);

    // ---- 7. Escape at the ROOT (depth===0) closes the palette ----
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);

    // ---- 8. openTo(['search-users']) — the ⌘P deep-link: opens + drills async-aware ----
    await openToUsersBtn.click();
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(2);
    await expect(breadcrumbTitle).toHaveText('Search users');
  });
}
