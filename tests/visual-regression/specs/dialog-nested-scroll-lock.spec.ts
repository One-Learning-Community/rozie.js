import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Dialog nested scroll-lock — the REF-COUNTED `<html>` scroll lock.
 *
 * Pre-fix, `applyScrollLock` was a naive per-instance toggle: closing an INNER
 * dialog while an OUTER one was still open unlocked `document.documentElement`
 * scrolling entirely, even though the outer dialog (which also wants scrolling
 * locked) was still on screen. This spec opens an outer dialog, then an inner
 * one nested inside it, closes ONLY the inner one, and asserts scrolling is
 * STILL locked — then closes the outer one too and asserts it is released.
 *
 * `examples/demos/DialogNestedScrollLockDemo.rozie` composes two `<Dialog>`
 * instances (outer contains inner), both with the default (locking)
 * `disableScrollLock: false`.
 *
 * Per `feedback_vr_linux_baselines`: structural/behavioral assertions only — no
 * `toHaveScreenshot`. Runs locally on macOS without a Docker baseline.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const KNOWN_FAILING: ReadonlySet<(typeof TARGETS)[number]> = new Set<
  (typeof TARGETS)[number]
>([]);

async function overflow(page: import('@playwright/test').Page) {
  return page.evaluate(() => document.documentElement.style.overflow);
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built || KNOWN_FAILING.has(target) ? test.fixme : test;
  runner(`dialog nested scroll-lock [${target}]: closing the inner dialog keeps <html> locked while the outer is still open`, async ({
    page,
  }) => {
    await page.goto(`/?example=DialogNestedScrollLock&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const outerBody = page.getByTestId('outer-body');
    const innerBody = page.getByTestId('inner-body');

    // ---- 0. baseline: neither dialog open → unlocked ----
    expect(await overflow(page)).toBe('');

    // ---- 1. open outer → locked ----
    await page.getByTestId('open-outer').click();
    await expect(outerBody).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(async () => overflow(page), { timeout: 10_000 })
      .toBe('hidden');

    // ---- 2. open inner (nested inside outer) → still locked ----
    await page.getByTestId('open-inner').click();
    await expect(innerBody).toBeVisible({ timeout: 10_000 });
    expect(await overflow(page)).toBe('hidden');

    // ---- 3. close ONLY the inner dialog → outer is still open → STILL locked ----
    // This is the exact regression this spec guards: a naive (non-ref-counted)
    // scroll lock would release here even though the outer dialog remains open.
    await page.getByTestId('close-inner').click();
    await expect(innerBody).toBeHidden({ timeout: 10_000 });
    await expect(outerBody).toBeVisible();
    expect(await overflow(page)).toBe('hidden');

    // ---- 4. close the outer dialog too → now released ----
    await page.getByTestId('close-outer').click();
    await expect(outerBody).toBeHidden({ timeout: 10_000 });
    await expect
      .poll(async () => overflow(page), { timeout: 10_000 })
      .toBe('');
  });
}
