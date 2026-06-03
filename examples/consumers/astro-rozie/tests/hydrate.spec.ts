import { expect, test } from '@playwright/test';

/**
 * Runtime hydration matrix.
 *
 * For each COVERED target's island, assert the Rozie Counter renders its
 * initial value (Count: 0) AND increments by step (2) on click — proving the
 * island genuinely hydrated, not that the tag is merely present in the static
 * SSR snapshot.
 *
 * COVERAGE EXCEPTIONS (asserted by NONE of the cases below):
 *   • angular — no first-party @astrojs/angular (only community
 *     @analogjs/astro-angular); intentionally not wired.
 *   • Any island framework whose Rozie emit cannot hydrate under its
 *     @astrojs/* renderer would be removed from COVERED below and documented in
 *     README.md with its real root cause. (As of this writing all five —
 *     react, vue, svelte, solid, lit — are covered.)
 *
 * Adding/removing a target is a one-line edit to COVERED.
 */
const COVERED = ['react', 'vue', 'svelte', 'solid', 'lit'] as const;

for (const target of COVERED) {
  test(`${target} island hydrates: Count 0 → 2 on click`, async ({ page }) => {
    await page.goto('/');

    // Scope to this island's section via its stable data-target hook.
    const section = page.locator(`[data-target="${target}"]`);
    await expect(section).toBeVisible();

    // The counter renders as a <button> whose text is "Count: N". For Lit the
    // button lives inside the <rozie-counter> custom element's shadow DOM, so
    // Playwright must pierce the shadow root — its default locators do this
    // automatically (open shadow roots).
    const button = section.getByRole('button', { name: /Count:/ });

    // Wait for the island to hydrate: the button must be attached + enabled and
    // show the initial value. client:load hydration is async, so poll the text.
    await expect(button).toBeVisible();
    await expect(button).toHaveText(/Count:\s*0/);

    // Click and assert the increment — this only succeeds if the island's
    // reactive handler actually ran in the browser (true hydration).
    await button.click();
    await expect(button).toHaveText(/Count:\s*2/);
  });
}
