// Phase 06.4 Plan 03 — SearchInput typing + search event dispatch in a real
// browser.
//
// NOTE: The v1 Lit emitter does NOT honor the `.debounce(300)` modifier on
// template-event bindings (it works for the <listeners> block but not for
// inline @event.debounce(N) in <template>). Documented in 06.4-03-SUMMARY.md
// as a deferred Phase 7 emitter enhancement. This test verifies the
// fundamental flow (input → search event → host receives detail) without the
// debounce timing window.
import { test, expect } from '@playwright/test';

test('SearchInput typing dispatches search event to host', async ({ page }) => {
  await page.goto('/src/pages/SearchInputPage.html');

  await page.waitForFunction(
    () => customElements.get('rozie-search-input') !== undefined,
  );

  const search = page.locator('#search');
  const lastQuery = page.locator('#last-query');

  // Type into the shadow-rooted input.
  await search.evaluate((el: Element) => {
    const input = (el as HTMLElement).shadowRoot?.querySelector(
      'input',
    ) as HTMLInputElement | undefined;
    if (input) {
      input.value = 'hi';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  // The host listener captured the search event. (Without the debounce
  // window, the event fires synchronously on every keystroke that passes the
  // minLength guard. The "hi" value is 2 chars which equals minLength=2.)
  await expect(lastQuery).toHaveText('hi');
});
