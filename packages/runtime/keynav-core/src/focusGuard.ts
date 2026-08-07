// Strict-containment focus guard — Plan 260806-lz7.
//
// r-keynav's tabindex model used to focus + scroll its active item
// unconditionally on the very first pass (mount, or a root re-appearance
// behind r-if). That stole focus from a cold-static page load and from any
// unrelated element the user happened to be focused on elsewhere on the
// page. This module is the ONE shared containment predicate every per-target
// keynav implementation (React/Vue/Solid/Svelte hooks, the Lit controller,
// the Angular emitted methods) calls to gate that first/redundant pass.
// Subsequent navigation passes (an active-INDEX change) are NEVER gated —
// only mount/re-appearance passes are.
//
// THE RULE — strict component containment, not "does the document have
// focus": the guarded pass may only focus + scroll when the composed active
// element already sits inside the OWNING COMPONENT's rendered subtree. A
// document-scoped predicate (any real focus anywhere on the page) is
// deliberately rejected — see the plan's <design_decision> block — because
// it would still let a page with focus on some unrelated widget steal focus
// into a keynav root that just mounted.
//
// WHY `composedContains` AND NOT PLAIN `Node.contains`: `Node.contains`
// cannot see across a shadow boundary — `host.contains(elementInsideItsOwn
// ShadowRoot)` is `false` even though the element is unambiguously "inside"
// the host from an author's point of view. `composedContains` walks UP from
// the candidate node via `parentNode`, and when it hits a `ShadowRoot`
// jumps to `.host` instead of stopping, so ascent continues out of the
// shadow tree. `composedActiveElement` is the descent counterpart: starting
// at `doc.activeElement`, it keeps stepping into `shadowRoot.activeElement`
// while one exists, so a focused element nested arbitrarily deep inside
// open shadow roots is still found.
//
// PINNED FALLBACK SEMANTICS (this is the compatibility contract for an
// already-published leaf calling a runtime that has this fix, WITHOUT
// itself having been regenerated to pass a focus scope):
//   - No scope resolved (opts field absent, returns null/empty, or every
//     entry is null/disconnected) -> fall back to `documentHasRealFocus`,
//     i.e. the OLD document-scoped behavior.
//   - The degradation direction is pinned: worst case is "document-scoped",
//     NEVER "unconditional focus". A field that is entirely optional and
//     additive cannot regress an old leaf past where it already was.

/** Any object exposing `shadowRoot` the way `Element` does. */
interface ShadowHost {
  shadowRoot: ShadowRoot | null;
}

function hasShadowRoot(node: Node | null): node is Node & ShadowHost {
  return node != null && 'shadowRoot' in node;
}

/**
 * The composed-tree active element: start at `doc.activeElement`, and while
 * the current node exposes a non-null `shadowRoot` whose own `activeElement`
 * is non-null, descend into it. Returns the deepest focused element, or
 * `null` if nothing is focused at all.
 */
export function composedActiveElement(doc: Document): Element | null {
  let current: Element | null = doc.activeElement;
  while (current != null && hasShadowRoot(current) && current.shadowRoot != null) {
    const nested = current.shadowRoot.activeElement;
    if (nested == null) {
      break;
    }
    current = nested;
  }
  return current;
}

/**
 * Composed-tree containment: true when `anchor` is an ancestor of `node`,
 * walking UP via `parentNode` and jumping from a `ShadowRoot` to its
 * `.host` at each shadow boundary. This is the ascent that plain
 * `Node.contains` cannot do.
 */
export function composedContains(anchor: Element, node: Node | null): boolean {
  let current: Node | null = node;
  while (current != null) {
    if (current === anchor) {
      return true;
    }
    if (current instanceof ShadowRoot) {
      current = current.host;
    } else {
      current = current.parentNode;
    }
  }
  return false;
}

/**
 * True when the document has "real" focus: the composed active element is
 * non-null and is neither `doc.body` nor `doc.documentElement`. This is the
 * compatibility fallback used only when no usable scope is available.
 */
export function documentHasRealFocus(doc: Document): boolean {
  const active = composedActiveElement(doc);
  return active != null && active !== doc.body && active !== doc.documentElement;
}

/** A single scope anchor, an array of them, or nothing at all. */
export type FocusScope = Element | readonly (Element | null)[] | null | undefined;

// Plan 260806-lz7 (drill-continuity patch) — a component-internal
// transition can remove the element that currently holds focus as part of
// the SAME synchronous render that resolves a NEW attachment's very first
// guarded pass. date-picker's own months->years drill is the case that
// found this: pressing Enter on the months panel's own drill-label (a
// plain sibling button, not itself a keynav item) tears down the WHOLE
// months panel — drill-label included — to mount the years panel; by the
// time the years attachment's first pass runs, `document.activeElement`
// has already reverted to `body`, even though the user's focus was
// GENUINELY inside the component a moment ago (unlike date-picker's own
// days->months drill, whose trigger — the persistent header's heading
// button — survives every transition, so this gap never showed up there).
//
// A `focusout` event with `relatedTarget === null` is the browser's own
// signal for exactly this "the focused element just left focusability"
// case (an ordinary blur-to-another-element sets `relatedTarget` to that
// element). Lazily installing ONE document-level capture-phase listener
// per `Document` lets `focusIsWithinScope` fall back to "was the LAST such
// element within scope" when nothing is currently focused.
//
// The listener CAPTURES the event's full `composedPath()` SYNCHRONOUSLY, at
// listener time — verified against real Chromium (not happy-dom, which does
// not implement the WHATWG "unfocusing steps" at all) that the path is
// still intact at the instant `focusout` fires, even though the removal
// that triggered it is already underway. This is load-bearing for TWO
// reasons: (1) by the time `focusIsWithinScope` is actually CALLED (from a
// target's post-render effect/watch callback, strictly later — after the
// removal has fully committed), the original element's `parentNode` is
// already `null`, so a LIVE ancestor walk from a merely-stored element
// reference would find nothing; (2) `e.target` ITSELF is unusable for a
// LIT consumer specifically — a document-level listener sees `.target`
// RETARGETED to the outermost shadow host the event crossed on its way out
// (standard shadow-DOM event retargeting), which for a component nested
// inside ANOTHER custom element (e.g. a demo harness host wrapping
// `<rozie-date-picker>`) is NOT `this.host` for the DatePicker's own Lit
// class — it's the demo wrapper's host, several shadow boundaries further
// out. `composedPath()` is immune to retargeting: it lists every node the
// event actually traversed, in order, INCLUDING every shadow-root-to-host
// jump, so capturing the whole path (not just `.target`) is what makes the
// Lit case work identically to the other five targets.
//
// EXPIRY, NOT single-consumption — found via a MULTI-GROUP consumer
// (date-picker's day/months/years are three INDEPENDENT keynav attachments
// sharing the same component-wide scope): several attachments can each call
// `focusIsWithinScope` in the SAME render batch (e.g. a stale/redundant
// re-fire on an attachment that isn't even the one actually resolving the
// transition). Consuming the tracked value on the FIRST read starved every
// LATER read in that same batch — including the one attachment the
// transition was actually FOR. The tracked value instead expires on the
// next animation frame (comfortably past every target's post-render
// effect/watch flush, which all complete before the next paint) — every
// attachment checking within the SAME render batch sees the SAME value,
// while a genuinely later, unrelated interaction still gets a fresh (empty)
// tracker.
const focusLossTrackers = new WeakMap<Document, Set<EventTarget> | null>();

function ensureFocusLossTracker(doc: Document): void {
  if (focusLossTrackers.has(doc)) return;
  focusLossTrackers.set(doc, null);
  doc.addEventListener(
    'focusout',
    (e) => {
      if (e.relatedTarget != null) return; // an ordinary blur — focus went somewhere real.
      const chain = new Set(e.composedPath());
      focusLossTrackers.set(doc, chain);
      const win = doc.defaultView;
      win?.requestAnimationFrame(() => {
        // Only clear if nothing NEWER has overwritten it in the meantime.
        if (focusLossTrackers.get(doc) === chain) {
          focusLossTrackers.set(doc, null);
        }
      });
    },
    true,
  );
}

/**
 * The predicate every per-target implementation calls before running a
 * guarded (first/redundant) focus + scroll pass.
 *
 * 1. Resolve the composed active element. If null, `doc.body`, or
 *    `doc.documentElement`: normally returns false (cold static mount stops
 *    here) UNLESS the last element to lose focus via a same-tick DOM
 *    removal (see the focus-loss-tracker doc comment above, valid until the
 *    next animation frame) is contained by a non-empty `scope` — the
 *    drill-continuity patch.
 * 2. Normalize `scope` to a list of connected Elements, discarding null /
 *    disconnected entries.
 * 3. If that list is EMPTY, return `documentHasRealFocus(doc)` — the
 *    compatibility fallback (the focus-loss patch never applies here,
 *    preserving the pinned fallback semantics for a leaf that never passes
 *    a scope at all).
 * 4. Otherwise return true when `composedContains(anchor, activeElement)`
 *    holds for ANY anchor in the list.
 */
export function focusIsWithinScope(scope: FocusScope, doc: Document): boolean {
  ensureFocusLossTracker(doc);
  const active = composedActiveElement(doc);
  if (active == null || active === doc.body || active === doc.documentElement) {
    const anchors = normalizeScope(scope);
    if (anchors.length > 0) {
      const lostChain = focusLossTrackers.get(doc);
      // Deliberately NOT consumed on read — see the tracker's own doc
      // comment for why every attachment checking within the SAME render
      // batch must see the SAME value. Expires on the next animation frame
      // instead.
      if (lostChain && anchors.some((anchor) => lostChain.has(anchor))) {
        return true;
      }
    }
    return false;
  }

  const anchors = normalizeScope(scope);
  if (anchors.length === 0) {
    return documentHasRealFocus(doc);
  }

  return anchors.some((anchor) => composedContains(anchor, active));
}

function normalizeScope(scope: FocusScope): Element[] {
  const list = scope == null ? [] : Array.isArray(scope) ? scope : [scope];
  const out: Element[] = [];
  for (const entry of list) {
    if (entry != null && entry.isConnected) {
      out.push(entry);
    }
  }
  return out;
}
