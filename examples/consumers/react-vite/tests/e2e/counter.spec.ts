// Phase 4 success criterion 1 anchor smoke test:
// Counter mounts and increment click updates value 0 → 1 → back to 0.
//
// The .rozie compiles to a React functional component with useControllableState
// (D-56/D-57 hybrid hook). The page wrapper (src/pages/CounterPage.tsx) starts
// in uncontrolled mode (defaultValue=0); useControllableState owns state internally
// and emits onValueChange to the parent so we can also assert the parent saw the
// value via the [data-testid="parent-value"] readout.
import { test, expect } from '@playwright/test';

test('Counter increments value via click (Phase 4 SC1 anchor smoke test)', async ({ page }) => {
  await page.goto('/');
  // Counter is the default page; click nav button to be explicit + deterministic.
  await page.getByTestId('nav-counter').click();

  // The Counter component renders a `.value` span with the current value.
  await expect(page.getByTestId('counter-value')).toHaveText('0');

  // Click the Increment button (aria-label="Increment" inside Counter.rozie).
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(page.getByTestId('counter-value')).toHaveText('1');

  // Click decrement → back to 0.
  await page.getByRole('button', { name: 'Decrement' }).click();
  await expect(page.getByTestId('counter-value')).toHaveText('0');

  // Parent saw the latest value via onValueChange (uncontrolled mode passthrough).
  await expect(page.getByTestId('parent-value')).toHaveText('0');
});
