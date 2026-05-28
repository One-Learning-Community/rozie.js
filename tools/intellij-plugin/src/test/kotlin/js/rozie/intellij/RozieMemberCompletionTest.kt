package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Contract test for [js.rozie.intellij.completion.RozieMemberCompletionContributor]:
 * typing `$props.` / `$data.` / `$refs.` inside a `.rozie` injected JS fragment
 * surfaces the member names declared in the sibling `<props>` / `<data>` block
 * and `<template>` `ref="…"` attributes.
 *
 * This is the IntelliJ-side analog of the LSP member completion VS Code gets;
 * it must be native because LSP4IJ completion does not reach carets inside
 * injected fragments.
 *
 * JUnit-3 method-name convention: every test method MUST start with `test`.
 */
class RozieMemberCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testPropsMemberCompletionSurfacesDeclaredProps() {
        myFixture.configureByFile("member-props-completion.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `count` from <props>; got: $lookups", "count" in lookups)
        assertTrue("Expected `label` from <props>; got: $lookups", "label" in lookups)
        // The $data member must NOT leak into a $props.* completion.
        assertFalse("`hovering` is a <data> key, not a prop; got: $lookups", "hovering" in lookups)
    }
}
