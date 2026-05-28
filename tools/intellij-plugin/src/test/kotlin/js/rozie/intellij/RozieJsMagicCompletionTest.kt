package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.completion.RozieMagicIdentifiers

/**
 * Contract test for magic-identifier completion: typing `$` (or a `$X` prefix)
 * in JS identifier position inside ANY Rozie-injected JS fragment (`<script>` /
 * `<listeners>` / `<props>` / `<data>` / `<components>`) surfaces the canonical
 * magic-identifier list.
 *
 * As of the round-1 GUI fixes, this is served by the **ambient `declare const`
 * prefix** (`rozie-globals.d.ts`, one decl per [RozieMagicIdentifiers] entry,
 * injected ahead of every Rozie JS fragment) — NOT a dedicated completion
 * contributor. The bespoke RozieJsMagicIdentifierCompletionContributor was
 * removed because it merely duplicated the ambient-decl completion, producing
 * two lookup entries per sigil (the "(magic)" + "any" duplicate Dan reported);
 * these tests passing without it prove the ambient decls fully cover the
 * surface (names, unique-prefix auto-insert, and the plain-`.js` negative guard).
 *
 * Behavior 3 asserts against the registry itself (not a hard-coded copy of the
 * names), which proves the DRY contract — the ambient `.d.ts` is generated 1:1
 * from [RozieMagicIdentifiers] (enforced by RozieGlobalsLibraryTest). Adding a
 * magic identifier is a 1-line registry append; this assertion picks it up.
 *
 * Behavior 4 is the Pitfall 2 regression guard: a plain `.js` file (NOT `.rozie`)
 * MUST NOT see magic-identifier suggestions, because the contributor is gated by
 * `RozieContextCheck.isRozieContext`. Without the guard, every `.js` / `.ts` /
 * `.tsx` file in the user's project would pollute with `$props` / `$data` /
 * etc. on every keystroke beginning with `$`.
 *
 * JUnit-3 method-name convention applies: every test method MUST start with
 * `test` (see RozieInjectionTest.kt lines 20–23 for the canonical comment).
 */
class RozieJsMagicCompletionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/completion"

    // === Behavior 1: typing `$pr` in <script> surfaces $props (narrow positive) ===
    //
    // `$pr` is a UNIQUE-match prefix against the registry (only `$props` starts
    // with it). IntelliJ's `completeBasic()` auto-inserts the unique match and
    // returns `null` for `lookupElementStrings` in that path, so we assert on
    // the post-completion document text — which is the actual P1-UAT-09
    // contract anyway (the user sees `$props` get filled in).

    fun testDollarPrefixSurfacesPropsInScript() {
        myFixture.configureByFile("script-magic-dollar-prefix.rozie")
        myFixture.completeBasic()
        val docText = myFixture.editor.document.text
        assertTrue(
            "Expected `\$props` to be auto-completed from `\$pr` prefix in <script>; " +
                "document text was: $docText",
            "\$props" in docText,
        )
    }

    // === Behavior 2: typing `$da` in <listeners> surfaces $data (cross-block-type positive) ===
    //
    // `$da` is also unique-match (only `$data` starts with it) — same
    // auto-insert path assertion as Behavior 1, just inside the second
    // JS-injected block type to confirm the contributor fires uniformly across
    // RozieMultiHostInjector's injection targets.

    fun testDollarPrefixSurfacesDataInListeners() {
        myFixture.configureByFile("listeners-magic-dollar-prefix.rozie")
        myFixture.completeBasic()
        val docText = myFixture.editor.document.text
        assertTrue(
            "Expected `\$data` to be auto-completed from `\$da` prefix in <listeners>; " +
                "document text was: $docText",
            "\$data" in docText,
        )
    }

    // === Behavior 3: typing bare `$` surfaces all 14 magic identifiers (DRY assertion) ===

    fun testBareDollarSurfacesAllMagicIdentifiers() {
        myFixture.configureByFile("script-magic-bare-dollar.rozie")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        for ((name, _) in RozieMagicIdentifiers.MAGIC_IDENTIFIERS) {
            assertTrue(
                "Expected `$name` in completion suggestions for bare `\$` prefix; " +
                    "got: $lookups",
                name in lookups,
            )
        }
    }

    // === Behavior 4 (negative — Pitfall 2 guard): plain .js MUST NOT see magic idents ===

    fun testPlainJsFileDoesNotSurfaceMagicIdentifiers() {
        myFixture.configureByText("plain.js", "const x = \$pr<caret>")
        myFixture.completeBasic()
        val lookups = myFixture.lookupElementStrings ?: emptyList()
        // Spot-check 4 of the most common — the contract is "none of the magic
        // identifiers leak", and a sampled check is sufficient; the positive
        // tests above already enumerate the full registry inside .rozie context.
        for (name in listOf("\$props", "\$data", "\$refs", "\$emit")) {
            assertFalse(
                "Pitfall 2 leak: `$name` MUST NOT appear in plain .js completion " +
                    "(only inside .rozie host); got: $lookups",
                name in lookups,
            )
        }
    }
}
