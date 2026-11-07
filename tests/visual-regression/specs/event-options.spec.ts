import { test, expect, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * `.capture`, `.passive` and `.once` on TEMPLATE `@event` bindings
 * (examples/demos/EventOptionsDemo.rozie, ?example=EventOptions), on every target.
 * Until this spec existed nothing ran these three modifiers in a browser, so four
 * targets could reject or silently drop them on template events unnoticed.
 *
 *   E1 — `.capture` runs the outer handler before the target's handler and the bubble handler.
 *   E2 — `.capture.stop` on a wrapper keeps the event from reaching the inner button.
 *   E3 — `.once` fires a single time, including after the component re-renders.
 *   E4 — `.capture.once` on `r-for` items fires once per item.
 *   E5 — `.passive` makes `preventDefault()` a no-op; a plain listener can still cancel.
 *   E6 — `.once` on a COMPONENT event fires once, even after the parent re-renders.
 *   E7 — a plain and a `.once` listener for the same component event: plain every time, once once.
 *   E8 — `.once` on a component event inside `r-for` fires once per child.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  return built ? test : test.fixme;
}

async function gotoDemo(page: Page, target: Target) {
  await page.goto(`/?example=EventOptions&target=${target}`);
  const mount = page.getByTestId('rozie-mount');
  await expect(mount).toBeVisible();
  await expect(mount.getByTestId('capture-inner')).toBeVisible({ timeout: 15_000 });
  return mount;
}

for (const target of TARGETS) {
  runnerFor(target)(`event-options [${target}]: E1 .capture runs before the target and bubble handlers`, async ({ page }) => {
    const mount = await gotoDemo(page, target);
    await mount.getByTestId('capture-inner').click();
    await expect(mount.getByTestId('log')).toHaveText('outer-capture,inner,outer-bubble');
  });

  runnerFor(target)(`event-options [${target}]: E2 .capture.stop stops the event before the inner button`, async ({ page }) => {
    const mount = await gotoDemo(page, target);
    await mount.getByTestId('stop-inner').click();
    await expect(mount.getByTestId('log')).toHaveText('guard');
  });

  runnerFor(target)(`event-options [${target}]: E3 .once fires once, even after a re-render`, async ({ page }) => {
    const mount = await gotoDemo(page, target);
    await mount.getByTestId('once').click();
    await expect(mount.getByTestId('once-count')).toHaveText('1');
    await mount.getByTestId('once').click();
    await mount.getByTestId('rerender').click();
    await expect(mount.getByTestId('renders')).toHaveText('1');
    await mount.getByTestId('once').click();
    await mount.getByTestId('rerender').click();
    await expect(mount.getByTestId('renders')).toHaveText('2');
    await expect(mount.getByTestId('once-count')).toHaveText('1');
  });

  runnerFor(target)(`event-options [${target}]: E4 .capture.once on r-for items fires once per item`, async ({ page }) => {
    const mount = await gotoDemo(page, target);
    for (const id of ['item-a', 'item-a', 'item-b', 'item-b', 'item-a']) {
      await mount.getByTestId(id).click();
    }
    await expect(mount.getByTestId('hit-log')).toHaveText('a,b');
  });

  runnerFor(target)(`event-options [${target}]: E5 .passive makes preventDefault a no-op`, async ({ page }) => {
    const mount = await gotoDemo(page, target);
    await mount.getByTestId('active').dispatchEvent('wheel', { cancelable: true, bubbles: true });
    await expect(mount.getByTestId('active-result')).toHaveText('true');
    await mount.getByTestId('passive').dispatchEvent('wheel', { cancelable: true, bubbles: true });
    await expect(mount.getByTestId('passive-result')).toHaveText('false');
  });

  runnerFor(target)(`event-options [${target}]: E6 .once on a component event fires once, even after a re-render`, async ({ page }) => {
    const mount = await gotoDemo(page, target);
    await mount.getByTestId('comp-once').click();
    await expect(mount.getByTestId('comp-once-count')).toHaveText('1');
    await mount.getByTestId('comp-once').click();
    await mount.getByTestId('rerender').click();
    await expect(mount.getByTestId('renders')).toHaveText('1');
    await mount.getByTestId('comp-once').click();
    await mount.getByTestId('rerender').click();
    await expect(mount.getByTestId('renders')).toHaveText('2');
    await expect(mount.getByTestId('comp-once-count')).toHaveText('1');
  });

  runnerFor(target)(`event-options [${target}]: E7 plain and .once listeners for one component event`, async ({ page }) => {
    const mount = await gotoDemo(page, target);
    for (let i = 0; i < 3; i++) await mount.getByTestId('comp-merged').click();
    await expect(mount.getByTestId('comp-plain-count')).toHaveText('3');
    await expect(mount.getByTestId('comp-merged-once-count')).toHaveText('1');
  });

  runnerFor(target)(`event-options [${target}]: E8 .once on a component event in r-for fires once per child`, async ({ page }) => {
    const mount = await gotoDemo(page, target);
    for (const id of ['comp-a', 'comp-a', 'comp-b', 'comp-b', 'comp-a']) {
      await mount.getByTestId(id).click();
    }
    await expect(mount.getByTestId('comp-hit-log')).toHaveText('comp-a,comp-b');
  });
}
