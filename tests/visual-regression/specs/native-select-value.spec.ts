import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * A declarative native `<select :value="…">` (examples/demos/NativeSelectValueDemo.rozie):
 * the bound value selects its <option> at mount, when the value changes, when the options
 * are replaced by an equal set, and when the options arrive after the value.
 *
 * Behavioral assertions only (no screenshots). CSS / test-id locators pierce Lit's open
 * shadow roots.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = built ? test : test.fixme;

  runner(`native-select-value [${target}]: the bound value selects its option`, async ({ page }) => {
    await page.goto(`/?example=NativeSelectValue&target=${target}`);
    const sel = page.getByTestId('sel');
    await expect(page.getByTestId('readout')).toHaveText('b');
    await expect(sel).toHaveValue('b'); // first render

    await page.getByTestId('pick-c').click();
    await expect(page.getByTestId('readout')).toHaveText('c');
    await expect(sel).toHaveValue('c'); // the value changed

    await page.getByTestId('replace').click();
    await page.waitForTimeout(100);
    await expect(sel).toHaveValue('c'); // equal options, re-rendered

    await sel.selectOption('a');
    await expect(page.getByTestId('readout')).toHaveText('a');
    await expect(sel).toHaveValue('a');

    const late = page.getByTestId('late');
    await page.getByTestId('fill').click();
    await expect(late.locator('option')).toHaveCount(3);
    await expect(late).toHaveValue('c'); // options arriving after the value
  });
}
