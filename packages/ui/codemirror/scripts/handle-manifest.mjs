/**
 * Hand-kept imperative-handle method-description manifest for
 * @rozie-ui/codemirror.
 *
 * The exposed methods are derived structurally from the source via
 * `ir.expose` (`getView`, `focus`, `getValue`, `replaceValue`, `dispatch`,
 * `insertText`, `getSelection`, `setSelection` — the Phase 21 `$expose({ ... })`
 * call in CodeMirror.rozie), but their human-readable descriptions have no
 * first-class IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every
 * exposed method name has an entry here and throws if one is missing.
 *
 * Collision discipline (ROZ121): none of these 12 verbs collides with a declared
 * prop name (`value/language/theme/readOnly/height/placeholder/extensions/
 * basicSetup/gutterLines/decorations`) and there are no events (D-08), so ROZ121
 * is clear. `scrollToPos` is deliberately NOT named `scrollIntoView`/`scrollTo`
 * (both inherited HTMLElement methods → Lit shadow). NOTE: the value-setter verb is
 * named `replaceValue` (NOT `setValue`) — a `value` model prop makes React
 * auto-generate a `setValue` state setter, so a `setValue` $expose verb is a hard
 * React ROZ524 collision. `replaceValue` preserves the value-setter semantics
 * collision-free across all 6 targets (deviation from the locked D-06 name
 * `setValue`; see 29-01-SUMMARY.md).
 */
export const handleManifest = {
  getView: 'Return the underlying CodeMirror `EditorView` for direct API access.',
  focus: 'Focus the editor.',
  getValue: 'Return the current document text as a string.',
  replaceValue:
    'Replace the document text — routes through the same suppress-echo guard as the `value` prop watcher.',
  dispatch: 'Dispatch a raw CodeMirror transaction — `dispatch(tr)`.',
  insertText: 'Insert text at the current main selection — `insertText(text)`.',
  getSelection: 'Return the main selection range (`{ anchor, head, from, to }`) or null.',
  setSelection: 'Set the selection — `setSelection(posNumber | { anchor, head })`.',
  undo: 'Undo the last change (CodeMirror history command).',
  redo: 'Redo the last undone change.',
  selectAll: 'Select the entire document.',
  scrollToPos:
    'Scroll a document position into view — `scrollToPos(pos, opts?)` (defaults to vertically centering). Not named `scrollIntoView`/`scrollTo` to avoid the Lit inherited-method shadow.',
};

export default handleManifest;
