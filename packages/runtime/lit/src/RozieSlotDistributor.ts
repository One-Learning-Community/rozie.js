/**
 * `RozieSlotDistributor` — manual slot-assignment reactive controller for the
 * Lit target (Quick 260808-iyh, D5).
 *
 * Native named `<slot>` assignment has no per-iteration identity: when
 * `repeat()` renders N runtime `<slot name="row">` elements (one per `r-for`
 * iteration), every one of them projects the SAME set of light-DOM
 * `slot="row"` children — the browser groups by name only, with no concept
 * of "the 2nd slot named row gets the 2nd matching child". The same
 * ambiguity exists for two AUTHORED `<slot name="x">` occurrences at
 * different template positions. This controller closes that gap by putting
 * the shadow root in `slotAssignment: 'manual'` mode and driving
 * `HTMLSlotElement.assign()` itself, using tree order + i-th assignment
 * (with surplus routed to the LAST slot in a name-group) as the
 * disambiguation rule.
 *
 * ── The whole-shadow-root constraint ─────────────────────────────────────
 * `slotAssignment: 'manual'` is a per-shadow-root setting — a component
 * cannot mix native ('named') and manual assignment for different slots in
 * the SAME shadow root. Every `<slot>` this controller finds via
 * `querySelectorAll('slot')` is therefore distributed here, not just the
 * colliding ones. The emitter only wires this controller in at all when
 * `shouldDistributeSlots(ir)` (`packages/targets/lit/src/emit/shouldDistributeSlots.ts`)
 * detects a genuine collision (a duplicated slot name, or a slot nested
 * under `r-for`) — see that module's doc comment for why this stays a
 * compile-time IR-shape gate rather than a universal default.
 *
 * ── Initial-pass ordering ────────────────────────────────────────────────
 * No `firstUpdated()` splice is needed to guarantee the FIRST distribution
 * pass runs before style adoption. `@lit/reactive-element`'s `_$didUpdate`
 * runs every registered controller's `hostUpdated()` (reactive-element.js:941)
 * BEFORE the host's own `firstUpdated()` (L944), and `adoptDocumentStyles(this)`
 * is the first statement inside the emitted `firstUpdated()` — so this
 * controller's `hostUpdated()` → `distribute()` call already precedes style
 * adoption on every connect, at zero emitted-code cost.
 *
 * ── Re-entrancy guard (T-260808-iyh-01) ──────────────────────────────────
 * `assign()` fires `slotchange`, which (via `@queryAssignedElements` /
 * `observeRozieSlotCtx`) writes the emitted `_hasSlot<X>` / D4 `_slot<X>Assigned`
 * reactive state, which calls `requestUpdate()`, which re-enters
 * `hostUpdated()`, which would call `assign()` again — a `slotchange` ->
 * `requestUpdate()` -> `hostUpdated()` -> `assign()` re-entrancy loop that
 * spins the main thread. `assignIfChanged()` breaks the loop by comparing the
 * TARGET node set against the slot's CURRENT `assignedNodes()` (by length,
 * then element-wise identity) and skipping the `assign()` call entirely when
 * they already match. This controller NEVER calls `requestUpdate()` itself.
 *
 * ── MutationObserver: `subtree: true` is required, not optional ─────────
 * Observing attribute changes on the light-DOM CHILDREN (a consumer flipping
 * `slot="row"` -> `slot="other"` on an existing child) requires `subtree:
 * true` on the observer — per the MutationObserver spec, `attributes: true`
 * without `subtree` only watches the TARGET node's own attributes, not its
 * descendants'. `childList` mutations on the host's DIRECT children are
 * reported regardless of `subtree` (they fire on the target that the
 * mutation actually happened on — the host itself, for direct
 * append/remove), but `subtree: true` is the only way to also catch
 * attribute mutations one level down. Verified against
 * `@lit/reactive-element`'s test host (`happy-dom@15.11.7`)'s
 * `Node.js#observeMutations`, which only propagates a listener to child
 * nodes when `options.subtree` is set — matching the WHATWG spec, not a
 * happy-dom-only quirk.
 *
 * ── Known limitation ──────────────────────────────────────────────────────
 * A nested `<slot>` inside another slot's fallback content that shares its
 * parent's name falls into the SAME name-group as its parent and is resolved
 * deterministically by the same i-th / extras-to-last rule as any other
 * duplicate — there is no special-casing for the nesting relationship.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * A `ReactiveControllerHost` that is also an `HTMLElement` — every emitted
 * component this controller is instantiated on satisfies this (the emitter
 * always passes `this` from inside a `LitElement` subclass's own field
 * initializer, mirroring `KeynavController`'s / `RoziePortalController`'s
 * `host: this` convention).
 */
export type RozieSlotDistributorHost = ReactiveControllerHost & HTMLElement;

export class RozieSlotDistributor implements ReactiveController {
  private readonly host: RozieSlotDistributorHost;
  private observer: MutationObserver | null = null;

  constructor(host: RozieSlotDistributorHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.observer = new MutationObserver(() => this.distribute());
    // `subtree: true` — see the module doc comment ("MutationObserver:
    // subtree: true is required, not optional"). Without it, a consumer
    // flipping a child's `slot` attribute is silently missed.
    this.observer.observe(this.host, {
      childList: true,
      attributes: true,
      attributeFilter: ['slot'],
      subtree: true,
    });
    // Deferred to a microtask, not called synchronously. On a RECONNECT
    // (not the first-ever connect), the shadow tree's connected-state
    // propagation finishes synchronously within the SAME insertion call
    // that fires this hostConnected() hook, but AFTER connectedCallback
    // has already run — a synchronous distribute() here would see the
    // <slot> elements as not-yet-connected and `assign()` would be a
    // silent no-op on some DOM implementations (verified against
    // happy-dom@15.11.7's `Node.js#connectedToNode`, whose shadow-subtree
    // recursion runs strictly after the host's own `connectedCallback`).
    // Deferring one microtask lets that synchronous propagation finish
    // first — still effectively immediate (well before any awaited
    // `updateComplete`). On the FIRST-EVER connect this is equally
    // correct: no `<slot>` exists in the shadow DOM yet at hostConnected()
    // time regardless (Lit's own first render is itself deferred), so the
    // real first distribution is always hostUpdated()'s post-render pass
    // either way — this microtask call is a no-op then too.
    queueMicrotask(() => this.distribute());
  }

  hostUpdated(): void {
    this.distribute();
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  /**
   * Re-projects every `<slot>` in the shadow root from the host's current
   * light-DOM children. Public so the emitter (or a test) can force a pass;
   * called automatically from `hostConnected()` and `hostUpdated()`. NEVER
   * calls `requestUpdate()` — see the module doc comment's re-entrancy
   * guard.
   */
  distribute(): void {
    const root = this.host.shadowRoot;
    if (!root) return;

    // Tree (document) order — the ordering contract for i-th assignment.
    const slotEls = Array.from(root.querySelectorAll('slot'));

    // Bucket the host's light-DOM children by slot name in ONE pass.
    // Elements with a non-empty `slot` attribute go to that name's bucket;
    // elements without one, and any Text node, go to the unnamed ('')
    // bucket — this is what keeps default-slot text content (which native
    // named assignment auto-projects, and manual mode does NOT) alive.
    // Comment nodes and any other node type are skipped.
    const buckets = new Map<string, (Element | Text)[]>();
    const pushToBucket = (name: string, node: Element | Text): void => {
      const bucket = buckets.get(name);
      if (bucket) {
        bucket.push(node);
      } else {
        buckets.set(name, [node]);
      }
    };
    for (const node of Array.from(this.host.childNodes)) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        pushToBucket(el.getAttribute('slot') ?? '', el);
      } else if (node.nodeType === Node.TEXT_NODE) {
        pushToBucket('', node as Text);
      }
      // Comment / other node types: not slottable, skip.
    }

    // Group the CURRENT slot elements by name, preserving tree order within
    // each group.
    const groups = new Map<string, HTMLSlotElement[]>();
    for (const slotEl of slotEls) {
      const name = slotEl.name; // '' for the unnamed slot.
      const group = groups.get(name);
      if (group) {
        group.push(slotEl);
      } else {
        groups.set(name, [slotEl]);
      }
    }

    for (const [name, group] of groups) {
      const bucket = buckets.get(name) ?? [];
      if (group.length === 1) {
        // Single-slot back-compat: the one slot for this name gets the
        // WHOLE bucket — today's native all-children-to-one-slot semantics,
        // preserved.
        this.assignIfChanged(group[0]!, bucket);
        continue;
      }
      // N-to-N (or N-to-fewer) assignment: slot i gets bucket[i] alone,
      // except the LAST slot in the group, which gets every remaining
      // bucket entry from its index onward — surplus children never vanish.
      const lastIndex = group.length - 1;
      for (let i = 0; i < group.length; i++) {
        const targets = i === lastIndex ? bucket.slice(i) : bucket.slice(i, i + 1);
        this.assignIfChanged(group[i]!, targets);
      }
    }
  }

  /**
   * Calls `slotEl.assign(...nodes)` ONLY when `nodes` differs from the
   * slot's current `assignedNodes()` — by length, then element-wise
   * identity. This guard is non-negotiable (T-260808-iyh-01): without it,
   * `assign()` fires `slotchange` unconditionally on every pass, which
   * re-enters `hostUpdated()` via the emitted reactive-state write it
   * triggers, spinning the main thread. Compares `assignedNodes()`, not
   * `assignedElements()`, because the unnamed-slot targets include Text
   * nodes.
   */
  private assignIfChanged(slotEl: HTMLSlotElement, nodes: (Element | Text)[]): void {
    const current = slotEl.assignedNodes();
    if (current.length === nodes.length && current.every((n, i) => n === nodes[i])) {
      return;
    }
    slotEl.assign(...nodes);
  }
}
