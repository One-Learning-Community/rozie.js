package js.rozie.intellij.xml

/**
 * Single source of truth for Rozie sigil attribute name lists. Consumed by
 * `RozieAttributeDescriptorsProvider` (Plan 02) AND
 * `RozieAttributeNameCompletionContributor` (Plan 06). Adding a new directive in
 * v0.3.0 = 1-line append.
 *
 * The five lists are deliberately split by sigil family:
 *  - [R_DIRECTIVES]      : `r-*` directives whose full name is fixed (e.g. `r-if`).
 *  - [EVENT_SIGILS]      : `@event` listener names — the "@" prefix is the sigil,
 *                          the suffix varies but here we enumerate the most-common
 *                          DOM events for completion seeding.
 *  - [PROP_SIGIL_HINTS]  : `:prop` binding hints — same shape; the descriptor
 *                          provider also resolves arbitrary `:<name>` by prefix
 *                          (`getAttributeDescriptor` returns non-null for any
 *                          name starting with `:`) so this list is purely a
 *                          completion-suggestion seed.
 *  - [SLOT_FILL_HINTS]   : `#slot` named-fill hints — same shape.
 *  - [KNOWN_LITERAL_ATTRS]: literal attribute names with no sigil prefix that the
 *                          provider must still recognise (`ref`, `lang`, `scoped`).
 *                          These are the ones [RozieAttributeDescriptorsProvider.getAttributeDescriptors]
 *                          enumerates by tag (the sigil-prefixed names cannot be
 *                          enumerated — their suffix varies — so they only resolve
 *                          via `getAttributeDescriptor(name, tag)` by name).
 */
object RozieKnownAttributes {
    val R_DIRECTIVES: List<String> = listOf(
        "r-if", "r-else-if", "r-else", "r-for", "r-show",
        "r-model", "r-html", "r-text", "r-bind", "r-on",
        // Phase 11 switch-style conditionals — mirrors the TextMate grammar
        // v0.2.0 `directive-attribute` rule.
        "r-match", "r-case", "r-default",
    )

    val EVENT_SIGILS: List<String> = listOf(
        "@click", "@input", "@change", "@submit", "@keydown",
        "@keyup", "@focus", "@blur", "@mouseenter", "@mouseleave",
    )

    val PROP_SIGIL_HINTS: List<String> = listOf(":class", ":style", ":disabled", ":value")

    val SLOT_FILL_HINTS: List<String> = listOf("#default", "#header", "#footer")

    val KNOWN_LITERAL_ATTRS: List<String> = listOf("ref", "lang", "scoped")
}
