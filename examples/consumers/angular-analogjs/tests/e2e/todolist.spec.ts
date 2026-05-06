// Phase 5 Plan 05-04b — TodoList spec (slots + named slot fallbacks).
//
// TodoList.rozie demonstrates the marquee Rozie features:
//   - r-for with required :key → @for (item of items(); track item.id) (Pitfall 3 mitigation — ROZ720)
//   - Named header slot WITH fallback content
//   - Default slot with per-item slot params (typed via ngTemplateContextGuard)
//   - Empty-state slot
//
// In Angular, named slots map to `@ContentChild('header', { read: TemplateRef })`
// + `*ngTemplateOutlet="headerTpl; context: {...}"`. AppComponent.ts passes
// ZERO ng-templates to TodoList for header / empty, so those slots fall back
// to their default content. AppComponent DOES pass `<ng-template #defaultSlot>` for
// the per-item row IF intentional — but here we omit it to exercise default
// slot fallback (the OQ A1 RESOLVED verbose form).
//
// REQ ANGULAR-03 — ngTemplateContextGuard + *ngTemplateOutlet.
import { test, expect } from '@playwright/test';

test('TodoList renders fallback header + default-slot rows + can add new todos (ANGULAR-03 — slots)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-todo-list').click();

  // Header fallback: "{title} ({remaining} remaining)" — 1 of 3 not done.
  // Initial seed: [done, done, NOT-done] → remaining=1.
  await expect(page.locator('h3')).toContainText('My Todos');
  await expect(page.locator('h3')).toContainText('1 remaining');

  // Default slot fallback renders <label> + <input type=checkbox> + <span> per item.
  // 3 items.
  const items = page.locator('ul li');
  await expect(items).toHaveCount(3);

  // Add a new todo via the form.
  const draft = page.locator('input[placeholder="What needs doing?"]');
  await draft.fill('test todo');
  await page.getByRole('button', { name: 'Add' }).click();

  // Now 4 items, 2 remaining (the new one is undone).
  await expect(page.locator('ul li')).toHaveCount(4);
  await expect(page.locator('h3')).toContainText('2 remaining');
});

test('TodoList toggle changes done state via fallback-slot checkbox', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-todo-list').click();

  // The third item starts undone — toggle its checkbox.
  const thirdCheckbox = page.locator('ul li').nth(2).locator('input[type="checkbox"]');
  await expect(thirdCheckbox).not.toBeChecked();
  await thirdCheckbox.check();

  // After toggle, all 3 items are done — header shows "0 remaining".
  await expect(page.locator('h3')).toContainText('0 remaining');
});
