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

/**
 * The predicate every per-target implementation calls before running a
 * guarded (first/redundant) focus + scroll pass.
 *
 * 1. Resolve the composed active element. If null, `doc.body`, or
 *    `doc.documentElement`, return false (cold static mount stops here).
 * 2. Normalize `scope` to a list of connected Elements, discarding null /
 *    disconnected entries.
 * 3. If that list is EMPTY, return `documentHasRealFocus(doc)` — the
 *    compatibility fallback.
 * 4. Otherwise return true when `composedContains(anchor, activeElement)`
 *    holds for ANY anchor in the list.
 */
export function focusIsWithinScope(scope: FocusScope, doc: Document): boolean {
  const active = composedActiveElement(doc);
  if (active == null || active === doc.body || active === doc.documentElement) {
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
