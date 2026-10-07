import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// tests/visual-regression/package.json sets "type": "module".
const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * @rozie-ui/tiptap inside @rozie-ui/dialog — Escape pressed in the editor.
 *
 * ProseMirror prevents the default of every Escape keydown, which kept the
 * surrounding native <dialog> from firing `cancel`. An Escape nothing in the
 * editor handled must close the dialog (reason 'escape'); an Escape a consumer
 * `editorProps.handleKeyDown` consumed must not.
 *
 * BEHAVIOR-ONLY: readouts, never a screenshot.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;
type Target = (typeof TARGETS)[number];

function runnerFor(target: Target) {
  const built = existsSync(
    resolve(__dirname, `../dist/${target}/host/entry.${target}.html`),
  );
  return built ? test : test.fixme;
}

for (const target of TARGETS) {
  const runner = runnerFor(target);

  runner(`tiptap-in-dialog [${target}]: Escape in the editor closes the dialog`, async ({ page }) => {
    await page.goto(`/?example=TipTapInDialog&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await mount.getByTestId('open-dialog').click();
    const editor = mount.getByTestId('plain-editor').locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.type('x');
    await expect(editor).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(mount.getByTestId('readout-open')).toHaveText('false');
    await expect(mount.getByTestId('readout-reason')).toHaveText('escape');
  });

  runner(`tiptap-in-dialog [${target}]: an Escape the editor handled leaves the dialog open`, async ({
    page,
  }) => {
    await page.goto(`/?example=TipTapInDialog&target=${target}`);
    const mount = page.getByTestId('rozie-mount');
    await mount.getByTestId('open-guarded').click();
    const editor = mount.getByTestId('guarded-editor').locator('[contenteditable="true"]');
    await expect(editor).toBeVisible({ timeout: 10_000 });

    await editor.click();
    await page.keyboard.type('x');
    await expect(editor).toBeFocused();
    await page.keyboard.press('Escape');
    // Give a wrongly-delivered close request time to land before asserting.
    await page.waitForTimeout(300);

    await expect(mount.getByTestId('readout-guarded-open')).toHaveText('true');
    await expect(mount.getByTestId('readout-reason')).toHaveText('');
  });
}
