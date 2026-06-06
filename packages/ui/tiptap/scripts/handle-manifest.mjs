/**
 * Hand-kept imperative-handle method-description manifest for @rozie-ui/tiptap.
 *
 * The exposed methods are derived structurally from the source via `ir.expose`
 * (the Phase 21 `$expose({ ... })` call in TipTap.rozie), but their
 * human-readable descriptions have no first-class IR source — so the prose lives
 * here. KEYS MUST stay in lockstep with `ir.expose`: codegen.mjs asserts every
 * exposed method name has an entry here and throws if one is missing.
 *
 * Collision discipline:
 *   - The content setter is `setContent`, NOT `setHtml` — an `html` model prop
 *     makes React auto-generate a `setHtml` state setter (ROZ524).
 *   - The focus/blur COMMANDS are `focusEditor`/`blurEditor`, NOT `focus`/`blur`
 *     — the component emits `focus`/`blur` EVENTS, and on class-based targets
 *     (Angular) an output field and a method cannot share a name (ROZ121).
 *   - None of the 14 names collides with the 8 props or LitElement lifecycle.
 */
export const handleManifest = {
  getEditor:
    'Return the underlying TipTap `Editor` instance for direct API access (commands, state, schema, extension storage).',
  focusEditor: 'Focus the editor — place the caret in the document.',
  blurEditor: 'Blur the editor — remove focus from the document.',
  getHTML: 'Return the current document serialized as an HTML string.',
  getJSON: 'Return the current document as a ProseMirror JSON object (`JSONContent`).',
  setContent:
    'Replace the document content — `setContent(html)`. Echo-guarded: reflects into the bound `html` model without bouncing an extra `update`.',
  clearContent:
    'Clear the document to an empty paragraph (reflects the empty value into the bound `html` model).',
  toggleBold: 'Toggle bold on the current selection.',
  toggleItalic: 'Toggle italic on the current selection.',
  toggleHeading:
    'Toggle a heading at the given level — `toggleHeading(level)` (defaults to 1).',
  toggleBulletList: 'Toggle a bullet list at the current selection.',
  undo: 'Undo the last change.',
  redo: 'Redo the last undone change.',
  chain:
    'Return a focused TipTap command chain for composing commands — e.g. `chain().toggleBold().toggleItalic().run()` (null before mount).',
};

export default handleManifest;
