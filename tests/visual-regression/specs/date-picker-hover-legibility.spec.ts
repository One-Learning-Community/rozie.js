import { test, expect, type Page, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/date-picker HOVER LEGIBILITY spec (plan 77-11, UAT-HOVER gap
 * closure) — Dan reported (2026-08-05) that hovering the selected day swaps
 * its accent background for the plain translucent-grey hover tint, leaving
 * white text on light grey: `.rozie-datepicker-day:hover:not([aria-disabled=
 * 'true'])` is (0,3,1) and was winning over `.rozie-datepicker-day.is-selected`
 * at (0,2,1). The fix adds a `.is-selected` / `.is-range-start` /
 * `.is-range-end` grouped `:hover` rule at (0,4,1) — this spec proves it
 * mechanically rather than with a new PNG baseline (no existing date-picker
 * screenshot captures a hover state, and adding one would introduce pixel-
 * drift surface against KNG-09 for a state the suite has never pinned).
 *
 * Mechanical, not visual: computed `background-color` must not be the plain
 * hover tint, AND the WCAG contrast ratio between computed foreground and
 * background must be >= 4.5:1. No screenshot; no PNG baseline is created by
 * this file.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return built ? test : test.fixme;
}

/**
 * Hovers `locator`, then reads its OWN computed `color` / `background-color`
 * inside `page.evaluate` (so the read happens post-hover, in the same
 * browser context the CSS cascade resolves in), parses both `rgb()`/`rgba()`
 * strings to 0-255 channel triples, linearises each channel with the sRGB
 * transfer function, computes relative luminance, and returns the WCAG
 * contrast ratio `(lighter + 0.05) / (darker + 0.05)` alongside the raw
 * computed strings (so a failing assertion's error message shows exactly
 * what colors were compared).
 */
async function contrastRatioOf(
  page: Page,
  locator: Locator,
): Promise<{ ratio: number; color: string; backgroundColor: string }> {
  await locator.hover();
  return locator.evaluate((el) => {
    const parseRgb = (input: string): [number, number, number] => {
      const match = input.match(/rgba?\(([^)]+)\)/);
      if (!match) return [0, 0, 0];
      const parts = match[1].split(',').map((p) => parseFloat(p.trim()));
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
    };
    const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
      const linearize = (c: number) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      const [rl, gl, bl] = [linearize(r), linearize(g), linearize(b)];
      return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
    };
    const style = getComputedStyle(el);
    const color = style.color;
    const backgroundColor = style.backgroundColor;
    const fgLum = relativeLuminance(parseRgb(color));
    const bgLum = relativeLuminance(parseRgb(backgroundColor));
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    return { ratio, color, backgroundColor };
  });
}

for (const target of TARGETS) {
  const runner = runnerFor(target);

  // -----------------------------------------------------------------------
  // 1. Selected day: hovering it must not fall back to the plain hover tint,
  //    and must clear the WCAG 4.5:1 bar against its (white) foreground.
  //    RED before the fix: backgroundColor resolves to rgba(0, 0, 0, 0.05)
  //    (the plain hover rule wins the specificity contest).
  // -----------------------------------------------------------------------
  runner(`date-picker-hover-legibility [${target}]: hovering the selected day stays legible`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerBehavior&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();
    const selectedDay = mount.locator('[data-day="2025-06-15"]');
    await expect(selectedDay).toBeVisible({ timeout: 10_000 });

    const { ratio, backgroundColor } = await contrastRatioOf(page, selectedDay);

    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0.05)');
    expect(ratio).toBeGreaterThanOrEqual(4.5);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // 2. Range-endpoint cells (`.is-range-start` / `.is-range-end`) — the same
  //    white-on-accent pattern at the same specificity collision — get
  //    identical treatment. RED before the fix for the same reason as test 1.
  // -----------------------------------------------------------------------
  runner(`date-picker-hover-legibility [${target}]: hovering a range-endpoint day stays legible`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`/?example=DatePickerRangeComplete&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const rangeStart = mount.locator('.is-range-start');
    await expect(rangeStart).toBeVisible({ timeout: 10_000 });
    const startResult = await contrastRatioOf(page, rangeStart);
    expect(startResult.backgroundColor).not.toBe('rgba(0, 0, 0, 0.05)');
    expect(startResult.ratio).toBeGreaterThanOrEqual(4.5);

    const rangeEnd = mount.locator('.is-range-end');
    await expect(rangeEnd).toBeVisible({ timeout: 10_000 });
    const endResult = await contrastRatioOf(page, rangeEnd);
    expect(endResult.backgroundColor).not.toBe('rgba(0, 0, 0, 0.05)');
    expect(endResult.ratio).toBeGreaterThanOrEqual(4.5);

    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
}
