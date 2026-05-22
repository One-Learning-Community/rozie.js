package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.xml.RozieKnownAttributes
import js.rozie.intellij.xml.RozieModifiers

/**
 * SC-6 contract test for [js.rozie.intellij.completion.RozieAttributeNameCompletionContributor]:
 * typing one of the four Rozie sigils (`r-`, `@`, `:`, `#`) in HTML attribute
 * position inside a `.rozie` `<template>` surfaces the canonical lookup lists
 * from [RozieKnownAttributes] (Plan 02's DRY source-of-truth).
 *
 * The test asserts on the constants themselves (not a hard-coded copy of the
 * lists), which proves the DRY contract: Plan 06's completion contributor and
 * Plan 02's descriptor provider read the same source. Adding a new directive
 * to [RozieKnownAttributes.R_DIRECTIVES] in v0.3.0 needs zero edits to either
 * the contributor or this test — the assertion picks up the new name
 * automatically.
 *
 * Each fixture file plants a `<caret>` marker after the sigil character in
 * HTML attribute-name position; `myFixture.completeBasic()` simulates pressing
 * Ctrl-Space at that caret and populates `myFixture.lookupElementStrings`
 * with the contributor's [LookupElementBuilder] outputs.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    // === Behavior 1: typing `r-` surfaces all 13 R_DIRECTIVES ===

    fun testRPrefixCompletion() {
        myFixture.configureByFile("template-r-prefix.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for (name in RozieKnownAttributes.R_DIRECTIVES) {
            assertTrue(
                "Expected `$name` in completion suggestions for `r-` prefix; " +
                    "got: $lookups",
                name in lookups,
            )
        }
    }

    // === Behavior 2: typing `@` surfaces all 10 EVENT_SIGILS ===

    fun testAtPrefixCompletion() {
        myFixture.configureByFile("template-at-prefix.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for (name in RozieKnownAttributes.EVENT_SIGILS) {
            assertTrue(
                "Expected `$name` in completion suggestions for `@` prefix; " +
                    "got: $lookups",
                name in lookups,
            )
        }
    }

    // === Behavior 3: typing `:` surfaces all 4 PROP_SIGIL_HINTS ===

    fun testColonPrefixCompletion() {
        myFixture.configureByFile("template-colon-prefix.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for (name in RozieKnownAttributes.PROP_SIGIL_HINTS) {
            assertTrue(
                "Expected `$name` in completion suggestions for `:` prefix; " +
                    "got: $lookups",
                name in lookups,
            )
        }
    }

    // === Behavior 4: typing `#` surfaces all 3 SLOT_FILL_HINTS ===

    fun testHashPrefixCompletion() {
        myFixture.configureByFile("template-hash-prefix.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for (name in RozieKnownAttributes.SLOT_FILL_HINTS) {
            assertTrue(
                "Expected `$name` in completion suggestions for `#` prefix; " +
                    "got: $lookups",
                name in lookups,
            )
        }
    }

    // === Behavior 5: typing `@click.` surfaces the event composition modifiers ===
    //
    // Lookup strings are the FULL attribute name (`@click.stop`) — see
    // `modifierCandidates` in the contributor. A non-keyboard event MUST NOT
    // offer key filters.

    fun testEventModifierCompletion() {
        myFixture.configureByFile("template-event-modifier.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for (modifier in RozieModifiers.EVENT_MODIFIERS) {
            assertTrue(
                "Expected `@click.$modifier` in completion for `@click.` prefix; " +
                    "got: $lookups",
                "@click.$modifier" in lookups,
            )
        }
        assertFalse(
            "Key filter `@click.enter` MUST NOT be offered on a non-keyboard " +
                "event; got: $lookups",
            "@click.enter" in lookups,
        )
    }

    // === Behavior 6: typing `@keydown.` surfaces key filters AND event modifiers ===

    fun testKeyboardEventSurfacesKeyFilters() {
        myFixture.configureByFile("template-keydown-modifier.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for (modifier in RozieModifiers.KEY_FILTERS) {
            assertTrue(
                "Expected key filter `@keydown.$modifier` for `@keydown.` prefix; " +
                    "got: $lookups",
                "@keydown.$modifier" in lookups,
            )
        }
        // Composition modifiers are still valid on keyboard events.
        assertTrue(
            "Expected `@keydown.stop` (event modifier) for `@keydown.` prefix; " +
                "got: $lookups",
            "@keydown.stop" in lookups,
        )
    }

    // === Behavior 7: typing `r-model.` surfaces the three r-model modifiers ===

    fun testModelModifierCompletion() {
        myFixture.configureByFile("template-model-modifier.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for (modifier in RozieModifiers.MODEL_MODIFIERS) {
            assertTrue(
                "Expected `r-model.$modifier` in completion for `r-model.` prefix; " +
                    "got: $lookups",
                "r-model.$modifier" in lookups,
            )
        }
    }

    // === Behavior 8: typing `r-on:` surfaces the DOM events as `r-on:event` ===
    //
    // The `r-on:` longhand offers the same events as the `@` shorthand,
    // re-prefixed — `@click` becomes `r-on:click`.

    fun testROnPrefixSurfacesEventNames() {
        myFixture.configureByFile("template-r-on-prefix.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for (sigil in RozieKnownAttributes.EVENT_SIGILS) {
            val expected = "r-on:" + sigil.drop(1)
            assertTrue(
                "Expected `$expected` in completion for `r-on:` prefix; got: $lookups",
                expected in lookups,
            )
        }
    }
}
