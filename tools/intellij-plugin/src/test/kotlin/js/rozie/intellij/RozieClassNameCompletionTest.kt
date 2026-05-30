package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Contract test for [js.rozie.intellij.completion.RozieClassNameCompletionContributor]:
 * `class` / `:class` / `r-bind:class` attribute values in a `.rozie` `<template>`
 * surface the class names declared in the sibling `<style>` block.
 *
 * JUnit-3 method-name convention: every test method MUST start with `test`.
 */
class RozieClassNameCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testPlainClassAttributeSurfacesStyleClasses() {
        myFixture.configureByFile("class-name-plain.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `card`; got: $lookups", "card" in lookups)
        assertTrue("Expected `card--active`; got: $lookups", "card--active" in lookups)
        assertTrue("Expected `icon-lg`; got: $lookups", "icon-lg" in lookups)
    }

    fun testMultiClassNarrowsToWordUnderCaret() {
        // `class="card ca|"` — the trailing partial word `ca` must still complete
        // `card`/`card--active` even though `card` already appears earlier.
        myFixture.configureByFile("class-name-multi.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `card` for prefix `ca`; got: $lookups", "card" in lookups)
        assertTrue("Expected `card--active` for prefix `ca`; got: $lookups", "card--active" in lookups)
        // `panel` does not start with `ca` — prefix matcher should exclude it.
        assertFalse("`panel` should be filtered by prefix `ca`; got: $lookups", "panel" in lookups)
    }

    fun testBoundClassAttributeIsExpressionContextNotClassNames() {
        // `:class="…"` injects a JS expression — the contributor must stay out of
        // it (bare class identifiers would read as undefined variables). The popup
        // is JS completion, NOT our css-class list.
        myFixture.configureByFile("class-name-bind.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertFalse("`is-open` must NOT be offered in a bound :class expression; got: $lookups", "is-open" in lookups)
    }
}
