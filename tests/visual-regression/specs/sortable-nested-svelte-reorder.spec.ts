// Behavioral VR cell for the nested-Kanban SVELTE column-reorder bug.
//
// Symptom: cards move between columns fine, but as soon as you reorder the
// OUTER columns, the moved columns revert to their SEED cards and duplicate
// (report: shove everything into col 1 → 6 items, swap the last two columns →
// the new columns reseed → 9 total).
//
// Root cause (fixed in dc34152e): Svelte re-exposed `model:true` props were
// emitted as bare `$bindable()` with NO `<key>-change` event on any write
// path. KanbanColumn re-exposes SortableList's `items` as its own `cards`
// model; the demo consumes it ONE-WAY (`:cards` + `@cards-change`, forced by
// the ROZ951 deep-chain-lvalue rule). On Svelte the `oncardschange` handler
// fell dead into `...__rozieAttrs`, so the demo's `columns` state never synced
// from inner card moves and stayed at the deep-cloned seed. The outer reorder
// then committed from that stale seed → moved columns reseeded + duplicated.
// React (onValueChange) / Vue (defineModel) always delivered the writeback, so
// this was Svelte-only.
//
// This spec drives a TWO-STAGE drag: (1) a cross-column card move, then (2) an
// outer column reorder. It asserts the card move PERSISTS across the reorder
// and no cards are lost or duplicated. It FAILS on the pre-fix build (the
// moved card reverts to seed and/or the total climbs past 6) and PASSES once
// the get/set `on<key>change` binding lands.
import { test, expect } from '@playwright/test';

type Board = { title: string; cards: string[] }[];

async function readBoard(page: import('@playwright/test').Page): Promise<Board> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.kanban-column')].map((col) => ({
      title: col.querySelector('.column-title')?.textContent?.trim() ?? '',
      cards: [...col.querySelectorAll('.card-label')].map((el) => el.textContent?.trim() ?? ''),
    })),
  );
}

// Linear mouse drag from the centre of `from` to the centre of `to`, in steps
// that give SortableJS time to register the dragover/sort. Mirrors the drag
// pattern used by the Lit-reset / Solid-triage nested specs.
async function drag(
  page: import('@playwright/test').Page,
  from: { x: number; y: number; width: number; height: number },
  to: { x: number; y: number; width: number; height: number },
): Promise<void> {
  const sx = from.x + from.width / 2;
  const sy = from.y + from.height / 2;
  const tx = to.x + to.width / 2;
  const ty = to.y + to.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(sx + (tx - sx) * ((i + 1) / 12), sy + (ty - sy) * ((i + 1) / 12), {
      steps: 5,
    });
    await page.waitForTimeout(20);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
}

function box(b: Awaited<ReturnType<import('@playwright/test').Locator['boundingBox']>>) {
  if (!b) throw new Error('Could not resolve a bounding box for a drag source/target.');
  return b;
}

test('Svelte nested Kanban — card move survives an outer column reorder (no reseed/duplication)', async ({
  page,
}) => {
  await page.goto('/svelte/host/entry.svelte.html?example=SortableListNested');
  await page.waitForSelector('.rozie-sortable-list', { timeout: 15_000 });
  await expect(page.locator('.totals')).toHaveText(/3 columns · 6 cards/);

  const seed = await readBoard(page);
  expect(seed.map((c) => c.title)).toEqual(['To do', 'Doing', 'Done']);
  expect(seed[0].cards).toEqual(['Draft README', 'Sketch wireframes', 'Spec out the API']);

  // ---- Stage 1: cross-column card move — drag "Draft README" (To do) into Done.
  const cardHandle = box(
    await page.locator('.kanban-column').nth(0).locator('.card').first().locator('.grip').boundingBox(),
  );
  const doneColumn = box(await page.locator('.kanban-column').nth(2).boundingBox());
  await drag(page, cardHandle, doneColumn);

  const mid = await readBoard(page);
  const midTotal = mid.reduce((n, c) => n + c.cards.length, 0);
  expect(midTotal, 'no cards lost/duplicated by the cross-column move').toBe(6);
  expect(
    mid.find((c) => c.title === 'Done')?.cards,
    'the moved card landed in Done',
  ).toContain('Draft README');
  expect(
    mid.find((c) => c.title === 'To do')?.cards,
    'the moved card left To do',
  ).not.toContain('Draft README');

  // ---- Stage 2: reorder the OUTER columns — drag "Done" (now index 2) left
  // over "Doing" (index 1) by its title bar. This is the step that regressed:
  // pre-fix it commits from stale-seed `columns`, reverting Stage 1's move and
  // duplicating cards.
  const doneBar = box(await page.locator('.kanban-column').nth(2).locator('.column-bar').boundingBox());
  const doingBar = box(await page.locator('.kanban-column').nth(1).locator('.column-bar').boundingBox());
  await drag(page, doneBar, doingBar);

  const after = await readBoard(page);
  const allLabels = after.flatMap((c) => c.cards);
  const total = allLabels.length;
  const duplicates = allLabels.filter((label, i) => allLabels.indexOf(label) !== i);

  // The core regression assertions: the board is still exactly the six seed
  // cards, none lost, none duplicated…
  expect(total, 'total card count stays 6 after the reorder (no reseed)').toBe(6);
  expect(duplicates, 'no card was duplicated by the outer reorder').toEqual([]);
  // …and Stage 1's card move survived the reorder rather than reverting to seed.
  expect(
    after.find((c) => c.title === 'Done')?.cards,
    'the earlier card move persisted through the column reorder',
  ).toContain('Draft README');
  // Sanity: the reorder actually happened (Done now precedes Doing).
  const titles = after.map((c) => c.title);
  expect(titles.indexOf('Done'), 'columns were reordered (Done moved before Doing)').toBeLessThan(
    titles.indexOf('Doing'),
  );
});
