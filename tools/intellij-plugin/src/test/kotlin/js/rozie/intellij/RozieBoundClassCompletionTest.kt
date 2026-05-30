package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Contract test for
 * [js.rozie.intellij.completion.RozieBoundClassCompletionContributor]: class-name
 * completion inside string literals of a bound `:class` expression, and that it
 * stays out of other bound attributes (e.g. `:style`).
 *
 * JUnit-3 convention: every test method MUST start with `test`.
 */
class RozieBoundClassCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testBoundClassObjectKeySurfacesStyleClasses() {
        myFixture.configureByFile("bound-class-object.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `is-open`; got: $lookups", "is-open" in lookups)
        assertTrue("Expected `is-closed`; got: $lookups", "is-closed" in lookups)
        assertTrue("Expected `panel`; got: $lookups", "panel" in lookups)
    }

    fun testBoundClassArrayElementSurfacesStyleClasses() {
        myFixture.configureByFile("bound-class-array.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `is-open`; got: $lookups", "is-open" in lookups)
        assertTrue("Expected `panel`; got: $lookups", "panel" in lookups)
    }

    fun testBoundStyleAttributeDoesNotSurfaceClasses() {
        // `:style="…"` is also injected JS, but class names are meaningless there
        // — the contributor must read the attribute name and stay out. (Value
        // position, not an object key, to avoid the platform's separate
        // injected-object-key SmartPointer fragility, which is orthogonal here.)
        myFixture.configureByFile("bound-class-negative.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertFalse("`is-open` must not be offered inside :style; got: $lookups", "is-open" in lookups)
    }
}
