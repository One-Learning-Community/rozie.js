import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

/** The kind of message the list speaks during keyboard reordering (a key of the `announcements` prop). */
export type AnnouncementKind = 'lifted' | 'moved' | 'movedToList' | 'dropped' | 'droppedInList' | 'atStart' | 'atEnd' | 'notSortable' | 'noListBefore' | 'noListAfter' | 'cancelledReturnedToList' | 'cancelledReturned' | 'cancelledStays' | 'cancelledRemoved' | 'liftEnded';
/** What an `announcements` function receives. */
export interface AnnouncementContext {
  /** The row's screen-reader label (`labelFor`, else `item.label`, else the row's text). */
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
/** The `announcements` prop: one optional function per message kind; `null` or `''` says nothing. */
export type Announcements = Partial<Record<AnnouncementKind, (ctx: AnnouncementContext) => string | null | undefined>>;
/** Which element drives keyboard reordering (the `keyboardTrigger` prop). */
export type SortableKeyboardTrigger = 'row' | 'handle';
/** Which arrow keys move a lifted row within the list (the `orientation` prop). */
export type SortableOrientation = 'vertical' | 'horizontal';

export interface SortableListProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'items' | 'defaultItems' | 'onItemsChange' | 'itemKey' | 'handle' | 'group' | 'animation' | 'disabled' | 'disableKeyboard' | 'keyboardTrigger' | 'options' | 'labelFor' | 'ghostClass' | 'chosenClass' | 'dragClass' | 'filter' | 'easing' | 'forceFallback' | 'swapThreshold' | 'cloneable' | 'listClass' | 'itemClass' | 'listLabel' | 'orientation' | 'pageStep' | 'keyboardInstructions' | 'announcements' | 'itemStyle' | 'onReorder' | 'onAdd' | 'onRemove' | 'onStart' | 'onEnd' | 'renderHeader' | 'children' | 'renderFooter' | 'slots' | 'dangerouslySetInnerHTML'> {
  /**
   * The bound items array. The sole `model: true` prop — two-way bind it (`r-model:items` / `v-model:items` / `bind:items` / `[(items)]`) and SortableList writes the re-ordered array back whenever a drag, cross-list move, or keyboard reorder commits, with no manual `onChange → setState` wiring.
   * @example
   * <SortableList items={todos} onItemsChange={setTodos} itemKey="id" />
   */
  items?: unknown[];
  defaultItems?: unknown[];
  onItemsChange?: (next: unknown[]) => void;
  /**
   * The per-row key the framework reconciler tracks each item by across a reorder — either a property name (e.g. `itemKey="id"` reads `item.id`) or an `(item, index) => key` function. With neither, id-less object items get a stable synthetic key via an internal `WeakMap` (survives reorder by object identity); primitive items fall back to index — pass a function for reorderable duplicate primitives.
   */
  itemKey?: (string | ((...args: any[]) => any)) | null;
  /**
   * CSS selector identifying the per-row drag handle, so a drag starts only from that element rather than anywhere in the row. Authored class names render literally on every target (React included), so a plain `.grip` works; `$classSelector('grip')` is an optional, typo-checked way to author it.
   */
  handle?: (string) | null;
  /**
   * SortableJS group name enabling cross-list drag — two lists sharing a `group` accept items between each other (the source fires `remove`, the destination fires `add`). Set `cloneable: true` to flip a string group into clone-mode. Lists that share a `group` also exchange rows by keyboard: Shift+arrow while a row is lifted hops it to the previous or next list of the same group (in source order), subject to the same pull/put rules as a mouse drag. `options.group` takes precedence over this prop, for keyboard hops as for drags. Function-valued `pull`/`put` cannot be evaluated without a drag, so those lists are unreachable by keyboard. Set `itemKey` on grouped lists.
   */
  group?: (string) | null;
  /**
   * Reorder animation duration in milliseconds. `0` disables the animation. Reapplied live via `instance.option('animation', v)` (no remount).
   */
  animation?: number;
  /**
   * Temporarily disable dragging without unmounting — reapplied live via `instance.option('disabled', v)` (no remount). Also suppresses keyboard reordering: a disabled list is not sortable by any input, so rows lose their `tabindex` and the keydown handler no-ops. Turning it on while a row is lifted ends the lift where the row is (`Lift ended`, and `end` fires); `options.disabled` and `option('disabled', v)` do the same.
   */
  disabled?: boolean;
  /**
   * Opt out of keyboard reordering (Space lift / Arrow move / Shift+Arrow hop between lists / Esc cancel / Enter drop) while leaving pointer drag enabled. Rows drop out of the tab order (no `tabindex`) and the keydown handler no-ops. Keyboard access is gated on `!disabled && !disableKeyboard`. Turning it on while a row is lifted ends the lift where the row is.
   */
  disableKeyboard?: boolean;
  /**
   * Which element drives keyboard reordering. `'row'` (default): rows are tab stops and the keys on the focused row drive reordering. `'handle'`: rows are NOT tab stops, and only keys pressed inside the element matched by `handle` (inside that row) drive the same Space/Enter lift-drop, Arrow move, Shift+Arrow hop and Escape cancel flow; handled keys call preventDefault so a handle `<button>`'s click does not fire. The consumer owns the handle markup (recommended: a `<button>` with its own aria-label such as "Reorder Hero banner") and the component adds no tabindex or role to slot content. `'handle'` without `handle` turns keyboard reordering off and logs a console warning. `disabled`/`disableKeyboard` still apply. Typed as `SortableKeyboardTrigger` (`'row' | 'handle'`); at runtime any value other than `'handle'` behaves as `'row'`.
   */
  keyboardTrigger?: SortableKeyboardTrigger;
  /**
   * Verbatim SortableJS options pass-through for anything not covered by the named props. The named props win on key conflict but `options` lands AFTER them in the merge so consumers can override defaults; handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`, `onClone`) are stripped — the helper owns those paths. Runtime-updatable: when `options` changes, each key whose value changed is reapplied via `instance.option(key, v)` (no remount), so mouse and keyboard obey the same values; a key you drop goes back to its named prop (or, for `sort` and `draggable`, the component default), and any other dropped key keeps its last value until you set it. `forceFallback` is still read only at construction.
   */
  options?: Record<string, unknown>;
  /**
   * Optional `(item, idx) => string` returning the screen-reader label for the aria-live announcer during keyboard drag. Defaults to `item.label`; without a `label` field, the row's text (whitespace collapsed, without nested lists or hidden content), else `String(item)` for a primitive, else `item {position}`.
   */
  labelFor?: ((...args: any[]) => any) | null;
  /**
   * Class name applied to the drop-placeholder (ghost) element while dragging. Forwarded live via `instance.option`, so toggling it at runtime takes effect without a remount.
   */
  ghostClass?: (string) | null;
  /**
   * Class name applied to the currently-chosen item while dragging. Forwarded live via `instance.option` (no remount needed to change it).
   */
  chosenClass?: (string) | null;
  /**
   * Class name applied to the dragging element. Only takes effect in fallback mode (`forceFallback: true`). Forwarded live via `instance.option`.
   */
  dragClass?: (string) | null;
  /**
   * CSS selector that prevents drag initiation on matching rows (locked items). SortableJS checks it at `mousedown`/`touchstart` and aborts the drag if it matches. The keyboard honours it too: a row that matches (the row element or its slot root, the element the row template renders) cannot be lifted with Space/Enter; a control nested deeper that matches blocks only presses on it. `options.filter` (which may also be a SortableJS filter function) takes precedence. A `data-*` attribute selector (e.g. `[data-locked]`) is the most robust choice across all targets.
   */
  filter?: (string) | null;
  /**
   * CSS easing function for the reorder animation (e.g. `'ease-in'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`). Runtime-updatable.
   */
  easing?: (string) | null;
  /**
   * Force SortableJS's mouse-event drag path over HTML5 DnD — useful for touch devices, consistent cross-browser behavior, and synthetic test drivers (and `dragClass` only applies in this mode). **Construction-time only**: SortableJS reads it once at construction, so re-key the `<SortableList>` to toggle it at runtime.
   */
  forceFallback?: boolean;
  /**
   * SortableJS swap threshold (0..1) — a lower value makes rows swap earlier as the dragged item overlaps a neighbor. Reapplied live via `instance.option('swapThreshold', v)` — SortableJS reads it on every dragover, so no remount is needed.
   */
  swapThreshold?: number;
  /**
   * High-level prop that REPLACES a string `group` with SortableJS's `{ name, pull: 'clone', put: false }` clone-mode object form — the source deposits a COPY onto the destination and keeps its own array unchanged, and takes nothing back: no row can be dropped or keyboard-hopped into it (the palette → canvas pattern). With `group: null` it is a no-op (a clone-mode list with no group name has no peer to clone into). Reapplied live — toggling `cloneable` (or changing `group`) recomputes the clone-mode shape and reapplies it via `instance.option('group', …)`, no remount.
   */
  cloneable?: boolean;
  /**
   * Extra class(es) merged onto the list container (the SortableJS root) alongside the base `rozie-sortable-list` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding), normalized identically across all six targets — the hook for bridging a CSS framework (`.list-group`) or a flex/grid parent onto the component.
   */
  listClass?: string | unknown[] | Record<string, unknown>;
  /**
   * Extra class(es) merged onto every item row alongside the base `rozie-sortable-item` class. Accepts a `String`, `Array`, or `Object` (Vue-style class binding) applied uniformly, OR an `(item, index) => class` function for per-row classes evaluated at render time. Normalized identically across all six targets.
   */
  itemClass?: string | unknown[] | Record<string, unknown> | ((...args: any[]) => any);
  /**
   * The list's human name, such as `"Top sidebar"`. Sets `aria-label` on the list container (`role="list"`) and names the list in keyboard announcements when a row moves between lists (`Moved Hero banner to Top sidebar, position 1 of 4`, `Dropped Hero banner in Top sidebar at position 3 of 4`, `No list after Top sidebar`). Pass the same words as the zone's visible heading. With no label, announcements fall back to a neutral `list 2 of 3`, counting the mounted lists of the same group in hop (source) order.
   */
  listLabel?: (string) | null;
  /**
   * Which arrow keys move a lifted row within the list: `'vertical'` (default) uses ↑/↓, `'horizontal'` uses ←/→. A horizontal list's default spoken instructions say "Use the left and right arrow keys to move" (`role="list"` has no `aria-orientation`). Typed as `SortableOrientation` (`'vertical' | 'horizontal'`).
   */
  orientation?: SortableOrientation;
  /**
   * How many positions Page Up / Page Down move a lifted row. The move stops at the first or last position when fewer rows remain.
   */
  pageStep?: number;
  /**
   * Replaces the spoken keyboard instructions. The text sits in a hidden element referenced by `aria-describedby` from each tabbable row (row mode) or from the consumer's handle via the `instructionsId` slot prop (handle mode). Default: "Press Space or Enter to pick up, and again to drop. Use the up and down arrow keys to move, Home and End to jump to the start or end, Page Up and Page Down to move several places, and Escape to cancel." (with `orientation: 'horizontal'`, "the left and right arrow keys"; a `sort: false` list says only "Press Space or Enter to pick up, and again to drop. Press Escape to cancel."). When the list has a group (`group` or `options.group`) the default adds "Hold Shift with an arrow key to move to another list."
   */
  keyboardInstructions?: (string) | null;
  /**
   * Rewords or translates what the list says during keyboard reordering. An object of optional functions keyed by message kind (`lifted`, `moved`, `movedToList`, `dropped`, `droppedInList`, `atStart`, `atEnd`, `notSortable`, `noListBefore`, `noListAfter`, `cancelledReturnedToList`, `cancelledReturned`, `cancelledStays`, `cancelledRemoved`, `liftEnded`). Each receives a context (`label`, `item`, `list`, and for kinds with a position `position` (1-based) and `total`; `movedToList` also `fromList`) and returns the text to speak; `null` or `''` says nothing. Kinds without a function keep the default English text (see "Announcements"). Define the object in your script and bind it (Angular templates reject inline arrow functions), e.g. `const announcements = { moved: ({ label, position, total }) => label + ' → ' + position + '/' + total }`. Typed as `Announcements`, exported with `AnnouncementKind` and `AnnouncementContext`.
   * @example
   * <SortableList items={todos} onItemsChange={setTodos} announcements={announcements} />
   */
  announcements?: (Announcements) | null;
  /**
   * Per-row inline style applied to the `.rozie-sortable-item` wrapper. Accepts a CSS `String`, a flat style object (`Record<string, string | number>`), or an `(item, index) => string | object` function for per-row styling. Because it lands on the wrapper — the direct child of the list container — it can drive CSS-grid placement (`grid-column` / `grid-row` / `align-self`) when `listClass` sets `display: grid`. Normalized per target; `null` / empty drops the attribute.
   */
  itemStyle?: (string | Record<string, unknown> | ((...args: any[]) => any)) | null;
  onReorder?: (...args: any[]) => void;
  onAdd?: (...args: any[]) => void;
  onRemove?: (...args: any[]) => void;
  onStart?: (...args: any[]) => void;
  onEnd?: (...args: any[]) => void;
  renderHeader?: () => ReactNode;
  children?: ReactNode | ((params: { item: unknown; index: unknown; instructionsId: unknown }) => ReactNode);
  renderFooter?: () => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface SortableListHandle {
  getInstance: (...args: any[]) => any;
  toArray: (...args: any[]) => any;
  sort: (...args: any[]) => any;
  option: (...args: any[]) => any;
}

declare const SortableList: React.ForwardRefExoticComponent<SortableListProps & React.RefAttributes<SortableListHandle>>;
export default SortableList;
