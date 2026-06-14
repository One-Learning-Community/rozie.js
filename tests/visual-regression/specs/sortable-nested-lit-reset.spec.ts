// Behavioral VR cell for the nested-Kanban Lit card-drop RESET bug.
// Symptom A: dropping a card (in its own column or another) reverts the whole
// board to the SEED order. Root cause: the OUTER controlled SortableList
// re-renders from its lagging controllable mirror BEFORE the demo flushes the
// updated _columns down, re-passing the SEED `scope.item.cards` into the
// child column. This spec drives a real in-column drag and asserts the move
// PERSISTS (it currently FAILS until the fix lands).
import { test, expect } from '@playwright/test';

async function readState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const host: any = document.querySelector('rozie-sortable-list-nested-demo');
    const cols = host?._columns?.value ?? [];
    return cols.map((c: any) => ({ id: c.id, cards: c.cards.map((x: any) => x.id) }));
  });
}
async function boxes(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const demo: any = document.querySelector('rozie-sortable-list-nested-demo');
    const outerSL = demo.shadowRoot.querySelector('rozie-sortable-list');
    const firstCol = outerSL.shadowRoot.querySelector('rozie-kanban-column');
    const innerSL = firstCol.shadowRoot.querySelector('rozie-sortable-list');
    const grips = [...innerSL.shadowRoot.querySelectorAll('.grip')];
    const cards = [...innerSL.shadowRoot.querySelectorAll('.card')];
    const r = (el: Element) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; };
    return { grips: grips.map(r), cards: cards.map(r) };
  });
}

test('Lit nested in-column card drop persists (no whole-demo reset)', async ({ page }) => {
  await page.goto('/lit/host/entry.lit.html?example=SortableListNested');
  await page.waitForFunction(() => {
    const host: any = document.querySelector('rozie-sortable-list-nested-demo');
    return host && host._columns && host._columns.value.length === 3;
  }, { timeout: 15_000 });
  await page.waitForTimeout(300);

  const before = await readState(page);
  expect(before[0].cards).toEqual(['c1', 'c2', 'c3']);

  const b = await boxes(page);
  const src = b.grips[0];
  const dst = b.cards[2];
  await page.mouse.move(src.x + src.w / 2, src.y + src.h / 2);
  await page.mouse.down();
  const targetY = dst.y + dst.h + 6;
  for (let i = 0; i < 14; i++) {
    const ty = (src.y + src.h / 2) + (targetY - (src.y + src.h / 2)) * ((i + 1) / 14);
    await page.mouse.move(src.x + src.w / 2, ty, { steps: 5 });
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
  await page.waitForTimeout(700);

  const after = await readState(page);
  const total = after.reduce((s, c) => s + c.cards.length, 0);
  expect(total, 'total card count stays 6').toBe(6);
  expect(after[0].cards, 'moved card persists; board did not reset to seed').toEqual(['c2', 'c3', 'c1']);
});
