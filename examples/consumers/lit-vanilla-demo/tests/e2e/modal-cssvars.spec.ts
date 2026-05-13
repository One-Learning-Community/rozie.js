// Phase 06.4 Plan 03 — Modal :root CSS-vars piercing via injectGlobalStyles
// (D-LIT-15). Asserts that the `:root { --rozie-modal-z: 2000; }` rule emitted
// at the top of Modal.rozie's <style> block actually reaches
// document.documentElement.style — i.e. is NOT scoped to the shadow root.
//
// This is the SC4 sibling for the "global stylesheet escape hatch" pattern.
import { test, expect } from '@playwright/test';

test('Modal :root CSS variables are injected into document.documentElement', async ({
  page,
}) => {
  await page.goto('/src/pages/ModalPage.html');

  // Wait for the custom element to upgrade — once <rozie-modal> upgrades, its
  // module-level injectGlobalStyles() call has already run.
  await page.waitForFunction(
    () => customElements.get('rozie-modal') !== undefined,
  );

  // Read --rozie-modal-z from document.documentElement's computed style.
  // injectGlobalStyles inserts a <style data-rozie-global-id="..."> into
  // <head>, so the variable is visible globally.
  const modalZ = await page.evaluate(() => {
    const root = document.documentElement;
    return getComputedStyle(root).getPropertyValue('--rozie-modal-z').trim();
  });

  expect(modalZ).toBe('2000');

  // The injected style tag exists with the expected marker attribute.
  const markerCount = await page.evaluate(
    () =>
      document.head.querySelectorAll('style[data-rozie-global-id]').length,
  );
  expect(markerCount).toBeGreaterThanOrEqual(1);
});
