/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/toast.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`show`, `dismiss`, `clear` — the `$expose({ ... })` call in Toaster.rozie),
 * but their human-readable descriptions have no first-class IR source — so the
 * prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - `show` / `dismiss` / `clear` are all collision-safe — none is an inherited
 *     `HTMLElement` / `Element` / `Node` member (no ROZ137 Lit-class-field clash),
 *     and Toaster emits no events (no ROZ121 expose==emit clash) and has no
 *     `model: true` prop (no ROZ524 React-setter clash). compile()×6 is therefore
 *     fully clean — zero error AND zero warning diagnostics.
 */
export const handleManifest = {
  show:
    'Enqueue a toast. Accepts `{ message, type, duration, id }` (all optional — `message` defaults to `\'\'`, `type` to `\'info\'`, `duration` to the `duration` prop). Returns the toast `id`. A non-sticky toast (duration > 0) auto-dismisses; `duration: 0` makes it sticky.',
  dismiss:
    'Remove a single toast by the `id` returned from `show` (clears its auto-dismiss timer).',
  clear:
    'Remove every visible toast at once and clear all pending auto-dismiss timers.',
};

export default handleManifest;
