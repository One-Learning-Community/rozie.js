// Phase 16 SPEC R1/R5 runtime probe (D-05 runtime arm) — Vue target.
import { test, expect } from '@playwright/test';

const EMPTY_JSON =
  '"a":null,"b":0,"c":"","d":false,"e":[],"f":{"k":1}';

test('PropDefaultCoercion — empty mount yields declared defaults', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-PropDefaultCoercion').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance1');

  const output = page.locator('[data-rozie-pdc-output]');
  await expect(output).toBeVisible();
  await expect(output).toContainText(EMPTY_JSON);

  // D-02 once-per-instance factory identity probe — two consecutive
  // `$props.e === $props.e` reads within the same expression must yield
  // `true`. Vue 3.5+ caches via `instance.propsDefaults`; Vue 3.4 hits
  // per-access re-invocation and this would assert `false` (a known Vue
  // 3.4 limitation; Vue's compiler-sfc rejects scope references inside
  // `withDefaults` so Rozie's emitter cannot inject a D-02 workaround).
  await expect(page.locator('[data-rozie-pdc-e-identity]')).toHaveText('true');
  await expect(page.locator('[data-rozie-pdc-f-identity]')).toHaveText('true');
});

test('PropDefaultCoercion — separate mounts both yield declared defaults', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-PropDefaultCoercion').click();

  await page.getByTestId('pdc-mode-instance1').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance1');
  await expect(page.locator('[data-rozie-pdc-output]')).toContainText(EMPTY_JSON);

  await page.getByTestId('pdc-mode-instance2').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance2');
  await expect(page.locator('[data-rozie-pdc-output]')).toContainText(EMPTY_JSON);

  await expect(page.locator('[data-rozie-pdc-e-identity]')).toHaveText('true');
  await expect(page.locator('[data-rozie-pdc-f-identity]')).toHaveText('true');
});

test('PropDefaultCoercion — consumer-supplied overrides win over defaults', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-PropDefaultCoercion').click();
  await page.getByTestId('pdc-mode-override').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('override');
  await expect(page.locator('[data-rozie-pdc-output]')).toContainText('"a":"override"');

  const text = await page.locator('[data-rozie-pdc-output]').textContent();
  expect(text).toContain('"a":"override"');
  expect(text).toContain('"e":[1,2]');
  expect(text).toContain('"b":0');
  expect(text).toContain('"c":""');
  expect(text).toContain('"d":false');
  expect(text).toContain('"f":{"k":1}');
});
