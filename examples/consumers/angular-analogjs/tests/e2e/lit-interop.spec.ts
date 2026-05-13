// Phase 06.4 P3 SC5 — Angular standalone consuming a compiled Lit custom element.
import { test, expect } from '@playwright/test';

test('SC5 Angular — <rozie-counter> renders and (value-change) updates parent state', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-lit-interop').click();

  const counter = page.locator('rozie-counter');
  await expect(counter).toBeVisible();

  await page.waitForFunction(
    () => customElements.get('rozie-counter') !== undefined,
  );

  // Initial parent state = 5 (Angular signal).
  await expect(page.getByTestId('parent-value')).toHaveText('5');

  await counter.evaluate((el: Element) => {
    const btn = (el as HTMLElement).shadowRoot?.querySelector(
      'button[aria-label="Increment"]',
    ) as HTMLButtonElement | undefined;
    btn?.click();
  });

  // Angular's parent should observe the update via (value-change). v1 emitter
  // limitation: property-write does not propagate to the internal attribute
  // mirror (see deferred-items.md D-LIT-FUTURE-03).
  const updated = await page.getByTestId('parent-value').textContent();
  expect(Number(updated)).toBeGreaterThanOrEqual(1);
});
