/**
 * RoziePortalController — command-palette-portal-overlay phase — Lit
 * `ReactiveController` for the NEW element-level `r-portal="<expr>"`
 * teleport directive.
 *
 * LIT IS THE HAZARD TARGET (Shadow DOM): every other target's element lives
 * in the light DOM (or, for Vue's `<Teleport>`/React's `createPortal`, moves
 * within the same document tree with no encapsulation boundary crossed). A
 * Lit component's template renders into a SHADOW ROOT — `static styles`
 * (the component's `[data-rozie-s-<hash>]`-scoped CSS, see `scopeCss.ts`)
 * is attached via `shadowRoot.adoptedStyleSheets`, which is PHYSICALLY
 * confined to that shadow tree. When `r-portal` relocates an element OUT to
 * `document.body` (light DOM, outside ANY shadow root), the shadow-scoped
 * stylesheet no longer reaches it — attribute-selector matching alone
 * cannot cross the shadow boundary; the stylesheet must ALSO exist
 * globally. `emitStyle.ts` reuses the EXISTING `injectGlobalStyles` runtime
 * helper (the same one `:root {}` rules already use) to ALSO push the
 * component's scoped CSS into `document.head` when the template has at
 * least one `r-portal` element — the relocated node already carries
 * `[data-rozie-s-<hash>]` (every `tagKind: 'html'` element does,
 * unconditionally), so the globally-injected, identically-scoped rules
 * match ONLY this component's own (portalled) elements, never a sibling
 * consumer's shadow-internal ones.
 *
 * ── THE SENTINEL (SEV-1 close-while-portalled zombie fix) ─────────────────
 * Once the controller moves the portalled node OUT of the shadow root, Lit's
 * `ChildPart` clear (`r-if`/`open` → false renders `nothing`) can no longer
 * reach it — the node is no longer in the logical DOM position Lit tracks.
 * An UNCACHED `@query` of the shadow root then returns `null` in TWO
 * indistinguishable states: (1) steadily portalled (node legitimately living
 * in the foreign container) and (2) closed (Lit dropped the branch). Reading
 * the portalled element alone cannot tell these apart, so a close left the
 * relocated node stranded in `document.body` forever as a pointer-capturing
 * zombie backdrop.
 *
 * The fix: the emitter stamps a zero-footprint SENTINEL element
 * (`<span data-rozie-portal-anchor="__roziePortalN" hidden>`) as a sibling
 * immediately preceding the portalled element, INSIDE the same `r-if`
 * conditional branch. The sentinel is never moved, so it stays under Lit's
 * ChildPart control in the shadow root: it is PRESENT exactly while the
 * conditional branch is alive and ABSENT the instant Lit drops the branch.
 * The controller reads the sentinel (`getAnchor`) as the authoritative
 * liveness signal — sentinel absent + a tracked moved node ⇒ the branch was
 * dropped ⇒ remove the stranded node from its container. Both the element
 * (`getElement`) and sentinel (`getAnchor`) queries MUST be UNCACHED so a
 * close→reopen that recreates the node is observed (a cached query would
 * stay bound to the first, now-stale node).
 *
 * This controller owns ONLY the DOM-relocation half (the Svelte
 * `roziePortal` action / Angular `__roziePortalPlace` method's shared
 * anchor-capture-and-restore semantics, ported to Lit's `ReactiveController`
 * lifecycle):
 *   - `hostUpdated()` — Lit's reactive-controller lifecycle hook, called
 *     after EVERY render (including the first). Reconciles the tracked moved
 *     node against the freshly-queried element + sentinel per the contract
 *     below.
 *   - `hostDisconnected()` — removes the node from wherever it currently
 *     lives IF it was moved, and clears ALL tracking so a reconnect restarts
 *     cleanly. Lit's own shadow-root teardown is not guaranteed to find a
 *     node relocated outside its logical DOM position.
 *
 * `getElement`/`getAnchor`/`getContainer` are getters (not values) so the
 * controller always reads the LATEST `@query`-resolved element + sentinel +
 * freshly-evaluated container expression on each `hostUpdated()` call.
 *
 * @public — runtime API consumed by emitted Lit components.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

export interface RoziePortalControllerHost extends ReactiveControllerHost {}

export class RoziePortalController implements ReactiveController {
  /**
   * command-palette-portal-through-portal cluster (BUG A) — a STRING-VALUED
   * brand `rozieResolvePortalledRef` checks INSTEAD OF `instanceof
   * RoziePortalController`. Each per-target-component Vite/Rollup chunk in
   * the real bundled build (confirmed live: the VR host's per-example code
   * splitting) can end up with its OWN separately-bundled copy of
   * `@rozie/runtime-lit` — a classic dual-package-hazard — so an
   * `instanceof` check against an import from a DIFFERENT chunk's copy of
   * this class silently fails even though the object is a genuine
   * `RoziePortalController` (confirmed live: `constructor.name` came back
   * minified/mangled to an unrelated short name, `.element` still worked
   * fine when read directly by field name). A plain string property survives
   * bundling/minification (property NAMES are not renamed by the toolchain
   * — only declaration identifiers/class names are), so this is bundling-
   * boundary-safe where `instanceof` is not.
   */
  readonly __rozieBrand = 'RoziePortalController' as const;
  private readonly host: RoziePortalControllerHost;
  private readonly getElement: () => Element | null | undefined;
  private readonly getAnchor: () => Element | null | undefined;
  private readonly getContainer: () => Element | null | undefined;
  private anchor: { parent: Node | null; next: Node | null } | null = null;
  // The node we relocated OUT to a container (`null` when nothing is placed).
  // Tracked as a node reference (not a boolean) so a close→reopen that
  // recreates the element is detectable (fresh query !== tracked node).
  private moved: Element | null = null;

  /**
   * command-palette-portal-through-portal cluster (BUG A) — the LIVE,
   * currently-relocated node (or `null` when nothing is portalled right
   * now: rendered in place, or the branch is closed). Public, additive
   * read-only accessor for `rozieResolvePortalledRef` (`@rozie/runtime-lit`):
   * an author `ref="x"` living INSIDE this controller's relocated subtree
   * cannot be found via a plain `this.renderRoot.querySelector` once
   * `place()` has moved it out — `rozieResolvePortalledRef` falls back to
   * searching WITHIN `.element`'s subtree instead. Always reflects the
   * CURRENT `hostUpdated()`-synced state (including the recreate-on-
   * reopen case — see `hostUpdated()`'s "Recreate" branch below), so
   * callers never need their own caching/staleness guard.
   */
  get element(): Element | null {
    return this.moved;
  }

  constructor(
    host: RoziePortalControllerHost,
    getElement: () => Element | null | undefined,
    getAnchor: () => Element | null | undefined,
    getContainer: () => Element | null | undefined,
  ) {
    this.host = host;
    this.getElement = getElement;
    this.getAnchor = getAnchor;
    this.getContainer = getContainer;
    host.addController(this);
  }

  private place(el: Element, target: Element | null | undefined): void {
    if (target) {
      if (!this.anchor) {
        // Lazily capture the element's NATURAL template position on the
        // first placement — before any move — so a later falsy `target`
        // restores it exactly (mirrors Vue Teleport's `:disabled` in-place
        // restoration / Angular's `__roziePortalAnchors` WeakMap).
        this.anchor = { parent: el.parentNode, next: el.nextSibling };
      }
      // Resurrect GUARD (defense-in-depth alongside the sentinel gate): when
      // the element is currently DISCONNECTED and we never moved it out, Lit
      // authoritatively removed it. A newly-truthy target must NOT append that
      // node back into the document — doing so RESURRECTS a closed overlay.
      // Only place a node Lit still intends to render (connected in the shadow
      // root) or one we already own (previously moved out).
      if (!this.moved && !el.isConnected) return;
      // Position GUARD: `appendChild`/`insertBefore` of an already-present
      // node is a MOVE (detach + reattach), NOT a no-op — it blurs any
      // focused descendant and fires spurious DOM mutations. `hostUpdated`
      // runs after EVERY render, so re-asserting an already-correct position
      // must leave the node physically untouched. Only append when the node
      // is not already parented by the target.
      if (el.parentNode !== target) {
        target.appendChild(el);
      }
      this.moved = el;
      return;
    }
    // Target is falsy (render in place). ONLY restore-to-anchor when we had
    // previously moved the element OUT to a container. When the element was
    // never portalled (steady in-place — the common case: `appendTo` absent),
    // Lit owns its full lifecycle and re-inserting here would blur a focused
    // descendant on every keystroke. So: if we never moved it, do nothing and
    // let Lit render authoritatively.
    if (!this.moved) return;
    const moved = this.moved;
    const anchor = this.anchor;
    this.moved = null;
    this.anchor = null;
    if (anchor && anchor.parent) {
      if (anchor.next && anchor.next.parentNode === anchor.parent) {
        anchor.parent.insertBefore(moved, anchor.next);
      } else {
        anchor.parent.appendChild(moved);
      }
    }
  }

  hostUpdated(): void {
    const sentinel = this.getAnchor();

    // Sentinel ABSENT — the `r-if` conditional branch was dropped. If we had
    // relocated a node out to a container, Lit's ChildPart clear could not
    // reach it; remove the stranded node ourselves (THE zombie fix) and clear
    // all tracking. If we never moved anything (in-place overlay), Lit already
    // removed the node authoritatively — nothing to do.
    if (!sentinel) {
      if (this.moved) {
        if (this.moved.parentNode) this.moved.parentNode.removeChild(this.moved);
        this.moved = null;
        this.anchor = null;
      }
      return;
    }

    // Sentinel PRESENT — the branch is alive.
    const q = this.getElement();

    // Recreate (close→reopen): a FRESH element appeared in the shadow while we
    // still track an OLD relocated node. Remove the stale node from its
    // container and adopt the fresh one (place() below re-portals it).
    if (this.moved && q && q !== this.moved) {
      if (this.moved.parentNode) this.moved.parentNode.removeChild(this.moved);
      this.moved = null;
      this.anchor = null;
    }

    // While steadily portalled, the uncached shadow query returns `null` (the
    // node lives in the foreign container) — fall back to the tracked node so
    // container changes still re-place it. Pre-render / not-yet-resolved: bail.
    const el = this.moved ?? q;
    if (!el) return;

    this.place(el, this.getContainer());
  }

  hostDisconnected(): void {
    // Restore the relocated node to its NATURAL shadow-DOM position (not just
    // detach it) so a reconnect + re-render finds the node where Lit expects
    // it and cleanly re-portals — and, either way, the foreign container is
    // emptied. Then clear ALL tracking so the reconnect restarts fresh.
    if (this.moved) {
      const moved = this.moved;
      const anchor = this.anchor;
      if (anchor && anchor.parent) {
        if (anchor.next && anchor.next.parentNode === anchor.parent) {
          anchor.parent.insertBefore(moved, anchor.next);
        } else {
          anchor.parent.appendChild(moved);
        }
      } else if (moved.parentNode) {
        moved.parentNode.removeChild(moved);
      }
    }
    this.moved = null;
    this.anchor = null;
  }
}
