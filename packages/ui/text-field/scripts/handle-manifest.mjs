/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/text-field.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (`focus`, `select`, `clear`); their README prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every exposed
 * method name has an entry here and throws if one is missing.
 *
 * `focus` deliberately overrides the inherited `HTMLElement.focus` on the Lit
 * custom element (signature-compatible; ROZ137 warns and is accepted — the otp /
 * number-field precedent), so `el.focus()` moves focus into the control.
 */
export const handleManifest = {
  focus: 'Move focus to the control (the `<input>`, or the `<textarea>` when `multiline`).',
  select: 'Focus the control and select all of its text.',
  clear: 'Empty the field: writes `modelValue = \'\'` (and re-measures an `autosize` field). Does not emit `change`.',
};

export default handleManifest;
