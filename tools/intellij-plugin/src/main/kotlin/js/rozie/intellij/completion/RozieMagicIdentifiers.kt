package js.rozie.intellij.completion

/**
 * Single source of truth for the 11 canonical Rozie `$`-prefixed magic
 * identifiers + their one-line type-text doc hints (surfaced by
 * `LookupElementBuilder.withTypeText` in the completion popup per the
 * P1-UAT-09 acceptance prose).
 *
 * Consumed by [RozieJsMagicIdentifierCompletionContributor] (Plan 13) and
 * pinned by `RozieJsMagicCompletionTest.testBareDollarSurfacesAllMagicIdentifiers`
 * which iterates [MAGIC_IDENTIFIERS] directly — adding a 12th magic name in
 * v0.3.0 is a 1-line append here; both the contributor and the test pick it
 * up automatically (DRY contract, identical to Plan 02's
 * [js.rozie.intellij.xml.RozieKnownAttributes] / Plan 06 mirror).
 *
 * Names locked in by the Rozie compiler + per-target emitters:
 *  - `$props`     — declared in `<props>` block; reactive prop accessor
 *  - `$data`      — declared in `<data>` block; reactive local state
 *  - `$refs`      — wired via `ref="name"` in `<template>`; element handle map
 *  - `$emit`      — call to dispatch a custom event upward
 *  - `$computed`  — derived reactive value factory `$computed(() => expr)`
 *  - `$onMount`   — lifecycle: runs after first render
 *  - `$onUpdate`  — lifecycle: runs after every reactive update
 *  - `$watch`     — reactive `$watch(() => getter, callback)`
 *  - `$listeners` — externally-declared event handlers map
 *  - `$slots`     — named slot fills passed by the consumer
 *  - `$expose`    — expose imperative API to the consumer ref
 *
 * Pattern note: each entry is a `(name, typeText)` pair; the contributor
 * destructures the pair into `LookupElementBuilder.create(name).bold()
 * .withTypeText(typeText)` so the popup is self-documenting on first sight.
 */
object RozieMagicIdentifiers {
    /**
     * Ordered (name, typeText) pairs for the 11 canonical Rozie magic
     * identifiers. Order is the natural read-order from the public API
     * documentation; the lookup popup does its own alphabetical sort, so
     * source order here is purely for readability of the registry itself.
     */
    val MAGIC_IDENTIFIERS: List<Pair<String, String>> = listOf(
        "\$props" to "(magic) component props object — declared in <props>",
        "\$data" to "(magic) reactive local state — declared in <data>",
        "\$refs" to "(magic) element refs — set via ref=\"name\" in <template>",
        "\$emit" to "(magic) emit a custom event",
        "\$computed" to "(magic) derived reactive value — returns a computed signal",
        "\$onMount" to "(magic) lifecycle: runs after first render",
        "\$onUpdate" to "(magic) lifecycle: runs after every reactive update",
        "\$watch" to "(magic) react to a getter — \$watch(() => expr, callback)",
        "\$listeners" to "(magic) externally-declared event handlers map",
        "\$slots" to "(magic) named slot fills passed by the consumer",
        "\$expose" to "(magic) expose imperative API to the consumer ref",
    )
}
