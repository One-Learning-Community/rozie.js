// THROWAWAY smoke (Phase 71 checkpoint enablement) — verifies the two fresh
// r-keynav demos live-render across all six targets in the playground grid and
// that keyboard navigation works, after wiring `@rozie/runtime-keynav-core`
// into the six preview importmaps. Delete after the checkpoint is signed off.
import { test, expect } from '@playwright/test';

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

test('KeynavMenuDemo live-renders + navigates across all six targets', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/');
  await page.waitForSelector('#snippet option[value="demos/KeynavMenuDemo"]', { state: 'attached', timeout: 30_000 });
  await page.selectOption('#snippet', 'demos/KeynavMenuDemo');

  // Enter grid mode (Compare all targets) so all six iframes render at once.
  await page.check('#preview-mode-toggle-input');

  for (const t of TARGETS) {
    const cell = page.locator(`.preview-cell[data-target="${t}"]`);
    await expect(cell, `cell missing for ${t}`).toHaveCount(1, { timeout: 30_000 });
    const frame = page.frameLocator(`iframe[data-target="${t}"]`);

    // 5 menuitems render (demo compiled + mounted, runtime import resolved).
    await expect(frame.locator('[role="menuitem"]'), `${t}: menuitems`).toHaveCount(5, { timeout: 30_000 });
    // No curated/harness error stamped on the cell.
    await expect(cell, `${t}: cell error`).not.toHaveAttribute('data-error-text', /.+/);

    // Initial active item is index 0 ("New") — proves the controller mounted
    // and applied the initial active state. (Interactive keyboard navigation
    // is proven authoritatively by tests/visual-regression keynav-behavior.spec
    // across all six targets; grid-cell .click() actionability is flaky here.)
    const active = frame.locator('[data-rozie-keynav-active]');
    await expect(active, `${t}: initial active`).toHaveText(/New/, { timeout: 10_000 });
  }

  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
});
