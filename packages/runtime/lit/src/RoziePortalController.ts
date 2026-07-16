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
 * This controller owns ONLY the DOM-relocation half (the Svelte
 * `roziePortal` action / Angular `__roziePortalPlace` method's shared
 * anchor-capture-and-restore semantics, ported to Lit's `ReactiveController`
 * lifecycle):
 *   - `hostUpdated()` — Lit's reactive-controller lifecycle hook, called
 *     after EVERY render (including the first). Idempotent by design
 *     (`appendChild` on an already-correct parent is a harmless no-op), so
 *     no dependency-array bookkeeping is needed — every call just
 *     re-asserts the correct DOM position for the CURRENT resolved
 *     container.
 *   - `hostDisconnected()` — removes the node from wherever it currently
 *     lives IF it was moved. Lit's own shadow-root teardown is not
 *     guaranteed to find a node relocated outside its logical DOM position.
 *
 * `getElement`/`getContainer` are getters (not values) so the controller
 * always reads the LATEST `@query`-resolved element + freshly-evaluated
 * container expression on each `hostUpdated()` call — mirrors
 * `KeynavController`'s identical getter-based `opts` shape.
 *
 * @public — runtime API consumed by emitted Lit components.
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';

export interface RoziePortalControllerHost extends ReactiveControllerHost {}

export class RoziePortalController implements ReactiveController {
  private readonly host: RoziePortalControllerHost;
  private readonly getElement: () => Element | null | undefined;
  private readonly getContainer: () => Element | null | undefined;
  private anchor: { parent: Node | null; next: Node | null } | null = null;
  private moved = false;

  constructor(
    host: RoziePortalControllerHost,
    getElement: () => Element | null | undefined,
    getContainer: () => Element | null | undefined,
  ) {
    this.host = host;
    this.getElement = getElement;
    this.getContainer = getContainer;
    host.addController(this);
  }

  private place(el: Element, target: Element | null | undefined): void {
    if (!this.anchor) {
      // Lazily capture the element's NATURAL template position on the
      // first placement — before any move — so a later falsy `target`
      // restores it exactly (mirrors Vue Teleport's `:disabled` in-place
      // restoration / Angular's `__roziePortalAnchors` WeakMap).
      this.anchor = { parent: el.parentNode, next: el.nextSibling };
    }
    if (target) {
      // Resurrect GUARD (mirrors the falsy-target `!this.moved` guard below):
      // when the element is currently DISCONNECTED and we never moved it out,
      // Lit authoritatively removed it (`r-if`/`open` → false) while
      // `@query(cache:true)` still returns the stale node. A newly-truthy
      // target must NOT append that node back into the document — doing so
      // RESURRECTS a closed overlay (toggling `appendTo` to a container while
      // the palette is closed re-mounted a full-viewport, pointer-capturing
      // backdrop into the container, blocking every click). Only place a node
      // Lit still intends to render (connected in the shadow root) or one we
      // already own (previously moved out).
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
      this.moved = true;
      return;
    }
    // Target is falsy (render in place). ONLY restore-to-anchor when we had
    // previously moved the element OUT to a container. When the element was
    // never portalled (steady in-place — the common case: `appendTo` absent),
    // Lit owns its full lifecycle: an `r-if`/`open` toggle legitimately
    // removes it, and `@query(cache: true)` keeps returning the now-removed
    // node. Re-inserting it here would RESURRECT a Lit-detached "zombie"
    // (e.g. the command-palette overlay reappearing with a stale, still-open
    // result list after the palette was told to close), and even a same-parent
    // re-insert blurs a focused descendant on every keystroke. So: if we never
    // moved it, do nothing and let Lit render authoritatively.
    if (!this.moved) return;
    this.moved = false;
    if (this.anchor.parent) {
      if (this.anchor.next && this.anchor.next.parentNode === this.anchor.parent) {
        this.anchor.parent.insertBefore(el, this.anchor.next);
      } else {
        this.anchor.parent.appendChild(el);
      }
    }
  }

  hostUpdated(): void {
    const el = this.getElement();
    if (!el) return; // Pre-render / falsy r-if — nothing to place yet.
    this.place(el, this.getContainer());
  }

  hostDisconnected(): void {
    const el = this.getElement();
    if (el && this.moved && el.parentNode) {
      el.parentNode.removeChild(el);
      this.moved = false;
    }
  }
}
