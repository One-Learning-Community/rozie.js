// Dropdown imperative-handle e2e (Phase 21 $expose). Dropdown.rozie declares
// `$expose({ toggle, close })`; its compiled React output is a forwardRef
// component whose ref carries { toggle, close }. DropdownImperativePage holds
// that ref and drives the dropdown from EXTERNAL buttons — the parent never
// owns the `open` state. This proves the imperative handle works end-to-end
// through the real @rozie/target-react + @rozie/unplugin chain (the producer
// side of $expose; consumers acquire the handle via React's native useRef).
import { test, expect } from '@playwright/test';

test('Dropdown $expose handle: external buttons drive toggle()/close() (Phase 21 REQ-11)', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-dropdown-imperative').click();

  const items = page.getByTestId('imp-items');

  // Panel is r-if-gated on `open`; closed at mount → no items rendered.
  await expect(items).toHaveCount(0);

  // toggle() via the handle opens it — the parent owns no `open` state, so this
  // proves the imperative handle ($expose → forwardRef + useImperativeHandle)
  // drives the child end-to-end.
  await page.getByTestId('handle-toggle').click();
  await expect(items).toBeVisible();

  // close() via the handle forces it shut.
  await page.getByTestId('handle-close').click();
  await expect(items).toHaveCount(0);
});
