import { expect, test } from '@playwright/test';

/**
 * Runtime hydration matrix.
 *
 * For each COVERED target's island, drive the canonical rich Counter and assert
 * REAL reactive behavior that can only happen post-hydration — not static SSR
 * markup. The Counter has plus/minus buttons bounded to min=0/max=10, with a
 * `$computed`-driven `:disabled` on each button at its bound, and a `:class`
 * hover effect.
 *
 * The island is mounted with `step={1} min={0} max={10}` and OMITS `value`
 * (model:true → uncontrolled, starts at the <props> default 0). So at load:
 *   • value is "0"
 *   • Decrement is DISABLED (canDecrement = 0 - 1 >= 0 → false)
 *   • Increment is ENABLED
 * The disabled→enabled TRANSITION after a click (and the disabled-at-max
 * transition) can only occur if `$computed` re-ran in the browser → proves
 * hydration, not static markup.
 *
 * LOCATOR STRATEGY — test by ROLE / STRUCTURE / EFFECT, never by author class
 * name. The React emit CSS-Modules-hashes author class names
 * (`counter`→`_counter_1d11t_1`, `value`→`_value_1d11t_3`), so a `.value` /
 * `.counter` class locator silently fails on React only — the
 * `project_react_classhash_breaks_selectors` gotcha. The fix is NOT to except
 * React (it hydrates and reacts identically to the rest — empirically verified)
 * but to locate elements the way a user perceives them: buttons by accessible
 * name (`aria-label`), the value by structure (the lone `<span>`), the counter
 * root as the nearest `<div>` ancestor of a button, and the hover state by its
 * rendered background effect. All four are immune to class hashing AND pierce
 * Lit's open shadow root.
 *
 * COVERAGE EXCEPTIONS (asserted by NONE of the cases below):
 *   • angular — no first-party @astrojs/angular (only community
 *     @analogjs/astro-angular); intentionally not wired.
 *   • Any island framework whose Rozie emit cannot hydrate / react under its
 *     @astrojs/* renderer is removed from COVERED and documented in README.md
 *     with its real root cause — never faked green.
 *
 * Adding/removing a target is a one-line edit to COVERED.
 */
const COVERED = ['react', 'vue', 'svelte', 'solid', 'lit'] as const;

const HOVER_BG = 'rgba(0, 0, 0, 0.04)';

for (const target of COVERED) {
  test(`${target} island hydrates: bounds + $computed :disabled + hover`, async ({ page }) => {
    await page.goto('/');

    // Scope to this island's section via its stable data-target hook. For Lit
    // the controls live in the <rozie-counter> open shadow root, which
    // Playwright's role/css locators pierce automatically.
    const section = page.locator(`[data-target="${target}"]`);
    await expect(section).toBeVisible();

    const decrement = section.getByRole('button', { name: 'Decrement' });
    const increment = section.getByRole('button', { name: 'Increment' });
    // Structural locators (NOT `.value`/`.counter` class names — React hashes
    // those). The value is the lone <span>; the counter root is the nearest
    // <div> ancestor of a button. Both pierce Lit's shadow root (the button and
    // its sibling span + parent div live in the same shadow tree).
    const value = section.locator('span').filter({ hasText: /^\d+$/ });
    const counter = increment.locator('xpath=ancestor::div[1]');

    // Wait for hydration: controls attached + visible, initial value rendered.
    await expect(increment).toBeVisible();
    await expect(value).toHaveText('0');

    // Bounds at load: value 0 == min 0 → Decrement disabled, Increment enabled.
    await expect(decrement).toBeDisabled();
    await expect(increment).toBeEnabled();

    // Click Increment once → value 1 AND Decrement becomes ENABLED. This
    // disabled→enabled transition can only happen if the reactive $computed
    // re-ran in the browser → proves hydration, not static markup.
    await increment.click();
    await expect(value).toHaveText('1');
    await expect(decrement).toBeEnabled();

    // Climb to max (10), then Increment must become DISABLED (canIncrement
    // false at max) — proves $computed-driven :disabled reactivity at the
    // upper bound.
    while ((await value.textContent())?.trim() !== '10') {
      await increment.click();
    }
    await expect(value).toHaveText('10');
    await expect(increment).toBeDisabled();
    await expect(decrement).toBeEnabled();

    // Step back down once → value 9, Increment re-enabled.
    await decrement.click();
    await expect(value).toHaveText('9');
    await expect(increment).toBeEnabled();

    // Hover effect — asserted via the rendered COMPUTED background (the effect,
    // not the class name → hashing-agnostic). Hover a child control (Increment
    // is enabled at value 9); mouseenter fires on the counter root, toggling
    // $data.hovering → the :class background.
    await increment.hover();
    await expect(counter).toHaveCSS('background-color', HOVER_BG);

    // Move the mouse away → background reverts (the hover :class de-applies).
    await page.mouse.move(0, 0);
    await expect(counter).not.toHaveCSS('background-color', HOVER_BG);
  });
}
