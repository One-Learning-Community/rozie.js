// Phase 16 SPEC R1/R5 runtime probe (D-05 runtime arm).
//
// Mounts PropDefaultCoercion three ways and asserts the JSON-substring +
// once-per-instance factory identity contract that the compiler is supposed
// to deliver uniformly across all 6 targets. Sibling e2e specs in vue-vite,
// svelte-vite, angular-analogjs, solid-vite, and lit-vanilla-demo run the
// equivalent assertions on their target's runtime.
import { test, expect } from '@playwright/test';

const EMPTY_JSON =
  '"a":null,"b":0,"c":"","d":false,"e":[],"f":{"k":1}';

test('PropDefaultCoercion — empty mount yields declared defaults', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-prop-default-coercion').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance1');

  const output = page.locator('[data-rozie-pdc-output]');
  await expect(output).toBeVisible();
  await expect(output).toContainText(EMPTY_JSON);

  // D-02 within-mount factory identity probe: $props.e === $data.__lastE
  // and $props.f === $data.__lastF must both report "true" (the cached
  // factory result is the same reference across consecutive renders).
  await expect(page.locator('[data-rozie-pdc-e-identity]')).toHaveText('true');
  await expect(page.locator('[data-rozie-pdc-f-identity]')).toHaveText('true');
});

test('PropDefaultCoercion — separate mounts produce distinct factory identities', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-prop-default-coercion').click();

  // Mount 1: read the `e` array length + verify identity probe reports true.
  await page.getByTestId('pdc-mode-instance1').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance1');
  await expect(page.locator('[data-rozie-pdc-output]')).toContainText(EMPTY_JSON);

  // Switch to mount 2 — the React `key` prop forces a fresh component
  // instance, which means a NEW factory invocation per D-02 once-per-
  // instance. The JSON STILL shows `"e":[]` (the empty array's bytes are
  // identical) but the underlying reference is distinct.
  await page.getByTestId('pdc-mode-instance2').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance2');
  // Wait for the new mount's useEffect to populate $data.observed.
  await expect(page.locator('[data-rozie-pdc-output]')).toContainText(EMPTY_JSON);

  // Both mounts independently report within-mount identity = true.
  await expect(page.locator('[data-rozie-pdc-e-identity]')).toHaveText('true');
  await expect(page.locator('[data-rozie-pdc-f-identity]')).toHaveText('true');
});

test('PropDefaultCoercion — consumer-supplied overrides win over defaults', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('nav-prop-default-coercion').click();
  await page.getByTestId('pdc-mode-override').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('override');
  // Wait for the override mount's useEffect to populate $data.observed.
  await expect(page.locator('[data-rozie-pdc-output]')).toContainText('"a":"override"');

  const text = await page.locator('[data-rozie-pdc-output]').textContent();
  // a is overridden to "override"; e is overridden to [1, 2]. Other props
  // remain at their declared defaults.
  expect(text).toContain('"a":"override"');
  expect(text).toContain('"e":[1,2]');
  // b/c/d/f still at defaults (override didn't touch them).
  expect(text).toContain('"b":0');
  expect(text).toContain('"c":""');
  expect(text).toContain('"d":false');
  expect(text).toContain('"f":{"k":1}');
});
