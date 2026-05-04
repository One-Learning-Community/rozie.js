// Phase 4 success criterion 3: model:true → useControllableState (D-56/D-57)
// supports BOTH controlled and uncontrolled modes; toggling between them after
// first render emits ROZ550 console.warn (parent-flip detection).
//
// REACT-T-03 anchor. The runtime helper at @rozie/runtime-react/useControllableState
// raises a one-shot console.warn with code ROZ550 when the controlled signal
// (props.value being undefined vs. defined) flips after the first render.
import { test, expect } from '@playwright/test';

test('Counter useControllableState — uncontrolled then controlled mode emits ROZ550 warn (Phase 4 SC3 / REACT-T-03)', async ({
  page,
}) => {
  const consoleMessages: { type: string; text: string }[] = [];
  page.on('console', (m) => {
    consoleMessages.push({ type: m.type(), text: m.text() });
  });

  await page.goto('/');
  await page.getByTestId('nav-counter').click();

  // Uncontrolled mode (default): increment increments internal state; parent sees onValueChange callback.
  await expect(page.getByTestId('mode-label')).toHaveText('uncontrolled');
  await expect(page.getByTestId('counter-value')).toHaveText('0');
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(page.getByTestId('counter-value')).toHaveText('1');
  await expect(page.getByTestId('parent-value')).toHaveText('1');

  // Toggle to controlled mode — useControllableState sees props.value go from
  // undefined → 1 (a "parent flip"). Emits a one-shot ROZ550 console.warn.
  await page.getByTestId('toggle-controlled').click();
  await expect(page.getByTestId('mode-label')).toHaveText('controlled');

  // Allow React + the warn to flush.
  await page.waitForTimeout(50);

  // Verify the parent-flip warning fired.
  const warnTexts = consoleMessages
    .filter((m) => m.type === 'warning' || m.type === 'warn')
    .map((m) => m.text)
    .join(' || ');
  expect(warnTexts).toMatch(/ROZ550/);

  // Now in controlled mode: increment should still work (parent owns state).
  await page.getByRole('button', { name: 'Increment' }).click();
  await expect(page.getByTestId('counter-value')).toHaveText('2');
  await expect(page.getByTestId('parent-value')).toHaveText('2');
});
