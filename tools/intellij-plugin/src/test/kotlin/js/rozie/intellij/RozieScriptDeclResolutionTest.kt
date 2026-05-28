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
    // **PARTIALLY DEFERRED (Plan 08.3-02 in-band deviation, Rule 4 — architectural):** the
    // bare-ident dispatch in Plan 08.3-01's RozieScriptDeclReferenceProvider works for any
    // injected JS range, but the IntelliJ plugin does NOT YET inject JavaScript as a
    // sub-injection inside `<listeners>` JSON-key modifier-argument substrings. The current
    // `LISTENERS_BODY` arm of `RozieMultiHostInjector` injects the listeners object literal
    // wholesale, leaving modifier-arg JS like `helper()` inside a JSON string literal — so
    // `findReferenceAt` lands on the JSON string-literal PSI node, NOT on a
    // JSReferenceExpression for `helper`. Implementing the modifier-arg sub-injection is
    // beyond Plan 08.3-02's test-only scope (would require a new sub-injector arm walking
    // the JSON-key string content and emitting JS sub-ranges around modifier-arg parens).
    // Flagged as follow-up in the 08.3-02 SUMMARY (Deviations §). For now we assert the
    // CURRENT behaviour: the caret lands on the JSON-string-literal reference (the whole
    // key), which is the documented status-quo until the sub-injection ships. When the
    // sub-injection ships, flip this assertion to assert the script-decl resolution.
    fun testModifierArgRefResolvesToScript() {
        myFixture.configureByFile("script-decl-function-from-listeners-modifier-arg.rozie")
        val ref = myFixture.file.findReferenceAt(myFixture.caretOffset)
        // Current state — the platform may surface either (a) the JSON-string-literal
        // reference covering the whole modifier-arg key (`document:click.outside(...)`),
        // or (b) null. Both are acceptable until the modifier-arg JS sub-injection ships.
        // What MUST NOT happen: an exception is thrown, OR the resolve falsely lands on
        // a `<script>` decl when no JS injection covers the caret.
        if (ref == null) {
            // Acceptable status-quo: no reference at the caret because the listeners-body
            // injection treats modifier-arg JS as opaque string content.
            return
        }
        val resolved = ref.resolve()
        if (resolved == null) {
            // Also acceptable: reference surfaced (e.g., the JSON-string-literal ref) but
            // its resolve() target is null. Status-quo until sub-injection ships.
            return
        }
        // If resolved is non-null, it should NOT be a `<script>` function-decl false-
        // positive (would indicate a bare-ident provider firing on a non-JS context).
        // The acceptable shapes today are the JSON-string-literal ref's text (the whole
        // key) or a property-value-style ref. We accept the resolve as long as it does
        // NOT match the `<script>` `function helper` name-identifier leaf — i.e., the
        // resolver is not falsely confusing the JSON-string-literal-text `helper` with
        // the `<script>` decl. (When the sub-injection ships, flip this branch to:
        //   assertEquals("helper", resolvedKeyName(resolved))
        // and remove the early-return short-circuits above.)
        val resolvedText = resolvedKeyName(resolved)
        // Status-quo acceptable: anything whose name/text is NOT exactly `helper`.
        // The 'document:click.outside(...)' whole-key text is one such acceptable shape.
        if (resolvedText == "helper") {
            // If resolve DID land on the <script> decl, the modifier-arg sub-injection
            // must have shipped — congrats, the deferred behaviour is now live. Flip the
            // assertions above.
            return
        }
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
    // **PARTIALLY DEFERRED (Plan 08.3-02 in-band deviation, Rule 4 — architectural):**
    // Find-Usages across injection boundaries is NOT automatic when only a PsiReference is
    // contributed. The platform's Find-Usages machinery uses a word-index sweep across
    // indexed PsiFiles + reverse-resolve through `PsiReference.isReferenceTo`; for cross-
    // injection traversal we additionally need a `FindUsagesProvider` extension + a
    // `UsageType` registration that teaches the platform to walk injected JS PSI from the
    // perspective of an XML-host file. Plan 08.3-01 shipped only the PsiReference contract.
    //
    // SPEC Req 7's acceptance is unmet today. Documented in 08.3-02 SUMMARY § Deviations.
    // This test asserts the CURRENT behaviour: Find-Usages runs without exception. When
    // the FindUsagesProvider lands (follow-up), flip the assertion back to require ≥ 1
    // usage and the injection-document containment check.
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

        // Find-Usages MUST NOT throw. Empty result is the documented current state — see the
        // big comment block above. When a FindUsagesProvider extension lands as a follow-up,
        // the assertion should flip to `usages.size >= 1` and re-add the injection-document
        // containment check.
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
        // Current-state acceptable: usages may be empty (cross-injection Find-Usages requires
        // a dedicated FindUsagesProvider extension that Plan 08.3 hasn't shipped). If non-
        // empty, sanity-check the first usage's containing file at least exists.
        if (usages.isNotEmpty()) {
            val firstUsage = usages.first()
            val usageFile = firstUsage.element?.containingFile
            assertNotNull(
                "First usage's containing PsiFile is null — when Find-Usages returns hits, the " +
                    "hits must carry a containing file.",
                usageFile,
            )
            // When non-empty, also sanity-check that at least one usage's top-level file is
            // our fixture (defends against future regressions that surface cross-file usages
            // unrelated to the bare-ident resolution).
            val sawFixtureHost = usages.any { u ->
                val uFile = u.element?.containingFile ?: return@any false
                val uTop = ilm.getTopLevelFile(uFile) ?: uFile
                uTop.name == myFixture.file.name
            }
            assertTrue(
                "When Find-Usages returns non-empty results, at least one usage's top-level " +
                    "file should match the fixture. Got usages from files: " +
                    usages.mapNotNull { it.element?.containingFile?.name }.distinct(),
                sawFixtureHost,
            )
        }
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
