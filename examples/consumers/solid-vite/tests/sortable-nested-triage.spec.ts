// Triage: does SortableListNestedDemo on a real vite-plugin-solid stack
// (with babel-plugin-jsx-dom-expressions) duplicate records on drop?
// The playground (esbuild + solid-js/h, no babel plugin) does. We need to
// know if it's a Rozie compiler bug or a playground harness limit.
import { test, expect } from '@playwright/test';

test('SortableListNestedDemo — initial render + cross-column card drag', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-sortable-nested').click();
  await page.waitForSelector('.rozie-sortable-list', { timeout: 10_000 });

  // Initial state: 3 columns + 6 cards total (3 + 2 + 1).
  const initialCards = await page.locator('.card').count();
  console.log('[triage] initial card count:', initialCards);
  expect(initialCards).toBe(6);

  const initialColumns = await page.locator('.kanban-column').count();
  console.log('[triage] initial column count:', initialColumns);
  expect(initialColumns).toBe(3);

  // Verify the totals text matches.
  await expect(page.locator('.totals')).toHaveText(/3 columns · 6 cards/);

  // Snapshot the card labels per column BEFORE drag.
  const before = await page.evaluate(() => {
    return [...document.querySelectorAll('.kanban-column')].map((col) => ({
      title: col.querySelector('.column-title')?.textContent?.trim() ?? '',
      cards: [...col.querySelectorAll('.card-label')].map((el) => el.textContent?.trim() ?? ''),
    }));
  });
  console.log('[triage] before drag:', JSON.stringify(before, null, 2));

  // Drag the first card of column 1 ("Draft README") to column 2's drop zone.
  const sourceHandle = page.locator('.kanban-column').nth(0).locator('.grip').first();
  const targetColumn = page.locator('.kanban-column').nth(1);

  const srcBox = await sourceHandle.boundingBox();
  const tgtBox = await targetColumn.boundingBox();
  if (!srcBox || !tgtBox) throw new Error('Could not get bounding boxes for drag.');

  // Simulate native HTML5 drag via mouse events (SortableJS uses HTML5 DnD by default,
  // but also responds to mouse events when configured for fallback). Use the
  // multi-step pattern that triggers Sortable's onUpdate/onAdd flow.
  await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
  await page.mouse.down();
  // Move in small increments — SortableJS needs movement events to engage drag.
  for (let i = 0; i < 10; i++) {
    const px = srcBox.x + ((tgtBox.x + tgtBox.width / 2) - srcBox.x) * ((i + 1) / 10);
    const py = srcBox.y + ((tgtBox.y + tgtBox.height / 2) - srcBox.y) * ((i + 1) / 10);
    await page.mouse.move(px, py, { steps: 5 });
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);

  // Snapshot AFTER.
  const after = await page.evaluate(() => {
    return [...document.querySelectorAll('.kanban-column')].map((col) => ({
      title: col.querySelector('.column-title')?.textContent?.trim() ?? '',
      cards: [...col.querySelectorAll('.card-label')].map((el) => el.textContent?.trim() ?? ''),
    }));
  });
  console.log('[triage] after drag:', JSON.stringify(after, null, 2));

  // Total cards across all columns should remain 6 (no duplication).
  const afterCards = await page.locator('.card').count();
  console.log('[triage] after card count:', afterCards);

  // Aggregate all labels — should still contain each of the 6 originals exactly once.
  const allLabelsAfter = after.flatMap((c) => c.cards).sort();
  console.log('[triage] all labels after drag (sorted):', allLabelsAfter);

  const duplicates = allLabelsAfter.filter((label, i) => allLabelsAfter.indexOf(label) !== i);
  console.log('[triage] duplicate labels:', duplicates);

  // The real assertion that catches the bug:
  expect(afterCards).toBe(6);
  expect(duplicates).toEqual([]);
});
