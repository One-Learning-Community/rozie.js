import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Tags behavioral smoke — pure-Rozie WAI-ARIA token / tags input (`Tags`).
 *
 * `Tags` is a pure-Rozie family (NO third-party engine): the PLATFORM is the
 * engine — one native `<input>` for typing + a row of removable chips. Rozie owns
 * the author-side API: the two-way `modelValue` token array, the commit/dedup/
 * validate funnel, paste-to-bulk-add, and the backspace-deletes-previous behaviour.
 * This spec proves the controlled token primitive (committed tokens ARE the model,
 * `draft` is the only local buffer) behaves identically across all 6 targets.
 *
 * `examples/demos/TagsBehaviorDemo.rozie` drives a tags input seeded with ['alpha'],
 * a two-way `r-model:modelValue` (live `readout-value` + `readout-count`), `@add` /
 * `@remove` readouts, and a `set-tags` direct-model-write button (→ ['one','two']).
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot` (the pixel cell is TagsScreenshot in matrix.spec.ts).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>();

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`tags [${target}]: Enter + comma commit, dedup rejects, backspace + chip-remove delete, set-tags writes`, async ({
    page,
  }) => {
    await page.goto(`/?example=TagsBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const value = page.getByTestId('readout-value');
    const count = page.getByTestId('readout-count');
    const lastAdd = page.getByTestId('readout-add');
    const lastRemove = page.getByTestId('readout-remove');
    // The single text input (the CSS locator pierces Lit shadow).
    const input = page.locator('input').first();

    // ---- 1. seeded with ['alpha'] ----
    await expect(input).toBeVisible({ timeout: 15_000 });
    await expect(count).toHaveText('1');
    await expect(value).toHaveText('alpha');

    // ---- 2. type + Enter commits a token ----
    await input.click();
    await input.fill('beta');
    await input.press('Enter');
    await expect(count).toHaveText('2', { timeout: 10_000 });
    await expect(value).toHaveText('alpha,beta');
    await expect(lastAdd).toHaveText('beta');

    // ---- 3. comma also commits a token ----
    await input.fill('gamma');
    await input.press(',');
    await expect(count).toHaveText('3', { timeout: 10_000 });
    await expect(value).toHaveText('alpha,beta,gamma');

    // ---- 4. dedup: a duplicate is rejected (count stays 3) ----
    await input.fill('beta');
    await input.press('Enter');
    await expect(count).toHaveText('3');
    await expect(value).toHaveText('alpha,beta,gamma');

    // ---- 5. Backspace in an EMPTY input deletes the previous token (gamma) ----
    await input.fill('');
    await input.press('Backspace');
    await expect(count).toHaveText('2', { timeout: 10_000 });
    await expect(value).toHaveText('alpha,beta');
    await expect(lastRemove).toHaveText('gamma');

    // ---- 6. a chip's remove control deletes that token (alpha) ----
    await page.getByRole('button', { name: 'Remove alpha' }).click();
    await expect(count).toHaveText('1', { timeout: 10_000 });
    await expect(value).toHaveText('beta');

    // ---- 7. set-tags direct-model write (→ ['one','two']) reflects ----
    await page.getByTestId('set-tags').click();
    await expect(count).toHaveText('2', { timeout: 10_000 });
    await expect(value).toHaveText('one,two');
  });
}
