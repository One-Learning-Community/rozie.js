import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  deepQuerySelectorAllCount,
  deepQuerySelectorAllTextInPage,
  deepActiveElementProbeInPage,
  type DeepActiveElementMenuItemInfo,
} from './_shadow-utils';

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
  return deepQuerySelectorAllCount(page, `[role="${role}"]`);
}

/**
 * The deepest REAL `document.activeElement`, recursively walking open shadow
 * roots (the CommandPalette.rozie `deepActiveElement` precedent, mirrored
 * here for the spec) — `{ role, disabled }` off it, or null when nothing is
 * focused. Used to prove real-focus arbitration (ACT-ARBITRATION): the
 * action menu takes ACTUAL DOM focus, not just an `aria-activedescendant`
 * pointer.
 */
async function activeMenuItemInfo(page: Page): Promise<DeepActiveElementMenuItemInfo | null> {
  return page.evaluate(deepActiveElementProbeInPage, 'menuitem') as Promise<DeepActiveElementMenuItemInfo | null>;
}

/** The deepest REAL active element's trimmed text content (shadow-piercing). */
async function activeElementText(page: Page): Promise<string> {
  return page.evaluate(deepActiveElementProbeInPage, 'text') as Promise<string>;
}

/**
 * Count elements matching `.<className>`, RECURSIVELY piercing every open
 * shadow root — reused below for the retired per-row group badge
 * (`.rozie-command-palette-option-group`, cp-adopts-combobox-groups).
 */
async function countByClass(page: Page, className: string): Promise<number> {
  return deepQuerySelectorAllCount(page, `.${className}`);
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
 *
 * NOT migrated to _shadow-utils.ts (quick 260716-npt Fix C): the `collect`
 * walker below is entangled with FURTHER `elementFromPoint`/geometry
 * computation in the SAME evaluate call — it does not fit the shared
 * "walk, return a serializable value" primitives cleanly.
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
 * Shadow-piercing hit-test at the `.rozie-command-palette-frame`'s OWN
 * bottom-center: true iff that point actually PAINTS the frame (visible
 * there), false iff the frame is clipped away / covered. The clipped-ancestor
 * proof (command-palette-portal-appendTo-escape): with `appendTo:false` the
 * frame is TALLER than the deliberately-tiny 160px clipping ancestor, so its
 * bottom overflows and is CLIPPED by the ancestor's `overflow:hidden`
 * (hit=false); portalled to `body` the SAME frame paints fully (hit=true). A
 * plain bounding-box "bounded" check cannot tell "laid out beyond the clip"
 * from "actually hidden by it" — this can, and it is the real regression guard
 * for the containing-block trap.
 */
async function frameBottomVisible(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const find = (root: Document | ShadowRoot): Element | null => {
      const direct = root.querySelector('[data-testid="command-palette-frame"]');
      if (direct) return direct;
      for (const el of Array.from(root.querySelectorAll('*'))) {
        const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
        if (sr) {
          const f = find(sr);
          if (f) return f;
        }
      }
      return null;
    };
    const frame = find(document);
    if (!frame) return false;
    const r = frame.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.bottom - 4;
    if (y > window.innerHeight || y < 0 || x < 0 || x > window.innerWidth) return false;
    let el: Element | null = document.elementFromPoint(x, y);
    while (el && (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot) {
      const inner = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot!.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    // Shadow-INCLUSIVE containment: on Lit the frame's content (the vendored
    // combobox list) lives in a NESTED shadow root, so `frame.contains(el)`
    // returns false across the shadow boundary. Walk el's ancestor chain,
    // crossing shadow-host boundaries (shadowRoot → host), to see if `frame`
    // is an ancestor — the same shadow-pierce discipline as the deep* helpers.
    let node: (Node & { host?: Element }) | null = el;
    while (node) {
      if (node === frame) return true;
      node = node.parentNode ?? (node as unknown as ShadowRoot).host ?? null;
    }
    return false;
  });
}

/**
 * The trimmed text content of every combobox group-heading element
 * (`.rozie-combobox-group-heading`), in DOM order, RECURSIVELY piercing
 * every open shadow root — cp-adopts-combobox-groups' section-heading proof.
 */
async function groupHeadingTexts(page: Page): Promise<string[]> {
  return page.evaluate(deepQuerySelectorAllTextInPage, '.rozie-combobox-group-heading');
}

/**
 * command-palette-per-level-virtual (FD-01 resolved — combobox-virtual-
 * reactivity, commits 6fd84251+afa0a7ec, made the vendored combobox's
 * `virtual` prop live-flippable at runtime). Drives the demo's THIRD,
 * self-contained palette (`open-virtual-palette` / `virtualOpen` /
 * `virtualQuery`), which the four suites above never touch. Its root
 * (`VIRTUAL_ROOT_ITEMS`) is GROUPED ('File'/'Edit') and non-virtual; its one
 * navigating item (`v-goto-many`) carries `virtual: true` +
 * `virtualMaxHeight`/`virtualEstimateRowHeight` and 60 static `children`.
 * Asserts: (1) the pushed virtual level WINDOWS — the combobox renders its
 * windowed `<ul>` branch (2 `.rozie-combobox-spacer` elements) and the
 * rendered `role="option"` count is strictly less than the full 60-item
 * list; (2) the pushed level renders FLAT — 0 group headings, the vendored
 * combobox's `isGrouped` requiring `!virtual` (the per-level caveat); (3)
 * popping back restores the grouped, non-virtual root — 0 spacer elements,
 * the 2 File/Edit headings again, and the full 4-item root count.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-per-level-virtual [${target}]: pushed virtual level windows + flattens, pop restores grouped non-virtual root`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openBtn = page.getByTestId('open-virtual-palette');
    const breadcrumbTitle = page.getByTestId('command-palette-title');

    // ---- 1. open at root: 4 items, GROUPED (File/Edit), non-virtual (0 ----
    //         spacer elements — the plain `<ul>` branch, not the windowed one).
    await openBtn.click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(4);
    await expect.poll(async () => groupHeadingTexts(page), { timeout: 10_000 }).toEqual(['File', 'Edit']);
    await expect
      .poll(async () => countByClass(page, 'rozie-combobox-spacer'), { timeout: 10_000 })
      .toBe(0);

    // ---- 2. PUSH the virtual level: `v-goto-many` (virtual:true, 60 static ----
    //         children) — windows (2 spacer elements + a rendered option count
    //         strictly less than 60) AND flattens (0 group headings — the
    //         flat-render caveat, combobox-side `isGrouped requires !virtual`).
    await page.locator('[role="option"]', { hasText: 'Browse many' }).click();
    await expect(breadcrumbTitle).toHaveText('Browse many');
    await expect
      .poll(async () => countByClass(page, 'rozie-combobox-spacer'), { timeout: 10_000 })
      .toBe(2);
    const windowedCount = await countOptions(page);
    expect(windowedCount).toBeGreaterThan(0);
    expect(windowedCount).toBeLessThan(60);
    await expect.poll(async () => groupHeadingTexts(page), { timeout: 10_000 }).toEqual([]);

    // ---- 3. POP via Backspace-on-empty: restores the grouped, non-virtual ----
    //         root — 0 spacer elements, the 2 File/Edit headings again, and
    //         the full 4-item root count (the per-level caveat, honestly
    //         bidirectional — nothing is lost popping OUT of a virtual level).
    await page.keyboard.press('Backspace');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(4);
    await expect(breadcrumbTitle).toHaveCount(0);
    await expect.poll(async () => groupHeadingTexts(page), { timeout: 10_000 }).toEqual(['File', 'Edit']);
    await expect
      .poll(async () => countByClass(page, 'rozie-combobox-spacer'), { timeout: 10_000 })
      .toBe(0);

    // ---- cleanup: close the palette ----
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
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

    // ---- finding-2 (260715-50l): the default #breadcrumb fill renders the ----
    //         FULL root..current trail (root ancestor + current), not just a
    //         bare `‹` + the current title. At depth 1, breadcrumbStack() =
    //         [{title: ariaLabel}, {title:'Go to page'}] — 2 segments, 1
    //         separator, current segment = 'Go to page' (mirrors
    //         breadcrumbTitle above, which still targets the SAME element via
    //         `command-palette-title` on the current segment only).
    const trail = page.getByTestId('command-palette-breadcrumb-trail');
    await expect(trail).toBeVisible();
    await expect(trail.locator('.rozie-command-palette-breadcrumb-segment')).toHaveCount(2);
    await expect(trail.locator('.rozie-command-palette-breadcrumb-separator')).toHaveCount(1);
    await expect(trail.locator('.rozie-command-palette-breadcrumb-segment--current')).toHaveText('Go to page');

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

    // ---- 9. 260715-uz1: breadcrumb ANCESTOR segment click-to-jump. This demo's ----
    //         two navigable levels (`goto`'s static children, `search-users`'s
    //         async source) are both leaf-only one level deep, so depth 1 is the
    //         max reachable here — the single ancestor segment at depth 1 is
    //         always the ROOT (index 0, the `ariaLabel` title). That still fully
    //         exercises the LOCKED N-T=1 contract (one `@back` per popped level,
    //         byte-identical to one Backspace) end-to-end through the DOM click
    //         path; the deeper N-T>1 pop-chain shape is unit-proven directly
    //         against the pure reducer (levelStack.test.ts's popFrame coverage)
    //         and the compile-output test (breadcrumb-jump.test.ts).
    //         Type a DISTINGUISHING query first so the jump's restore-on-pop is
    //         observable (not just '' -> '').
    await input.pressSequentially('ada', { delay: 30 });
    await expect
      .poll(async () => (await readoutQuery.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('ada');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);

    const backCountBeforeJump = Number((await readoutBackCount.textContent())?.trim() ?? '0');
    const jumpBtn = page.getByTestId('command-palette-breadcrumb-jump').first();
    await expect(jumpBtn).toBeVisible();
    // The ancestor button carries the "Back to <title>" aria-label — the demo's
    // root title is its ariaLabel ("Command palette").
    await expect(jumpBtn).toHaveAttribute('aria-label', 'Back to Command palette');
    await jumpBtn.click();

    // (a) breadcrumb collapses to the clicked (root) depth — at depth 0 the
    //     header is not rendered at all, so `command-palette-title` has no
    //     match (the same shape steps 3/6 assert for a pop-to-root).
    await expect(breadcrumbTitle).toHaveCount(0);
    // (b) readout-back-count increased by EXACTLY 1 — one `@back` per popped
    //     level (N-T=1 here), proving the click path fires the same emit
    //     shape a physical Backspace would.
    await expect(readoutBackCount).toHaveText(String(backCountBeforeJump + 1));
    // (c) readout-query restored to the root tier's query — '' (the query in
    //     effect just before `search-users` was pushed via openTo).
    await expect
      .poll(async () => (await readoutQuery.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('');
    await expect(input).toHaveValue('');
    // (d) the jump did NOT commit a command and did NOT leave the popup
    //     stuck-closed — the root list (8 items) is visible again and real
    //     DOM focus landed back on the search input (reopenComboboxPopup's
    //     reused restore path, the same invariant proven at L556-569 for the
    //     sub-actions Escape-close case).
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(8);
    await expect
      .poll(async () => activeMenuItemInfo(page), { timeout: 10_000 })
      .toEqual({ role: 'combobox', disabled: false });
    // (e) the CURRENT segment stays a non-interactive span, never a button —
    //     at root the whole header is gone, so there is no
    //     `command-palette-breadcrumb-jump` element left in the DOM at all.
    await expect(page.getByTestId('command-palette-breadcrumb-jump')).toHaveCount(0);
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

/**
 * command-palette-portal-appendTo-escape (command-palette-portal-overlay
 * phase) — the clipped-ancestor escape proof. `examples/demos/
 * CommandPaletteClippedDemo.rozie` wraps the palette in an
 * `overflow: hidden; transform: translateZ(0)` ancestor — a CONTAINING
 * BLOCK (transform) for the palette's `position: fixed` overlay AND a clip
 * region (overflow). With `appendTo: false` (default) the overlay's
 * containing block IS that ancestor, so its rect is bounded by the
 * ancestor's small box; `r-portal` disabled (falsy container) — the bug,
 * reproduced on purpose. Toggling `appendTo` to `'body'` relocates the
 * overlay to `document.body`, whose containing block is the viewport — the
 * SAME overlay markup now escapes the ancestor's box entirely — the fix.
 *
 * Gated on the batched Linux Docker VR union run that closes the 0.4.0
 * series (per `feedback_vr_linux_baselines` / Dan's "wait to do expensive
 * testing like vr until the end") — authored here, not executed in this
 * phase.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-portal-appendTo-escape [${target}]: appendTo:false is bounded by the clipping ancestor; appendTo:'body' escapes it`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteClipped&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openBtn = page.getByTestId('clipped-open-palette');
    const toggleBtn = page.getByTestId('clipped-toggle-append-to');
    const appendToReadout = page.getByTestId('clipped-append-to-readout');
    const ancestor = page.getByTestId('clipping-ancestor');
    const frame = page.getByTestId('command-palette-frame');

    // ---- 1. appendTo:false (default) — the overlay's containing block IS ----
    //         the clipping ancestor (its `transform` creates one for the
    //         fixed-position overlay), so the frame is HORIZONTALLY bounded by
    //         (and TOP-anchored inside) the ancestor's small box. The frame's
    //         own content (search + the 4-item list) is TALLER than the
    //         deliberately-tiny 160px ancestor, so it overflows the ancestor's
    //         clip region downward and its bottom is CLIPPED AWAY by
    //         `overflow:hidden` — the reproduced bug (this demo's whole point,
    //         per its header comment). A plain layout-box "bottom bounded"
    //         check is WRONG here: the frame is TRAPPED + CLIPPED, not shrunk
    //         to fit — so we prove the trap (horizontal containment) AND the
    //         clip (overflow + a real hit-test), which a fitted frame fails.
    const input = page.locator('input[role="combobox"]').first();
    await openBtn.click();
    await expect(frame).toBeVisible({ timeout: 15_000 });
    // Wait for the FULL 4-item list to render before measuring — the frame
    // becomes visible with just the search input a frame before the options
    // paint, and the clip proof (b)/(c) depends on the frame being taller than
    // the 160px ancestor, which only holds once the list is present.
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(4);
    const ancestorBox = await ancestor.boundingBox();
    const clippedFrameBox = await frame.boundingBox();
    expect(ancestorBox).not.toBeNull();
    expect(clippedFrameBox).not.toBeNull();
    // (a) containing block IS the ancestor: horizontally within it, top-anchored.
    expect(clippedFrameBox!.x).toBeGreaterThanOrEqual(ancestorBox!.x - 1);
    expect(clippedFrameBox!.y).toBeGreaterThanOrEqual(ancestorBox!.y - 1);
    expect(clippedFrameBox!.x + clippedFrameBox!.width).toBeLessThanOrEqual(
      ancestorBox!.x + ancestorBox!.width + 1,
    );
    // (b) the frame is TALLER than the clip region — it overflows the
    //     ancestor's bottom (a fitted, non-trapped frame would not).
    expect(clippedFrameBox!.y + clippedFrameBox!.height).toBeGreaterThan(
      ancestorBox!.y + ancestorBox!.height + 1,
    );
    // (c) and that overflow is ACTUALLY CLIPPED: the frame's own bottom-center
    //     is not hittable (the ancestor's overflow:hidden hides it).
    expect(await frameBottomVisible(page)).toBe(false);

    // ---- 2. Toggle appendTo → 'body' WHILE THE PALETTE STAYS OPEN — the ----
    //         SAME live overlay node relocates out of the clipping ancestor to
    //         document.body, escaping the clip entirely (the fix). This test's
    //         contract is clip-vs-escape, which the live relocate proves
    //         directly (you SEE the open palette jump out of the clip), so it
    //         toggles while open by design. (The close→reopen r-if node-recreate
    //         that the old Lit `@query(cache: true)` binding could not follow is
    //         now FIXED by the SENTINEL-NODE design — uncached element + sentinel
    //         queries under `RoziePortalController`; the natural close→remove is
    //         asserted in the cleanup below and in the runtime-lit controller
    //         close→reopen unit test.)
    await toggleBtn.click();
    await expect(appendToReadout).toHaveText('body');
    // The relocate is a MOVE (detach + reattach), which blurs the focused input
    // and collapses the combobox popup; re-focus to bring the full-height list
    // back so the escaped frame is measured under the SAME condition as the
    // clipped one.
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(4);
    await expect(frame).toBeVisible({ timeout: 15_000 });
    const escapedFrameBox = await frame.boundingBox();
    expect(escapedFrameBox).not.toBeNull();
    const escapes =
      escapedFrameBox!.x < ancestorBox!.x - 1 ||
      escapedFrameBox!.y < ancestorBox!.y - 1 ||
      escapedFrameBox!.x + escapedFrameBox!.width > ancestorBox!.x + ancestorBox!.width + 1 ||
      escapedFrameBox!.y + escapedFrameBox!.height > ancestorBox!.y + ancestorBox!.height + 1;
    expect(escapes).toBe(true);
    // The complement of the trapped (c): portalled to `body`, the SAME frame is
    // no longer inside the clipping ancestor, so its bottom-center now paints
    // the frame (fully visible — the clip is gone). This is the live proof the
    // portal UN-clips, not merely that the box moved.
    expect(await frameBottomVisible(page)).toBe(true);

    await input.focus();
    await waitListRefocused(page);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);

    // SEV-1 close-while-portalled zombie fix (SENTINEL-NODE): with
    // appendTo:'body' the overlay was relocated into document.body's LIGHT DOM;
    // closing (r-if → false) must REMOVE it. Before the fix, Lit's ChildPart
    // clear could not reach the moved node and it lingered forever as a
    // pointer-capturing backdrop. Assert no portalled overlay survives — a
    // light-DOM `.rozie-command-palette` whose root node is `document` (i.e. NOT
    // inside any component shadow root, so it is a teleported overlay, not an
    // in-place shadow render). Uniform across all six targets: every target's
    // native teleport removes the node on close; Lit is the one this fix
    // repairs.
    const zombieOverlays = await page.evaluate(() =>
      Array.from(document.body.querySelectorAll('.rozie-command-palette')).filter(
        (el) => el.getRootNode() === document,
      ).length,
    );
    expect(zombieOverlays).toBe(0);
  });
}

/**
 * command-palette-portal-through-portal (command-palette-portal-overlay
 * phase) — proves the levels Escape funnel, the action-menu real-focus
 * arbitration, the breadcrumb header, and the frame-relative flyout anchor
 * (finding 1) ALL still work THROUGH the portal, with `appendTo: 'body'`
 * active the entire test — not just in-place mode. This is the "proven, not
 * rewritten" claim: CommandPalette.rozie roots every DOM read at
 * `$refs.panel`/`$refs.frame` (never `$el`), so a moved node's ref identity
 * survives the teleport with zero logic changes (verified live here, not
 * merely asserted in a comment).
 *
 * Gated on the batched Linux Docker VR union run — authored here, not
 * executed in this phase.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-portal-through-portal [${target}]: levels Escape funnel, action-menu real focus, flyout anchor — all through appendTo:'body'`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteClipped&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openBtn = page.getByTestId('clipped-open-palette');
    const toggleBtn = page.getByTestId('clipped-toggle-append-to');
    const appendToReadout = page.getByTestId('clipped-append-to-readout');
    const readoutNavigate = page.getByTestId('clipped-readout-navigate');
    const readoutDepth = page.getByTestId('clipped-readout-depth');
    const readoutBackCount = page.getByTestId('clipped-readout-back-count');
    const readoutActionItem = page.getByTestId('clipped-readout-action-item');
    const readoutAction = page.getByTestId('clipped-readout-action');
    const breadcrumbTitle = page.getByTestId('command-palette-title');

    // ---- portal the overlay to document.body BEFORE opening it ----
    await toggleBtn.click();
    await expect(appendToReadout).toHaveText('body');

    // ---- 1. open at root: 4 items, no breadcrumb ----
    await openBtn.click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(4);
    await expect(breadcrumbTitle).toHaveCount(0);

    // ---- 2. PUSH a level (selecting `goto`, a static-children navigating ----
    //         item) — the breadcrumb header renders, @navigate fires,
    //         depth becomes 1. Proven while the overlay lives in
    //         document.body — the breadcrumb (a $refs.panel-rooted child)
    //         must still render correctly.
    await input.pressSequentially('go', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await page.locator('[role="option"]', { hasText: 'Go to page' }).click();
    await expect(breadcrumbTitle).toHaveText('Go to page');
    await expect
      .poll(async () => (await readoutNavigate.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('goto');
    await expect(readoutDepth).toHaveText('1');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(2);

    // ---- 3. Escape AT DEPTH>0 pops ONE level — does NOT close the palette ----
    //         (resolveEscape's depth-aware funnel, unmodified, now running
    //         against a node relocated to document.body). goBack() RESTORES
    //         the snapshotted parent query 'go' — BOTH the model AND the
    //         combobox's VISIBLE input text (seedQuery — the documented "full
    //         query undo", proven by the command-palette-levels test) — so the
    //         restored 'go' re-filters the ROOT list back down to the single
    //         matching command ("Go to page…"), count 1. This proves the pop
    //         returned to ROOT (breadcrumb gone) AND that query-undo drove the
    //         pipeline THROUGH the portal, not just the model.
    await page.keyboard.press('Escape');
    await expect(breadcrumbTitle).toHaveCount(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    await expect(input).toHaveValue('go');
    await expect(readoutBackCount).toHaveText('1');

    // Pace past reopenComboboxPopup's blur→rAF focus boundary, then clear the
    // restored 'go' — the cleared ROOT shows the FULL 4-item set (the
    // through-portal root-count proof) and gives the action-menu step below a
    // clean input to filter from (mirrors the levels test's input.fill('')
    // between tiers — otherwise 'new' would append onto 'go').
    await waitListRefocused(page);
    await input.fill('');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(4);

    // ---- 4. action-menu real-focus arbitration + the frame-relative ----
    //         flyout anchor (finding 1) — isolate the `new` row (carries
    //         actions), open the menu, assert REAL DOM focus lands in a
    //         menuitem (shadow-piercing document.activeElement walk) and
    //         the flyout is fully hittable at its own last-item center
    //         (deepHitAtLastMenuItem — a plain bounding-box check alone
    //         cannot distinguish "clipped but sized" from "visible").
    await input.pressSequentially('new', { delay: 30 });
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(1);
    // Park the mouse in a neutral corner BEFORE opening the action menu. The
    // menu items carry `@mouseenter="actionIndex = ai"` (hover-roving), so a
    // cursor left over the flyout area from a prior click would fire mouseenter
    // on whichever item renders under it when the menu opens — desyncing the
    // hover-roving index from the keyboard focus and making Enter select the
    // HOVERED action (flakily 'duplicate') instead of the keyboard-focused
    // first one. This isolates the KEYBOARD action-menu flow the test asserts;
    // it does not change product behavior.
    await page.mouse.move(2, 2);
    await page.keyboard.press('ControlOrMeta+k');
    await expect.poll(async () => countByRole(page, 'menuitem'), { timeout: 10_000 }).toBe(2);
    await expect
      .poll(async () => activeMenuItemInfo(page), { timeout: 10_000 })
      .toEqual({ role: 'menuitem', disabled: false });
    await expect.poll(async () => deepHitAtLastMenuItem(page), { timeout: 10_000 }).toBe(true);
    // keepOpen: the result list stays visible while the menu holds focus.
    await expect(countOptions(page)).resolves.toBe(1);

    // Pace past the menu-open roving/focus settle: confirm the FIRST action
    // ('Rename') is the STABLY deeply-focused menuitem before Enter. The
    // generic activeMenuItemInfo poll above only proves "a menuitem is
    // focused" — on Lit the open-focus rAF can transiently land on a sibling,
    // so an immediate Enter occasionally fired 'duplicate'. Asserting the
    // SPECIFIC active item removes that race (and is a stronger real-focus
    // arbitration proof: the menu opens on its first enabled action).
    await expect
      .poll(async () => activeElementText(page), { timeout: 10_000 })
      .toContain('Rename');

    // ---- 5. Enter fires @action-select through the portal ----
    await page.keyboard.press('Enter');
    await expect
      .poll(async () => (await readoutActionItem.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('new');
    await expect
      .poll(async () => (await readoutAction.textContent())?.trim() ?? '', { timeout: 10_000 })
      .toBe('rename');

    // ---- cleanup ----
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });
}

/**
 * command-palette-portal-token-resolution (command-palette-portal-overlay
 * phase, PORTAL-THEME) — a `--rozie-command-palette-*` custom property set
 * on `:root` must resolve through the portal on ALL SIX targets. Lit is the
 * explicit hazard cell: the relocated element leaves `static styles`'
 * `shadowRoot.adoptedStyleSheets` reach, so `emitStyle.ts` additionally
 * pushes the component's own scoped CSS through `injectGlobalStyles`
 * whenever `r-portal` is in use (see the compiler docs' Lit theming-hazard
 * note) — this test is the live proof that mechanism actually resolves the
 * token, not just that the CSS text exists somewhere.
 *
 * Gated on the batched Linux Docker VR union run — authored here, not
 * executed in this phase.
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-portal-token-resolution [${target}]: a :root-set --rozie-command-palette-backdrop-bg resolves through the portal`, async ({
    page,
  }) => {
    // A :root-set token, injected BEFORE navigation so it's present on the
    // very first paint (mirrors how a real consumer app sets theming tokens
    // globally, not scoped to any single component's host).
    await page.addStyleTag({
      content: ':root { --rozie-command-palette-backdrop-bg: rgb(1, 2, 3); }',
    });
    await page.goto(`/?example=CommandPaletteClipped&target=${target}`);
    // Re-apply after navigation — `addStyleTag` before `goto` does not
    // survive a full page navigation in every browser/target harness
    // configuration; belt-and-suspenders for a token that MUST be present
    // at open time.
    await page.addStyleTag({
      content: ':root { --rozie-command-palette-backdrop-bg: rgb(1, 2, 3); }',
    });
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const openBtn = page.getByTestId('clipped-open-palette');
    const toggleBtn = page.getByTestId('clipped-toggle-append-to');
    const appendToReadout = page.getByTestId('clipped-append-to-readout');

    await toggleBtn.click();
    await expect(appendToReadout).toHaveText('body');
    await openBtn.click();
    await expect(page.getByTestId('command-palette-frame')).toBeVisible({ timeout: 15_000 });

    // The backdrop is the r-portal HOST element itself (`.rozie-command-palette`,
    // the div carrying both r-if and r-portal) — read its computed
    // background-color, shadow-piercing (Lit: light-DOM after relocation,
    // but still reachable via a plain recursive walk since it is no longer
    // inside any shadow root once portalled).
    const backdropBg = await page.evaluate(() => {
      const find = (root: Document | ShadowRoot): Element | null => {
        const direct = root.querySelector('.rozie-command-palette');
        if (direct) return direct;
        for (const el of Array.from(root.querySelectorAll('*'))) {
          const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
          if (sr) {
            const found = find(sr);
            if (found) return found;
          }
        }
        return null;
      };
      const el = find(document);
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    expect(backdropBg).toBe('rgb(1, 2, 3)');

    // Focus the search input and settle before the closing Escape: on the
    // Linux Docker harness the combobox autofocus lands a frame later than an
    // immediate keypress, so an un-paced Escape would land on <body> (outside
    // onPanelKeydown's funnel) and be lost — the documented rAF focus-boundary
    // hazard (waitListRefocused), NOT a behavior change. (Passes locally on
    // every target un-paced; this hardens the Docker cell that flaked.)
    const closeInput = page.locator('input[role="combobox"]').first();
    await closeInput.focus();
    await waitListRefocused(page);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });
}

/**
 * The trimmed `placeholder` attribute of the deepest REAL active element
 * (shadow-piercing, the `activeMenuItemInfo`/`deepActiveElement` precedent
 * mirrored here) — used to identify WHICH args field currently holds real
 * DOM focus (each field's placeholder is distinct: 'Page name' vs
 * 'Template' vs 'Search pages' on the CommandPaletteArgsDemo item set).
 */
async function deepActiveElementPlaceholder(page: Page): Promise<string | null> {
  return page.evaluate(deepActiveElementProbeInPage, 'placeholder') as Promise<string | null>;
}

/**
 * After a panel-internal sub-surface closes (closeArgsSurface /
 * closeActionMenu → reopenComboboxPopup), focus returns to the combobox
 * search input via a rAF: reopenComboboxPopup `blur()`s the current node THEN
 * `requestAnimationFrame(focusInput)`. A palette-closing Escape fired during
 * that blur→rAF gap lands on `<body>` (outside the frame's onPanelKeydown
 * funnel) and is silently lost — a synthetic-input pacing hazard (countOptions
 * stays 3 across the whole transition, so it cannot gate this). Wait for the
 * search input ('Type a command…') to regain real focus before the closing
 * Escape — pacing past the documented rAF boundary, NOT a behavior change.
 */
async function waitListRefocused(page: Page): Promise<void> {
  await expect
    .poll(async () => deepActiveElementPlaceholder(page), { timeout: 10_000 })
    .toBe('Type a command…');
}

/**
 * command-palette-inline-args (feature #12) — the panel-internal args
 * surface. `examples/demos/CommandPaletteArgsDemo.rozie` drives a dedicated
 * item set: `create-page` (a required `name` + a `default`-prefilled
 * `template`), `save` (argless — non-regression), and `go-to-page` (carries
 * BOTH `source` and `args` — proving args wins, the source is never
 * reached). Authored to gate the batched Linux Docker VR union run that
 * closes the 0.4.0 series — NOT executed in this phase
 * (`feedback_vr_linux_baselines` / Dan's "wait to do expensive testing like
 * vr until the end").
 */
for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`command-palette-args-auto-entry [${target}]: selecting an args item renders the chip + fields, focuses the first field, dims the list`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteArgs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('args-open-palette').click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(3);

    await page.locator('[role="option"]', { hasText: 'Create page' }).click();

    const argsSurface = page.locator('[data-testid="command-palette-args"]');
    await expect(argsSurface).toBeVisible({ timeout: 10_000 });
    await expect(argsSurface).toHaveAttribute('role', 'group');
    await expect(page.getByTestId('command-palette-args-chip')).toHaveText('Create page');

    // Real DOM focus lands in the FIRST field ('Page name'), not merely an
    // aria-activedescendant pointer.
    await expect
      .poll(async () => deepActiveElementPlaceholder(page), { timeout: 10_000 })
      .toBe('Page name');

    // The result list stays visibly open (keepOpen) but is now inert +
    // aria-hidden.
    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const find = (root: Document | ShadowRoot): Element | null => {
              const direct = root.querySelector('.rozie-command-palette-list-region');
              if (direct) return direct;
              for (const el of Array.from(root.querySelectorAll('*'))) {
                const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
                if (sr) {
                  const found = find(sr);
                  if (found) return found;
                }
              }
              return null;
            };
            return find(document)?.getAttribute('aria-hidden') ?? null;
          }),
        { timeout: 10_000 },
      )
      .toBe('true');

    // No @select yet.
    await expect(page.getByTestId('args-readout-select-item')).toHaveText('');

    // Escape from the args surface returns to the LIST (closeArgsSurface —
    // resolveEscape 'close-surface'); it does NOT close the palette. A SECOND
    // Escape at the (depth-0) list closes it. Same two-step teardown as
    // escape-restore below — the `command-palette-args` toHaveCount(0) gate is
    // load-bearing: countOptions stays 3 whether the list is dimmed (args open)
    // or restored, so it does NOT signal the transition; the surface-gone
    // assertion waits for closeArgsSurface + reopenComboboxPopup to settle
    // before the second Escape.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette-args')).toHaveCount(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(3);
    await waitListRefocused(page);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });

  runner(`command-palette-args-submit [${target}]: Enter with every required field filled emits the trimmed, additive args payload`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteArgs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('args-open-palette').click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(3);

    await page.locator('[role="option"]', { hasText: 'Create page' }).click();
    await expect(page.getByTestId('command-palette-args')).toBeVisible({ timeout: 10_000 });

    // Wait for the rAF-deferred focus to land in the first field before
    // typing, so the subsequent Enter is funneled from within the surface.
    await expect
      .poll(async () => deepActiveElementPlaceholder(page), { timeout: 10_000 })
      .toBe('Page name');

    const fields = page.locator('[data-command-palette-args] input');
    await fields.nth(0).fill('  My Page  ');
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('args-readout-select-item')).toHaveText('create-page');
    await expect
      .poll(async () => (await page.getByTestId('args-readout-select-args').textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe(JSON.stringify({ name: 'My Page', template: 'blank' }));

    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });

  runner(`command-palette-args-required-block [${target}]: Enter with the required field empty does NOT emit and refocuses it`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteArgs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('args-open-palette').click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(3);

    await page.locator('[role="option"]', { hasText: 'Create page' }).click();
    await expect(page.getByTestId('command-palette-args')).toBeVisible({ timeout: 10_000 });

    // Wait for the rAF-deferred focus to land before pressing Enter, so the
    // Enter is funneled from within the surface (submitArgs' required-gate).
    await expect
      .poll(async () => deepActiveElementPlaceholder(page), { timeout: 10_000 })
      .toBe('Page name');

    await page.keyboard.press('Enter');

    await expect(page.getByTestId('args-readout-select-item')).toHaveText('');
    await expect
      .poll(async () => deepActiveElementPlaceholder(page), { timeout: 10_000 })
      .toBe('Page name');

    // Two-step teardown: Escape → list (3), Escape → closed (0). The
    // surface-gone gate (see auto-entry) synchronizes the transition.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette-args')).toHaveCount(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(3);
    await waitListRefocused(page);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });

  runner(`command-palette-args-escape-restore [${target}]: Escape closes the args surface and restores the interactive list`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteArgs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('args-open-palette').click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(3);

    await page.locator('[role="option"]', { hasText: 'Create page' }).click();
    await expect(page.getByTestId('command-palette-args')).toBeVisible({ timeout: 10_000 });

    // Wait for the rAF-deferred focus to land in the surface before Escape.
    await expect
      .poll(async () => deepActiveElementPlaceholder(page), { timeout: 10_000 })
      .toBe('Page name');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette-args')).toHaveCount(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(3);

    await waitListRefocused(page);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });

  runner(`command-palette-args-backspace-empty [${target}]: Backspace on the empty first field returns to the list`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteArgs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('args-open-palette').click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(3);

    await page.locator('[role="option"]', { hasText: 'Create page' }).click();
    await expect(page.getByTestId('command-palette-args')).toBeVisible({ timeout: 10_000 });

    // Backspace-on-empty-first-field pops back to the list ONLY when the
    // keydown originates from the first field (onPanelKeydown gates on
    // e.target === firstInput). Focus is rAF-deferred, so wait for it to land.
    await expect
      .poll(async () => deepActiveElementPlaceholder(page), { timeout: 10_000 })
      .toBe('Page name');

    await page.keyboard.press('Backspace');
    await expect(page.getByTestId('command-palette-args')).toHaveCount(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(3);

    await waitListRefocused(page);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });

  runner(`command-palette-args-source-wins [${target}]: a source+args item enters the args surface — source is never reached`, async ({
    page,
  }) => {
    await page.goto(`/?example=CommandPaletteArgs&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    await page.getByTestId('args-open-palette').click();
    const input = page.locator('input[role="combobox"]').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.focus();
    await expect.poll(async () => countOptions(page), { timeout: 15_000 }).toBe(3);

    await page.locator('[role="option"]', { hasText: 'Go to page' }).click();
    await expect(page.getByTestId('command-palette-args')).toBeVisible({ timeout: 10_000 });
    // The nested source item never renders — args won, no child level pushed.
    await expect(page.getByTestId('command-palette-title')).toHaveCount(0);

    // Wait for the rAF-deferred focus to land in the (required) 'Search pages'
    // field before Escape, then use the design's two-step teardown
    // (Escape → list, Escape → closed).
    await expect
      .poll(async () => deepActiveElementPlaceholder(page), { timeout: 10_000 })
      .toBe('Search pages');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('command-palette-args')).toHaveCount(0);
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(3);
    await waitListRefocused(page);
    await page.keyboard.press('Escape');
    await expect.poll(async () => countOptions(page), { timeout: 10_000 }).toBe(0);
  });
}
