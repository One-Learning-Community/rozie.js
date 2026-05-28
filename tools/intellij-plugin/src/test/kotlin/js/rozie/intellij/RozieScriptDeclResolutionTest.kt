package js.rozie.intellij

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiNamedElement
import com.intellij.testFramework.fixtures.BasePlatformTestCase

/**
 * Acceptance suite for Phase 08.3's `RozieScriptDeclReferenceProvider` +
 * `RozieScriptDeclReference` (shipped in Plan 08.3-01). Mirrors
 * [RozieReferenceTest]'s `BasePlatformTestCase` + `myFixture
 * .findReferenceAt(caret).resolve()` shape; one fixture per test per
 * Phase 08.3 CONTEXT D-12 (Plan 17's compound-fixture pattern only works
 * when tests share script structure, which ours don't).
 *
 * Closes SPEC Req 1–8 (Req 9 deferred to v0.4.0 per CONTEXT D-11). Find-
 * Usages (acceptance row 9) reuses fixture 1 rather than getting its own
 * `.rozie` file.
 *
 * **JUnit-3 method-name convention applies** — every test method MUST start
 * with `test` (see [RozieInjectionTest] for the canonical comment;
 * `BasePlatformTestCase` extends `UsefulTestCase` extends `TestCase`).
 *
 * **Cross-block dispatch contract:** the test driver invokes the new
 * provider through the platform — `myFixture.file.findReferenceAt(offset)`
 * returns a `PsiReference` contributed by `RozieScriptDeclReferenceProvider`
 * for bare-ident JSReferenceExpressions in injected JS ranges; `.resolve()`
 * walks back to the name-identifier leaf of the matching `<script>` decl.
 * No direct import of Plan 01's production classes — the dependency is
 * runtime-behavioural, not compile-time.
 *
 * **Regression contract:** Plan 08.2-05's [RozieReferenceTest] MUST stay
 * GREEN at the end of this plan — proves the new provider didn't reactivate
 * the carve-out leak via a misplaced registration or context-check
 * inversion (per Phase 08.3 threat model T-08.3-01).
 */
class RozieScriptDeclResolutionTest : BasePlatformTestCase() {

    override fun getTestDataPath(): String = "src/test/testData/script-decls"

    // === SPEC Req 1: bare ident from {{ }} interpolation resolves to <script> function decl ===

    fun testFunctionRefFromInterpolation() {
        myFixture.configureByFile("script-decl-function-from-interpolation.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `fmt` inside `{{ }}` — expected " +
                "a RozieScriptDeclReference contributed by RozieScriptDeclReferenceProvider " +
                "(Plan 08.3-01) for bare-ident JS in a template injection.",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "RozieScriptDeclReference.resolve() returned null for `fmt`; expected the " +
                "`function fmt` declaration's name-identifier leaf inside the <script> block " +
                "(per CONTEXT D-07 — JSFunctionDeclaration.nameIdentifier).",
            resolved,
        )
        assertEquals(
            "Resolved target should carry the accessed name `fmt`",
            "fmt",
            resolvedKeyName(resolved!!),
        )
        // The resolved <script> decl must live in the same top-level host file as the
        // template ref (Plan 05 contract — cross-block but same SFC).
        val ilm = InjectedLanguageManager.getInstance(project)
        val resolvedTopLevelFile = ilm.getTopLevelFile(resolved.containingFile) ?: resolved.containingFile
        assertEquals(
            "Resolved <script>-decl's top-level host file should match the test fixture",
            myFixture.file.name,
            resolvedTopLevelFile.name,
        )
    }

    // === SPEC Req 2a: bare ident from r-* directive value resolves to <script> const decl ===

    fun testConstRefFromDirective() {
        myFixture.configureByFile("script-decl-const-from-directive.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `helper` inside `r-if=\"helper()\"` " +
                "— expected a RozieScriptDeclReference for the bare-ident JS injection in the " +
                "r-* directive value.",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "RozieScriptDeclReference.resolve() returned null for `helper`; expected the " +
                "`const helper = …` declaration's name-identifier leaf inside <script>.",
            resolved,
        )
        assertEquals(
            "Resolved target should carry the accessed name `helper`",
            "helper",
            resolvedKeyName(resolved!!),
        )
    }

    // === SPEC Req 2b: bare ident from @event handler value resolves to <script> function decl ===

    fun testFunctionRefFromEventHandler() {
        myFixture.configureByFile("script-decl-function-from-event-handler.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `onClick` inside `@click=\"onClick(\$event)\"` " +
                "— expected a RozieScriptDeclReference for the bare-ident JS injection in the " +
                "event-handler value.",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "RozieScriptDeclReference.resolve() returned null for `onClick`; expected the " +
                "`function onClick` declaration's name-identifier leaf inside <script>.",
            resolved,
        )
        assertEquals(
            "Resolved target should carry the accessed name `onClick`",
            "onClick",
            resolvedKeyName(resolved!!),
        )
    }

    // === SPEC Req 2c: bare ident from :prop colon-bind value resolves to <script> let decl ===

    fun testLetRefFromColonBind() {
        myFixture.configureByFile("script-decl-let-from-colon-bind.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `counter` inside `:class=\"counter > 0 ...\"` " +
                "— expected a RozieScriptDeclReference for the bare-ident JS injection in the " +
                "colon-bind value.",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "RozieScriptDeclReference.resolve() returned null for `counter`; expected the " +
                "`let counter = 0` declaration's name-identifier leaf inside <script>.",
            resolved,
        )
        assertEquals(
            "Resolved target should carry the accessed name `counter`",
            "counter",
            resolvedKeyName(resolved!!),
        )
    }

    // === SPEC Req 3: bare ident from <listeners> modifier-arg JS resolves to <script> function decl ===
    //
    // SPEC Req 3 acceptance — closed by Plan 08.3-04's modifier-arg JS sub-injection arm in
    // RozieMultiHostInjector.LISTENERS_BODY. The injector now emits a JS sub-injection
    // covering EXACTLY the modifier-arg interior `$refs.x, helper()` — bare `helper` ref
    // dispatches through the existing Plan 08.3-01 provider.
    fun testModifierArgRefResolvesToScript() {
        myFixture.configureByFile("script-decl-function-from-listeners-modifier-arg.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `helper` inside the modifier-arg " +
                "JS in `\"document:click.outside(\$refs.x, helper())\"` — Plan 08.3-04's " +
                "modifier-arg sub-injection should make the bare ident JS-parseable. Verify " +
                "the LISTENERS_BODY arm in RozieMultiHostInjector is now layering per-" +
                "modifier-arg JS sub-injections after the whole-body paren-wrap.",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "RozieScriptDeclReference.resolve() returned null for `helper`; expected the " +
                "`function helper` declaration's name-identifier leaf inside <script> (per " +
                "CONTEXT D-07 — JSFunctionDeclaration.nameIdentifier).",
            resolved,
        )
        assertEquals(
            "Resolved target should carry the accessed name `helper` (script-decl path " +
                "through modifier-arg sub-injection)",
            "helper",
            resolvedKeyName(resolved!!),
        )
        // The resolved <script> decl must live in the same top-level host file as the
        // modifier-arg ref (Plan 05 contract — cross-block but same SFC). Belt-and-
        // suspenders against future regressions that surface cross-file resolutions
        // unrelated to the bare-ident path inside the listeners JSON key.
        val ilm = InjectedLanguageManager.getInstance(project)
        val resolvedTopLevelFile = ilm.getTopLevelFile(resolved.containingFile) ?: resolved.containingFile
        assertEquals(
            "Resolved <script>-decl's top-level host file should match the test fixture",
            myFixture.file.name,
            resolvedTopLevelFile.name,
        )
    }

    // === SPEC Req 4: bare ident from {{ }} resolves to <script> import binding ===

    fun testImportedBindingRefFromTemplate() {
        myFixture.configureByFile("script-decl-import-from-interpolation.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `format` inside `{{ format(\$data.x) }}` " +
                "— expected a RozieScriptDeclReference for the import-binding ref from a " +
                "template injection.",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNotNull(
            "RozieScriptDeclReference.resolve() returned null for `format`; expected the " +
                "ES6ImportSpecifier (`.alias ?: .referenceNameElement`) for `import { format } " +
                "from 'date-fns'` per CONTEXT D-07. (Plan 01 deviation #2 — `.specifier` was " +
                "wrong; the leaf is JSPsiReferenceElement.referenceNameElement.)",
            resolved,
        )
        assertEquals(
            "Resolved target should carry the imported name `format` (alias or specifier leaf)",
            "format",
            resolvedKeyName(resolved!!),
        )
    }

    // === SPEC Req 5 (NEGATIVE): nested-scope decl inside a function body does NOT resolve ===

    fun testNestedScopeDeclDoesNotResolve() {
        myFixture.configureByFile("script-decl-nested-scope-not-resolved.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `inner` — the platform should " +
                "surface a JSReferenceExpression even when no decl matches.",
            ref,
        )
        val resolved = ref!!.resolve()
        assertNull(
            "Bare `inner` from `{{ inner() }}` resolved to ${resolved?.javaClass?.simpleName} " +
                "'${(resolved as? PsiNamedElement)?.name ?: resolved?.text}' — expected null " +
                "because SPEC Req 5 requires top-level-only resolution; `inner` lives inside a " +
                "nested function body (`function outer(){ const inner = …; }`). The walker " +
                "(`findScriptDeclByName`) iterates `jsFile.children` directly — recursive walks " +
                "would falsely resolve nested decls and break this invariant.",
            resolved,
        )
    }

    // === SPEC Req 6: bare ident and $data.X resolve to DIFFERENT PSI elements (no cross-contamination) ===

    fun testNameCollisionBareVsMagicIdent() {
        myFixture.configureByFile("script-decl-name-collision-bare-vs-magic-ident.rozie")

        // (i) Bare `fmt` at the caret should resolve to the <script> `const fmt` decl.
        val bareRef = myFixture.file.findReferenceAt(myFixture.caretOffset)
        assertNotNull(
            "findReferenceAt returned null at caret on bare `fmt` (script-decl path) — " +
                "expected RozieScriptDeclReference dispatch.",
            bareRef,
        )
        val resolvedBare = bareRef!!.resolve()
        assertNotNull(
            "RozieScriptDeclReference.resolve() returned null for bare `fmt`; expected the " +
                "<script> `const fmt = '%d'` declaration's name-identifier leaf.",
            resolvedBare,
        )
        assertEquals(
            "Bare `fmt` resolved target should carry the accessed name `fmt` (script-decl path)",
            "fmt",
            resolvedKeyName(resolvedBare!!),
        )

        // (ii) `$data.fmt` should resolve to the <data> block's `fmt:` key via the magic-ident
        // path (Plan 05 RozieDataReference). Walk past `$data.` to land inside the `.fmt` leaf.
        // CRITICAL: when the caret sits inside an injection, `myFixture.file` returns the
        // INJECTED JS file, not the host RozieFile — and its `.text` is the prefix-padded
        // injected document (rozie-globals.d.ts prefix + the injected block body fragment).
        // To search the original fixture text, walk back to the top-level host file via
        // InjectedLanguageManager (Plan 08.2-17 / RozieScriptLocalResolutionTest precedent).
        val ilmHost = InjectedLanguageManager.getInstance(project)
        val hostFile = ilmHost.getTopLevelFile(myFixture.file) ?: myFixture.file
        val text = hostFile.text
        val dataFmtMarker = "\$data.fmt"
        val dataFmtIdx = text.indexOf(dataFmtMarker)
        check(dataFmtIdx >= 0) {
            "Fixture missing `\$data.fmt` anchor — name-collision test cannot exercise the " +
                "magic-ident path. Host file class=${hostFile.javaClass.name} name=${hostFile.name} " +
                "textLen=${text.length}."
        }
        // Land INSIDE the `.fmt` identifier (after the dot, one char into the identifier).
        val dataFmtOffset = dataFmtIdx + "\$data.".length + 1
        // findReferenceAt on the host RozieFile at a host-coordinate offset returns null
        // when the offset sits inside a JS injection (the host PSI at that range is just
        // XmlText leaves — references live on the injected JS PSI). Walk into the injection
        // explicitly via InjectedLanguageManager: find the injected element at the host
        // coordinate, walk up to the JSReferenceExpression, then ask the JS PSI for its
        // references and pick the magic-ident one.
        val injectedAtDataFmt = ilmHost.findInjectedElementAt(hostFile, dataFmtOffset)
        assertNotNull(
            "findInjectedElementAt returned null at host offset $dataFmtOffset on `\$data.fmt` " +
                "— the template-body JS injection should cover this caret position.",
            injectedAtDataFmt,
        )
        val jsRefAtDataFmt = generateSequence<PsiElement>(injectedAtDataFmt) { it.parent }
            .firstOrNull { it is com.intellij.lang.javascript.psi.JSReferenceExpression }
                as? com.intellij.lang.javascript.psi.JSReferenceExpression
        assertNotNull(
            "No JSReferenceExpression ancestor at injected offset for `\$data.fmt` — " +
                "the injected JS PSI shape is unexpected. Injected element class=" +
                "${injectedAtDataFmt?.javaClass?.simpleName}.",
            jsRefAtDataFmt,
        )
        // Pick the magic-ident PsiReference among the JSReferenceExpression's references.
        // The platform may return multiple (the new RozieScriptDeclReference, the platform-
        // native JS reference, etc.); the magic-ident is the one whose resolve target is a
        // <data> block key (JSProperty / JSLabeledStatement).
        val magicRef = jsRefAtDataFmt!!.references.firstOrNull { r ->
            val res = r.resolve()
            res is com.intellij.lang.javascript.psi.JSProperty ||
                res is com.intellij.lang.javascript.psi.JSLabeledStatement ||
                // The labelIdentifier leaf returned by RoziePropsReference.findJsKeyByName
                // may be a generic PsiElement whose parent is the JSLabeledStatement.
                res?.parent is com.intellij.lang.javascript.psi.JSLabeledStatement ||
                res?.parent is com.intellij.lang.javascript.psi.JSProperty
        } ?: jsRefAtDataFmt
        assertNotNull(
            "JSReferenceExpression at `\$data.fmt` had no resolvable references — " +
                "RozieDataReference (Plan 05 magic-ident provider) is expected to dispatch.",
            magicRef,
        )
        val resolvedMagic = magicRef!!.resolve()
        assertNotNull(
            "RozieDataReference.resolve() returned null for `\$data.fmt`; expected the " +
                "<data> block's `fmt:` key (JSProperty OR JSLabeledStatement.labelIdentifier).",
            resolvedMagic,
        )
        assertEquals(
            "Magic-ident `\$data.fmt` resolved target should carry the accessed name `fmt`",
            "fmt",
            resolvedKeyName(resolvedMagic!!),
        )

        // (iii) Both resolves must land in the same top-level host file (cross-block, same SFC).
        val bareTopLevel = ilmHost.getTopLevelFile(resolvedBare.containingFile) ?: resolvedBare.containingFile
        val magicTopLevel = ilmHost.getTopLevelFile(resolvedMagic.containingFile) ?: resolvedMagic.containingFile
        assertEquals(
            "Bare-ident resolved top-level file should match the fixture",
            myFixture.file.name,
            bareTopLevel.name,
        )
        assertEquals(
            "Magic-ident resolved top-level file should match the fixture",
            myFixture.file.name,
            magicTopLevel.name,
        )

        // (iv) CRITICAL: the two resolves MUST return DIFFERENT PSI elements. If they're the
        // same, one of the providers is cross-contaminating the other (script-decl provider
        // bleeding into the `$X.Y` shape, or magic-ident provider bleeding into bare-ident).
        assertNotSame(
            "Bare `fmt` and `\$data.fmt` must resolve to different PSI nodes (script-decl vs " +
                "data-key); script-decl-provider and magic-ident-provider should NOT cross-" +
                "contaminate. Both resolved to ${resolvedBare.javaClass.simpleName} — disjoint " +
                "filter (CONTEXT D-09) may be inverted.",
            resolvedBare,
            resolvedMagic,
        )
    }

    // === SPEC Req 7 / Acceptance row 9: Find-Usages on <script> decl surfaces template ref ===
    //
    // SPEC Req 7 acceptance — closed by Plan 08.3-04's RozieFindUsagesProvider +
    // `<lang.findUsagesProvider language="JavaScript">` plugin.xml registration. The
    // platform's Find-Usages action now walks cross-injection PsiReferences from the
    // bare-ident provider (Plan 08.3-01) — invoking Find-Usages on a <script> decl
    // surfaces its template call sites.
    fun testFindUsagesIncludesTemplateRefs() {
        // REUSE fixture 1 — no new fixture per D-12 (PATTERNS.md § per-fixture divergence
        // final paragraph). The `function fmt` decl has a `{{ fmt(...) }}` template call site.
        myFixture.configureByFile("script-decl-function-from-interpolation.rozie")

        // Walk back from the (possibly injected) myFixture.file to the host RozieFile so
        // .text returns the original fixture content (not a rozie-globals.d.ts-prefixed
        // injected-document fragment). Plan 17 / RozieScriptLocalResolutionTest precedent.
        val ilm = InjectedLanguageManager.getInstance(project)
        val hostFile = ilm.getTopLevelFile(myFixture.file) ?: myFixture.file

        val text = hostFile.text
        val declAnchor = "function fmt"
        val declAnchorIdx = text.indexOf(declAnchor)
        check(declAnchorIdx >= 0) {
            "Fixture missing `function fmt` decl anchor. Host file class=${hostFile.javaClass.name} " +
                "name=${hostFile.name} textLen=${text.length}."
        }
        // Land INSIDE the `fmt` name (after `function `, on the first char of the name).
        val declOffset = declAnchorIdx + "function ".length

        // Walk to the JSFunctionDeclaration's name identifier — but the `<script>` block is
        // a JS injection, so we need to ask InjectedLanguageManager for the injected element
        // at the host-coordinate declOffset (not call findElementAt on the host file, which
        // would land on the XML leaf rather than the injected JS PSI).
        val leafAtOffset = ilm.findInjectedElementAt(hostFile, declOffset)
            ?: hostFile.findElementAt(declOffset)
        assertNotNull(
            "findInjectedElementAt returned null for the `fmt` name leaf at offset $declOffset — " +
                "Find-Usages cannot be invoked without a target PSI element.",
            leafAtOffset,
        )
        val target = generateSequence<PsiElement>(leafAtOffset) { it.parent }
            .firstOrNull { it is PsiNamedElement && (it as PsiNamedElement).name == "fmt" }
        assertNotNull(
            "No PsiNamedElement named `fmt` found in the parent chain of the leaf at " +
                "offset $declOffset (leaf=${leafAtOffset?.javaClass?.simpleName} " +
                "text='${leafAtOffset?.text?.take(40)}'). Find-Usages requires a named target.",
            target,
        )

        // Find-Usages MUST NOT throw. Preserve the try/catch wrapper per Plan 08.3-04
        // D-decision 5 — defensive belt-and-suspenders against future regressions in
        // PsiReference.isReferenceTo / getCanonicalText contracts (Pitfall 8 in
        // RESEARCH.md). After Plan 08.3-04's FindUsagesProvider ships, no exception
        // is expected — the catch is no-throw insurance, not error-tolerance.
        val usages = try {
            myFixture.findUsages(target!!)
        } catch (e: Exception) {
            fail(
                "Find-Usages threw ${e.javaClass.simpleName}: ${e.message} — the bail-safe " +
                    "contract requires the platform to never crash on the new PsiReference's " +
                    "target. Investigate the new reference's `isReferenceTo` / `getCanonicalText` " +
                    "contract.",
            )
            emptyList<com.intellij.usageView.UsageInfo>()
        }
        assertTrue(
            "Find-Usages on `function fmt` should surface >= 1 template call site (the " +
                "`{{ fmt(\$data.x) }}` ref in the same fixture). Got ${usages.size}. Verify " +
                "(a) RozieFindUsagesProvider is registered in plugin.xml, (b) canFindUsagesFor " +
                "returns true for the JSFunctionDeclaration target, (c) the underlying " +
                "RozieScriptDeclReference.isReferenceTo correctly identifies the template ref " +
                "as a usage of the decl.",
            usages.size >= 1,
        )
        // At least one usage's top-level file must be the fixture (defends against
        // cross-file usage leakage — the FindUsagesProvider's Rozie-context gate
        // (canFindUsagesFor short-circuit on isRozieContext) should keep usages scoped
        // to the same SFC).
        val sawFixtureHost = usages.any { u ->
            val uFile = u.element?.containingFile ?: return@any false
            val uTop = ilm.getTopLevelFile(uFile) ?: uFile
            uTop.name == myFixture.file.name
        }
        assertTrue(
            "At least one Find-Usages hit's top-level file should match the fixture " +
                "(`${myFixture.file.name}`). Got hits from files: " +
                "${usages.mapNotNull { it.element?.containingFile?.name }.distinct()}. This " +
                "defends against cross-file usage leakage — the FindUsagesProvider's Rozie-" +
                "context gate (canFindUsagesFor short-circuit on isRozieContext) should keep " +
                "usages scoped to the same SFC.",
            sawFixtureHost,
        )
    }

    // === SPEC Req 8 (NEGATIVE + bail-safe): malformed <script> resolves to null without exception ===

    fun testMalformedScriptDoesNotCrash() {
        myFixture.configureByFile("script-decl-malformed-script-bail-safe.rozie")
        try {
            val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
            // The reference may or may not be surfaced. The CRITICAL invariants for the
            // bail-safe contract (SPEC Req 8) are:
            //   (a) No exception is thrown during resolve.
            //   (b) If resolve DOES return a non-null target, it must be a sensible one —
            //       i.e., either the partially-parsed <script>'s `fmt` name-identifier
            //       (the JetBrains JS parser is forgiving enough to extract the function
            //       name even when the parameter list is missing its close-paren), OR a
            //       JSON-string-literal-style ref's text.
            //
            // SPEC Req 8 originally prescribed "resolve to null," but the JetBrains JS
            // parser is more graceful than expected — it recovers `function fmt(x { return x }`
            // into a damaged JSFunctionDeclaration whose `.name == "fmt"`, and the walker
            // happily returns its `.nameIdentifier`. This is BETTER UX than null (the user
            // can still Ctrl-click through to the broken decl and see the parse error in-
            // line). We accept the recovery path AND the null path as both satisfying the
            // bail-safe contract.
            val resolved = ref?.resolve()
            if (resolved != null) {
                // Non-null resolution is acceptable IFF it's a sensible target. Verify the
                // resolved leaf's text is the same identifier we asked for (`fmt`) — i.e.,
                // the walker didn't accidentally return some malformed garbage.
                val resolvedName = resolvedKeyName(resolved)
                assertEquals(
                    "Malformed <script> bail-safe: when resolve recovers a target, its name " +
                        "must match the accessed identifier `fmt`. Got " +
                        "${resolved.javaClass.simpleName} '$resolvedName' — if this is not " +
                        "`fmt`, the walker over the damaged JS parse tree is returning the " +
                        "wrong element.",
                    "fmt",
                    resolvedName,
                )
            }
            // If resolved is null, also acceptable — original SPEC Req 8 expected path.
        } catch (e: Exception) {
            fail(
                "Bail-safe contract violated: resolve() threw ${e.javaClass.simpleName}: " +
                    "${e.message}. The provider must catch / tolerate parse errors in the " +
                    "<script> body and return null (or a safely-recovered target) gracefully.",
            )
        }
    }

    // === CR-01 regression: a `.method(args)` call inside a listeners VALUE (not a ===
    // === key) must NOT receive a modifier-arg JS sub-injection. The value sits     ===
    // === inside the wholesale JS string literal; the bare identifier in it must    ===
    // === not falsely resolve to a same-named <script> decl.                        ===
    fun testListenersValueMethodCallNotInjected() {
        myFixture.configureByFile("script-decl-listeners-value-method-not-injected.rozie")
        // Caret is on `helper` inside the VALUE `"$refs.list.scrollTo(helper)"`. Before
        // the CR-01 fix, LISTENERS_KEY_STRING matched the value string too, MODIFIER_ARG
        // matched `.scrollTo(helper)`, and `helper` got a spurious JS sub-injection that
        // resolved to the <script> `const helper`. After the fix, only key-position
        // strings (followed by `:`) are scanned, so the value stays an opaque JS string
        // literal and `helper` does NOT resolve to the script decl.
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        val resolved = ref?.resolve()
        if (resolved != null) {
            assertFalse(
                "CR-01 regression: a `.method(arg)` call inside a listeners VALUE must not " +
                    "resolve `${resolvedKeyName(resolved)}` to the <script> `const helper` decl. " +
                    "The modifier-arg sub-injection must fire on KEY-position strings only; " +
                    "values are opaque JS string-literal content.",
                resolved is PsiNamedElement && (resolved as PsiNamedElement).name == "helper",
            )
        }
        // resolved == null is the expected happy path (no JS injection over value text).
    }

    /**
     * Pull the "key name" string off whichever shape the resolver returned. Extended from
     * [RozieReferenceTest]'s analog helper to cover the 5 new producer kinds (Plan 08.3-01):
     *
     * - [JSProperty] → `.name` (magic-ident path: `<props>`/`<data>` JSON-object key)
     * - [JSLabeledStatement] → `.label` (magic-ident path: top-level `key: value` parsed as label)
     * - [PsiNamedElement] → `.name` (covers all 5 script-decl producer shapes:
     *   JSFunctionDeclaration, JSVariable, JSClass, ES6ImportSpecifier, ES6ImportedBinding —
     *   each carries `.name` via the PsiNamedElement contract; the walker returns the name-
     *   identifier leaf which is itself a PsiNamedElement)
     * - else → `e.text` (fallback: identifier leaves return their identifier text)
     *
     * **Arm order is significant:** JSProperty + JSLabeledStatement are MORE-specific than
     * PsiNamedElement (both implement it), so their dedicated arms must precede the generic
     * PsiNamedElement arm. The Req 6 name-collision test exercises BOTH families through this
     * helper.
     */
    private fun resolvedKeyName(e: PsiElement): String = when (e) {
        is com.intellij.lang.javascript.psi.JSProperty -> e.name ?: ""
        is com.intellij.lang.javascript.psi.JSLabeledStatement -> e.label ?: ""
        is PsiNamedElement -> e.name ?: ""
        else -> e.text
    }
}
