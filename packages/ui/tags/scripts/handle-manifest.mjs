/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/tags.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`clear`, `focus` — the `$expose({ ... })` call in Tags.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - `clear` is collision-safe (NOT a host-element member).
 *   - the focus verb is `focus` — a DELIBERATE override of the inherited
 *     `HTMLElement.focus` on the Lit custom element. ROZ137 warns on this (it is
 *     warn-only and does NOT auto-rename), and the warn is ACCEPTED: the public
 *     `focus()` handle (which focuses the inline text input) is the intended
 *     semantics. This mirrors the otp/slider precedent and is consistent with
 *     NumberField, which also exposes `focus`. codegen's severity filter keeps
 *     only `error` diagnostics, so the deliberate ROZ137 `focus` warn never
 *     throws codegen.
 */
export const handleManifest = {
  clear:
    'Remove every token (emits `change` with `{ value: [] }`) and move DOM focus to the text input. Collision-safe — not a host-element member.',
  focus:
    'Move DOM focus to the inline text input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is the intended semantics.',
};

export default handleManifest;
