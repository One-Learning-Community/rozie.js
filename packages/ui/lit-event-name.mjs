/**
 * lit-event-name.mjs — the ONE shared Lit event-name kebab helper for every
 * `packages/ui/<family>/scripts/` generator (readme.mjs + cem.mjs).
 *
 * WHY: the compiled Lit target dispatches multi-word `$emit()` names
 * kebab-cased (quick 260811-nre), so every Lit-facing event-name string a
 * generator publishes — the README Events table cell and the
 * custom-elements.json `events[].name` — must be the DISPATCHED string, not
 * the raw `ir.emits` source name. Seven generators used to carry their own
 * byte-identical copy of the helper; this module replaces all of them so the
 * algorithm cannot re-diverge per family (quick 260812-3tv).
 *
 * BYTE-IDENTITY CONTRACT: `litEventName` is copied VERBATIM from
 * `toKebabCase` in packages/targets/lit/src/emit/emitDecorator.ts:15 — the
 * compiler's own dispatch-side algorithm. It must stay byte-identical to that
 * function; any drift silently mis-documents what the compiler actually
 * dispatches, publishing an event string `addEventListener` will not accept.
 *
 * D-01 (quick 260812-3tv): the explanatory note above the Lit Events table is
 * CONDITIONAL — generators push `LIT_EVENT_NOTE` only when
 * `litEventNamesDiverge(ir.emits)` is true, i.e. when at least one emit name
 * in THAT table actually renders differently from its source form. That keeps
 * the note byte-identical for the multi-word families (it keeps rendering),
 * absent for single-word families (nothing changes), and self-activating the
 * day any family adds its first multi-word emit.
 */

/**
 * camelCase / PascalCase `$emit()` name → the kebab-cased string the compiled
 * Lit component actually dispatches (`regionIn` → `region-in`).
 *
 * Copied VERBATIM from `toKebabCase` in
 * packages/targets/lit/src/emit/emitDecorator.ts:15 — see the byte-identity
 * contract in the module docstring.
 */
export function litEventName(name) {
  const hyphenated = name.replace(/([a-z0-9]|[A-Z](?=[A-Z][a-z]))([A-Z])/g, '$1-$2');
  return hyphenated.toLowerCase();
}

/**
 * True iff any entry of `emits` renders differently under `litEventName`
 * than its source form — i.e. the Lit Events table for this emit list needs
 * the explanatory note (D-01). Tolerates a null/undefined list.
 */
export function litEventNamesDiverge(emits) {
  if (!emits) return false;
  return emits.some((name) => litEventName(name) !== name);
}

/**
 * The exact prose line pushed above a Lit Events table whose event names
 * diverge from their source form. Centralised here so the 29 generators'
 * note prose cannot re-diverge; generators push this constant (followed by a
 * blank line) instead of an inline string literal.
 */
export const LIT_EVENT_NOTE =
  '`addEventListener` name — the Lit target dispatches multi-word event names kebab-cased.';
