import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Select floating popup — the popup is positioned by the composed
 * @rozie-ui/popover leaf (Floating UI). Driven against
 * examples/demos/SelectFloatingDemo.rozie on all 6 targets.
 *
 * Positioning runs through requestAnimationFrame and needs a real layout engine,
 * so this is the only place the placement, the flip and the width match can be
 * proven. Behavioral assertions only (no screenshots). CSS / role locators pierce
 * Lit's open shadow roots.
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

  runner(`select-floating [${target}]: popup is positioned below, matches control width, flips above near the viewport bottom`, async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 600 });
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const top = page.getByTestId('top-select');
    await top.locator('[role="combobox"]').click();
    const list = top.locator('[role="listbox"]');
    await expect(list).toBeVisible();
    const c = await top.locator('.rozie-select-control').boundingBox();
    const l = await list.boundingBox();
    expect(l!.y).toBeGreaterThanOrEqual(c!.y + c!.height);          // below
    expect(Math.abs(l!.width - c!.width)).toBeLessThanOrEqual(1);   // width-matched
    await page.keyboard.press('Escape');

    const bottom = page.getByTestId('bottom-select');
    await bottom.locator('[role="combobox"]').click();
    const bl = bottom.locator('[role="listbox"]');
    await expect(bl).toBeVisible();
    const bc = await bottom.locator('.rozie-select-control').boundingBox();
    await expect.poll(async () => { const b = await bl.boundingBox(); return b!.y + b!.height <= bc!.y + 1; }).toBe(true); // flipped above
  });

  runner(`select-floating [${target}]: outside click closes only the clicked-away select; ids stay unique`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const a = page.getByTestId('top-select').locator('[role="combobox"]');
    const b = page.getByTestId('second-select').locator('[role="combobox"]');
    await a.click();
    await expect(a).toHaveAttribute('aria-expanded', 'true');
    await b.click();
    await expect(a).toHaveAttribute('aria-expanded', 'false');
    await expect(b).toHaveAttribute('aria-expanded', 'true');
    const ids = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (root: Document | ShadowRoot) => {
        root.querySelectorAll('[id]').forEach((e) => out.push(e.id));
        root.querySelectorAll('*').forEach((e) => { if ((e as HTMLElement).shadowRoot) walk((e as HTMLElement).shadowRoot!); });
      };
      walk(document);
      return out.filter((i) => i.startsWith('rozie-select'));
    });
    expect(new Set(ids).size).toBe(ids.length);
    await page.mouse.click(5, 5);
    await expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  runner(`select-floating [${target}]: open-change fires exactly once per transition, whoever closes the popup`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const top = page.getByTestId('top-select');
    const trigger = top.locator('[role="combobox"]');
    const list = top.locator('[role="listbox"]');
    const log = page.getByTestId('readout-log');
    // The log holds one letter per open-change event: T = { open: true }, F = { open: false }.
    // `settled` waits long enough for a late duplicate (a deferred dismissal, a second
    // watcher pass) to land before the exact string is asserted.
    const settled = async (want: string) => {
      await expect(log).toHaveText(want);
      await page.waitForTimeout(250);
      await expect(log).toHaveText(want);
    };
    await expect(trigger).toBeVisible();
    await settled('');

    // open by click → close by outside click (the popover's own dismissal)
    await trigger.click();
    await expect(list).toBeVisible();
    await settled('T');
    await page.mouse.click(5, 5);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);
    await settled('TF');

    // open by keyboard → close by Escape on the focused trigger (the key handler and
    // the popover's document-level Escape both see this key)
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled('TFT');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled('TFTF');
    // Escape did not re-open it, and the keyboard still works (focus stayed on the trigger).
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    // The highlight was reset by the close: it starts again from the first option.
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled('TFTFT');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-1$/);

    // close by clicking the control itself
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled('TFTFTF');

    // the exposed toggle(): open, then close
    const toggle = page.getByTestId('toggle-top');
    await toggle.focus();
    await page.keyboard.press('o');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(list).toBeVisible();
    await settled('TFTFTFT');
    await page.keyboard.press('o');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled('TFTFTFTF');

    // open through the handle, then Escape while focus is OUTSIDE the select: only the
    // popover's document-level Escape sees it.
    await page.keyboard.press('o');
    await expect(list).toBeVisible();
    await settled('TFTFTFTFT');
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);
    await settled('TFTFTFTFTF');
    // The highlight was reset by that close too.
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await settled('TFTFTFTFTFT');

    // picking an option closes once
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await settled('TFTFTFTFTFTF');

    // Back-to-back opens and closes with no settling in between: every transition is
    // still reported exactly once, and the popup ends in the state the last key asked for.
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
    }
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(list).toHaveCount(0);
    await settled('TFTFTFTFTFTF' + 'TFTF'.repeat(8));
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(list).toBeVisible();
    await settled('TFTFTFTFTFTF' + 'TFTF'.repeat(8) + 'T');
  });

  runner(`select-floating [${target}]: focus stays on the trigger when the popup opens and closes (keyboard keeps working after a click)`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('second-select');
    const trigger = wrap.locator('[role="combobox"]');
    await trigger.click();
    await expect(wrap.locator('[role="listbox"]')).toBeVisible();
    await expect(trigger).toBeFocused();
    // No focus() call from here on: every key must reach the trigger the click focused.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-\d$/);
    const active = await trigger.getAttribute('aria-activedescendant');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).not.toHaveAttribute('aria-activedescendant', active!);
    await page.keyboard.press('Escape');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toBeFocused();
    await expect(trigger).not.toHaveText('');
  });

  runner(`select-floating [${target}]: block fills the container and the popup follows`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('block-select');
    await wrap.locator('[role="combobox"]').click();
    const list = wrap.locator('[role="listbox"]');
    await expect(list).toBeVisible();
    const w = await wrap.boundingBox();
    const c = await wrap.locator('.rozie-select-control').boundingBox();
    expect(Math.abs(c!.width - w!.width)).toBeLessThanOrEqual(1);
    await expect.poll(async () => { const l = await list.boundingBox(); return Math.abs(l!.width - c!.width) <= 1; }).toBe(true);
  });

  runner(`select-floating [${target}]: a windowed (virtual) list floats, stays mounted while closed, and navigates`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('virtual-select');
    const trigger = wrap.locator('[role="combobox"]');
    const list = wrap.locator('[role="listbox"]');
    // Mounted but hidden while closed (the virtualizer needs its scroll element).
    await expect(list).toHaveCount(1);
    await expect(list).toBeHidden();
    await trigger.click();
    await expect(list).toBeVisible();
    const options = wrap.locator('[role="option"]');
    await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    expect(await options.count()).toBeLessThan(60); // a window, not 500 rows
    const c = await wrap.locator('.rozie-select-control').boundingBox();
    await expect.poll(async () => { const l = await list.boundingBox(); return !!l && l.y >= c!.y + c!.height && Math.abs(l.width - c!.width) <= 1; }).toBe(true);
    // The window follows the scroll position inside the floated panel.
    await list.evaluate((el) => { el.scrollTop = 6000; });
    await expect
      .poll(async () => options.evaluateAll((els) => els.some((e) => Number(e.getAttribute('data-index')) > 100)), { timeout: 15_000 })
      .toBe(true);
    await list.evaluate((el) => { el.scrollTop = 0; });
    await expect(wrap.locator('[role="option"][data-index="0"]')).toBeVisible();
    // Keyboard navigation and commit.
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-0$/);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(trigger).toHaveAttribute('aria-activedescendant', /-opt-2$/);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('Option 3');
    // Closed: hidden, still mounted; it opens again with its window intact.
    await expect(list).toBeHidden();
    await expect(list).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await expect(list).toBeVisible();
    await expect.poll(async () => options.count(), { timeout: 15_000 }).toBeGreaterThan(0);
  });

  runner(`select-floating [${target}]: custom #option content renders inside the floated list and picks`, async ({ page }) => {
    await page.goto(`/?example=SelectFloating&target=${target}`);
    const wrap = page.getByTestId('nested-outer');
    const trigger = wrap.locator('[role="combobox"]');
    await trigger.click();
    const options = wrap.locator('[role="option"]');
    await expect(options).toHaveCount(5);
    await expect(options.nth(2)).toHaveText('Cherry');
    await options.nth(2).click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(trigger).toContainText('Cherry');
  });
}
