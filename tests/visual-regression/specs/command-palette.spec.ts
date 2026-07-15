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
 * A THIRD suite below (command-palette-sub-actions, feature #5) proves the
 * interactive sub-actions state machine: ⌘K / caret-at-end Right-arrow / the
 * `#actions` row affordance click all open a per-row action menu (a no-op on
 * an action-less row); real DOM focus moves into the menu while the result
 * list stays visibly open (the combobox `keepOpen`/`pinOpen` primitive);
 * disabled-skip clamped roving; Enter fires `@action-select` and closes the
 * menu (+ palette when `closeOnAction`); Escape/← close the menu and restore
 * focus + the list WITHOUT popping a level or closing the palette. This is
 * ALSO the behavioral proof that `keepOpen` (landed in the `combobox-keepopen`
 * phase) doesn't regress its OTHER consumer — see the separately-gated
 * `data-table` VR cell in the same `vr.sh -g` run.
 *
 * A FOURTH suite below (command-palette-groups, cp-adopts-combobox-groups)
 * proves the vendored <Combobox>'s NATIVE section-groups adoption: the demo's
 * `File` (new/open/save) and `Edit` (cut/copy/paste) commands render as two
 * labeled sections, the two navigating items (`goto`/`search-users`, which
 * carry no `group`) render in a leading headingless block, the `role="option"`
 * count stays 8 (grouping never drops/adds rows), and the old per-row
 * `.rozie-command-palette-option-group` badge is fully replaced (0 elements).
 *
 * A FIFTH suite below (command-palette-default-items,
 * command-palette-13-empty-home-view-first) proves the empty/home-view seam
 * on the demo's SECOND, self-contained palette (`open-home-palette`,
 * `homeOpen`/`homeQuery`, never touching the first palette's items/testids):
 * an empty query at the ROOT renders the `defaultItems` prop's 3 items,
 * grouped into 'Recent'/'Suggested' sections; typing switches to scored
 * `items` results; clearing returns to `defaultItems`; pushing the
 * `find-users` navigating item (which carries its OWN `defaultItems` field)
 * shows ITS 2-item home view immediately — no loading flash, and critically
 * NOT the async source's full 3-entry pool, proving `source('')` was never
 * called; typing a real query still runs the async source; clearing restores
 * the per-level home view again.
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
  return countByRole(page, 'option');
}

/**
 * Count `[role="<role>"]` elements, RECURSIVELY piercing every open shadow
 * root — the generalized form of `countOptions`, reused for
 * `[role="menuitem"]` (the action menu flyout, command-palette-sub-actions).
 */
async function countByRole(page: Page, role: string): Promise<number> {
  return page.evaluate((r) => {
    let total = 0;
    const walk = (root: Document | ShadowRoot): void => {
      total += root.querySelectorAll(`[role="${r}"]`).length;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return total;
  }, role);
}

/**
 * The deepest REAL `document.activeElement`, recursively walking open shadow
 * roots (the CommandPalette.rozie `deepActiveElement` precedent, mirrored
 * here for the spec) — `{ role, disabled }` off it, or null when nothing is
 * focused. Used to prove real-focus arbitration (ACT-ARBITRATION): the
 * action menu takes ACTUAL DOM focus, not just an `aria-activedescendant`
 * pointer.
 */
async function activeMenuItemInfo(page: Page): Promise<{ role: string | null; disabled: boolean } | null> {
  return page.evaluate(() => {
    let node: (Element & { shadowRoot?: ShadowRoot | null }) | null = document.activeElement as Element | null;
    while (node && node.shadowRoot && node.shadowRoot.activeElement) {
      node = node.shadowRoot.activeElement as Element & { shadowRoot?: ShadowRoot | null };
    }
    if (!node) return null;
    return { role: node.getAttribute('role'), disabled: node.getAttribute('aria-disabled') === 'true' };
  });
}

/** The deepest REAL active element's trimmed text content (shadow-piercing). */
async function activeElementText(page: Page): Promise<string> {
  return page.evaluate(() => {
    let node: (Element & { shadowRoot?: ShadowRoot | null }) | null = document.activeElement as Element | null;
    while (node && node.shadowRoot && node.shadowRoot.activeElement) {
      node = node.shadowRoot.activeElement as Element & { shadowRoot?: ShadowRoot | null };
    }
    return node ? (node.textContent || '').trim() : '';
  });
}

/**
 * Count elements matching `.<className>`, RECURSIVELY piercing every open
 * shadow root — reused below for the retired per-row group badge
 * (`.rozie-command-palette-option-group`, cp-adopts-combobox-groups).
 */
async function countByClass(page: Page, className: string): Promise<number> {
  return page.evaluate((cls) => {
    let total = 0;
    const walk = (root: Document | ShadowRoot): void => {
      total += root.querySelectorAll(`.${cls}`).length;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return total;
  }, className);
}

/**
 * Non-clip hit-test (finding 1, 260715-50l): true iff the LAST `[role="menuitem"]`
 * (RECURSIVELY collected across every open shadow root, mirroring the
 * `deepActiveElement`/`deepQuerySelector` shadow-piercing precedents in
 * CommandPalette.rozie) is fully within the viewport AND is actually hittable
 * at its own center — a shadow-piercing `elementFromPoint` walk, because a
 * CLIPPED element still reports a full, non-zero bounding box (a plain box
 * assertion alone would pass even when the row is invisible under
 * `overflow: hidden`). This is the real regression guard for the
 * NON-CLIPPING `.rozie-command-palette-frame` anchor (finding 1) — the
 * single-result ⌘K scenario opens a 3-item menu against a 1-row-tall panel,
 * which a naive `position: relative` panel would CLIP.
 */
async function deepHitAtLastMenuItem(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const collect = (root: Document | ShadowRoot, acc: Element[]): Element[] => {
      root.querySelectorAll('[role="menuitem"]').forEach((e) => acc.push(e));
      root.querySelectorAll('*').forEach((e) => {
        const sr = (e as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) collect(sr, acc);
      });
      return acc;
    };
    const items = collect(document, []);
    const last = items[items.length - 1];
    if (!last) return false;
    const r = last.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.right > window.innerWidth || r.top < 0) return false;
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    let el: Element | null = document.elementFromPoint(x, y);
    while (el && (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
      const inner = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot!.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return !!el && (el === last || last.contains(el));
  });
}

/**
 * The trimmed text content of every combobox group-heading element
 * (`.rozie-combobox-group-heading`), in DOM order, RECURSIVELY piercing
 * every open shadow root — cp-adopts-combobox-groups' section-heading proof.
 */
async function groupHeadingTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: Document | ShadowRoot): void => {
      for (const el of Array.from(root.querySelectorAll('.rozie-combobox-group-heading'))) {
        out.push((el.textContent || '').trim());
      }
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) walk(sr);
      }
    };
    walk(document);
    return out;
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

/**
 * command-palette-sub-actions — the interactive sub-actions state machine
 * (ACT-SEAM/ACT-MODEL/ACT-TRIGGER/ACT-ARBITRATION/ACT-KEEPOPEN/ACT-RENDER,
 * feature #5). Drives the demo's `new` ("New File") item, which carries
 * `actions: [rename, delete(disabled), duplicate]`, and its action-less
 * `open` ("Open File") sibling.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-sub-actions [${target}]: open/rove/select/escape-returns-to-list/click-affordance/keepOpen`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openBtn = page.getByTestId('open-palette');
    const readoutActionItem = page.getByTestId('readout-action-item');
    const readoutAction = page.getByTestId('readout-action');
    const readoutSelect = page.getByTestId('readout-select');

    // ---- open + isolate the `new` row (carries actions) via the query ----
    await openBtn.click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(8);
    await input.pressSequentially('new', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('New File');

    // ---- 1. ⌘K opens the menu on the highlighted row (which HAS actions): ----
    //         real focus moves into the first ENABLED menuitem ("Rename" — index 0,
    //         "Delete" at index 1 is disabled); the result list STAYS VISIBLE
    //         (keepOpen/pinOpen) the whole time — proving both ACT-ARBITRATION's
    //         real-focus guarantee AND ACT-KEEPOPEN in one assertion.
    await page.keyboard.press('ControlOrMeta+k');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(3);

    // ---- finding-1 (260715-50l): the flyout is anchored to the palette, ----
    //         NEVER clipped — this is Dan's single-result-row scenario (the
    //         list is already filtered to 1 result above), so a naive
    //         `position: relative` PANEL (content-height, overflow:hidden)
    //         would CLIP a 3-item menu; the NON-CLIPPING `.rozie-command-
    //         palette-frame` wrapper must instead let it extend past the
    //         panel while staying anchored (never escaping to the viewport
    //         edge). Deep elementFromPoint hit-test at the LAST menuitem's
    //         center is the real non-clip guard (a bounding-box check alone
    //         cannot distinguish clipped-but-sized from visible).
    await expect.poll(async () => deepHitAtLastMenuItem(page), { timeout: 10_000 }).toBe(true);
    // Horizontal anchoring to the frame (NOT vertical containment — the menu
    // may legitimately extend below a short panel).
    const menuBox = await page.getByTestId('command-palette-actions-menu').boundingBox();
    const frameBox = await page.getByTestId('command-palette-frame').boundingBox();
    expect(menuBox).not.toBeNull();
    expect(frameBox).not.toBeNull();
    expect(menuBox!.x).toBeGreaterThanOrEqual(frameBox!.x - 1);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width + 1);

    await expect
      .poll(async () => activeMenuItemInfo(page), { timeout: 10_000 })
      .toEqual({ role: 'menuitem', disabled: false });
    // keepOpen: the result list is STILL visible while the menu holds focus.
    await expect(countOptions(page)).resolves.toBe(1);

    // ---- 2. ↑/↓ roving SKIPS the disabled "Delete" action (index 1) ----
    await page.keyboard.press('ArrowDown');
    await expect.poll(async () => activeElementText(page), { timeout: 10_000 }).toContain('Duplicate');
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => activeElementText(page), { timeout: 10_000 }).toContain('Rename');

    // ---- 3. Enter fires @action-select AND closes the menu + palette ----
    //         (closeOnAction defaults true) — focused item is "Rename" (id 'rename')
    //         on the anchored "New File" item (id 'new').
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await readoutActionItem.textContent())?.trim() ?? '', {
      timeout: 10_000,
    }).toBe('new');
    await expect.poll(async () => (await readoutAction.textContent())?.trim() ?? '', {
      timeout: 10_000,
    }).toBe('rename');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);

    // ---- 4. caret-at-end Right-arrow ALSO opens the menu ----
    await openBtn.click();
    const input2 = page.locator('input[role="combobox"]').first();
    await expect(input2).toBeVisible({ timeout: 15_000 });
    await input2.focus();
    await input2.pressSequentially('new', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(3);
    // Real focus must land on the menuitem BEFORE the next menu-scoped key — the
    // menu's OWN keydown handler only sees keys while focus is actually inside it
    // (onActionMenuKeydown is bound on the flyout container, not delegated).
    await expect
      .poll(async () => activeMenuItemInfo(page), { timeout: 10_000 })
      .toEqual({ role: 'menuitem', disabled: false });

    // ---- 5. Escape closes the menu, restores focus to the input, and REOPENS ----
    //         the list — it does NOT pop a level or close the palette (menu-close
    //         precedes level-pop precedes root-close).
    await page.keyboard.press('Escape');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    // Focus-restore invariant: wait for it to actually land back on the input
    // (reopenComboboxPopup's blur-then-rAF-refocus) before the NEXT keydown —
    // a keydown dispatched into the gap between blur and refocus never reaches
    // any component listener at all (it lands on document.body).
    await expect.poll(async () => activeMenuItemInfo(page), { timeout: 10_000 }).toEqual({
      role: 'combobox',
      disabled: false,
    });

    // ---- 6. ← ALSO closes the menu (re-open via ⌘K, then ←) ----
    await page.keyboard.press('ControlOrMeta+k');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(3);
    await expect
      .poll(async () => activeMenuItemInfo(page), { timeout: 10_000 })
      .toEqual({ role: 'menuitem', disabled: false });
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => activeMenuItemInfo(page), { timeout: 10_000 }).toEqual({
      role: 'combobox',
      disabled: false,
    });

    // ---- 7. ⌘K on an action-less row ("Open File") is a NO-OP — no menu opens ----
    await input2.fill('');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(8);
    await input2.pressSequentially('open file', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('Open File');
    await page.keyboard.press('ControlOrMeta+k');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 5_000 }).toBe(0);

    // ---- 8. the `#actions` affordance CLICK opens the menu WITHOUT committing ----
    //         the option underneath it (the confirmed combobox-row collision — the
    //         option count must stay 1, the palette must stay open, and the select
    //         readout must stay untouched by this click).
    await input2.fill('');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(8);
    await input2.pressSequentially('new', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    const selectBefore = (await readoutSelect.textContent())?.trim() ?? '';
    await page.locator('[data-testid="command-palette-actions-affordance"]').first().click();
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(3);
    // The list is STILL open (the option was not committed) — keepOpen proof #2.
    await expect(countOptions(page)).resolves.toBe(1);
    await expect(readoutSelect).toHaveText(selectBefore);
    // Wait for real focus to land inside the menu (see step 4's note) before
    // the next keydown.
    await expect
      .poll(async () => activeMenuItemInfo(page), { timeout: 10_000 })
      .toEqual({ role: 'menuitem', disabled: false });
    await page.keyboard.press('Escape');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(0);
    await expect.poll(async () => activeMenuItemInfo(page), { timeout: 10_000 }).toEqual({
      role: 'combobox',
      disabled: false,
    });

    // ---- cleanup: close the palette ----
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });
}

/**
 * command-palette-groups (cp-adopts-combobox-groups) — the native combobox
 * section-groups adoption. Drives the demo's `File` (new/open/save) and
 * `Edit` (cut/copy/paste) commands, plus the two ungrouped navigating items
 * (`goto`, `search-users`).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-groups [${target}]: renders File/Edit sections, preserves option count, retires the per-row badge`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openBtn = page.getByTestId('open-palette');
    await openBtn.click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();

    // ---- 1. grouping preserves the role="option" count (8 — grouped options ----
    //         render as <div role="option">, same count as the flat branch).
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(8);

    // ---- 2. exactly 2 group HEADINGS render, "File" then "Edit" (the demo's ----
    //         two groups, in first-appearance order). The 2 ungrouped navigating
    //         items (goto, search-users) render in a LEADING headingless
    //         role="group" block, so this asserts on the heading ELEMENTS/text,
    //         not on role="group" count (which is 3, including that block).
    await expect.poll(async () => groupHeadingTexts(page), { timeout: 10_000 }).toEqual(['File', 'Edit']);

    // ---- 3. the old per-row badge is fully retired — 0 elements anywhere ----
    //         (shadow-pierced), since grouping now fully replaces it.
    await expect
      .poll(async () => countByClass(page, 'rozie-command-palette-option-group'), { timeout: 10_000 })
      .toBe(0);

    // ---- cleanup: close the palette ----
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });
}

/**
 * command-palette-default-items (command-palette-13-empty-home-view-first)
 * — the empty/home-view seam. Drives the demo's SECOND, self-contained
 * palette (`open-home-palette` / `homeOpen` / `homeQuery`), which the other
 * four suites above never touch. `HOME_RECENTS` (root `defaultItems`, 3
 * items in 2 groups) is the root home view; `HOME_ITEMS` (root `items`, 4
 * entries — 3 plain leaves + the `find-users` navigating item) is the
 * scored/searchable list; `find-users` carries its OWN `defaultItems`
 * (`HOME_USER_RECENTS`, 2 items) — that child level's home view, distinct
 * from its async `source` (`findUsers`, a 3-entry pool with NO `if (!query)`
 * overload — the whole point of the feature).
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-default-items [${target}]: root+nested home views, switch-to-scored, clear-restores, no source('') on push`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openHomeBtn = page.getByTestId('open-home-palette');
    const breadcrumbTitle = page.getByTestId('command-palette-title');

    // ---- 1. open at root: empty query renders the 3 root defaultItems, ----
    //         grouped 'Recent'/'Suggested' (author order, never reordered).
    await openHomeBtn.click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(3);
    await expect.poll(async () => groupHeadingTexts(page), { timeout: 10_000 }).toEqual(['Recent', 'Suggested']);

    // ---- 2. typing switches to scored `items` results — defaultItems gone ----
    await input.pressSequentially('folder', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('Open folder');

    // ---- 3. clearing the query RESTORES the root defaultItems + groups ----
    await input.fill('');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(3);
    await expect.poll(async () => groupHeadingTexts(page), { timeout: 10_000 }).toEqual(['Recent', 'Suggested']);

    // ---- 4. PUSH the navigating item carrying its OWN defaultItems: shows ----
    //         its 2-item home view IMMEDIATELY — NOT the async pool's 3
    //         entries — proving source('') was never invoked on push.
    await input.pressSequentially('users', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await page.locator('[role="option"]', { hasText: 'Find users' }).click();
    await expect(breadcrumbTitle).toHaveText('Find users');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(2);

    // ---- 5. typing a real query on the pushed level runs the async source ----
    await input.pressSequentially('grace', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await expect(page.locator('[role="option"]').first()).toContainText('Grace Hopper');

    // ---- 6. clearing the query on the pushed level restores ITS defaultItems ----
    await input.fill('');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(2);

    // ---- cleanup: Escape pops the level, Escape closes the palette ----
    await page.keyboard.press('Escape');
    await expect(breadcrumbTitle).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });
}
