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
 *   - None of the 22 names collides with the 11 props or LitElement lifecycle.
 */
export const handleManifest = {
  getEditor:
    'Return the underlying TipTap `Editor` instance for direct API access (commands, state, schema, extension storage).',
  focusEditor: 'Focus the editor — place the caret in the document.',
  blurEditor: 'Blur the editor — remove focus from the document.',
  getHTML: 'Return the current document serialized as an HTML string.',
  getJSON: 'Return the current document as a ProseMirror JSON object (`JSONContent`).',
  getText: 'Return the current document as a plain-text string (word/char counts, search indexing, plaintext export).',
  setContent:
    'Replace the document content — `setContent(html)`. Echo-guarded: reflects into the bound `html` model without bouncing an extra `update`.',
  clearContent:
    'Clear the document to an empty paragraph (reflects the empty value into the bound `html` model).',
  toggleBold: 'Toggle bold on the current selection.',
  toggleItalic: 'Toggle italic on the current selection.',
  toggleHeading:
    'Toggle a heading at the given level — `toggleHeading(level)` (defaults to 1).',
  toggleBulletList: 'Toggle a bullet list at the current selection.',
  toggleUnderline: 'Toggle underline on the current selection.',
  toggleOrderedList: 'Toggle an ordered (numbered) list at the current selection.',
  undo: 'Undo the last change.',
  redo: 'Redo the last undone change.',
  chain:
    'Return a focused TipTap command chain for composing commands — e.g. `chain().toggleBold().toggleItalic().run()` (null before mount).',
  isActive:
    'Whether a mark/node is active in the current selection — `isActive(name, attrs?)` (e.g. `isActive("heading", { level: 2 })`). Drives custom-toolbar active styling. False before mount.',
  can:
    'Return the command-availability chain — `can().chain().focus().toggleBold().run()` returns a boolean — for enabling/disabling custom-toolbar buttons. null before mount.',
  isEmpty:
    'Whether the document is empty — drives empty-state UI and submit-gating. true before mount.',
  getCharacterCount:
    'Return the current character count. Reads the CharacterCount extension\'s live storage when registered (`maxLength` set or the `#count` slot filled), else falls back to `getText().length`. Always a number — 0 before mount.',
  getWordCount:
    'Return the current word count. Reads the CharacterCount extension\'s live storage when registered, else falls back to a whitespace-split count of `getText()`. Always a number — 0 before mount.',
};

export default handleManifest;
