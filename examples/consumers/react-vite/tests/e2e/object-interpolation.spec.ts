// Phase 26 (D-08/D-09) — object-interpolation no-crash e2e (SPEC-1 acceptance).
//
// Before Phase 26 the React leg threw "Objects are not valid as a React child"
// the instant a non-primitive value reached an interpolation site ({{ }} text,
// :attr binding, or class interpolation). The annotateDisplayWrap gate now wraps
// each non-provably-primitive interpolation in rozieDisplay, so a plain object
// ({ a: 1, b: [2, 3] }) renders as 2-space pretty-printed JSON text instead.
//
// This spec is the runtime arm of D-09: it proves React no longer crashes and
// the object renders as the expected JSON. Byte-exact cross-target JSON parity
// is proven separately and more precisely by the dist-parity text gates; the
// Linux-Docker VR cell is intentionally SKIPPED for this fixture (D-09).
import { test, expect } from '@playwright/test';

// JSON.stringify({ a: 1, b: [2, 3] }, null, 2) — the rozieDisplay output that
// each non-Vue target must render identically (React here).
const EXPECTED_JSON = `{
  "a": 1,
  "b": [
    2,
    3
  ]
}`;

test('ObjectInterp — object interpolation does NOT crash React and renders JSON (SPEC-1/D-09)', async ({
  page,
}) => {
  // Capture every console error so a React "Objects are not valid as a React
  // child" invariant (which surfaces as a console error before the error
  // overlay) fails the test loudly.
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  // Uncaught exceptions (the React invariant throw) also fail the test.
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => {
    pageErrors.push(e.message);
  });

  await page.goto('/');
  await page.getByTestId('nav-object-interp').click();

  // The fixture's root <div class="object-interp"> must mount — if React
  // crashed on the object child, this element would never appear.
  const root = page.locator('.object-interp');
  await expect(root).toBeVisible();

  // (a) No "Objects are not valid as a React child" anywhere.
  const allMessages = [...consoleErrors, ...pageErrors].join('\n');
  expect(allMessages).not.toContain('Objects are not valid as a React child');
  expect(pageErrors).toEqual([]);

  // (b) The interpolated object renders as the expected 2-space JSON in the
  // text-node position. textContent collapses no whitespace, so the exact
  // pretty-printed JSON is present verbatim.
  await expect(root.locator('p')).toContainText(EXPECTED_JSON);

  // (c) The :data-x attribute-binding position carries the same JSON string.
  const dataX = await root.locator('p').getAttribute('data-x');
  expect(dataX).toBe(EXPECTED_JSON);

  // (d) The class-interpolation position embeds the JSON in the class attribute
  // (class="card--<json> ..."). Assert the wrapped JSON reached the class list.
  const className = await root.locator('p').getAttribute('class');
  expect(className).toContain('card--{');
  expect(className).toContain('"a": 1');
});
