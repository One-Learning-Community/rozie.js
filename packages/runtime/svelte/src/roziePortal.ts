/**
 * roziePortal — command-palette-portal-overlay phase — Svelte 5 action for
 * the NEW element-level `r-portal="<expr>"` teleport directive.
 *
 * Distinct from `PortalHost.svelte` (the P33 slot-content-INTO-container
 * primitive, untouched by this phase): `roziePortal` relocates the element
 * it is attached to OUT to a container, imperatively, via native DOM
 * `appendChild`/`insertBefore` — no framework-level teleport primitive
 * exists in Svelte 5 (unlike Vue's `<Teleport>` or React's `createPortal`),
 * so an ACTION operating on the already-rendered node is the idiomatic
 * Svelte shape (mirrors `applyListeners`'s D-11 rationale: "the only
 * idiomatic shape for [X] is a Svelte 5 action").
 *
 * Lifecycle (Svelte 5 action contract — https://svelte.dev/docs/svelte/svelte-action):
 *   - runs synchronously after the element is created (this is INITIAL
 *     placement, run once)
 *   - `update(next)` runs whenever the action's parameter (the resolved
 *     container) changes by reference — moves the node to the new
 *     container, or restores it to its natural position when `next` is
 *     falsy
 *   - `destroy()` runs on `{#if}` block removal / component unmount /
 *     parent destroy — removes the node from wherever it currently lives
 *     (this is the SAME element instance the surrounding `{#if}` block
 *     will also tear down; explicit removal here prevents a double-remove
 *     race with Svelte's own block-teardown by making the node's DOM
 *     absence idempotent)
 *
 * In-place (disabled) semantics: a falsy `container` (null/undefined/false)
 * on INITIAL attach is a no-op — the node is already in its natural
 * template position, exactly where the surrounding `{#if}` mounted it — so
 * `appendChild`-ing it "back" is unnecessary. On `update`, a transition
 * FROM a truthy container back TO falsy restores the node to its captured
 * original parent/next-sibling anchor. This is what makes `appendTo:false`
 * byte-behavior-identical to no directive at runtime.
 *
 * SSR: Svelte's `use:` action directives are DOM-only — the SSR compile
 * target never emits or evaluates the action or its argument expression,
 * so no `typeof document` guard is needed here (unlike React/Solid, whose
 * portal wrap is a plain JSX expression evaluated during SSR render).
 *
 * @public — runtime API consumed by emitted .svelte files.
 */
export function roziePortal(
  node: Element,
  container: Element | null | undefined,
): {
  update(next: Element | null | undefined): void;
  destroy(): void;
} {
  // Capture the node's natural template position ONCE, before any move, so
  // a later falsy `update()` can restore it exactly (mirrors Vue Teleport's
  // "disabled" in-place restoration).
  const originalParent = node.parentNode;
  const originalNextSibling = node.nextSibling;
  // Finding 10 (R3) — track whether we currently have the node relocated
  // OUT to a container (mirrors the Lit controller's `moved` field). Needed
  // for the resurrect guard below and to avoid a spurious restore-move when
  // the node was never portalled.
  let moved = false;

  function place(target: Element | null | undefined): void {
    if (target) {
      // Resurrect GUARD (ported verbatim from RoziePortalController): when
      // the node was never moved out AND is currently disconnected, the
      // enclosing `{#if}` block removed it — a newly-truthy container must
      // NOT append it back (that resurrects a block-removed node).
      if (!moved && !node.isConnected) return;
      // Position GUARD: appendChild of an already-present node is a MOVE
      // (detach + reattach), NOT a no-op — it blurs any focused descendant.
      // `update()` re-runs on every parameter change, so re-asserting an
      // already-correct position must leave the node physically untouched.
      if (node.parentNode !== target) {
        target.appendChild(node);
      }
      moved = true;
      return;
    }
    // Falsy target (render in place). Only restore when we PREVIOUSLY moved
    // the node out — a never-moved node is already in its natural position,
    // and re-inserting it would blur a focused descendant (mirrors the Lit
    // controller's `if (!this.moved) return;` falsy-branch guard).
    if (!moved) return;
    moved = false;
    // Restore to the captured natural position, if it's still attached to
    // the document (a torn-down ancestor is a no-op: the enclosing
    // {#if}/component teardown will discard this node too).
    if (originalParent && originalParent.isConnected) {
      if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
        originalParent.insertBefore(node, originalNextSibling);
      } else {
        originalParent.appendChild(node);
      }
    }
  }

  // Initial attach — a truthy container moves the node immediately; a
  // falsy container is a no-op (the node is already where it belongs).
  if (container) place(container);

  return {
    update(next) {
      place(next);
    },
    destroy() {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    },
  };
}
