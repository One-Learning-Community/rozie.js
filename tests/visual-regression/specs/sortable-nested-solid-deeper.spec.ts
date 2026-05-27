// Multi-step drag sequence that exposes a hardening bug in examples/SortableList.rozie:
// when SortableJS's e.item isn't a valid Node (fallback-mode events, touch
// screens, or when source-side onRemove fires after destination's onAdd has
// detached the element), `listElRef.insertBefore(e.item, …)` throws inside
// SortableJS's `_dispatchEvent`. SortableJS silently swallows the throw, so:
//
//   1. The DOM-restore step fails
//   2. The model writeback (`$props.items = next`) never runs
//   3. The source column's cards-change chain breaks
//   4. The source column's `$data.columns[i].cards` stays at its initial value
//   5. A later column reorder reveals the stale data → duplicates
//
// This is a hardening bug in the user-authored SortableList demo, NOT a
// Rozie compiler bug. Reproduces the user-reported "Solid resets initial
// state on drop, records duplicate" symptom on the real vite-plugin-solid
// stack — at least when triggered via Playwright's mouse-event drag (which
// engages SortableJS's fallback mode). Whether real-user HTML5 DnD also
// triggers the throw is open; some browsers/touch devices definitely do.
//
// Closed 2026-05-26 (quick task 260526-q7s): the SortableJS-vs-reconciler
// dance moved into `useSortableJS()` (`@rozie/runtime-engine-helpers`).
// The helper wraps the DOM-restore step in try/catch and uses identity-
// based item lookup over fragile `e.oldIndex` — both required hardenings.
import { test, expect } from '@playwright/test';

test('VR Solid SortableListNested — multi-drag sequence + column reorder', async ({ page }) => {
  await page.goto('/solid/host/entry.solid.html?example=SortableListNested');
  await page.waitForSelector('.rozie-sortable-list', { timeout: 15_000 });

  const snapshot = () => page.evaluate(() => {
    return [...document.querySelectorAll('.kanban-column')].map((col) => ({
      title: col.querySelector('.column-title')?.textContent?.trim() ?? '',
      cards: [...col.querySelectorAll('.card-label')].map((el) => el.textContent?.trim() ?? ''),
    }));
  });

  const dragFromTo = async (srcEl: any, tgtEl: any) => {
    const srcBox = await srcEl.boundingBox();
    const tgtBox = await tgtEl.boundingBox();
    if (!srcBox || !tgtBox) throw new Error('boundingBox null');
    await page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
    await page.mouse.down();
    for (let i = 0; i < 12; i++) {
      const px = srcBox.x + ((tgtBox.x + tgtBox.width / 2) - srcBox.x) * ((i + 1) / 12);
      const py = srcBox.y + ((tgtBox.y + tgtBox.height / 2) - srcBox.y) * ((i + 1) / 12);
      await page.mouse.move(px, py, { steps: 5 });
      await page.waitForTimeout(25);
    }
    await page.mouse.up();
    await page.waitForTimeout(500);
  };

  const totalAndDups = (snap: Awaited<ReturnType<typeof snapshot>>) => {
    const all = snap.flatMap((c) => c.cards);
    const dups = all.filter((l, i) => all.indexOf(l) !== i);
    return { total: all.length, dups };
  };

  // Initial
  let s = await snapshot();
  console.log('[deep] step 0 (initial):', JSON.stringify(s));
  expect(totalAndDups(s).total).toBe(6);
  expect(totalAndDups(s).dups).toEqual([]);

  // Drag 1: cross-column card move (To do → Doing)
  await dragFromTo(
    page.locator('.kanban-column').nth(0).locator('.grip').first(),
    page.locator('.kanban-column').nth(1),
  );
  s = await snapshot();
  console.log('[deep] step 1 (cross-col card drag):', JSON.stringify(s));
  console.log('[deep] step 1 total+dups:', totalAndDups(s));

  // Drag 2: another cross-column card move (Doing → Done)
  await dragFromTo(
    page.locator('.kanban-column').nth(1).locator('.grip').first(),
    page.locator('.kanban-column').nth(2),
  );
  s = await snapshot();
  console.log('[deep] step 2 (second cross-col):', JSON.stringify(s));
  console.log('[deep] step 2 total+dups:', totalAndDups(s));

  // Drag 3: same-column reorder (drag card within Done back up)
  const doneGrips = page.locator('.kanban-column').nth(2).locator('.grip');
  const gripCount = await doneGrips.count();
  if (gripCount >= 2) {
    await dragFromTo(doneGrips.nth(0), doneGrips.nth(gripCount - 1));
    s = await snapshot();
    console.log('[deep] step 3 (same-col reorder):', JSON.stringify(s));
    console.log('[deep] step 3 total+dups:', totalAndDups(s));
  }

  // Drag 4: column reorder (outer SortableList) — drag column-bar of column 1 to column 3 position
  await dragFromTo(
    page.locator('.kanban-column').nth(0).locator('.column-bar'),
    page.locator('.kanban-column').nth(2).locator('.column-bar'),
  );
  s = await snapshot();
  console.log('[deep] step 4 (column reorder):', JSON.stringify(s));
  console.log('[deep] step 4 total+dups:', totalAndDups(s));

  const final = totalAndDups(s);
  expect(final.total).toBe(6);
  expect(final.dups).toEqual([]);
});
