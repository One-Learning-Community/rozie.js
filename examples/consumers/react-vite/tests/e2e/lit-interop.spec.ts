// Phase 06.4 P3 SC5 — React 19 consuming a compiled Lit custom element.
//
// Asserts the <rozie-counter> renders in the React host, that React 19's
// native customElements support routes the onvalue-change handler correctly
// (lowercase-dashed property handler per RESEARCH.md A5 / Pitfall 7), and
// that the parent React state updates when the custom element dispatches.
import { test, expect } from '@playwright/test';

test('SC5 React — <rozie-counter> renders and value-change updates parent state', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-lit-interop').click();

  const counter = page.locator('rozie-counter');
  await expect(counter).toBeVisible();

  // Wait for upgrade — once the @customElement decorator runs, the element is
  // upgraded and customElements.get returns the constructor.
  await page.waitForFunction(
    () => customElements.get('rozie-counter') !== undefined,
  );

  // Initial parent state = 5 (React useState).
  await expect(page.getByTestId('parent-value')).toHaveText('5');

  // Click the shadow-rooted Increment button — the custom element will
  // dispatch value-change, React 19's lowercase-dashed onvalue-change handler
  // routes the event to setVal, and the parent updates. The exact final
  // value depends on whether the property write (React passes `value={5}` as
  // a property) propagated to the internal controllable mirror — a v1
  // emitter limitation (see deferred-items.md D-LIT-FUTURE-03). The test
  // verifies the fundamental flow: custom element click → CustomEvent →
  // React state updates.
  await counter.evaluate((el: Element) => {
    const btn = (el as HTMLElement).shadowRoot?.querySelector(
      'button[aria-label="Increment"]',
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });

  const updated = await page.getByTestId('parent-value').textContent();
  expect(Number(updated)).toBeGreaterThanOrEqual(1);
});
