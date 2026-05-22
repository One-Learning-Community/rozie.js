package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Contract test for [js.rozie.intellij.folding.RozieFoldingBuilder]: every
 * SFC block in a `.rozie` file gets a fold region whose collapsed placeholder
 * is `<tagName>...`.
 *
 * `myFixture.testFolding` reads the `<fold text='...'>...</fold>` markers in
 * the fixture, strips them, runs the registered folding builders, and asserts
 * the produced regions + placeholders match the markers exactly.
 *
 * The fixture deliberately keeps every injected fragment single-line
 * (`<div></div>`, `const count = 1;`, a one-line CSS rule) so the HTML / JS /
 * CSS folding builders contribute zero regions — the only fold regions are
 * the four Rozie block regions, which the markers enumerate.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieFoldingTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/folding"

    fun testSfcBlocksFoldToPlaceholders() {
        myFixture.testFolding("${getTestDataPath()}/folding-blocks.rozie")
    }
}
