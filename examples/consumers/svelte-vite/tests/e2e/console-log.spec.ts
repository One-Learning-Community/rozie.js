// DX-03 trust-erosion floor verification (Phase 5 Plan 05-02b).
//
// Counter.rozie line 32: `console.log("hello from rozie")` in <script>.
// The token stream must be byte-identical from .rozie source through
// parse → lowerToIR → emitSvelte → @sveltejs/vite-plugin-svelte → browser.
//
// We capture page.on('console') and assert the literal "hello from rozie"
// text reaches the browser DevTools console.
//
// Mirrors examples/consumers/react-vite/tests/e2e/console-preserved.spec.ts.
import { test, expect } from '@playwright/test';

test('console.log("hello from rozie") survives end-to-end (DX-03)', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', (m) => {
    messages.push(m.text());
  });

  await page.goto('/');
  // Counter is the default page; the Counter setup runs on first mount and
  // calls console.log("hello from rozie"). Wait briefly for any async logs.
  await page.waitForTimeout(300);
  expect(messages).toContain('hello from rozie');
});
