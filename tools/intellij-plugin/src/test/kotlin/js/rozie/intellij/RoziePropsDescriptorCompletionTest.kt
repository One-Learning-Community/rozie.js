package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Contract test for [js.rozie.intellij.completion.RoziePropsDescriptorCompletionContributor]:
 * descriptor-key + type-token completion inside a `.rozie` `<props>` block.
 *
 * JUnit-3 method-name convention: every test method MUST start with `test`.
 */
class RoziePropsDescriptorCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    fun testDescriptorKeyPositionOffersDescriptorKeys() {
        myFixture.configureByFile("props-descriptor-key.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `type`; got: $lookups", "type" in lookups)
        assertTrue("Expected `default`; got: $lookups", "default" in lookups)
        assertTrue("Expected `model`; got: $lookups", "model" in lookups)
        assertTrue("Expected `required`; got: $lookups", "required" in lookups)
        // We own the position (stopHere) — stock JS postfix/object noise suppressed.
        assertFalse("postfix template `if` leaked; got: $lookups", "if" in lookups)
        // Exactly the four descriptor keys, no duplicates.
        assertEquals("Expected exactly 4 descriptor keys; got: $lookups", 4, lookups.size)
    }

    fun testTypeValuePositionOffersTypeTokens() {
        myFixture.configureByFile("props-descriptor-type-value.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        assertTrue("Expected `String`; got: $lookups", "String" in lookups)
        assertTrue("Expected `Number`; got: $lookups", "Number" in lookups)
        assertTrue("Expected `Boolean`; got: $lookups", "Boolean" in lookups)
        assertTrue("Expected `Array`; got: $lookups", "Array" in lookups)
        assertTrue("Expected `Object`; got: $lookups", "Object" in lookups)
        assertTrue("Expected `Function`; got: $lookups", "Function" in lookups)
        // Descriptor KEYS must not leak into the type-value position.
        assertFalse("`default` is a descriptor key, not a type token; got: $lookups", "default" in lookups)
    }

    fun testScriptObjectLiteralDoesNotOfferDescriptorKeys() {
        myFixture.configureByFile("props-descriptor-script-negative.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        // The contributor is confined to the <props> block — a plain object
        // literal inside <script> must NOT surface the descriptor keys.
        assertFalse("`required` leaked into <script>; got: $lookups", "required" in lookups)
        assertFalse("`model` leaked into <script>; got: $lookups", "model" in lookups)
    }
}
