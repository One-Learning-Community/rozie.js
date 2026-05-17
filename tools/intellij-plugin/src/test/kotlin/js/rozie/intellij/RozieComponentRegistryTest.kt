package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.xml.RozieComponentRegistry

/**
 * Contract test for [RozieComponentRegistry]. Closes the recognition-half of
 * P1-UAT-03 at the registry layer — file-local `<components>` declarations
 * must be introspectable as a `Set<String>` of PascalCase keys.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieComponentRegistryTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/xml"

    // === Single-declaration fixture (Card.rozie shape) ===

    fun testCardShapeSingleDeclaration() {
        myFixture.configureByFile("components-block-card.rozie")
        val declared = RozieComponentRegistry.declaredComponents(myFixture.file)
        assertEquals(
            "components-block-card.rozie should declare exactly {CardHeader}",
            setOf("CardHeader"),
            declared,
        )
    }

    // === Two-declaration fixture (ModalConsumer.rozie shape) ===

    fun testModalConsumerShapeTwoDeclarations() {
        myFixture.configureByFile("components-block-modalconsumer.rozie")
        val declared = RozieComponentRegistry.declaredComponents(myFixture.file)
        assertEquals(
            "components-block-modalconsumer.rozie should declare {Modal, WrapperModal}",
            setOf("Modal", "WrapperModal"),
            declared,
        )
    }

    // === Single-declaration fixture (WrapperModal.rozie shape) ===

    fun testWrapperModalShapeSingleDeclaration() {
        myFixture.configureByFile("components-block-wrapper-modal.rozie")
        val declared = RozieComponentRegistry.declaredComponents(myFixture.file)
        assertEquals(
            "components-block-wrapper-modal.rozie should declare exactly {Modal}",
            setOf("Modal"),
            declared,
        )
    }

    // === File without <components> block returns empty set ===

    fun testFileWithoutComponentsBlockReturnsEmpty() {
        myFixture.configureByFile("components-block-empty.rozie")
        val declared = RozieComponentRegistry.declaredComponents(myFixture.file)
        assertTrue(
            "Fixture with no <components> block should return empty Set, got: $declared",
            declared.isEmpty(),
        )
    }

    // === Self-import shape (TreeNode-like) does not recurse or crash ===

    fun testSelfImportShapeExtractsKey() {
        myFixture.configureByFile("components-block-with-self-import.rozie")
        val declared = RozieComponentRegistry.declaredComponents(myFixture.file)
        assertEquals(
            "Self-import fixture should declare {TreeNode} (key extraction is purely textual)",
            setOf("TreeNode"),
            declared,
        )
    }

    // === Negative: non-Rozie file (plain .html) returns empty set ===

    fun testPlainHtmlFileReturnsEmpty() {
        myFixture.configureByFile("components-block-plain.html")
        val declared = RozieComponentRegistry.declaredComponents(myFixture.file)
        assertTrue(
            "Plain .html file should return empty Set (file-type guard), got: $declared",
            declared.isEmpty(),
        )
    }

    // === Cache: two consecutive calls return the same Set instance ===

    fun testRepeatedCallsReturnSameCachedInstance() {
        myFixture.configureByFile("components-block-card.rozie")
        val first = RozieComponentRegistry.declaredComponents(myFixture.file)
        val second = RozieComponentRegistry.declaredComponents(myFixture.file)
        // Referential equality confirms the CachedValuesManager hit — the
        // value is constructed once per file.modificationStamp and reused on
        // subsequent calls within the same edit cycle.
        assertSame(
            "Consecutive calls within the same edit cycle should return the cached Set instance",
            first,
            second,
        )
    }
}
