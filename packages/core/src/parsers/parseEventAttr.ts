/**
 * Shared `@event` attribute-name parse (D-20 structural, Phase 19 D-02).
 *
 * Extracted from `parseTemplate.finalizeCurrentAttr`'s `@` branch so BOTH the
 * template parser and the `<listeners>` element-walk (`parseListeners`) compute
 * `@event.modifier(args)` parts from the IDENTICAL code path. This makes the
 * D-20 byte-identity guarantee STRUCTURAL: the modifier-chain text + base offset
 * feeding the peggy modifier grammar (`enrichListeners` / `enrichAttr`) are
 * produced by one function, so both parsers feed the same input downstream.
 *
 * Caveat (verified against parseTemplate.ts): the no-modifier default base
 * offset is the END of the attribute name (`a.nameEnd` in parseTemplate),
 * reproduced here as `nameStartOffset + rawName.length`. The `r-model` colon/dot
 * split is INTENTIONALLY NOT handled here — that logic stays in parseTemplate's
 * `r-` directive branch (memory: do NOT extend the r-model dotIdx split for the
 * `@event`/r-on path).
 *
 * @experimental — shape may change before v1.0
 */

export interface EventAttrParts {
  /** Event name — `@click` → `click`. */
  name: string;
  /**
   * Modifier-chain text — substring from the first '.' to end-of-rawName,
   * INCLUDING the leading dot. Empty string if no modifiers.
   */
  modifierChainText: string;
  /**
   * Absolute byte offset where modifierChainText begins. When no modifiers are
   * present, points PAST the end of rawName (= the attribute name's end byte),
   * matching parseTemplate's `a.nameEnd` default.
   */
  modifierChainBaseOffset: number;
}

/**
 * Parse an `@event.modifier(args)` attribute NAME into its parts.
 *
 * @param rawName - the attribute name INCLUDING the leading '@'.
 * @param nameStartOffset - the ABSOLUTE byte offset of the first byte of
 *   `rawName` (the '@').
 */
export function parseEventAttrName(
  rawName: string,
  nameStartOffset: number,
): EventAttrParts {
  const nameEnd = nameStartOffset + rawName.length;
  const dotIdx = rawName.indexOf('.');
  if (dotIdx >= 0) {
    return {
      name: rawName.slice(1, dotIdx),
      modifierChainText: rawName.slice(dotIdx),
      // The leading '.' lives at `nameStartOffset + dotIdx`.
      modifierChainBaseOffset: nameStartOffset + dotIdx,
    };
  }
  return {
    name: rawName.slice(1),
    modifierChainText: '',
    modifierChainBaseOffset: nameEnd,
  };
}
