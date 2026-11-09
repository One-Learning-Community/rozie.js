/**
 * Keyboard registry for cross-list moves between SortableLists.
 *
 * A `globalThis` singleton (keyed by `Symbol.for`) so separately bundled
 * copies of the component share one registry. Framework-free.
 */

export type Interaction = 'pointer' | 'keyboard';

/**
 * The one payload every `start` / `end` / `reorder` / `add` / `remove` event
 * carries, for pointer and keyboard alike.
 */
export interface SortablePayload {
  interaction: Interaction;
  /** The item's data value (never an element). */
  item: unknown;
  /** The row element; null when there is none (a lost lift). */
  el: HTMLElement | null;
  /** The list element the row came from. */
  from: HTMLElement;
  /** The list element the row went to. */
  to: HTMLElement;
  /** Item-row index in `from`; -1 for `add`. */
  oldIndex: number;
  /** Item-row index in `to`; -1 for `remove` and a lost lift. */
  newIndex: number;
  /** Pointer only: the raw SortableJS event. */
  originalEvent?: unknown;
}
export type GroupOption =
  | string
  | { name: string; pull?: unknown; put?: unknown }
  | null
  | undefined;

export interface ListEntry {
  el: HTMLElement;
  group(): GroupOption;
  label(): string | null;
  keyboardEnabled(): boolean;
  items(): readonly unknown[];
  keyOf(item: unknown, index: number): string;
  /** The screen-reader label of one of this list's items (its `labelFor`). */
  labelOf(item: unknown, index: number): string;
  /**
   * Handle a reorder key for the lift this list holds. Keys pressed in any
   * list while a lift exists are routed here, to the holder. Returns true
   * when the key was handled (the caller then calls preventDefault).
   */
  onKey(key: string, shift: boolean): boolean;
  write(next: unknown[]): void;
  setLifted(index: number | null): void;
  announce(text: string): void;
  focusRow(item: unknown, index: number): void;
  /**
   * Focus this list's row (or its handle) nearest `index`, but only while
   * focus has been lost to <body>. Used when a lift ends because the
   * consumer took the lifted item away.
   */
  focusNear(index: number): void;
  rowEl(index: number): HTMLElement | null;
  emit(name: 'add' | 'remove' | 'reorder' | 'start' | 'end', payload: SortablePayload): void;
}

export interface Lift {
  holder: ListEntry;
  key: string;
  /** The lifted item's data value. */
  item: unknown;
  copy: boolean;
  /** True once the row has hopped out of its origin list. */
  hopped: boolean;
  /**
   * True while a refocus after a keyboard move is outstanding: a key that
   * falls to <body> meanwhile belongs to this lift.
   */
  focusPending?: boolean;
  origin: { list: ListEntry; index: number };
  liftedRowEl: HTMLElement | null;
  /** The lifted row's last known index in its holder. */
  index?: number;
}

export interface KeyboardRegistry {
  register(entry: ListEntry): () => void;
  has(entry: ListEntry): boolean;
  /** The registered entry whose list element is `el`, else null. */
  entryFor(el: HTMLElement): ListEntry | null;
  lift: Lift | null;
  /** The list whose aria-live region spoke last (cleared when another speaks). */
  speaker: ListEntry | null;
  orderedLists(): ListEntry[];
  findHopTarget(from: ListEntry, dir: 1 | -1): ListEntry | null;
  listName(entry: ListEntry): string;
  indexOfLift(): number;
  /**
   * Run `fire` (an `end` emit) in a task, after every write made so far and
   * whatever framework flush those writes scheduled (`afterFlush`). Pending ends run in
   * order; `flushEnds()` runs them now.
   */
  deferEnd(fire: () => void): void;
  /** Run every pending `end` now (before a new drag or lift emits `start`). */
  flushEnds(): void;
}

interface Singleton {
  registry: KeyboardRegistry;
  counter: number;
}

const KEY = Symbol.for('rozie.sortable-list.keyboard.v1');

/**
 * Run `fn` after the work a framework scheduled for writes made so far:
 * microtasks (Vue, Svelte, React during a discrete event), timers, and
 * posted messages (React's scheduler renders in a MessageChannel task). A
 * `setTimeout(0)` alone runs before an earlier-posted message in Chrome, so it
 * hops once more through a fresh MessageChannel: posted messages run in the
 * order they were posted, so ours runs after one a framework posted first.
 */
export function afterFlush(fn: () => void): void {
  setTimeout(() => {
    if (typeof MessageChannel !== 'function') {
      fn();
      return;
    }
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      fn();
    };
    ch.port2.postMessage(null);
  }, 0);
}

// Composed-tree parent: slot assignment, then light/shadow parent, then host.
function composedParent(n: any): any {
  return n.assignedSlot ?? n.parentNode ?? n.host ?? null;
}

function chainOf(n: Node): Node[] {
  const out: Node[] = [];
  let c: any = n;
  while (c) {
    out.push(c);
    c = composedParent(c);
  }
  return out;
}

/** <0 when `a` precedes `b` in composed document order. */
export function composedCompare(a: Node, b: Node): number {
  if (a === b) return 0;
  const ca = chainOf(a);
  const cb = chainOf(b);
  const inB = new Map<Node, number>();
  cb.forEach((n, i) => inB.set(n, i));
  let ia = -1;
  let ib = -1;
  for (let i = 0; i < ca.length; i++) {
    const j = inB.get(ca[i]!);
    if (j !== undefined) {
      ia = i;
      ib = j;
      break;
    }
  }
  if (ia < 0) return 0; // disconnected: no defined order
  if (ia === 0) return -1; // a is an ancestor of b
  if (ib === 0) return 1;
  const childA = ca[ia - 1]!;
  const childB = cb[ib - 1]!;
  if (childA.parentNode && childA.parentNode === childB.parentNode) {
    const pos = childA.compareDocumentPosition(childB);
    return pos & 4 /* FOLLOWING */ ? -1 : pos & 2 /* PRECEDING */ ? 1 : 0;
  }
  // Different trees under the common ancestor (a host): shadow content
  // renders in place of the host's own children.
  const aShadow = (childA as any).host === ca[ia];
  const bShadow = (childB as any).host === cb[ib];
  if (aShadow !== bShadow) return aShadow ? -1 : 1;
  return 0;
}

export function isRenderable(el: HTMLElement): boolean {
  if (el.getClientRects().length === 0) return false;
  let n: any = el;
  while (n) {
    if (n.nodeType === 1) {
      if (
        n.hasAttribute('inert') ||
        n.hasAttribute('hidden') ||
        n.getAttribute('aria-hidden') === 'true'
      ) {
        return false;
      }
    }
    n = composedParent(n);
  }
  return true;
}

function contains(root: Node, target: Node): boolean {
  let n: any = target;
  while (n) {
    if (n === root) return true;
    n = composedParent(n);
  }
  return false;
}

interface NormGroup {
  name: string | undefined;
  pull: unknown;
  put: unknown;
}

function norm(g: GroupOption): NormGroup | null {
  if (g == null) return null;
  if (typeof g === 'string') return { name: g, pull: undefined, put: undefined };
  return { name: g.name, pull: g.pull, put: g.put };
}

/**
 * Mirrors SortableJS group semantics: an absent `pull` means pull allowed;
 * an absent `put` means same-group-name only; `put: true` accepts any group;
 * a string / array `put` lists accepted source group names; `pull` may be
 * `false`, `'clone'`, or a list of target group names. Function-valued
 * pull/put cannot be evaluated without a drag event, so such hops are
 * unreachable by keyboard (a function on the source's put or target's pull is irrelevant to the hop).
 */
export function canHop(from: GroupOption, to: GroupOption): { ok: boolean; copy: boolean } {
  const no = { ok: false, copy: false };
  const f = norm(from);
  const t = norm(to);
  if (!f || !t) return no;
  for (const v of [f.pull, t.put]) if (typeof v === 'function') return no;
  const same = f.name != null && f.name === t.name;

  let copy = false;
  const pull = f.pull;
  if (pull === false) return no;
  if (pull === 'clone') copy = true;
  else if (typeof pull === 'string') {
    if (pull !== t.name) return no;
  } else if (Array.isArray(pull)) {
    if (!pull.includes(t.name)) return no;
  } else if (pull != null && pull !== true) return no;

  const put = t.put;
  if (put == null) {
    if (!same) return no;
  } else if (put === false) return no;
  else if (put === true) {
    /* any group */
  } else if (typeof put === 'string') {
    if (put !== f.name) return no;
  } else if (Array.isArray(put)) {
    if (!put.includes(f.name)) return no;
  } else return no;

  return { ok: true, copy };
}

function createState(): Singleton {
  const entries = new Set<ListEntry>();
  const pendingEnds: Array<() => void> = [];
  const registry: KeyboardRegistry = {
    lift: null,
    speaker: null,
    register(entry) {
      entries.add(entry);
      return () => {
        entries.delete(entry);
        if (registry.lift && registry.lift.holder === entry) registry.lift = null;
        if (registry.speaker === entry) registry.speaker = null;
      };
    },
    has(entry) {
      return entries.has(entry);
    },
    entryFor(el) {
      for (const e of entries) if (e.el === el) return e;
      return null;
    },
    orderedLists() {
      return [...entries].sort((x, y) => composedCompare(x.el, y.el));
    },
    findHopTarget(from, dir) {
      const all = registry.orderedLists();
      const at = all.indexOf(from);
      if (at < 0) return null;
      const lifted = registry.lift?.liftedRowEl ?? null;
      for (let i = at + dir; i >= 0 && i < all.length; i += dir) {
        const cand = all[i]!;
        if (!cand.keyboardEnabled()) continue;
        if (!canHop(from.group(), cand.group()).ok) continue;
        if (!isRenderable(cand.el)) continue;
        if (lifted && contains(lifted, cand.el)) continue;
        return cand;
      }
      return null;
    },
    listName(entry) {
      const label = entry.label();
      if (label != null) return label;
      const gname = norm(entry.group())?.name ?? null;
      const peers = registry
        .orderedLists()
        .filter((e) => (norm(e.group())?.name ?? null) === gname);
      return `list ${peers.indexOf(entry) + 1} of ${peers.length}`;
    },
    indexOfLift() {
      const l = registry.lift;
      if (!l) return -1;
      const items = l.holder.items();
      let i = items.findIndex((it, j) => l.holder.keyOf(it, j) === l.key);
      if (i >= 0) {
        // Found by key: the consumer may have swapped in a new object with
        // the same key, so follow it.
        l.item = items[i];
      } else {
        // Not by key: the consumer may have re-keyed the lifted object
        // itself. Find it by reference and adopt its new key.
        i = items.indexOf(l.item);
        if (i < 0) return -1;
        l.key = l.holder.keyOf(items[i], i);
      }
      l.index = i;
      return i;
    },
    deferEnd(fire) {
      pendingEnds.push(fire);
      afterFlush(() => registry.flushEnds());
    },
    flushEnds() {
      while (pendingEnds.length > 0) pendingEnds.shift()!();
    },
  };
  return { registry, counter: 0 };
}

function state(): Singleton {
  const g = globalThis as any;
  return (g[KEY] ??= createState());
}

export function getKeyboardRegistry(): KeyboardRegistry {
  return state().registry;
}

export function nextInstructionsId(): string {
  return 'rozie-sortable-instructions-' + ++state().counter;
}
