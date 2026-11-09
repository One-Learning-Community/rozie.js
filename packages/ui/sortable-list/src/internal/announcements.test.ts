import { describe, expect, it, vi } from 'vitest';
import {
  announcementText,
  defaultInstructions,
  DEFAULT_ANNOUNCEMENTS,
  fallbackLabel,
  rowText,
  type AnnouncementContext,
} from './announcements';

const ctx: AnnouncementContext = { label: 'Apple', item: { id: 'a' }, list: 'Fruit', position: 2, total: 5, fromList: 'Veg' };

describe('default announcements', () => {
  it('speak the exact default text of every kind', () => {
    const said = Object.fromEntries(Object.entries(DEFAULT_ANNOUNCEMENTS).map(([k, f]) => [k, f(ctx)]));
    expect(said).toEqual({
      lifted: 'Lifted Apple, position 2 of 5',
      moved: 'Moved Apple to position 2 of 5',
      movedToList: 'Moved Apple to Fruit, position 2 of 5',
      dropped: 'Dropped Apple at position 2 of 5',
      droppedInList: 'Dropped Apple in Fruit at position 2 of 5',
      atStart: 'Apple is already first',
      atEnd: 'Apple is already last',
      notSortable: "Apple can't be moved within Fruit",
      noListBefore: 'No list before Fruit',
      noListAfter: 'No list after Fruit',
      cancelledReturnedToList: 'Cancelled. Apple returned to Fruit, position 2 of 5',
      cancelledReturned: 'Cancelled. Apple returned to position 2 of 5',
      cancelledStays: 'Cancelled. Apple stays in Fruit, position 2 of 5',
      cancelledRemoved: 'Cancelled. Apple removed from Fruit',
      liftEnded: 'Lift ended',
    });
  });
});

describe('announcementText', () => {
  it('uses an override for its kind and the default for the rest', () => {
    const o = { moved: ({ label, position }: AnnouncementContext) => `${label} → ${position}` };
    expect(announcementText(o, 'moved', ctx)).toBe('Apple → 2');
    expect(announcementText(o, 'dropped', ctx)).toBe('Dropped Apple at position 2 of 5');
    expect(announcementText(null, 'moved', ctx)).toBe('Moved Apple to position 2 of 5');
  });

  it("'' or null from an override says nothing", () => {
    expect(announcementText({ lifted: () => '' }, 'lifted', ctx)).toBe('');
    expect(announcementText({ lifted: () => null }, 'lifted', ctx)).toBe('');
  });

  it('an override that throws falls back to the default', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      announcementText({ lifted: () => { throw new Error('x'); } }, 'lifted', ctx),
    ).toBe('Lifted Apple, position 2 of 5');
    expect(err).toHaveBeenCalledOnce();
    err.mockRestore();
  });
});

describe('defaultInstructions', () => {
  const MOVE_V =
    'Press Space or Enter to pick up, and again to drop. Use the up and down arrow keys to move, Home and End to jump to the start or end, Page Up and Page Down to move several places, and Escape to cancel.';
  const SHIFT = ' Hold Shift with an arrow key to move to another list.';
  it('vertical, horizontal, grouped and sort:false variants', () => {
    expect(defaultInstructions({ horizontal: false, sortable: true, grouped: false })).toBe(MOVE_V);
    expect(defaultInstructions({ horizontal: true, sortable: true, grouped: false })).toBe(
      MOVE_V.replace('up and down', 'left and right'),
    );
    expect(defaultInstructions({ horizontal: false, sortable: true, grouped: true })).toBe(MOVE_V + SHIFT);
    expect(defaultInstructions({ horizontal: false, sortable: false, grouped: false })).toBe(
      'Press Space or Enter to pick up, and again to drop. Press Escape to cancel.',
    );
    expect(defaultInstructions({ horizontal: true, sortable: false, grouped: true })).toBe(
      'Press Space or Enter to pick up, and again to drop. Press Escape to cancel.' + SHIFT,
    );
  });
});

describe('fallbackLabel / rowText', () => {
  const row = (html: string) => {
    const d = document.createElement('div');
    d.innerHTML = html;
    return d;
  };

  it('reads the row text, whitespace collapsed', () => {
    expect(fallbackLabel({ id: 1, text: 'x' }, 0, row('\n  <span> Buy </span>\n <b>milk</b>  '))).toBe('Buy milk');
  });

  it('skips nested lists and hidden content', () => {
    const r = row(
      '<h3>To do</h3><div class="rozie-sortable-wrap"><div>Card 1</div></div>' +
        '<span hidden>secret</span><span aria-hidden="true">⋮⋮</span><rozie-sortable-list>Card 2</rozie-sortable-list>',
    );
    expect(rowText(r)).toBe('To do');
  });

  it('reads the nodes assigned to a <slot>', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const r = document.createElement('div');
    r.appendChild(document.createElement('slot'));
    shadow.appendChild(r);
    host.innerHTML = '<span>Projected</span>';
    expect(rowText(r)).toBe('Projected');
    host.remove();
  });

  it('falls back to String(item) for a primitive, else "item {p}"', () => {
    expect(fallbackLabel('Pear', 0, row(''))).toBe('Pear');
    expect(fallbackLabel(7, 0, null)).toBe('7');
    expect(fallbackLabel({ id: 1 }, 2, row('   '))).toBe('item 3');
    expect(fallbackLabel({ id: 1 }, 0, null)).toBe('item 1');
  });
});
