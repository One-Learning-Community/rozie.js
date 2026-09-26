import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Resizable accessibility smoke — the `role="separator"` handle.
 *
 * Pre-fix, the handle had NO accessible name: `role="separator"` + `tabindex="0"`
 * + `aria-value*` with no `aria-label` and no visible text is announced by a
 * screen reader as just "separator" with no indication of WHAT it resizes. This
 * spec asserts (a) the handle has a non-empty accessible name (the new `ariaLabel`
 * prop, defaulted to `"Resize panels"`) and (b) `aria-valuenow` is a number
 * actually inside `[aria-valuemin, aria-valuemax]` (the clamped `currentSize()`,
 * not the bare — possibly out-of-range — `size` prop) on all 6 targets.
 *
 * `examples/demos/ResizableBehaviorDemo.rozie` mounts `<Resizable>` with no
 * explicit `ariaLabel`, so this exercises the prop's DEFAULT.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Runs locally on macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>([]);

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`resizable [${target}]: separator handle has an accessible name and an in-range aria-valuenow`, async ({
    page,
  }) => {
    await page.goto(`/?example=ResizableBehavior&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const handle = page.getByRole('separator');
    await expect(handle).toBeVisible();

    // ---- accessible name: the default ariaLabel ("Resize panels") ----
    const accessibleName = await handle.evaluate((el) => el.getAttribute('aria-label'));
    expect(accessibleName, 'the separator handle must carry a non-empty aria-label').toBeTruthy();
    expect(accessibleName?.trim().length).toBeGreaterThan(0);

    // ---- aria-valuenow reflects the CLAMPED size, in [aria-valuemin, aria-valuemax] ----
    const [now, min, max] = await Promise.all([
      handle.evaluate((el) => el.getAttribute('aria-valuenow')),
      handle.evaluate((el) => el.getAttribute('aria-valuemin')),
      handle.evaluate((el) => el.getAttribute('aria-valuemax')),
    ]);
    expect(now, 'aria-valuenow must be present').toBeTruthy();
    const nowNum = Number(now);
    const minNum = Number(min);
    const maxNum = Number(max);
    expect(Number.isFinite(nowNum)).toBe(true);
    expect(nowNum).toBeGreaterThanOrEqual(minNum);
    expect(nowNum).toBeLessThanOrEqual(maxNum);

    // ---- after a programmatic model write (Set 70), valuenow tracks it ----
    await page.getByTestId('set-size').click();
    await expect
      .poll(async () => (await page.getByTestId('readout-size').textContent())?.trim() ?? '', {
        timeout: 10_000,
      })
      .toBe('70');
    await expect
      .poll(async () => handle.evaluate((el) => el.getAttribute('aria-valuenow')), {
        timeout: 10_000,
      })
      .toBe('70');
  });
}
