// Phase 69 Plan 06 (D-04), residual (a) — svelte half.
//
// 69-02 compiled the two @rozie/runtime-svelte PortalHost .svelte SFC
// subpath exports Node-side and wired them into svelte.html's importmap so
// portal-using families (e.g. FullCalendar's 10 portal slots) resolve
// cleanly on the svelte target instead of throwing an unresolved-module-
// specifier error. This smoke drives the real playground UI (picker
// selects, not the location.hash deep-link encoding) and asserts the
// resulting svelte iframe is console-clean + non-blank.
import { test, expect } from '@playwright/test';

// esbuild-wasm is fetched/initialized fresh on every iframe's first render —
// generous timeouts account for that one-time cold-start cost per test run.
test.setTimeout(90_000);

test('bundle/FullCalendarDemo renders console-clean + non-blank on svelte (residual a)', async ({
  page,
}) => {
  await page.goto('/');

  // Switch target first, while the default snippet is still selected. This
  // absorbs (a) the playground's own default-load compile (react +
  // bundle/SortableListDemo, which is known to throw an unrelated
  // pre-existing "style-to-js" resolution error — see 69-02-SUMMARY.md
  // Issues Encountered #2) and (b) the svelte iframe's one-time cold
  // esbuild-wasm init, BEFORE we start listening for console errors — so
  // neither shows up as a false positive against the FullCalendar render
  // we're actually asserting on below.
  await page.locator('#target').selectOption('svelte');
  await page.waitForTimeout(20_000);

  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.locator('#snippet').selectOption('bundle/FullCalendarDemo');
  await expect(page.locator('#preview-status')).toHaveText('rendered', { timeout: 45_000 });

  const svelteFrame = page.frameLocator('.preview-cell[data-target="svelte"] iframe');
  const app = svelteFrame.locator('#app');
  await expect(app).not.toBeEmpty();
  const childCount = await app.locator('*').count();
  expect(childCount).toBeGreaterThan(0);

  expect(errors, `console/page errors on svelte target: ${errors.join('\n')}`).toEqual([]);
});
