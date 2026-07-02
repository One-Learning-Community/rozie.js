// Phase 69 Plan 06 (D-04), residual (c).
//
// 69-04 confirmed (via live Playwright instrumentation) a genuine render
// order-inversion race in `solid.html`: two overlapping `render` messages
// can complete out of order (a slower-resolving compile finishing AFTER a
// faster, newer one), and a slower render's stale `dispose()`/`render()`
// pair could clobber the newer render's already-mounted content. The fix —
// a module-local `currentRenderId` gate re-checked immediately before the
// `dispose()`/`render()` pair — skips a superseded render instead of
// letting it run out of order.
//
// This spec codifies 69-04's own verified repro directly against
// `/preview/solid.html` (bypassing the full playground UI, same rationale
// as lit-sibling-rerender.spec.ts): fire a deliberately size-padded "slow"
// component immediately followed by a trivial "fast" one, with NO await
// between the two `postMessage` calls, across several padding sizes to
// exercise the actual esbuild-transform-timing race Pitfall 3 describes.
// Post-fix, the final mounted content must always be the LATEST request
// (FAST), never a stale, out-of-order SLOW clobber — regardless of whether
// genuine reordering occurs in this environment.
import { test, expect } from '@playwright/test';

function padded(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += `const __pad_${i} = ${i};\n`;
  return s;
}

const FAST_SRC = `
export default function Fast() {
  return <div id="result">FAST</div>;
}
`;

function slowSrc(n: number): string {
  return `
${padded(n)}
export default function Slow() {
  return <div id="result">SLOW</div>;
}
`;
}

function renderPayload(code: string) {
  return { type: 'render', code, css: '', siblings: {} };
}

test('rapid overlapping renders always settle on the latest content, never a stale clobber (residual c)', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await page.addInitScript(() => {
    (window as any).__msgs = [];
    window.addEventListener('message', (e) => {
      if (e.data && typeof e.data === 'object') (window as any).__msgs.push(e.data);
    });
  });

  await page.goto('/preview/solid.html');
  await page.waitForFunction(() => (window as any).__msgs?.some((m: any) => m.type === 'ready'));

  // Warm up esbuild-wasm's one-time cold-init first — not part of the race
  // timing we care about.
  await page.evaluate((payload) => window.postMessage(payload, '*'), renderPayload(FAST_SRC));
  await page.waitForFunction(
    () => (window as any).__msgs.some((m: any) => m.type === 'rendered'),
    undefined,
    { timeout: 30_000 },
  );

  // Escalating padding sizes, mirroring 69-04's own repro sweep — a
  // deliberately slow-transforming render fired immediately before a
  // trivial fast one, no await in between.
  for (const n of [2000, 4000, 8000, 16000]) {
    await page.evaluate((payload) => window.postMessage(payload, '*'), renderPayload(slowSrc(n)));
    await page.evaluate((payload) => window.postMessage(payload, '*'), renderPayload(FAST_SRC));

    await expect(page.locator('#app')).toContainText('FAST', { timeout: 10_000 });
    await expect(page.locator('#app')).not.toContainText('SLOW');
  }

  expect(
    consoleErrors,
    `console/page errors during overlapping-render race: ${consoleErrors.join('\n')}`,
  ).toEqual([]);
});
