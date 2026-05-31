package js.rozie.intellij

import com.intellij.testFramework.LoggedErrorProcessor
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

    // === Behavior 2: typing `$da` in a <listener> @event handler surfaces $data ===
    //
    // Phase 19: `<listeners>` is now element form, so the magic-ident completion
    // fires inside a `<listener>` `@event` handler VALUE (which is JS-injected just
    // like a template `@event` handler). `$da` is unique-match (only `$data` starts
    // with it) — same auto-insert path assertion as Behavior 1, confirming the
    // contributor fires uniformly across RozieMultiHostInjector's JS-injection
    // targets (now including <listener> @event handler values). The handler is
    // `x($da)` rather than a bare `$da` so the injected JS fragment carries enough
    // surrounding expression context for the platform completion lookup (a bare
    // trailing `$da` at the fragment edge trips a platform smart-pointer-restore
    // assertion unrelated to the contributor under test).

    fun testDollarPrefixSurfacesDataInListeners() {
        myFixture.configureByFile("listeners-magic-dollar-prefix.rozie")
        // Flake guard (not a behavior change): the platform's JSLookupContext
        // smart-pointer restore over the injected JS fragment can emit a benign,
        // order-dependent LOG.error during completeBasic() —
        //   "Cannot restore JSReferenceExpression … restored=null"
        //   (com.intellij.lang.javascript.completion.JSLookupContext.<init>)
        // — when a sibling test's injected-fragment SmartPsiFileRangePointer leaks
        // into this light fixture. IntelliJ's test harness converts ANY logged error
        // into a teardown failure (TestLoggerFactory$TestLoggerAssertionError), which
        // made THIS test flake on CI (red on push, green on a no-op re-run). The
        // completion behavior under test is unaffected — it's asserted below.
        //
        // Swallow ONLY that one known platform assertion via the platform-blessed
        // LoggedErrorProcessor; every other logged error still fails the test.
        LoggedErrorProcessor.executeWith<RuntimeException>(
            object : LoggedErrorProcessor() {
                override fun processError(
                    category: String,
                    message: String,
                    details: Array<String>,
                    t: Throwable?,
                ): Set<Action> =
                    if ("Cannot restore" in message && "restored=null" in message) {
                        Action.NONE // benign JSLookupContext smart-pointer-restore leak
                    } else {
                        Action.ALL // any other logged error must still fail the test
                    }
            },
        ) {
            myFixture.completeBasic()
        }
        val docText = myFixture.editor.document.text
        assertTrue(
            "Expected `\$data` to be auto-completed from `\$da` prefix in <listeners>; " +
                "document text was: $docText",
            "\$data" in docText,
        )
    }

    // === Behavior 2b (Phase 19 Req 9): :target on a <listener> completes window/document ===
    //
    // `:target` is a `:bind` attribute, so its value is JS-injected; `window` and
    // `document` are ambient JS globals, so the platform JS completion offers them
    // natively (no bespoke descriptor needed). This is MANUALLY verified (SPEC Req 9
    // VALIDATION manual-only entry) rather than asserted here: a bare trailing-edge
    // reference inside the tiny `:target="…"` injection (`:target="wind|"`) trips a
    // platform `JSLookupContext` smart-pointer-restore assertion in the test harness
    // (`Cannot restore JSReferenceExpression … restored=null`) that is unrelated to
    // the completion behavior under test and order-dependent across the suite. The
    // sibling Behavior-2 test (`x($da)`) shows the completion path itself works when
    // the injected fragment carries surrounding expression context — which a bare
    // `:target` value cannot naturally provide. Verified by hand in the running IDE.

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
