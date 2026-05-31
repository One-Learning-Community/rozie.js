package js.rozie.intellij.completion

/**
 * Single source of truth for the 18 canonical Rozie `$`-prefixed magic
 * identifiers + their one-line type-text doc hints (surfaced by
 * `LookupElementBuilder.withTypeText` in the completion popup per the
 * P1-UAT-09 acceptance prose).
 *
 * The set mirrors the TextMate grammar's `magic-identifier` rule
 * (`tools/textmate/syntaxes/rozie.tmLanguage.json`, grammar v0.2.0) verbatim
 * — that grammar is the canonical enumeration of the author-facing sigil
 * surface, cross-checked against the compiler (`$portals` in
 * `computeDeps.MAGIC_ACCESSOR_NAMES`, `$classSelector` in
 * `computeDeps.STABLE_IDENTIFIERS`, the lifecycle quartet in
 * `unknownRefValidator.LIFECYCLE_NAMES`).
 *
 * Consumed by:
 *  - `rozie-globals.d.ts` — the synthetic ambient-declaration twin, which is
 *    what now drives `$`-prefix completion (the bespoke completion contributor
 *    was removed in the round-1 GUI fixes as a duplicate of the ambient decls).
 *  - [js.rozie.intellij.highlighting.RozieJsAnnotator] (Plan 04) — sigil
 *    coloring; reads [NAMES] so the painted set and the offered set are
 *    provably identical (one registry, two consumers).
 *  - `rozie-globals.d.ts` — the synthetic ambient-declaration twin; the
 *    `RozieGlobalsLibraryTest` coverage assertion pins the two in lockstep.
 *
 * `RozieJsMagicCompletionTest.testBareDollarSurfacesAllMagicIdentifiers`
 * iterates [MAGIC_IDENTIFIERS] directly — adding an 18th magic name is a 1-line
 * append here (plus the matching `declare` in `rozie-globals.d.ts`); the
 * contributor, the annotator, and the test all pick it up automatically (DRY
 * contract, identical to Plan 02's [js.rozie.intellij.xml.RozieKnownAttributes]).
 *
 * Names locked in by the Rozie compiler + per-target emitters:
 *  - `$props`        — declared in `<props>` block; reactive prop accessor
 *  - `$data`         — declared in `<data>` block; reactive local state
 *  - `$refs`         — wired via `ref="name"` in `<template>`; element handle map
 *  - `$emit`         — call to dispatch a custom event upward
 *  - `$computed`     — derived reactive value factory `$computed(() => expr)`
 *  - `$onMount`      — lifecycle: runs after first render
 *  - `$onUnmount`    — lifecycle: runs on teardown / cleanup
 *  - `$onUpdate`     — lifecycle: runs after every reactive update
 *  - `$watch`        — reactive `$watch(() => getter, callback)`
 *  - `$slots`        — named slot fills passed by the consumer
 *  - `$el`           — the component's root DOM element
 *  - `$portals`      — render a slot into an external container (Spike 003)
 *  - `$classSelector`— resolve an authored class to its emitted CSS selector
 *                      (Phase 13 — survives React's class-name hashing)
 *  - `$attrs`        — consumer-passed attribute cluster minus declared props
 *                      (Phase 14 — for `r-bind="$attrs"` manual placement and
 *                      member reads `$attrs.someAttr`)
 *  - `$listeners`    — consumer-passed event-listener cluster minus declared
 *                      events (Phase 15 — for `r-on="$listeners"` manual
 *                      placement and member reads `$listeners.click?.(e)`)
 *  - `$restoreFocus` — restore focus to a keyed-list row by selector + index
 *                      after a state mutation reorders the list (Phase 16 —
 *                      Lit/Solid/Svelte lower to queueMicrotask + focus();
 *                      React/Vue/Angular no-op)
 *  - `$event`        — the active event closure parameter (Phase 07.6 — scoped
 *                      to `@event` / `r-on:event` handler contexts; mirrors
 *                      the reserved-sigil set in `RESERVED_SIGILS`)
 *  - `$model`        — producer-side two-way-write accessor whose valid keys are
 *                      the `model: true` subset of `<props>` (Phase 18 — write
 *                      `$model.x` lowers to the same per-target two-way setter
 *                      `$props.x = …` used today; `$props.x` is now read-only)
 *
 * Pattern note: each entry is a `(name, typeText)` pair; the contributor
 * destructures the pair into `LookupElementBuilder.create(name).bold()
 * .withTypeText(typeText)` so the popup is self-documenting on first sight.
 */
object RozieMagicIdentifiers {
    /**
     * Ordered (name, typeText) pairs for the 18 canonical Rozie magic
     * identifiers. Order mirrors the TextMate grammar's `magic-identifier`
     * regex so the two artifacts diff trivially; the lookup popup does its
     * own alphabetical sort, so source order is purely for readability.
     */
    val MAGIC_IDENTIFIERS: List<Pair<String, String>> = listOf(
        "\$props" to "(magic) component props object — declared in <props>",
        "\$data" to "(magic) reactive local state — declared in <data>",
        "\$refs" to "(magic) element refs — set via ref=\"name\" in <template>",
        "\$emit" to "(magic) emit a custom event",
        "\$event" to "(magic) active event closure parameter inside an @event handler",
        "\$computed" to "(magic) derived reactive value — returns a computed signal",
        "\$onMount" to "(magic) lifecycle: runs after first render",
        "\$onUnmount" to "(magic) lifecycle: runs on teardown / cleanup",
        "\$onUpdate" to "(magic) lifecycle: runs after every reactive update",
        "\$watch" to "(magic) react to a getter — \$watch(() => expr, callback)",
        "\$slots" to "(magic) named slot fills passed by the consumer",
        "\$el" to "(magic) the component's root DOM element",
        "\$portals" to "(magic) render a slot into a container — \$portals.X(el, scope)",
        "\$classSelector" to "(magic) authored class → emitted CSS selector string",
        "\$attrs" to "(magic) consumer-passed attributes minus declared props",
        "\$listeners" to "(magic) consumer-passed event listeners minus declared events",
        "\$restoreFocus" to "(magic) restore focus to a keyed-list row by selector + index (Lit/Solid/Svelte do work; React/Vue/Angular no-op)",
        "\$model" to "(magic) producer-side two-way write — keys are the model:true props (\$model.x = … lowers like the old \$props.x write)",
    )

    /**
     * Bare identifier names (with the leading `$`) extracted from
     * [MAGIC_IDENTIFIERS]. Consumed by
     * [js.rozie.intellij.highlighting.RozieJsAnnotator] for O(1) membership
     * lookup on each candidate `JSReferenceExpression` — keeps the annotator's
     * painted set and the completion popup's offered set provably identical.
     */
    val NAMES: Set<String> = MAGIC_IDENTIFIERS.mapTo(LinkedHashSet()) { it.first }
}
