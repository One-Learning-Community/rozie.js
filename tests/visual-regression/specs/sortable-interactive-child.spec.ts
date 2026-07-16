import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * sortable-interactive-child — slotted-interactive-child keyboard hijack
 * regression for SortableList (quick 260716-ggq).
 *
 * The row-level `@keydown="onRowKeyDown($event, index)"` handler previously
 * ran on ANY keydown that reached the row — including one that BUBBLED UP
 * from an interactive element (an `<input>`, `<button>`, etc.) rendered into
 * the row's default slot. Because Space/Enter both call `preventDefault()`
 * inside `onRowKeyDown`, typing a space into a slotted `<input>` never
 * reached the input's own value — the row hijacked it for lift/drop instead.
 *
 * The fix is an origin guard as the FIRST line of `onRowKeyDown`:
 *   if ($event.target !== $event.currentTarget) return
 * Reorder keys now apply only when the row element ITSELF is focused;
 * keystrokes bubbling up from a slotted child fall through untouched.
 *
 * This spec is STRUCTURAL-only (no screenshot matchers — runs on macOS
 * without Docker baselines) and asserts three things per target:
 *   (1) SLOTTED-CHILD RECEIVES KEYS — focus the first row's `<input>`, press
 *       Space, assert the input's own value now contains a space. This is
 *       RED against the pre-fix build (the row's preventDefault swallows it).
 *   (2) NO LIFT OCCURRED — the aria-live announcer does NOT mention a lift
 *       and no row carries the `-lifted` class. Also RED pre-fix (the row
 *       handler ran and lifted the row).
 *   (3) ROW-FOCUS SANITY (intact behavior) — focus the ROW element itself
 *       (not the input), press Space, assert aria-live NOW announces a lift.
 *       This proves the origin guard does not disable reordering outright.
 *       Escape afterward resets state so it does not leak across assertions.
 *
 * ── CONVENTIONS (mirrors sortable-drag-keyboard.spec.ts) ────────────────────
 *   - 6-target loop with the `existsSync(dist/<t>/host/entry.<t>.html)`
 *     build-availability gate + `test.fixme` fallback.
 *   - STRUCTURAL assertions only.
 *   - Substring locators (`[class*="..."]`) pierce the Lit target's shadow
 *     DOM (Playwright Locators pierce shadow roots by default).
 *   - `KNOWN_FAILING` starts as an empty `ReadonlySet<Target>`.
 *
 * ── FOCUS-IN-SHADOW-DOM PATTERN ──────────────────────────────────────────────
 * Lit emits a custom element with a shadow root; `document.activeElement` on
 * the host returns the host element, not the focused row/input inside. We
 * descend into `activeElement.shadowRoot.activeElement` (transitively) to
 * find the deepest active element — same shape used by
 * sortable-drag-keyboard.spec.ts and other shadow-aware specs.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

const KNOWN_FAILING: ReadonlySet<Target> = new Set<Target>();

const SEED_ITEM_COUNT = 3;
const ITEM = '[class*="rozie-sortable-item"]';
const ARIA_LIVE = '[data-rozie-sortable-aria-live]';
const ROW_INPUT = '[data-testid="row-input"]';
const LIFTED_ITEM = '[class*="rozie-sortable-item-lifted"]';

async function deepestActiveElementRole(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a && (a as HTMLElement).shadowRoot && (a as HTMLElement).shadowRoot!.activeElement) {
      a = (a as HTMLElement).shadowRoot!.activeElement;
    }
    return a?.getAttribute('role') ?? null;
  });
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;

  runner(
    `sortable-interactive-child [${target}]: slotted input receives its own keystrokes, row-focus reorder stays intact`,
    async ({ page }) => {
      await page.goto(`/?example=SortableListInteractive&target=${target}`);
      const mount = page.getByTestId('rozie-mount');
      await expect(mount).toBeVisible();

      // Settle: SortableListInteractiveDemo seeds 3 rows on $onMount.
      const items = mount.locator(ITEM);
      await expect(items).toHaveCount(SEED_ITEM_COUNT);
      await expect(items.first()).toHaveAttribute('role', 'listitem');
      await expect(items.first()).toHaveAttribute('tabindex', '0');

      // ── (1) + (2): focus the FIRST row's slotted <input>, press Space ──
      const input = items.first().locator(ROW_INPUT);
      await input.focus();
      await expect.poll(
        () =>
          page.evaluate(() => {
            let a: Element | null = document.activeElement;
            while (
              a &&
              (a as HTMLElement).shadowRoot &&
              (a as HTMLElement).shadowRoot!.activeElement
            ) {
              a = (a as HTMLElement).shadowRoot!.activeElement;
            }
            return a?.getAttribute('data-testid') === 'row-input';
          }),
        { timeout: 2000 },
      ).toBe(true);

      await page.keyboard.press('Space');

      // (1) SLOTTED-CHILD RECEIVES KEYS — the input's own value now contains
      // a space. RED pre-fix: the row's preventDefault() swallows the
      // keystroke before it reaches the input's value.
      await expect(input).toHaveValue(/ /);

      // (2) NO LIFT OCCURRED — aria-live silent, no row carries -lifted.
      // RED pre-fix: the row handler ran unconditionally and lifted row 0.
      const ariaLiveText = (await mount.locator(ARIA_LIVE).textContent()) ?? '';
      expect(ariaLiveText).not.toMatch(/lift/i);
      await expect(mount.locator(LIFTED_ITEM)).toHaveCount(0);

      // ── (3) ROW-FOCUS SANITY: focus the ROW itself, Space still lifts ──
      await items.first().focus();
      await expect.poll(() => deepestActiveElementRole(page), { timeout: 2000 }).toBe(
        'listitem',
      );

      await page.keyboard.press('Space');
      await expect(mount.locator(ARIA_LIVE)).toContainText(/lift/i);

      // Reset the lift so state does not leak.
      await page.keyboard.press('Escape');
      await expect(mount.locator(ARIA_LIVE)).toContainText(/cancel/i);
    },
  );
}
