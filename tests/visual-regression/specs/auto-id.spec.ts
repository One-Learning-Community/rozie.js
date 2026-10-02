import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Per-instance default id base (oinbox 0.8.0 follow-up F6, quick 261002-ekf) on
 * all 6 targets, driven against examples/demos/AutoIdDemo.rozie: two
 * default-configured Listboxes and two default-configured Popovers never share an
 * id (they all used to default to one fixed string). The Combobox case is covered
 * by combobox-recipient.spec.ts.
 *
 * Behavioral assertions only. CSS locators pierce Lit's open shadow roots.
 */

const TARGETS = ['vue', 'react', 'svelte', 'angular', 'solid', 'lit'] as const;

const POLL = { timeout: 10_000, intervals: [100, 200, 400, 800] };

for (const target of TARGETS) {
  const built = existsSync(resolve(__dirname, `../dist/${target}/host/entry.${target}.html`));
  const runner = built ? test : test.fixme;

  runner(`auto-id [${target}]: default Listboxes and Popovers get distinct ids`, async ({ page }) => {
    await page.goto(`/?example=AutoId&target=${target}`);
    await expect(page.getByTestId('rozie-mount')).toBeVisible();

    const listControls: string[] = [];
    for (const label of ['List A', 'List B']) {
      const trigger = page.locator(`button[role="combobox"][aria-label="${label}"]`);
      await expect
        .poll(async () => (await trigger.getAttribute('aria-controls')) ?? '', POLL)
        .toMatch(/^rozie-listbox-\d+-list$/);
      listControls.push((await trigger.getAttribute('aria-controls')) ?? '');
    }
    expect(listControls[0]).not.toBe(listControls[1]);

    const panels = page.locator('.rozie-popover-floating');
    await expect(panels).toHaveCount(2, { timeout: 15_000 });
    await expect.poll(async () => (await panels.nth(0).getAttribute('id')) ?? '', POLL).toMatch(/^rozie-popover-\d+-panel$/);
    await expect.poll(async () => (await panels.nth(1).getAttribute('id')) ?? '', POLL).toMatch(/^rozie-popover-\d+-panel$/);
    expect(await panels.nth(0).getAttribute('id')).not.toBe(await panels.nth(1).getAttribute('id'));
  });
}
