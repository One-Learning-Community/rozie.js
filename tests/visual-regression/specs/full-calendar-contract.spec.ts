import { test, expect, type Locator, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * FullCalendar consumer contract — behavioral proof on all six targets for the
 * release-0.8.0 audit fixes (C3–C9, C11). Drives
 * `examples/demos/FullCalendarContractDemo.rozie`; dates are pinned through
 * `:options` (`initialDate` + engine `now`), so nothing depends on the wall
 * clock. The demo's `eventSources` feed (`/fc-feed.json`) is served by a route
 * interception here, which also counts the fetches.
 *
 *   - FC-C3b: the inline `:options` literal is re-created on every demo render;
 *     re-rendering does NOT refetch the feed;
 *   - FC-C3a: `options.height: 999` and `options.eventClick` never win over the
 *     curated `height` and the wrapped `eventClick`, at mount or after renders;
 *   - FC-C4: `options.firstDay: 1` reaches the engine (curated `firstDay` unset);
 *   - FC-C7: `eventClick` carries `el` + `jsEvent` for a pointer click AND for
 *     Enter; `eventMouseLeave` carries `el`; `dateClick` carries `dayEl` +
 *     `jsEvent`; `eventDrop` carries `oldEvent` + a working `revert()`;
 *   - FC-C6: the untitled event has `aria-label="Untitled event"`;
 *   - FC-C5: runtime `height` `'600'` → 600px, `''` → the 480 default,
 *     `'auto'` → content height; a STATIC `height="600"` attribute → 600px (the
 *     Lit attribute-converter path, end to end);
 *   - FC-C8: replacing `events` keeps the feed's events;
 *   - FC-C9: after unmount the handle's `getApi()` returns null (not Angular,
 *     where the component ref is the host ElementRef — see
 *     full-calendar-behavior.spec.ts);
 *   - no uncaught page errors throughout.
 *
 * Per `feedback_vr_linux_baselines`: DOM/behavioral assertions only — no
 * `toHaveScreenshot`, so there are no PNG baselines.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
const TOLERANCE = 2;

async function heightOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return box.height;
}

async function expectHeight(locator: Locator, expected: number) {
  await expect
    .poll(async () => Math.round(await heightOf(locator)), { timeout: 10_000 })
    .toBeGreaterThanOrEqual(expected - TOLERANCE);
  await expect
    .poll(async () => Math.round(await heightOf(locator)), { timeout: 10_000 })
    .toBeLessThanOrEqual(expected + TOLERANCE);
}

async function centerOf(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

for (const target of TARGETS) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  const runner = !built ? test.fixme : test;
  runner(`full-calendar-contract [${target}]: options churn, curated keys, payloads, height, reconcile, teardown`, async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    let feedRequests = 0;
    await page.route('**/fc-feed.json**', async (route) => {
      feedRequests += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'feed', title: 'Feed event', start: '2026-01-20' }]),
      });
    });

    await page.goto(`/?example=FullCalendarContract&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await expect(mount).toBeVisible();

    const log = page.getByTestId('log');
    const main = page.getByTestId('main-calendar');
    const mainFc = main.locator('.fc').first();
    const staticFc = page.getByTestId('static-height-calendar').locator('.fc').first();
    await expect(mainFc).toBeVisible({ timeout: 15_000 });
    await expect(main.getByText('Feed event')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Drag me')).toBeVisible();

    // ---- FC-C4: options.firstDay reaches the engine → weeks start Monday ----
    await expect(main.locator('.fc-col-header-cell').first()).toHaveClass(/fc-day-mon/);

    // ---- FC-C3a (mount): curated height 420 beats options.height 999 ----
    await expectHeight(mainFc, 420);

    // ---- FC-C5 static attribute: height="600" → 600px ----
    await expectHeight(staticFc, 600);

    // ---- FC-C3b: re-rendering with a new inline options literal never refetches ----
    expect(feedRequests).toBe(1);
    for (let i = 1; i <= 3; i++) {
      await page.getByTestId('rerender').click();
      await expect(page.getByTestId('tick')).toHaveText(String(i));
    }
    await page.waitForTimeout(500);
    expect(feedRequests, 'inline :options re-render must not refetch eventSources').toBe(1);
    await expect(main.getByText('Feed event')).toBeVisible();
    // ...and the re-renders did not apply options.height either.
    await expectHeight(mainFc, 420);

    // ---- FC-C6: the untitled event has an accessible name ----
    await expect(main.locator('.fc-event[aria-label="Untitled event"]')).toHaveCount(1);

    // ---- FC-C7 + C3a: pointer eventClick carries el + jsEvent; wrapped handler wins ----
    const dragEvent = main.locator('.fc-event', { hasText: 'Drag me' }).first();
    await dragEvent.click();
    await expect(log).toHaveText(/^eventClick:[A-Z]+:click:drag$/);

    // ---- FC-C7: keyboard activation → jsEvent is the keydown ----
    await page.getByTestId('rerender').click();
    await dragEvent.focus();
    await page.keyboard.press('Enter');
    await expect(log).toHaveText(/^eventClick:[A-Z]+:keydown:drag$/);

    // ---- FC-C7: eventMouseLeave carries el ----
    await dragEvent.hover();
    await page.getByRole('heading', { name: 'FullCalendar consumer contract' }).hover();
    await expect(log).toHaveText(/^eventMouseLeave:[A-Z]+:drag$/);

    // ---- FC-C7: dateClick carries dayEl + jsEvent ----
    const emptyDay = main.locator('td.fc-daygrid-day[data-date="2026-01-28"]');
    const dayBox = await emptyDay.boundingBox();
    if (!dayBox) throw new Error('day cell has no bounding box');
    await page.mouse.click(dayBox.x + dayBox.width / 2, dayBox.y + dayBox.height - 6);
    await expect(log).toHaveText(/^dateClick:TD:2026-01-28:(click|mouseup|pointerup)$/);

    // ---- FC-C7: eventDrop carries oldEvent + revert(); the demo reverts ----
    const fromCell = main.locator('td.fc-daygrid-day[data-date="2026-01-13"]');
    const toCell = main.locator('td.fc-daygrid-day[data-date="2026-01-16"]');
    const from = await centerOf(page, dragEvent);
    const to = await centerOf(page, toCell);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y + 2, { steps: 4 });
    await page.mouse.move(to.x, to.y, { steps: 12 });
    await page.mouse.up();
    await expect(log).toHaveText('eventDrop:reverted:old=drag', { timeout: 10_000 });
    await expect(fromCell.getByText('Drag me')).toBeVisible();
    await expect(toCell.getByText('Drag me')).toHaveCount(0);

    // ---- FC-C5: runtime height '600' → 600, '' → 480 default, 'auto' → content ----
    await page.getByTestId('height-600').click();
    await expectHeight(mainFc, 600);
    await page.getByTestId('height-empty').click();
    await expectHeight(mainFc, 480);
    await page.getByTestId('height-auto').click();
    await expect
      .poll(async () => Math.round(await heightOf(mainFc)), { timeout: 10_000 })
      .not.toBe(480);

    // ---- FC-C8: replacing `events` keeps the feed's events ----
    await page.getByTestId('replace-events').click();
    await expect(main.getByText('Replaced')).toBeVisible({ timeout: 10_000 });
    await expect(main.getByText('Drag me')).toHaveCount(0);
    await expect(main.locator('.fc-event[aria-label="Untitled event"]')).toHaveCount(0);
    await expect(main.getByText('Feed event')).toBeVisible();
    expect(feedRequests).toBe(1);

    // ---- FC-C9: after unmount the handle's getApi() is null ----
    if (target !== 'angular') {
      await page.getByTestId('teardown').click();
      await expect(main).toHaveCount(0, { timeout: 10_000 });
      await page.getByTestId('probe-api').click();
      await expect(log).toHaveText('api-after-unmount:null');
    }

    // The wrapped eventClick was never replaced by options.eventClick.
    await expect(log).not.toHaveText('options-eventClick-LEAKED');
    expect(pageErrors, `uncaught page errors: ${pageErrors.join('; ')}`).toEqual([]);
  });
}
