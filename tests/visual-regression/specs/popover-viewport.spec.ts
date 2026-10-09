import { test, expect, type Locator } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Popover viewport containment — DOM-geometry proof (261008-mmt).
 *
 * Root cause (field report: a `bare`, `strategy="fixed"`, `placement="right-start"`
 * card on a 390px screen ended with its right edge at 521px): Floating UI's default
 * `flip()` never tries the other axis, so a right-start panel with no room on either
 * side stays right-start; the default `shift()` moves a side placement along the
 * vertical alignment axis only, so the horizontal overflow is never corrected. The
 * fix makes side placements fall back below/above and shift on the cross axis, and
 * caps the panel width at the measured `--rozie-popover-available-width`.
 *
 * `examples/demos/PopoverViewportDemo.rozie` holds the reported configuration plus a
 * default-chrome panel with long prose. DOM-geometry assertions only — no
 * `toHaveScreenshot`, so there are no PNG baselines.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
const OFFSET = 8;
const CARD_WIDTH = 360;
const CARD_HEIGHT = 220;

type Box = { x: number; y: number; width: number; height: number };

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return box;
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;

  test.describe(`popover viewport 390 [${target}]`, () => {
    test.use({ viewport: { width: 390, height: 844 } });

    runner(`popover-viewport reported case [${target}]`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));
      await page.goto(`/?example=PopoverViewport&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();
      const W = page.viewportSize()!.width;

      const chip = page.getByTestId('event-chip');
      await expect(chip).toBeVisible({ timeout: 15_000 });
      const c = await boxOf(chip);
      // Precondition: neither side has room for the card, and there is room below.
      expect(c.x + c.width + OFFSET + CARD_WIDTH).toBeGreaterThan(W);
      expect(c.x - OFFSET - CARD_WIDTH).toBeLessThan(0);
      expect(c.y + c.height + OFFSET + CARD_HEIGHT).toBeLessThanOrEqual(844);

      const panel = page.getByTestId('event-popover').locator('.rozie-popover-floating');
      await chip.click();
      await expect(panel).toBeVisible({ timeout: 10_000 });

      await expect
        .poll(async () => {
          const p = await boxOf(panel);
          const right = p.x + p.width;
          return p.x >= -1 && right <= W + 1
            ? 'ok'
            : `left ${p.x.toFixed(1)}, right ${right.toFixed(1)}, viewport ${W}`;
        }, { timeout: 10_000 })
        .toBe('ok');

      // Positioned below the chip at the offset (so it does not cover the chip).
      await expect
        .poll(async () => {
          const p = await boxOf(panel);
          const d = p.y - (c.y + c.height + OFFSET);
          return Math.abs(d) <= 2 ? 'ok' : `top Δ ${d.toFixed(1)}`;
        }, { timeout: 10_000 })
        .toBe('ok');

      expect(await panel.evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
      await expect(page.getByTestId('card-action')).toBeInViewport({ ratio: 1 });
      expect(pageErrors).toEqual([]);
    });

    runner(`popover-viewport width limit [${target}]`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));
      await page.goto(`/?example=PopoverViewport&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();
      const W = page.viewportSize()!.width;

      const trigger = page.getByTestId('notes-trigger');
      await expect(trigger).toBeVisible({ timeout: 15_000 });
      const panel = page.getByTestId('notes-popover').locator('.rozie-popover-floating');
      await trigger.click();
      await expect(panel).toBeVisible({ timeout: 10_000 });

      await expect
        .poll(async () => {
          const p = await boxOf(panel);
          const right = p.x + p.width;
          return p.width <= W + 1 && p.x >= -1 && right <= W + 1
            ? 'ok'
            : `width ${p.width.toFixed(1)}, left ${p.x.toFixed(1)}, right ${right.toFixed(1)}, viewport ${W}`;
        }, { timeout: 10_000 })
        .toBe('ok');

      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      await expect
        .poll(
          () => panel.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--rozie-popover-available-width')),
          { timeout: 10_000 },
        )
        .toBe(`${clientWidth}px`);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe(`popover viewport 1280 [${target}]`, () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    runner(`popover-viewport desktop control [${target}]`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));
      await page.goto(`/?example=PopoverViewport&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();

      const chip = page.getByTestId('event-chip');
      await expect(chip).toBeVisible({ timeout: 15_000 });
      const c = await boxOf(chip);
      const panel = page.getByTestId('event-popover').locator('.rozie-popover-floating');
      await chip.click();
      await expect(panel).toBeVisible({ timeout: 10_000 });

      await expect
        .poll(async () => {
          const p = await boxOf(panel);
          const dx = p.x - (c.x + c.width + OFFSET);
          const dy = p.y - c.y;
          return Math.abs(dx) <= 2 && Math.abs(dy) <= 2
            ? 'ok'
            : `left Δ ${dx.toFixed(1)}, top Δ ${dy.toFixed(1)}`;
        }, { timeout: 10_000 })
        .toBe('ok');
      expect(pageErrors).toEqual([]);
    });
  });
}
