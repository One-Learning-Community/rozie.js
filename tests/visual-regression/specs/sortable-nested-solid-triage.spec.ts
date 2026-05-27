// VR triage: does the SortableListNestedDemo show duplicate-on-drop on the
// VR Solid sub-build (real vite-plugin-solid + babel-plugin-jsx-dom-expressions)?
// Mirror of examples/consumers/solid-vite/tests/sortable-nested-triage.spec.ts
// — same drag pattern, same assertions, different mount path (VR's
// import.meta.glob + host/entry.solid.ts vs solid-vite's direct App.tsx route).
import { test, expect } from '@playwright/test';

test('VR Solid SortableListNestedDemo — cross-column card drag', async ({ page }) => {
  await page.goto('/solid/host/entry.solid.html?example=SortableListNested');
  await page.waitForSelector('.rozie-sortable-list', { timeout: 15_000 });

  const initialCards = await page.locator('.card').count();
  console.log('[vr-triage] initial card count:', initialCards);
  expect(initialCards).toBe(6);

  await expect(page.locator('.totals')).toHaveText(/3 columns · 6 cards/);

  const before = await page.evaluate(() => {
    return [...document.querySelectorAll('.kanban-column')].map((col) => ({
      title: col.querySelector('.column-title')?.textContent?.trim() ?? '',
      cards: [...col.querySelectorAll('.card-label')].map((el) => el.textContent?.trim() ?? ''),
    }));
  });
  console.log('[vr-triage] before drag:', JSON.stringify(before, null, 2));

  const sourceHandle = page.locator('.kanban-column').nth(0).locator('.grip').first();
  const targetColumn = page.locator('.kanban-column').nth(1);

  const srcBox = await sourceHandle.boundingBox();
  const tgtBox = await targetColumn.boundingBox();
  if (!srcBox || !tgtBox) throw new Error('Could not get bounding boxes.');

  await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) {
    const px = srcBox.x + ((tgtBox.x + tgtBox.width / 2) - srcBox.x) * ((i + 1) / 10);
    const py = srcBox.y + ((tgtBox.y + tgtBox.height / 2) - srcBox.y) * ((i + 1) / 10);
    await page.mouse.move(px, py, { steps: 5 });
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  const after = await page.evaluate(() => {
    return [...document.querySelectorAll('.kanban-column')].map((col) => ({
      title: col.querySelector('.column-title')?.textContent?.trim() ?? '',
      cards: [...col.querySelectorAll('.card-label')].map((el) => el.textContent?.trim() ?? ''),
    }));
  });
  console.log('[vr-triage] after drag:', JSON.stringify(after, null, 2));

  const afterCards = await page.locator('.card').count();
  console.log('[vr-triage] after card count:', afterCards);

  const allLabelsAfter = after.flatMap((c) => c.cards).sort();
  console.log('[vr-triage] all labels after (sorted):', allLabelsAfter);

  const duplicates = allLabelsAfter.filter((label, i) => allLabelsAfter.indexOf(label) !== i);
  console.log('[vr-triage] duplicate labels:', duplicates);

  expect(afterCards).toBe(6);
  expect(duplicates).toEqual([]);
});
