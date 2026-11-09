/**
 * Spoken text for SortableList's keyboard reordering: the default
 * announcements, the default instructions and the label fallback.
 *
 * A consumer rewords or translates any announcement through the
 * `announcements` prop: an object of optional functions, one per kind below,
 * each receiving an {@link AnnouncementContext} and returning the text to
 * speak (`null` or `''` says nothing). Kinds without a function keep the
 * default.
 */

export type AnnouncementKind =
  | 'lifted'
  | 'moved'
  | 'movedToList'
  | 'dropped'
  | 'droppedInList'
  | 'atStart'
  | 'atEnd'
  | 'notSortable'
  | 'noListBefore'
  | 'noListAfter'
  | 'cancelledReturnedToList'
  | 'cancelledReturned'
  | 'cancelledStays'
  | 'cancelledRemoved'
  | 'liftEnded';

export interface AnnouncementContext {
  /** The row's screen-reader label (`labelFor`, `item.label`, the row text, …). */
  label: string;
  /** The item value. */
  item: unknown;
  /** The name of the list the message is about (`listLabel`, or `list 2 of 3`). */
  list: string;
  /** 1-based position of the row in `list` (kinds that have a position). */
  position?: number;
  /** How many rows `list` holds (kinds that have a position). */
  total?: number;
  /** The list the row came from (`movedToList` only). */
  fromList?: string;
}

export type AnnouncementFn = (ctx: AnnouncementContext) => string | null | undefined;
export type Announcements = Partial<Record<AnnouncementKind, AnnouncementFn>>;

const at = (c: AnnouncementContext) => `position ${c.position} of ${c.total}`;

/** The default English text of every announcement. */
export const DEFAULT_ANNOUNCEMENTS: Record<AnnouncementKind, (c: AnnouncementContext) => string> = {
  lifted: (c) => `Lifted ${c.label}, ${at(c)}`,
  moved: (c) => `Moved ${c.label} to ${at(c)}`,
  movedToList: (c) => `Moved ${c.label} to ${c.list}, ${at(c)}`,
  dropped: (c) => `Dropped ${c.label} at ${at(c)}`,
  droppedInList: (c) => `Dropped ${c.label} in ${c.list} at ${at(c)}`,
  atStart: (c) => `${c.label} is already first`,
  atEnd: (c) => `${c.label} is already last`,
  notSortable: (c) => `${c.label} can't be moved within ${c.list}`,
  noListBefore: (c) => `No list before ${c.list}`,
  noListAfter: (c) => `No list after ${c.list}`,
  cancelledReturnedToList: (c) => `Cancelled. ${c.label} returned to ${c.list}, ${at(c)}`,
  cancelledReturned: (c) => `Cancelled. ${c.label} returned to ${at(c)}`,
  cancelledStays: (c) => `Cancelled. ${c.label} stays in ${c.list}, ${at(c)}`,
  cancelledRemoved: (c) => `Cancelled. ${c.label} removed from ${c.list}`,
  liftEnded: () => 'Lift ended',
};

/**
 * The text to speak for `kind`: the consumer's function when `overrides` has
 * one (its `null` / `undefined` / `''` means silence), else the default. A
 * function that throws is logged and the default is spoken, so a bug in a
 * translation never strands a lift half-way through a key press.
 */
export function announcementText(
  overrides: Announcements | null | undefined,
  kind: AnnouncementKind,
  ctx: AnnouncementContext,
): string {
  const fn = overrides != null ? (overrides as Record<string, unknown>)[kind] : null;
  if (typeof fn === 'function') {
    try {
      const out = (fn as AnnouncementFn)(ctx);
      return out == null ? '' : String(out);
    } catch (err) {
      console.error(`[rozie-sortable-list] announcements.${kind} threw; using the default text.`, err);
    }
  }
  return DEFAULT_ANNOUNCEMENTS[kind](ctx);
}

export interface InstructionsShape {
  /** `orientation: 'horizontal'` (left / right arrows). */
  horizontal: boolean;
  /** False for a `sort: false` list: rows cannot move within it. */
  sortable: boolean;
  /** The group SortableJS runs with (prop or `options.group`) is set. */
  grouped: boolean;
}

/** The default spoken keyboard instructions (replaced by `keyboardInstructions`). */
export function defaultInstructions(s: InstructionsShape): string {
  const arrows = s.horizontal ? 'left and right' : 'up and down';
  const text = s.sortable
    ? `Press Space or Enter to pick up, and again to drop. Use the ${arrows} arrow keys to move, Home and End to jump to the start or end, Page Up and Page Down to move several places, and Escape to cancel.`
    : 'Press Space or Enter to pick up, and again to drop. Press Escape to cancel.';
  return s.grouped ? `${text} Hold Shift with an arrow key to move to another list.` : text;
}

// Content that is not this row's own text: nested SortableLists (their rows,
// live region and instructions), hidden and aria-hidden content.
function skipped(el: Element): boolean {
  if (el.tagName === 'ROZIE-SORTABLE-LIST' || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'TEMPLATE') return true;
  if (el.classList.contains('rozie-sortable-wrap')) return true;
  return el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true';
}

function collect(node: Node, out: string[]): void {
  if (node.nodeType === 3) {
    out.push(node.nodeValue ?? '');
    return;
  }
  if (node.nodeType !== 1 && node.nodeType !== 11) return;
  if (node.nodeType === 1) {
    const el = node as Element;
    if (skipped(el)) return;
    // A <slot> (Lit) reads the content assigned to it, else its fallback.
    if (el.tagName === 'SLOT' && typeof (el as HTMLSlotElement).assignedNodes === 'function') {
      const assigned = (el as HTMLSlotElement).assignedNodes({ flatten: true });
      if (assigned.length > 0) {
        for (const n of assigned) collect(n, out);
        return;
      }
    }
  }
  for (const c of Array.from(node.childNodes)) collect(c, out);
}

/**
 * A row element's text, like `textContent` with whitespace collapsed and
 * trimmed, but read through Lit `<slot>`s and without nested lists or hidden
 * content.
 */
export function rowText(row: Element | null | undefined): string {
  if (row == null) return '';
  const out: string[] = [];
  collect(row, out);
  return out.join('').replace(/\s+/g, ' ').trim();
}

/**
 * The label of an item when the list has no `labelFor` and the item no
 * `label` field: the row's text, else `String(item)` for a primitive, else
 * `item {position}`.
 */
export function fallbackLabel(item: unknown, index: number, row: Element | null | undefined): string {
  const text = rowText(row);
  if (text !== '') return text;
  if (item === null || (typeof item !== 'object' && typeof item !== 'function')) return String(item);
  return `item ${index + 1}`;
}
