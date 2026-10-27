import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * TextField behavioral smoke — the accessible text field (`TextField`).
 *
 * The control is a native <input> / <textarea>; what TextField owns is the field
 * around it. This spec proves that wiring behaves identically on all six targets —
 * including Lit, where label, control and helper text share one shadow root (the
 * reason the control lives inside the component):
 *   - the <label for> labels the control (getByLabel resolves; a label click focuses it);
 *   - aria-describedby lists exactly the rendered description / error / counter;
 *   - an error sets aria-invalid and joins describedby, and clearing it undoes both;
 *   - typing writes the two-way modelValue; `enter` fires on Enter, `change` on blur;
 *   - a programmatic model write reaches the control; clear() / focus() work;
 *   - a multiline autosize field grows with its content and caps at maxRows.
 *
 * `examples/demos/TextFieldBehaviorDemo.rozie` mounts an email field (idBase
 * `demo-email`, maxLength 40 + counter, toggleable error) and an autosize notes
 * textarea (rows 2, maxRows 4).
 *
 * Structural/behavioral assertions only — the pixel cell is TextFieldScreenshot in
 * matrix.spec.ts (feedback_vr_linux_baselines).
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = built ? test : test.fixme;

  test.describe(`text-field [${target}]`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/?example=TextFieldBehavior&target=${target}`);
      await expect(page.getByTestId('rozie-mount')).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible({ timeout: 15_000 });
    });

    runner('the label labels the control and focuses it on click', async ({ page }) => {
      const input = page.getByLabel('Email');
      await expect(input).toHaveAttribute('id', 'demo-email-input');
      await expect(input).toHaveAttribute('type', 'email');
      await expect(input).toHaveAttribute('required', '');
      await page.locator('label', { hasText: 'Email' }).click();
      await expect(input).toBeFocused();
    });

    runner('describedby tracks the rendered helper text; an error sets aria-invalid', async ({ page }) => {
      const input = page.getByLabel('Email');
      await expect(input).toHaveAttribute('aria-describedby', 'demo-email-description demo-email-count');
      await expect(input).not.toHaveAttribute('aria-invalid', /.*/);

      await page.getByTestId('toggle-error').click();
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAttribute(
        'aria-describedby',
        'demo-email-description demo-email-error demo-email-count',
      );
      await expect(page.locator('#demo-email-error')).toHaveText('Enter a valid email address.');

      await page.getByTestId('toggle-error').click();
      await expect(input).not.toHaveAttribute('aria-invalid', /.*/);
      await expect(input).toHaveAttribute('aria-describedby', 'demo-email-description demo-email-count');
      await expect(page.locator('#demo-email-error')).toHaveCount(0);
    });

    runner('typing writes the model; Enter emits enter, blur emits change', async ({ page }) => {
      const input = page.getByLabel('Email');
      await input.click();
      await input.pressSequentially('ab');
      await expect(page.getByTestId('readout-value')).toHaveText('ab');
      await expect(page.locator('#demo-email-count')).toHaveText('2 / 40');
      await expect(page.getByTestId('readout-change')).toHaveText('');

      await input.press('Enter');
      await expect(page.getByTestId('readout-enter')).toHaveText('ab');

      await page.getByTestId('readout-value').click();
      await expect(page.getByTestId('readout-change')).toHaveText('ab');
    });

    runner('a programmatic write reaches the control; clear() and focus() work', async ({ page }) => {
      const input = page.getByLabel('Email');
      await page.getByTestId('set-email').click();
      await expect(input).toHaveValue('ada@example.com');

      await page.getByTestId('clear-email').click();
      await expect(input).toHaveValue('');
      await expect(page.getByTestId('readout-value')).toHaveText('');

      await page.getByTestId('focus-email').click();
      await expect(input).toBeFocused();
    });

    runner('an autosize textarea grows with its content and caps at maxRows', async ({ page }) => {
      const notes = page.getByLabel('Notes');
      await expect(notes).toBeVisible();
      const height = () => notes.evaluate((el) => (el as HTMLElement).getBoundingClientRect().height);
      const initial = await height();

      await notes.click();
      await notes.press('a');
      await notes.press('Enter');
      await notes.press('b');
      await notes.press('Enter');
      await notes.press('c');
      await expect.poll(height).toBeGreaterThan(initial + 4);
      const threeLines = await height();
      await expect(notes).toHaveCSS('overflow-y', 'hidden');

      await page.getByTestId('set-notes').click();
      await expect(page.getByTestId('readout-notes')).toHaveText('33');
      await expect.poll(height).toBeGreaterThan(threeLines + 4);
      await expect(notes).toHaveCSS('overflow-y', 'auto');
      const capped = await height();
      // The cap holds: content far past four rows does not keep growing the box.
      await notes.press('End');
      await notes.press('Enter');
      await notes.press('x');
      await expect.poll(height).toBe(capped);
    });
  });
}
