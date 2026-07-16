/**
 * Hand-kept event-description manifest for @rozie-ui/command-palette.
 *
 * Events are derived structurally from the source via `ir.emits` (`select`,
 * `navigate`, `back`, `action-select`), but their human-readable descriptions
 * have no first-class `<emits>` IR source — so the prose lives here.
 *
 * KEYS MUST stay in lockstep with `ir.emits`: codegen.mjs asserts every emitted
 * event name has an entry here and throws if one is missing.
 *
 * Note: `open` and `query` are two-way MODELS (write-back via `r-model`), not
 * emits — they are not listed here.
 */
export const eventManifest = {
  select:
    'Fired when the user chooses a LEAF command (clicks it, or highlights it and presses Enter) — an item with no `children`/`source` (see `navigate` for a navigating item). Payload `{ item, path }` — `item` is the full chosen command object, `path` is the id breadcrumb of levels navigated through to reach it (empty at the root). When the chosen command declared `args` (inline command arguments, feature #12), the payload additionally carries `args: { [id]: value }` — every declared arg, TRIMMED — absent entirely for an argless command (additive, non-breaking). If `closeOnSelect` is true (the default) the palette also closes (its `open` model is written `false`).',
  navigate:
    'Fired when a nested level is PUSHED — selecting an item that carries `children` or `source` drills into it instead of emitting `select`. Payload `{ item, depth }` — the navigated-to item and the resulting nesting depth (1-based; the root is depth 0).',
  back:
    'Fired when a level is POPPED — via Backspace-on-empty, Escape at depth>0, the imperative `goBack()` handle, or an equivalent consumer-triggered back navigation. No payload. Does not fire at the root (popping is a no-op there).',
  'action-select':
    'Fired when the user chooses a row ACTION from its action menu (⌘K / caret-at-end Right-arrow / clicking the row\'s actions affordance, then Enter/Space/click on a menu item). Payload `{ item, action }` — `item` is the full anchored command object (the row the menu was opened for) and `action` is the chosen entry from that row\'s `actions[]`. The action menu ALWAYS closes on selection; if `closeOnAction` is true (the default) the palette also closes (its `open` model is written `false`).',
};

export default eventManifest;
