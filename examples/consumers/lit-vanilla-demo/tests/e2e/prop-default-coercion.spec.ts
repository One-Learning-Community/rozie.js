// Phase 16 SPEC R1/R5 runtime probe (D-05 runtime arm) — Lit target.
// Locators pierce the rozie-prop-default-coercion shadow root via
// page.evaluate() since light-DOM testid lookups won't see attributes
// inside the custom element's shadow tree.
import { test, expect } from '@playwright/test';

const EMPTY_JSON =
  '"a":null,"b":0,"c":"","d":false,"e":[],"f":{"k":1}';

async function readShadowText(
  page: import('@playwright/test').Page,
  selector: string,
): Promise<string> {
  return await page.evaluate(
    ({ selector }) => {
      const host = document.querySelector('rozie-prop-default-coercion');
      if (!host) return '';
      const el = host.shadowRoot?.querySelector(selector);
      return el?.textContent ?? '';
    },
    { selector },
  );
}

test('PropDefaultCoercion — empty mount yields declared defaults', async ({
  page,
}) => {
  await page.goto('/src/pages/PropDefaultCoercionPage.html');
  await page.waitForFunction(
    () => customElements.get('rozie-prop-default-coercion') !== undefined,
  );
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance1');

  // Wait for the firstUpdated lifecycle to populate $data.observed.
  await page.waitForFunction(
    () => {
      const host = document.querySelector('rozie-prop-default-coercion');
      const txt = host?.shadowRoot?.querySelector('[data-rozie-pdc-output]')?.textContent;
      return typeof txt === 'string' && txt.length > 4;
    },
  );

  const output = await readShadowText(page, '[data-rozie-pdc-output]');
  expect(output).toContain(EMPTY_JSON);

  expect(await readShadowText(page, '[data-rozie-pdc-e-identity]')).toBe('true');
  expect(await readShadowText(page, '[data-rozie-pdc-f-identity]')).toBe('true');
});

test('PropDefaultCoercion — separate mounts produce distinct factory identities', async ({
  page,
}) => {
  await page.goto('/src/pages/PropDefaultCoercionPage.html');
  await page.waitForFunction(
    () => customElements.get('rozie-prop-default-coercion') !== undefined,
  );

  // instance1
  await page.getByTestId('pdc-mode-instance1').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance1');
  await page.waitForFunction(() => {
    const host = document.querySelector('rozie-prop-default-coercion');
    const txt = host?.shadowRoot?.querySelector('[data-rozie-pdc-output]')?.textContent;
    return typeof txt === 'string' && txt.length > 4;
  });
  const outputMount1 = await readShadowText(page, '[data-rozie-pdc-output]');
  expect(outputMount1).toContain(EMPTY_JSON);

  // instance2
  await page.getByTestId('pdc-mode-instance2').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('instance2');
  await page.waitForFunction(() => {
    const host = document.querySelector('rozie-prop-default-coercion');
    const txt = host?.shadowRoot?.querySelector('[data-rozie-pdc-output]')?.textContent;
    return typeof txt === 'string' && txt.length > 4;
  });
  const outputMount2 = await readShadowText(page, '[data-rozie-pdc-output]');
  expect(outputMount2).toContain(EMPTY_JSON);

  expect(await readShadowText(page, '[data-rozie-pdc-e-identity]')).toBe('true');
  expect(await readShadowText(page, '[data-rozie-pdc-f-identity]')).toBe('true');
});

test('PropDefaultCoercion — consumer-supplied overrides win over defaults', async ({
  page,
}) => {
  await page.goto('/src/pages/PropDefaultCoercionPage.html');
  await page.waitForFunction(
    () => customElements.get('rozie-prop-default-coercion') !== undefined,
  );
  await page.getByTestId('pdc-mode-override').click();
  await expect(page.getByTestId('pdc-mode')).toHaveText('override');
  await page.waitForFunction(() => {
    const host = document.querySelector('rozie-prop-default-coercion');
    const txt = host?.shadowRoot?.querySelector('[data-rozie-pdc-output]')?.textContent;
    return typeof txt === 'string' && txt.includes('override');
  });

  const text = await readShadowText(page, '[data-rozie-pdc-output]');
  expect(text).toContain('"a":"override"');
  expect(text).toContain('"e":[1,2]');
  expect(text).toContain('"b":0');
  expect(text).toContain('"c":""');
  expect(text).toContain('"d":false');
  expect(text).toContain('"f":{"k":1}');
});
