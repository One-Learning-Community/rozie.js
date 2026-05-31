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
        // Top-level only — the nested descriptor keys must NOT appear.
        assertFalse("`type` is a nested descriptor key, not a prop; got: $lookups", "type" in lookups)
        assertFalse("`default` is a nested descriptor key, not a prop; got: $lookups", "default" in lookups)
        // We own the position (stopHere) — stock JS postfix/live templates suppressed.
        assertFalse("postfix template `if` leaked; got: $lookups", "if" in lookups)
        assertFalse("postfix template `dforof` leaked; got: $lookups", "dforof" in lookups)
        // Exactly the two declared props, no duplicates.
        assertEquals("Expected exactly [count, label]; got: $lookups", 2, lookups.size)
    }

    // === Phase 18: $model.<member> offers ONLY the model:true subset of <props> ===
    //
    // `$model` is the producer-side two-way-write accessor (SPEC Req 9). Its
    // valid keys are exactly the props declared `model: true`. The completion
    // contributor reuses the SAME PROPS_BODY machinery as `$props` but applies a
    // `modelOnly` descriptor filter (`{ … model: true }`) — the model-only path
    // (A3 preferred), not the all-props cosmetic fallback, because the `model:`
    // flag is read off the same descriptor object the `type:` hint comes from.
    fun testModelMemberCompletionOffersOnlyModelProps() {
        myFixture.configureByFile("member-model-completion.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        // `value` is `model: true` — it MUST appear.
        assertTrue("Expected model prop `value`; got: $lookups", "value" in lookups)
        // `step` is a declared prop WITHOUT `model: true` — it MUST NOT appear
        // ($model's keys are the model:true subset only).
        assertFalse("`step` is not a model prop; got: $lookups", "step" in lookups)
        // <data> keys + nested descriptor keys must not leak.
        assertFalse("`hovering` is a <data> key, not a model prop; got: $lookups", "hovering" in lookups)
        assertFalse("`type` is a nested descriptor key; got: $lookups", "type" in lookups)
        assertFalse("`model` is a nested descriptor key; got: $lookups", "model" in lookups)
        // We own the position (stopHere) — stock JS postfix templates suppressed.
        assertFalse("postfix template `if` leaked; got: $lookups", "if" in lookups)
        // Exactly the one model prop, no duplicates.
        assertEquals("Expected exactly [value]; got: $lookups", 1, lookups.size)
    }
}
