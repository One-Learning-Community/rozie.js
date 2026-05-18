package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSFunction
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.lang.javascript.psi.JSVariable
import com.intellij.psi.PsiElement
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.completion.RozieMagicIdentifiers

/**
 * Plan 08.2-16 contract test for the synthetic Rozie globals declaration
 * (`rozie-globals.d.ts` + Strategy-B ambient-decl prefix on every Rozie JS
 * injection in [js.rozie.intellij.injection.RozieMultiHostInjector]).
 *
 * Closes:
 *  - **P1-UAT-11** (UAT-CHECKLIST-v0.2.0.md lines 293-307) — bare `$props` /
 *    `$data` / etc. Ctrl-click in `.rozie`-injected JS no longer opens a
 *    multi-file picker. The JS resolver finds the synthetic declaration FIRST
 *    (it's in the same injected fragment, prepended by Strategy-B prefix)
 *    and stops.
 *  - **P1-UAT-12** — `$computed(...)` / `$emit(...)` etc. call sites no longer
 *    flagged as "Unresolved method or function" by the JS unresolved-symbol
 *    inspector. The synthetic `.d.ts` declares each magic identifier as a
 *    function with permissive `any`-typed signatures matching the runtime
 *    semantics.
 *
 * Strategy B (chosen per Task 1 investigation — see rozie-globals.d.ts
 * leading comment): the ambient declarations are concatenated as the
 * `prefix` argument of [com.intellij.lang.injection.MultiHostRegistrar
 * .addPlace] on every Rozie JS injection. The prefix lives in the injected
 * document only (NOT in host coordinates), so the
 * [InjectedLanguageManager.injectedToHost] mapping is preserved for Plan 05
 * cross-block Go-to-Declaration. Pitfall 2 is mitigated by construction —
 * the prefix only appears inside [RozieRootBlock]-host injections, which
 * only exist in `.rozie` files. A plain `.js` file never receives the
 * prefix because [RozieMultiHostInjector] never fires there.
 *
 * The 4 behaviors below pin the contract:
 *
 *  1. [testBareDollarPropsResolvesToSyntheticDeclaration] — positive: caret
 *     on bare `$props` in `<script>` resolves to a `JSVariable` named
 *     `$props` (the `declare const $props: any` from the prefix). Pre-Plan-16
 *     this returned null OR resolved to a free-identifier search target in
 *     another `.rozie` file (P1-UAT-11 symptom).
 *  2. [testComputedCallResolvesToSyntheticFunction] — positive: caret on
 *     `$computed` at a call site resolves to a `JSFunction` named `$computed`.
 *     Pre-Plan-16 the JS inspector rendered `$computed` with the
 *     "Unresolved method or function" diagnostic (P1-UAT-12 symptom).
 *  3. [testAllElevenMagicIdentifiersAreDeclared] — coverage / DRY contract:
 *     iterates [RozieMagicIdentifiers.MAGIC_IDENTIFIERS] and asserts each
 *     entry has a matching `declare const|function <name>` in
 *     `rozie-globals.d.ts`. Adding a 12th identifier in v0.3.0 requires
 *     1-line edits to BOTH the registry AND the `.d.ts`; this test fails
 *     fast otherwise (T-08.2-36 mitigation).
 *  4. [testPlainJsFileDoesNotResolveBareDollarProps] — Pitfall 2 negative
 *     guard: a plain `.js` file with `$props` MUST NOT resolve to the
 *     synthetic declaration. Under Strategy B this holds by construction
 *     (the prefix only appears in Rozie injections, which a plain `.js`
 *     file does not have). T-08.2-35 mitigation.
 *
 * JUnit-3 method-name convention: every test method MUST start with `test`
 * (see RozieInjectionTest.kt lines 20-23 for the canonical comment).
 */
class RozieGlobalsLibraryTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/globals"

    // === Behavior 1: Bare `$props` in <script> resolves to synthetic declaration ===

    fun testBareDollarPropsResolvesToSyntheticDeclaration() {
        myFixture.configureByFile("bare-props-goto.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `\$props` inside <script>; " +
                "expected the JS resolver to find the synthetic `declare const \$props: any` " +
                "declared via Strategy-B ambient-decl prefix on the Rozie JS injection",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "Bare `\$props` did not resolve to any declaration. Pre-Plan-16 this either " +
                "returned null OR resolved into another .rozie file via free-identifier search " +
                "(P1-UAT-11 symptom). Post-Plan-16 it MUST resolve to the synthetic ambient " +
                "declaration prepended to every Rozie JS injection.",
            resolved,
        )
        // Under Strategy B the resolved element is a JSVariable whose name is
        // `$props` — declared by the prefix `declare const $props: any;`
        // prepended to the injected JS fragment.
        assertTrue(
            "Resolved element should be a JSVariable (from `declare const \$props: any;`); " +
                "got ${resolved?.javaClass?.name}: '${resolved?.text}'",
            resolved is JSVariable,
        )
        assertEquals(
            "Resolved JSVariable name should be `\$props`",
            "\$props",
            (resolved as JSVariable).name,
        )
    }

    // === Behavior 2: `$computed(...)` call site resolves to synthetic JSFunction (P1-UAT-12) ===

    fun testComputedCallResolvesToSyntheticFunction() {
        myFixture.configureByFile("computed-call-resolution.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on `\$computed` at a call site; " +
                "expected the JS resolver to find the synthetic " +
                "`declare function \$computed<T>(getter: () => T): T;` ambient declaration",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "`\$computed(...)` call site did not resolve to any declaration. Pre-Plan-16 the " +
                "JS unresolved-symbol inspector flagged this with 'Unresolved method or function' " +
                "(P1-UAT-12 symptom). Post-Plan-16 it MUST resolve to the synthetic ambient " +
                "function declaration in the Strategy-B injection prefix.",
            resolved,
        )
        // The resolved element must be a JSFunction whose name is `$computed`.
        // Walk up if the resolver landed on a sub-element (parameter, name leaf etc.).
        val function = resolved as? JSFunction
            ?: PsiTreeUtil.getParentOfType(resolved, JSFunction::class.java)
        assertNotNull(
            "Resolved element (or its JSFunction ancestor) should be a JSFunction; " +
                "got ${resolved?.javaClass?.name}: '${resolved?.text}'",
            function,
        )
        assertEquals(
            "Resolved JSFunction name should be `\$computed`",
            "\$computed",
            function!!.name,
        )
    }

    // === Behavior 3: Coverage — all 11 RozieMagicIdentifiers represented in .d.ts ===

    fun testAllElevenMagicIdentifiersAreDeclared() {
        val dts = javaClass.getResourceAsStream("/rozie-globals.d.ts")
            ?.bufferedReader()?.use { it.readText() }
            ?: fail(
                "rozie-globals.d.ts not found in plugin resources at /rozie-globals.d.ts. " +
                    "Strategy B loads this file at class-load of RozieMultiHostInjector — " +
                    "without it, every Rozie JS injection ships an empty globals prefix and " +
                    "P1-UAT-11/12 closure regresses to fully broken.",
            )
        assertEquals(
            "Expected exactly ${RozieMagicIdentifiers.MAGIC_IDENTIFIERS.size} declarations " +
                "in rozie-globals.d.ts (one per RozieMagicIdentifiers entry)",
            RozieMagicIdentifiers.MAGIC_IDENTIFIERS.size,
            Regex("""(?m)^declare\s""").findAll(dts as String).count(),
        )
        for ((name, _) in RozieMagicIdentifiers.MAGIC_IDENTIFIERS) {
            assertTrue(
                "Expected `declare const $name` OR `declare function $name` in rozie-globals.d.ts; " +
                    "RozieMagicIdentifiers and rozie-globals.d.ts are twin sources of truth " +
                    "(T-08.2-36) and MUST mirror the same 11-identifier set. Got:\n$dts",
                Regex("""declare\s+(const|function)\s+\Q$name\E""").containsMatchIn(dts),
            )
        }
    }

    // === Behavior 4 (negative — Pitfall 2 leak guard): plain .js MUST NOT resolve ===

    fun testPlainJsFileDoesNotResolveBareDollarProps() {
        // A plain .js file (NOT .rozie) MUST NOT see the synthetic declaration.
        // Under Strategy B this holds by construction — RozieMultiHostInjector
        // never fires on a plain .js file, so the ambient-decl prefix is never
        // prepended. The negative-test assertion below pins the invariant.
        myFixture.configureByFile("plain-js-no-leak.js")
        val text = myFixture.file.text
        val offset = text.indexOf("\$props")
        check(offset >= 0) { "plain-js-no-leak.js missing `\$props` anchor" }
        val ref = myFixture.file.findReferenceAt(offset + 1)
        val resolved = ref?.resolve()
        // The assertion is: the resolver MUST NOT find a Rozie-synthetic
        // declaration. The resolved element, if any, must NOT be a JSVariable
        // named `$props` inside an injected file whose host is a `.rozie` file.
        // The simplest expression: assert that any resolved target is NOT a
        // top-level `declare const $props` originating from the synthetic
        // prefix. In practice, on a plain .js file the resolver will return
        // null (no declaration anywhere) — that's the strongest negative.
        if (resolved != null) {
            val ilm = InjectedLanguageManager.getInstance(project)
            val topFile = ilm.getTopLevelFile(resolved.containingFile) ?: resolved.containingFile
            assertFalse(
                "Pitfall 2 LEAK: bare `\$props` in a plain .js file resolved to a Rozie " +
                    "synthetic declaration. Strategy B's ambient-decl prefix MUST stay inside " +
                    "Rozie JS injections only; a plain .js file should never receive the prefix. " +
                    "Resolved to: ${resolved.javaClass.name} in file ${topFile.name}",
                resolved is JSVariable &&
                    (resolved as JSVariable).name == "\$props" &&
                    topFile.name.endsWith(".rozie"),
            )
        }
    }

    /**
     * Walk an injected JS resolution target back through the
     * [JSReferenceExpression] -> resolved-element chain. Currently unused — the
     * tests above resolve directly via `findReferenceAt` -> `resolve()` — but
     * kept here for future debugging if a test starts behaving oddly after a
     * platform upgrade.
     */
    @Suppress("unused")
    private fun walkResolutionChain(element: PsiElement): PsiElement? {
        var current: PsiElement? = element
        while (current != null) {
            if (current is JSReferenceExpression) {
                return current.resolve()
            }
            current = current.parent
        }
        return null
    }
}
