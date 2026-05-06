// Phase 5 Plan 05-02b — TodoList spec (slots + named slot fallbacks).
//
// TodoList.rozie demonstrates the marquee Rozie features:
//   - r-for with required :key
//   - Named header slot WITH fallback content
//   - Default slot with per-item slot params
//   - Empty-state slot
//
// In Svelte 5, named slots map to `{#snippet name(params)}` / `{@render
// name?.(params)}`. App.svelte passes ZERO snippets to TodoList, so all
// slots fall back to their defaultContent — verifying the OQ A1 RESOLVED
// verbose form (`{#if header}{@render header(...)}{:else}<fallback />{/if}`).
//
// SVELTE-03 anchor: Snippet-typed named slots + default content rendering.
import { test, expect } from '@playwright/test';

test('TodoList renders fallback header + default-slot rows + can add new todos (SVELTE-03 — slots)', async ({ page }) => {
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
