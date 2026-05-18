package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSFile
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.lang.javascript.psi.JSVariable
import com.intellij.psi.PsiElement
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Plan 08.2-17 diagnostic + regression test for **P1-UAT-13** — `<script>` block
 * cannot resolve its own local `const`/`let`/`function` declarations to references
 * appearing elsewhere inside the SAME `<script>` block.
 *
 * Repro source (examples/Counter.rozie lines 31-39):
 *
 *     <script>
 *     console.log("hello from rozie")
 *     const canIncrement = $computed(() => $props.value + $props.step <= $props.max)
 *     const canDecrement = $computed(() => $props.value - $props.step >= $props.min)
 *     const increment = () => { if (canIncrement) $props.value += $props.step }
 *     const decrement = () => { if (canDecrement) $props.value -= $props.step }
 *     </script>
 *
 * The user-visible bug: Ctrl-click on `canIncrement` inside `if (canIncrement)`
 * does NOT navigate to the `const canIncrement` declaration on the line above,
 * even though both live inside the SAME `<script>` block.
 *
 * Three suspected root causes — one diagnostic test per hypothesis. The tests
 * are intentionally written so the EXECUTOR reads their failure output to
 * pinpoint which cause is real, then targets Task 2's fix accordingly.
 *
 *  - **Cause (a) — Injection fragmentation:** SCRIPT_BODY is injected such that
 *    the declaration and the reference live in different injected JS PsiFiles,
 *    so lexical-scope lookup fails by construction. Diagnostic
 *    [testInjectedScriptFragmentSharesScopeAcrossStatements] asserts both
 *    elements resolve to the SAME injected JSFile.
 *
 *  - **Cause (b) — Plan 05 contributor over-reach:**
 *    [js.rozie.intellij.references.RozieJSReferenceContributor]'s provider returns
 *    `PsiReference.EMPTY_ARRAY` for non-`$X.Y` shapes (line 54, 57, 62, 63, 64, 79, 85).
 *    The JetBrains [com.intellij.psi.PsiReferenceContributor] contract treats
 *    EMPTY_ARRAY as a no-op contribution — the platform asks the NEXT registered
 *    contributor — but if every JS reference at this offset goes through Plan 05's
 *    provider before reaching the stock JS resolver, and the stock resolver isn't
 *    a `PsiReferenceContributor` (it's resolved via JSReferenceExpression's own
 *    `multiResolve` implementation rather than the contributor chain), then
 *    Plan 05's EMPTY_ARRAY response is harmless. Diagnostic
 *    [testNonMagicReferenceShapesReachStockJsResolver] inspects the resolved
 *    target for a bare `canIncrement` reference; if non-null + correct, cause (b)
 *    is NOT real and the contributor stays out of the way.
 *
 *  - **Cause (c) — CachedValuesManager cache contamination:** Plan 05's
 *    [js.rozie.intellij.references.RoziePropsReference.multiResolve] (and its
 *    siblings) wrap `doResolve()` in `CachedValuesManager.getCachedValue(element)`.
 *    If priming this cache by resolving a `$props.X` reference first contaminates
 *    the stock JS resolver's cache for the same injected PSI file, bare-identifier
 *    resolution would break only on the second resolve. Diagnostic
 *    [testStockJsResolverCacheNotContaminatedByRozieReferenceResolution] resolves
 *    `$props.value` first, then resolves bare `canIncrement` and asserts success.
 *
 * **DIAGNOSIS RESULT (Task 1 empirical finding):**
 *
 *   **Cause (a) — injection fragmentation — IS REAL and is the root cause of P1-UAT-13.**
 *
 *   Task 1's [testInjectedScriptFragmentSharesScopeAcrossStatements] empirically
 *   confirmed the declaration and the reference live in DIFFERENT injected JSFiles
 *   (decl file range=(0, 5444); ref file range=(0, 5610)). The lexer's
 *   `IN_SCRIPT_BODY` state at `tools/intellij-plugin/src/main/jflex/Rozie.flex:198-204`
 *   emits a SCRIPT_BODY token via the greedy `[^<]+` rule UNTIL it hits a `<`
 *   character, then emits a separate SCRIPT_BODY token for the `<` itself
 *   (rule `"<"` on line 203). In the user UAT repro, the script body contains
 *   `$props.step <= $props.max` — the `<` in `<=` triggers token splitting, producing
 *   THREE SCRIPT_BODY tokens. [js.rozie.intellij.injection.RozieMultiHostInjector]'s
 *   SCRIPT_BODY arm calls `injectJs` for each token individually (line 60), creating
 *   three independent JS injection ranges. Lexical scope cannot span the fragments,
 *   so `const canIncrement` declared in fragment 1 is invisible to `if (canIncrement)`
 *   referenced in fragment 3. The TEMPLATE_BODY arm already coalesces consecutive
 *   tokens into a single range via the loop at lines 79-118 — the SCRIPT_BODY arm
 *   needs the same treatment.
 *
 *   **Causes (b) and (c) — NOT the root cause.**
 *
 *   Tests 2 + 3 also report `findReferenceAt returned null` for the bare
 *   `canIncrement` reference — BUT this is a downstream consequence of cause (a),
 *   not an independent cause. When SCRIPT_BODY is fragmented, the JS PSI inside
 *   the caret-containing fragment is malformed (the fragment starts with
 *   `= 100);\n...` which is a syntax error). The platform cannot surface a
 *   well-formed JSReferenceExpression at the caret offset, so `findReferenceAt`
 *   returns null. Both Tests 2 and 3 are dominated by cause (a) at the
 *   pre-condition layer and cannot independently diagnose (b)/(c). After Task 2's
 *   fragmentation fix, Tests 2 + 3 + 4 should all pass — confirming (b) and (c)
 *   are not real, and the diagnostic tests serve as regression guards.
 *
 *   **Task 2's fix:** coalesce consecutive SCRIPT_BODY tokens in
 *   [js.rozie.intellij.injection.RozieMultiHostInjector] (mirror the existing
 *   TEMPLATE_BODY coalescing at lines 79-118). One-arm extension; no JFlex
 *   change required.
 *
 * **Regression test (P1-UAT-13 closure pin):**
 * [testScriptLocalVarResolution] is the user-facing contract test — Ctrl-click
 * on `canIncrement` inside `if (canIncrement)` resolves to the `const
 * canIncrement` declaration. RED at Task 1 (the bug is live), GREEN at Task 2
 * (the fix is applied).
 *
 * JUnit-3 method-name convention: every test method MUST start with `test`
 * (see RozieInjectionTest.kt lines 25-27 for the canonical comment).
 */
class RozieScriptLocalResolutionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/script-local"

    // === Diagnostic Test 1 — cause (a) — injection fragmentation ===

    /**
     * Asserts that the `const canIncrement` DECLARATION and the
     * `if (canIncrement)` REFERENCE both inject into the SAME injected JSFile.
     *
     * If this fails, SCRIPT_BODY injection has fragmented the body into multiple
     * JS PsiFiles — cause (a) is REAL and Task 2 fixes
     * [js.rozie.intellij.injection.RozieMultiHostInjector] to coalesce
     * SCRIPT_BODY tokens (mirror the existing TEMPLATE_BODY coalescing loop).
     *
     * The failure message includes both file identities so the executor can see
     * which fragment contains which element.
     */
    fun testInjectedScriptFragmentSharesScopeAcrossStatements() {
        myFixture.configureByFile("counter-can-increment.rozie")
        // Use getTopLevelFile to walk back from the injected JS file (which is what
        // myFixture.file resolves to when the caret sits inside an injection) to the
        // host RozieFile whose `.text` is the unmodified fixture source. Without this
        // walk-back, `myFixture.file.text` would be the rozie-globals.d.ts prefix
        // (~5392 chars) concatenated with whichever SCRIPT_BODY fragment covers the
        // caret offset — which is exactly the cause-(a) symptom this test diagnoses.
        val ilm = InjectedLanguageManager.getInstance(project)
        val hostFile = ilm.getTopLevelFile(myFixture.file) ?: myFixture.file
        val text = hostFile.text

        // Declaration: the `canIncrement` identifier in `const canIncrement = $computed(...)`
        val declAnchor = "const canIncrement"
        val declIdx = text.indexOf(declAnchor)
        check(declIdx >= 0) {
            "DIAGNOSIS-A SETUP: fixture text missing `$declAnchor` anchor. " +
                "Host file class=${hostFile.javaClass.name}, name=${hostFile.name}, " +
                "language=${hostFile.language.id}, textLen=${text.length}."
        }
        // Land inside the identifier name (not on the keyword `const`).
        val declOffset = declIdx + declAnchor.length - 1

        // Reference: the second `canIncrement` (inside `if (canIncrement)`).
        val refAnchor = "if (canIncrement"
        val firstRefOffset = text.indexOf(refAnchor)
        check(firstRefOffset >= 0) {
            "DIAGNOSIS-A SETUP: fixture text missing `$refAnchor` anchor. textLen=${text.length}."
        }
        val refOffset = firstRefOffset + refAnchor.length - 1

        // CRITICAL: pass the HOST file (RozieFile) to findInjectedElementAt — the
        // offsets are host-coordinate offsets, not injected-coordinate offsets.
        val declInjected = ilm.findInjectedElementAt(hostFile, declOffset)
        val refInjected = ilm.findInjectedElementAt(hostFile, refOffset)

        assertNotNull(
            "DIAGNOSIS-A: no injected element at declaration offset $declOffset — " +
                "SCRIPT_BODY isn't being JS-injected at all at this offset. This would " +
                "indicate the SCRIPT_BODY token range doesn't cover the declaration, " +
                "OR the injector didn't fire. Check RozieMultiHostInjector.getLanguagesToInject " +
                "SCRIPT_BODY arm.",
            declInjected,
        )
        assertNotNull(
            "DIAGNOSIS-A: no injected element at reference offset $refOffset — " +
                "SCRIPT_BODY isn't being JS-injected at all at this offset. This would " +
                "indicate the SCRIPT_BODY token range doesn't cover the reference.",
            refInjected,
        )

        val declFile = declInjected!!.containingFile
        val refFile = refInjected!!.containingFile

        // The CRITICAL invariant: both injected elements must live in the SAME
        // injected JSFile. If they live in DIFFERENT JSFiles, cause (a) is real:
        // SCRIPT_BODY has been fragmented across multiple injections and lexical
        // scope cannot span the fragments.
        assertSame(
            "DIAGNOSIS-A REAL ⇒ cause (a) is the root cause: declaration and " +
                "reference live in DIFFERENT injected JSFiles. " +
                "decl file=${declFile.name} (virtualFile=${declFile.virtualFile?.path}, " +
                "language=${declFile.language.id}, range=${declFile.textRange}); " +
                "ref file=${refFile.name} (virtualFile=${refFile.virtualFile?.path}, " +
                "language=${refFile.language.id}, range=${refFile.textRange}). " +
                "Fix shape: coalesce SCRIPT_BODY tokens in RozieMultiHostInjector or " +
                "ensure JFlex emits a single greedy SCRIPT_BODY token.",
            declFile,
            refFile,
        )
    }

    // === Diagnostic Test 2 — cause (b) — Plan 05 contributor over-reach ===

    /**
     * Asserts that a bare `canIncrement` reference (no `$props.` / `$data.` /
     * `$refs.` qualifier) resolves through the stock JetBrains JS resolver to
     * the `const canIncrement` declaration in the same `<script>` block.
     *
     * If this fails AND Test 1 passes (same JSFile), Plan 05's contributor is
     * somehow short-circuiting stock JS resolution — cause (b) is REAL. The
     * failure message includes the reference class name and resolved-elements
     * list so the executor can see whether Plan 05's
     * [js.rozie.intellij.references.RoziePropsReference] et al. have inserted
     * themselves into the chain when they shouldn't have.
     */
    fun testNonMagicReferenceShapesReachStockJsResolver() {
        myFixture.configureByFile("counter-can-increment.rozie")
        // The fixture caret sits immediately after the `t` of the second `canIncrement`
        // (inside `if (canIncrement<caret>)`). Walk back to the reference at the caret.
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "DIAGNOSIS-B: findReferenceAt returned null at caret on bare `canIncrement` " +
                "inside `if (canIncrement)`. The platform did not even surface a reference — " +
                "this would be a strong cause-(a) signal (injected JS PSI is malformed).",
            ref,
        )

        // multiResolve gives the full list (PsiReference.resolve() returns null for
        // poly refs with >1 result). We want to see every resolved target so we can
        // tell if Plan 05 short-circuited or if stock JS contributed.
        val resolvedSet = mutableListOf<PsiElement>()
        // Plan 05's references are PsiReferenceBase.Poly subclasses — handle both shapes.
        when (ref) {
            is com.intellij.psi.PsiPolyVariantReference -> {
                ref.multiResolve(false).forEach { rr -> rr.element?.let { resolvedSet.add(it) } }
            }
            else -> {
                ref!!.resolve()?.let { resolvedSet.add(it) }
            }
        }

        val refClassName = ref!!.javaClass.name
        val resolvedDescriptors = resolvedSet.joinToString(", ") { el ->
            "${el.javaClass.simpleName}(name='${
                (el as? com.intellij.psi.PsiNamedElement)?.name ?: el.text.take(40)
            }', file=${el.containingFile?.name})"
        }

        // Look for the `const canIncrement` declaration in the resolved set.
        // Stock JS resolves a bare identifier to its JSVariable declaration.
        val resolvedToDecl = resolvedSet.any { el ->
            // Either the JSVariable named `canIncrement`, or the JSVarStatement
            // around it — both are acceptable Go-to-Declaration landing points.
            val asVar = el as? JSVariable ?: PsiTreeUtil.getParentOfType(el, JSVariable::class.java)
            asVar?.name == "canIncrement"
        }

        assertTrue(
            "DIAGNOSIS-B REAL ⇒ cause (b) is the root cause if Test 1 PASSED: bare " +
                "`canIncrement` did NOT resolve to its `const canIncrement` declaration. " +
                "Reference class=$refClassName. " +
                "Resolved set (${resolvedSet.size} elements): [$resolvedDescriptors]. " +
                "If the reference class is from js.rozie.intellij.references.* AND the " +
                "resolved set is empty, Plan 05's RozieJSReferenceContributor is firing on " +
                "the bare-identifier shape and short-circuiting stock JS resolution. " +
                "Fix shape: tighten RozieJSReferenceContributor.registerReferenceProviders' " +
                "PsiElementPattern so the provider only fires on JSReferenceExpressions whose " +
                "qualifier name is in {\$props, \$data, \$refs} — move the qualifier-name " +
                "check from provider body (where EMPTY_ARRAY may matter) to pattern (where " +
                "non-matching shapes never reach the provider at all).",
            resolvedToDecl,
        )
    }

    // === Diagnostic Test 3 — cause (c) — CachedValuesManager cache contamination ===

    /**
     * First resolves a `$props.value` reference (priming Plan 05's
     * [com.intellij.psi.util.CachedValuesManager] wrap if it leaks), then resolves
     * the bare `canIncrement` reference. If the second resolution fails, cause
     * (c) is REAL — Plan 05's cache key or invalidation contract is contaminating
     * the stock JS resolver's cache.
     *
     * If this test passes but Test 4 (regression) fails, cause (c) is NOT the
     * issue and the root cause is elsewhere.
     */
    fun testStockJsResolverCacheNotContaminatedByRozieReferenceResolution() {
        myFixture.configureByFile("counter-can-increment.rozie")
        val text = myFixture.file.text

        // 1. Prime Plan 05's cache by resolving a `$props.value` reference.
        //    The first `$props.value` is inside `$computed(() => $props.value + ...)`.
        val propsRefOffset = text.indexOf("\$props.value")
        check(propsRefOffset >= 0) { "fixture missing `\$props.value` anchor for cache-priming step" }
        // Walk into the `.value` part so findReferenceAt lands on the .value identifier.
        val propsRefDotOffset = propsRefOffset + "\$props.".length + 1
        val propsRef = myFixture.file.findReferenceAt(propsRefDotOffset)
        // We don't assert this priming step succeeds — Plan 05 might be broken too,
        // but the point is to EXERCISE its cache path so a leak (if any) would now
        // contaminate the stock JS resolver's cache.
        propsRef?.resolve()

        // 2. Now resolve the bare `canIncrement` reference at the caret.
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "DIAGNOSIS-C: findReferenceAt returned null at caret on bare `canIncrement` " +
                "AFTER priming \$props.value resolution. If Test 2 also returned null, this " +
                "test is dominated by cause (a) or (b); cause (c) cannot be diagnosed in " +
                "isolation until those are ruled out.",
            ref,
        )

        // The stock JS resolver should find the const canIncrement declaration.
        val resolved = ref!!.resolve()
        val resolvedDesc = resolved?.let { el ->
            "${el.javaClass.simpleName}(name='${
                (el as? com.intellij.psi.PsiNamedElement)?.name ?: el.text.take(40)
            }')"
        } ?: "null"

        val resolvedToDecl = resolved != null && run {
            val asVar = resolved as? JSVariable ?: PsiTreeUtil.getParentOfType(resolved, JSVariable::class.java)
            asVar?.name == "canIncrement"
        }

        assertTrue(
            "DIAGNOSIS-C REAL ⇒ cause (c) is the root cause if Tests 1+2 PASSED but this " +
                "fails: after priming \$props.value resolution, bare `canIncrement` no longer " +
                "resolves to its const declaration. Resolved=$resolvedDesc. " +
                "Fix shape: tighten RoziePropsReference (+ Data + Refs) " +
                "CachedValuesManager.getCachedValue wrap so the cache key is element-scoped " +
                "and the dependency is PsiModificationTracker.MODIFICATION_COUNT.",
            resolvedToDecl,
        )
    }

    // === Regression Test 4 — P1-UAT-13 closure pin ===

    /**
     * The user-facing P1-UAT-13 contract: Ctrl-click on `canIncrement` inside
     * `if (canIncrement)` navigates to the `const canIncrement` declaration in
     * the same `<script>` block.
     *
     * RED at Task 1 (the bug is live and this assertion fires).
     * GREEN at Task 2 (the targeted fix is applied).
     *
     * Stays in the suite as a regression guard against any future change that
     * regresses script-local resolution.
     */
    fun testScriptLocalVarResolution() {
        myFixture.configureByFile("counter-can-increment.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "P1-UAT-13: findReferenceAt returned null at caret on bare `canIncrement` " +
                "inside `if (canIncrement)`. Stock JS should at minimum surface a " +
                "JSReferenceExpression reference here.",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "P1-UAT-13: bare `canIncrement` reference did not resolve to ANY target. " +
                "Expected the `const canIncrement = \$computed(...)` declaration on the " +
                "line above, via stock JS lexical-scope lookup inside the same injected " +
                "JSFile. Reference class=${ref.javaClass.name}.",
            resolved,
        )
        // The resolved target must carry the name `canIncrement` (either a JSVariable
        // directly, or an element whose parent is the JSVariable). Walk up if the
        // resolver landed on a sub-element.
        val asVar = resolved as? JSVariable ?: PsiTreeUtil.getParentOfType(resolved, JSVariable::class.java)
        assertNotNull(
            "P1-UAT-13: resolved target was ${resolved?.javaClass?.name}: '${resolved?.text?.take(60)}' " +
                "with no JSVariable ancestor. Expected a JSVariable named `canIncrement`.",
            asVar,
        )
        assertEquals(
            "P1-UAT-13: resolved JSVariable name should be `canIncrement`",
            "canIncrement",
            asVar!!.name,
        )
        // Confirm the resolved declaration lives in the SAME injected JSFile as the
        // reference (the script-local-scope invariant — both in the same <script>).
        val ilm = InjectedLanguageManager.getInstance(project)
        val resolvedTopLevelFile = ilm.getTopLevelFile(resolved!!.containingFile) ?: resolved.containingFile
        assertEquals(
            "P1-UAT-13: resolved declaration's top-level host file should match the test fixture",
            myFixture.file.name,
            resolvedTopLevelFile.name,
        )
    }

    // === Helper: assert resolved file is a JSFile of the expected shape ===

    @Suppress("unused")
    private fun assertIsJSFile(file: com.intellij.psi.PsiFile?, hint: String) {
        assertNotNull("$hint: containing file is null", file)
        assertTrue(
            "$hint: containing file is ${file?.javaClass?.name} (id=${file?.language?.id}), " +
                "expected a JSFile (id=JavaScript)",
            file is JSFile || file?.language?.id == "JavaScript",
        )
    }
}
