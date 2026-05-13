// Phase 06.4 Plan 03 — SC4 vanilla-HTML attribute reactivity for <rozie-counter>.
//
// Asserts that:
//   1. The custom element registers and renders inside its shadow root.
//   2. Clicking the shadow-rooted Increment button updates the value and
//      dispatches `value-change` (host-side listener updates #external).
//   3. Attribute writes (el.setAttribute('value', ...)) propagate via
//      attributeChangedCallback → updates the internal controllable AND
//      triggers Lit re-render (because @property('value') mirror updates).
//
// NOTE on emitter limitations exposed here (v1 — to be addressed in Phase 7
// emitter-types enhancement; documented in 06.4-03-SUMMARY.md):
//   - Direct property writes via `el.value = N` route through the
//     controllable's `write()` BUT do not currently call `host.requestUpdate()`,
//     so the shadow display does not re-render. attributeChangedCallback IS
//     wired correctly (the other direction), so `setAttribute` works.
//   - Attribute reflection on property writes is similarly disconnected —
//     `@property({ reflect: true })` reflects the underlying mirror field
//     (`_value_attr`), but the model-prop setter writes to the controllable,
//     not the mirror.
//
// Shadow-DOM piercing is done via page.evaluate() — Playwright's selector engine
// can pierce shadow DOM with the `>>>` combinator, but evaluate() gives explicit
// programmatic access without selector-engine assumptions.
import { test, expect } from '@playwright/test';

test.describe('SC4 — <rozie-counter> attribute reactivity in vanilla HTML', () => {
  test('renders initial state', async ({ page }) => {
    await page.goto('/src/pages/CounterPage.html');
    const counter = page.locator('#counter');
    await expect(counter).toHaveAttribute('value', '0');

    // Shadow-DOM piercing — verify the button-rendered value is "0".
    const text = await counter.evaluate((el: Element) => {
      const span = (el as HTMLElement).shadowRoot?.querySelector('.value');
      return span?.textContent ?? null;
    });
    expect(text).toBe('0');
  });

  test('shadow-rooted Increment click bumps value', async ({ page }) => {
    await page.goto('/src/pages/CounterPage.html');
    const counter = page.locator('#counter');

    // Click the Increment button inside the shadow root.
    await counter.evaluate((el: Element) => {
      const btn = (el as HTMLElement).shadowRoot?.querySelector(
        'button[aria-label="Increment"]',
      ) as HTMLButtonElement | undefined;
      btn?.click();
    });

    // Counter dispatched value-change → host-side listener updated #external.
    await expect(page.locator('#external')).toHaveText('1');
  });

  test('attribute write triggers attributeChangedCallback + re-render', async ({
    page,
  }) => {
    await page.goto('/src/pages/CounterPage.html');
    const counter = page.locator('#counter');

    await counter.evaluate((el: Element) => {
      el.setAttribute('value', '42');
    });

    // The attribute mirror @property updated → Lit re-renders. The controllable
    // helper's notifyAttributeChange propagated the new value to the getter.
    await expect(counter).toHaveAttribute('value', '42');

    // Shadow-DOM display reflects the new internal value via re-render.
    const text = await counter.evaluate((el: Element) => {
      const span = (el as HTMLElement).shadowRoot?.querySelector('.value');
      return span?.textContent ?? null;
    });
    expect(text).toBe('42');
  });
});
