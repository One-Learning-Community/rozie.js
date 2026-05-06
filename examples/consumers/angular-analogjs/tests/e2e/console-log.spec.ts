// DX-03 trust-erosion floor verification (Phase 5 Plan 05-04b).
//
// Counter.rozie line 32: `console.log("hello from rozie")` in <script>.
// The token stream must be byte-identical from .rozie source through
// parse → lowerToIR → emitAngular → @analogjs/vite-plugin-angular → browser.
//
// Per Plan 05-04a, the Angular emitter places `console.log("hello from rozie")`
// inside Counter's `constructor() {...}` body verbatim — verified by
// Counter.ts.snap fixture line 31. The Counter is the default page so its
// constructor runs on first render, firing the log.
//
// We capture page.on('console') and assert the literal "hello from rozie"
// text reaches the browser DevTools console.
//
// Mirrors examples/consumers/svelte-vite/tests/e2e/console-log.spec.ts and
// examples/consumers/react-vite/tests/e2e/console-preserved.spec.ts.
import { test, expect } from '@playwright/test';

test('console.log("hello from rozie") survives end-to-end (DX-03)', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', (m) => {
    messages.push(m.text());
  });

  await page.goto('/');
  // Counter is the default page; the Counter constructor runs on first mount
  // and calls console.log("hello from rozie"). Wait briefly for any async logs
  // (Angular's first CD cycle + zone.js task scheduling).
  await page.waitForTimeout(500);
  expect(messages).toContain('hello from rozie');
});
