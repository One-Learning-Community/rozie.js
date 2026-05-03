// DX-03: a deliberate console.log("hello from rozie") in Counter.rozie's
// <script> block survives verbatim through the parse → lower → emit →
// @vitejs/plugin-react → browser pipeline.
//
// Counter.rozie line 32: `console.log("hello from rozie")`. The token stream
// must be byte-identical from .rozie source to compiled .tsx body; here we
// verify the runtime side: the message reaches the browser console.
//
// React StrictMode causes effects to run twice in dev — but module-body
// console.log runs ONCE per component mount (StrictMode double-mounts the
// component, so we expect at least 1 instance, possibly 2).
import { test, expect } from '@playwright/test';

test('console.log("hello from rozie") survives to browser console (DX-03)', async ({ page }) => {
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
