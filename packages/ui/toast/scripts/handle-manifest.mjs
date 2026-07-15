/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/toast.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`show`, `dismiss`, `clear`, `patch`, `promise` — the `$expose({ ... })`
 * call in Toaster.rozie), but their human-readable descriptions have no
 * first-class IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - `show` / `dismiss` / `clear` / `patch` / `promise` are all collision-safe
 *     — none is an inherited `HTMLElement` / `Element` / `Node` member (no
 *     ROZ137 Lit-class-field clash; `patch`, not `update`, sidesteps the
 *     LitElement `update()` lifecycle method), the single `dismissed` emit
 *     does not collide with any of them (no ROZ121), and Toaster has no
 *     `model: true` prop (no ROZ524 React-setter clash). compile()×6 is
 *     therefore fully clean — zero error AND zero warning diagnostics.
 */
export const handleManifest = {
  show:
    'Enqueue a toast. Accepts `{ message, type, duration, id }` (all optional — `message` defaults to `\'\'`, `type` to `\'info\'`, `duration` to the `duration` prop). Returns the toast `id`. A non-sticky toast (duration > 0) auto-dismisses; `duration: 0` makes it sticky.',
  dismiss:
    "Remove a single toast by the `id` returned from `show` (routes through the exit lifecycle with reason `'api'` — fires `dismissed`, plays the exit animation, then removes it).",
  clear:
    'Remove every visible toast at once immediately (no exit animation) and clear all pending auto-dismiss timers. Does NOT fire `dismissed`.',
  patch:
    "Update an existing toast in place. Accepts `(id, { message, type, duration })` — only the keys you pass are merged into the matching entry. Returns `true` if the id existed, `false` otherwise (no throw). Including a `duration` key clears and restarts that toast's auto-dismiss timer (`0` makes it sticky; a positive value arms/re-arms it); omitting `duration` leaves a running timer untouched.",
  promise:
    "Sugar over `show`/`patch` for an async operation: `promise(p, { loading, success, error })` immediately shows a `{ type: 'loading', duration: 0 }` toast and returns its `id` SYNCHRONOUSLY. On resolve it patches the SAME toast to `{ type: 'success', message: resolve(success, value) }` (the auto-dismiss timer starts AT SETTLE); on reject, likewise with `error`. `success`/`error` accept a string or a `(value) => string` function. Never resurrects a toast dismissed while `p` was still pending, and never returns a derived promise — your own `.then`/`.catch` on `p` still fire.",
};

export default handleManifest;
