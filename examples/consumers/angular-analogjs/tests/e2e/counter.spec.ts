// Phase 5 Plan 05-04b — Counter spec.
//
// Counter.rozie compiles to an Angular 17+ standalone component with:
//   - model<number>(0) for `value` (model: true prop) — two-way binding
//   - signal(false) for `hovering` ($data declaration)
//   - computed() for canIncrement / canDecrement
//   - (click)="increment($event)" / (mouseenter)="hovering.set(true)" handlers
//
// AppComponent.ts uses `[(value)]="counterValue"` so the parent counter
// mirror reflects each click. We click +/- buttons and assert both the
// inner `.value` span AND the parent-tracked `data-testid="parent-value"`
// span flip together (proves model() two-way binding works end-to-end).
//
// REQ ANGULAR-01 + ANGULAR-04 — model + signal + computed + emulated encap.
import { test, expect } from '@playwright/test';

test('Counter renders and increments via click (ANGULAR-01 / ANGULAR-04 — model + computed)', async ({ page }) => {
  await page.goto('/');
  // Counter is the default page; click the nav button to be explicit.
  await page.getByTestId('nav-counter').click();

  // The Counter component renders a `.value` span with the current value.
  await expect(page.locator('.value')).toHaveText('0');
  await expect(page.getByTestId('parent-value')).toHaveText('0');

  // Click the Increment button (aria-label="Increment" inside Counter.rozie).
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(page.locator('.value')).toHaveText('1');
  await expect(page.getByTestId('parent-value')).toHaveText('1');

  // Click decrement → back to 0.
  await page.getByRole('button', { name: 'Decrement' }).click();
  await expect(page.locator('.value')).toHaveText('0');
  await expect(page.getByTestId('parent-value')).toHaveText('0');
});
