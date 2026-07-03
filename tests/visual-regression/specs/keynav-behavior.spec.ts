import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * `r-keynav` six-target DOM-driven behavior spec (Phase 71 Plan 11, SPEC §11
 * gates 4-5). Modeled EXACTLY on context-behavior.spec.ts: a per-target
 * build-availability gate (`test.fixme` when the target sub-build is
 * absent), DOM-driven assertions only (NO `toHaveScreenshot` — pixel
 * coverage for these same two demos lives separately in `matrix.spec.ts`),
 * Angular included in TARGETS as a first-class real-DOM gate. THIS is also
 * the Angular real-DOM keynav proof deferred by 71-09's emit-only scope —
 * the treenode-mount.test.ts precedent that a real Playwright mount (not
 * happy-dom TestBed) is the canonical signal for Angular DOM behavior.
 *
 * Two fresh demos exercise the full SPEC §4 keyboard map across both focus
 * models — no existing `@rozie-ui/*` family is touched (the scope fence):
 *
 *   - 'KeynavMenu' (examples/demos/KeynavMenuDemo.rozie) — the TABINDEX
 *     model. role="menu" with five `r-keynav-item` buttons (index 2, 'Save',
 *     is `disabled`), `.loop.typeahead`. DOM focus MOVES to the active item
 *     (WAI-ARIA roving tabindex).
 *
 *   - 'KeynavCombobox' (examples/demos/KeynavComboboxDemo.rozie) — the
 *     ACTIVEDESCENDANT model. role="combobox" `<input>` + a SEPARATE
 *     role="listbox" `<ul>` subtree (index 2, 'Cherry', is `disabled`) —
 *     proving the association is shared-state (`:source` + `$data.active`),
 *     not DOM containment (SPEC §7). DOM focus STAYS on the input;
 *     `aria-activedescendant` tracks the active option's id.
 *
 * Assertions read the compiler's own canonical hooks —
 * `[data-rozie-keynav-item]` (the index marker; event delegation + focus
 * targeting, SPEC §8) and `[data-rozie-keynav-active]` (the always-present
 * active hook, SPEC §9) — so the spec is emitter-shape-agnostic across all 6
 * targets, never asserting on a per-target class name or DOM structure.
 *
 * If this spec is red, the regression is in the runtime controller (the
 * `createKeynavStateMachine` reducer, 71-03) or a per-target emitter/adapter
 * (71-04..71-09) — the exact real-DOM gap that let a prior Solid class bug
 * hide behind IR-snapshot-only tests.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  // Build-availability gate — copied from context-behavior.spec.ts /
  // flatpickr-behavior.spec.ts. Angular is a first-class gate here: when its
  // analogjs sub-build is present, it runs as a real `test`, not
  // `test.fixme` (the deferred-from-71-09 real-DOM proof).
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = built ? test : test.fixme;

  runner(`keynav-behavior [${target}]: menu — tabindex model (move, wrap, skip-disabled, Home/End, typeahead, commit, roving focus)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`/?example=KeynavMenu&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const items = mount.locator('[data-rozie-keynav-item]');
    await expect(items).toHaveCount(5, { timeout: 10_000 });
    const readout = mount.getByTestId('readout-committed');
    const activeItem = () => mount.locator('[data-rozie-keynav-active]');

    // Item 0 ('New') is active on mount.
    await expect(activeItem()).toHaveAttribute(
      'data-rozie-keynav-item',
      '0',
      { timeout: 10_000 },
    );

    // Seed real DOM focus on the currently-active item (SPEC §3 tabindex
    // model: DOM focus MOVES to the active item — roving tabindex).
    await activeItem().focus();
    await expect(activeItem()).toBeFocused();

    // ---- move + skip-disabled (.skipdisabled default ON) ----
    // 0 ('New') -> 1 ('Open'). Item 2 ('Save') is disabled, so a SECOND
    // ArrowDown from 1 skips straight to 3 ('Print').
    await page.keyboard.press('ArrowDown');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '1');
    await page.keyboard.press('ArrowDown');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '3');
    // Roving focus follows the active index.
    await expect(activeItem()).toBeFocused();

    // ---- Home / End (skip-disabled applies to both) ----
    await page.keyboard.press('Home');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0');
    await page.keyboard.press('End');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '4');

    // ---- loop (.loop) ----
    // From the LAST enabled item (4, 'Export'), ArrowDown WRAPS to the FIRST
    // enabled item (0, 'New') rather than clamping.
    await page.keyboard.press('ArrowDown');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '0');

    // ---- typeahead (.typeahead) ----
    // 'p' (case-insensitive prefix match) jumps directly to 'Print' (index
    // 3) — the only label starting with 'p' — skipping the disabled 'Save'
    // entry entirely.
    await page.keyboard.press('p');
    await expect(activeItem()).toHaveAttribute('data-rozie-keynav-item', '3');

    // ---- commit (Enter -> @keynav-commit) ----
    await expect(readout).toHaveText('');
    await page.keyboard.press('Enter');
    await expect(readout).toHaveText('Print');

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual(
      [],
    );
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual(
      [],
    );
  });

  runner(`keynav-behavior [${target}]: combobox — activedescendant model (move, skip-disabled, aria-activedescendant tracking, commit, focus stays on input)`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`/?example=KeynavCombobox&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const input = mount.locator('[role="combobox"]');
    await expect(input).toBeVisible({ timeout: 10_000 });
    const options = mount.locator('[data-rozie-keynav-item]');
    await expect(options).toHaveCount(5, { timeout: 10_000 });
    const readout = mount.getByTestId('readout-chosen');
    const activeOption = () => mount.locator('[data-rozie-keynav-active]');

    // Option 0 ('Apple') is active on mount.
    await expect(activeOption()).toHaveAttribute(
      'data-rozie-keynav-item',
      '0',
      { timeout: 10_000 },
    );

    // Root is the INPUT (activedescendant model) — DOM focus stays there for
    // the entire interaction, never on an option.
    await input.focus();
    await expect(input).toBeFocused();

    // aria-activedescendant on the input tracks the active option's id.
    const activeId0 = await activeOption().getAttribute('id');
    expect(activeId0).toBeTruthy();
    await expect(input).toHaveAttribute('aria-activedescendant', activeId0!);

    // ---- move + skip-disabled ----
    // 0 ('Apple') -> 1 ('Banana'). Item 2 ('Cherry') is disabled, so a
    // SECOND ArrowDown lands on 3 ('Date') directly.
    await page.keyboard.press('ArrowDown');
    await expect(activeOption()).toHaveAttribute(
      'data-rozie-keynav-item',
      '1',
    );
    await page.keyboard.press('ArrowDown');
    await expect(activeOption()).toHaveAttribute(
      'data-rozie-keynav-item',
      '3',
    );

    // DOM focus NEVER moved off the input — contrast with the menu's roving
    // roving-tabindex assertion above (the two focus models' defining split).
    await expect(input).toBeFocused();

    // aria-activedescendant tracks the NEW active option's id (a DIFFERENT
    // id than before — proves live tracking, not a stale first-paint value).
    const activeId1 = await activeOption().getAttribute('id');
    expect(activeId1).toBeTruthy();
    expect(activeId1).not.toBe(activeId0);
    await expect(input).toHaveAttribute('aria-activedescendant', activeId1!);

    // ---- commit (Enter -> @keynav-commit) ----
    await expect(readout).toHaveText('');
    await page.keyboard.press('Enter');
    await expect(readout).toHaveText('Date');
    // Commit does not move DOM focus off the input.
    await expect(input).toBeFocused();

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual(
      [],
    );
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual(
      [],
    );
  });
}
