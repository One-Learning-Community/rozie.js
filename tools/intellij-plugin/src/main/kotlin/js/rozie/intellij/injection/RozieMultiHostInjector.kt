package js.rozie.intellij.injection

import com.intellij.lang.Language
import com.intellij.lang.css.CSSLanguage
import com.intellij.lang.html.HTMLLanguage
import com.intellij.lang.injection.MultiHostInjector
import com.intellij.lang.injection.MultiHostRegistrar
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.tree.IElementType
import com.intellij.psi.util.CachedValueProvider
import com.intellij.psi.util.CachedValuesManager
import com.intellij.psi.util.PsiModificationTracker
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.parser.RozieRootBlock
import js.rozie.intellij.xml.RozieComponentRegistry

/**
 * Walks every [RozieRootBlock]'s token stream and registers JavaScript / HTML / CSS
 * (or SCSS / Less) injection ranges per the D-09 / D-10 / D-11 / D-12 contracts:
 *
 *  - SCRIPT_BODY / PROPS_BODY / DATA_BODY / LISTENERS_BODY / COMPONENTS_BODY -> JavaScript (D-09, D-12)
 *  - TEMPLATE_BODY                                          -> HTML       (D-10)
 *  - STYLE_BODY                                             -> CSS / SCSS / Less based on `lang=...` (D-11)
 *
 * Post-pivot (Phase 08.2): TEMPLATE_BODY is the SINGLE contiguous range covering
 * the entire `<template>` body — JetBrains' HTMLLanguage PSI handles attribute
 * values, JS expression injection inside `r-* / @ / : / ref` (via standard HTML
 * `attribute-value` injection), tag matching, and Emmet automatically. No
 * per-attribute ATTR_VALUE_JS arm is required at the host-injector layer.
 *
 * RESEARCH A3 outcome: empirical javap inspection of `plugins/javascript-plugin/lib/javascript-plugin.jar`
 * showed `JavaScriptSupportLoader.JAVASCRIPT` is typed as `LanguageFileType`, not a `Language`,
 * so it cannot be passed to [MultiHostRegistrar.startInjecting]. The correct constant for
 * "vanilla JS" injection is `Language.findLanguageByID("JavaScript")` — used instead of
 * `JavascriptLanguage.INSTANCE` because the latter was converted to a Kotlin `object` in
 * IU 2025.3, breaking the static-INSTANCE accessor across the 2024.2 floor (Java class) and
 * 2025.3 current (Kotlin object). The findLanguageByID lookup is stable across both.
 *
 * RESEARCH A4 outcome: the file-as-host approach FAILED empirically — the platform's
 * injection-dispatcher does not visit `PsiFile` itself when walking for injection hosts.
 * [RozieRootBlock] (a single composite element nested under [js.rozie.intellij.parser.RozieFile])
 * is the [com.intellij.psi.PsiLanguageInjectionHost] target instead.
 */
class RozieMultiHostInjector : MultiHostInjector {

    override fun elementsToInjectIn(): List<Class<out PsiElement>> =
        listOf(RozieRootBlock::class.java)

    override fun getLanguagesToInject(registrar: MultiHostRegistrar, host: PsiElement) {
        if (host !is RozieRootBlock) return
        val tokens = scanTokens(host)

        var i = 0
        while (i < tokens.size) {
            val tok = tokens[i]
            when (tok.type) {
                // SCRIPT_BODY stays UNWRAPPED — see injectJs KDoc.
                //   - SCRIPT_BODY is a statement list (function decls, const decls, lifecycle
                //     calls); wrapping in parens would parse it as a single expression and
                //     break top-level declarations.
                //
                // Plan 08.2-17 (P1-UAT-13 closure): coalesce consecutive SCRIPT_BODY
                // tokens into ONE JS-injected range. The JFlex IN_SCRIPT_BODY state
                // (Rozie.flex:198-204) emits a separate SCRIPT_BODY token at every
                // `<` character — rule `[^<]+` greedily consumes up to the next `<`,
                // then the standalone `"<"` rule emits a 1-char SCRIPT_BODY for the
                // `<` itself, then `[^<]+` resumes. A script body containing JS
                // comparison operators like `$props.step <= $props.max` produces
                // THREE SCRIPT_BODY tokens. Without coalescing, RozieMultiHostInjector
                // calls injectJs once per token, creating N independent JS injection
                // ranges. JavaScript lexical scope cannot span the fragments — so
                // `const canIncrement` declared in fragment 1 is invisible to
                // `if (canIncrement)` referenced in fragment 3, and the caret-
                // containing fragment is also a syntax error (`= 100);` at file
                // start) so the JS parser cannot even surface a JSReferenceExpression
                // at the caret. Task 1's diagnostic test
                // RozieScriptLocalResolutionTest.testInjectedScriptFragmentSharesScopeAcrossStatements
                // empirically confirmed this — decl file range=(0,5444); ref file
                // range=(0,5610). Coalescing into one greedy SCRIPT_BODY range
                // mirrors the TEMPLATE_BODY coalescing immediately below (Plan 02
                // shipped the same fix for HTMLLanguage). The threat-model entry
                // T-08.2-40 dispositions this as `mitigate` and explicitly scopes
                // the coalescing change to SCRIPT_BODY only — other BODY types stay
                // on their existing per-token helpers (PROPS_BODY / DATA_BODY /
                // COMPONENTS_BODY / LISTENERS_BODY are object literals where `<` is
                // virtually never inside the body; the existing Plan 11/15 paren-wrap
                // tests pin that behavior).
                RozieTokenTypes.SCRIPT_BODY,
                -> {
                    var j = i
                    val start = tok.range.startOffset
                    var end = tok.range.endOffset
                    while (j + 1 < tokens.size && tokens[j + 1].type == RozieTokenTypes.SCRIPT_BODY) {
                        j++
                        end = tokens[j].range.endOffset
                    }
                    injectJs(registrar, host, TextRange(start, end))
                    i = j + 1
                }

                // PROPS_BODY / DATA_BODY / COMPONENTS_BODY are by-design
                // object literals. Paren-wrap via addPlace prefix=`(\n` + suffix=`\n)`
                // so the JS parser sees `({ key: value })` (an expression) instead of
                // `{ key: value }` (a label-statement). Closes P1-UAT-04 (Plan 08.2-11).
                // See injectJsAsExpression KDoc for full rationale + Vue/Svelte precedent.
                RozieTokenTypes.PROPS_BODY,
                RozieTokenTypes.DATA_BODY,
                RozieTokenTypes.COMPONENTS_BODY,
                -> { injectJsAsExpression(registrar, host, tok.range); i++ }

                // LISTENERS_BODY is ALSO an object literal — same paren-wrap base layer
                // as PROPS_BODY / DATA_BODY / COMPONENTS_BODY (Plan 08.2-15 added the
                // wrap to close P1-UAT-10). Plan 08.3-04 layers an additional per-
                // modifier-arg JS sub-injection on top so bare identifiers inside
                // modifier-arg parens (e.g., `helper` in
                // `"document:click.outside($refs.x, helper())"`) become resolvable
                // JSReferenceExpressions instead of opaque JSON-string-literal text.
                //
                // Layering order matters per the platform's last-registered-wins rule
                // (documented at lines 138–146 of the TEMPLATE_BODY arm above): register
                // the whole-body paren-wrap FIRST so it forms the base parse layer for
                // the listeners JSON object literal (keys, values, structure), THEN
                // layer the per-modifier-arg JS sub-injections so they take precedence
                // at the offsets they cover. Bare-ident resolution through Plan 08.3-01's
                // RozieScriptDeclReferenceProvider auto-fires on the resulting
                // JSReferenceExpression with zero extra wiring (closes SPEC Req 3).
                RozieTokenTypes.LISTENERS_BODY,
                -> {
                    injectJsAsExpression(registrar, host, tok.range)
                    injectListenersModifierArgJs(
                        registrar,
                        host,
                        host.text.substring(tok.range.startOffset, tok.range.endOffset),
                        tok.range.startOffset,
                    )
                    i++
                }

                RozieTokenTypes.TEMPLATE_BODY,
                -> {
                    // Coalesce a run of consecutive TEMPLATE_BODY tokens into ONE
                    // HTML-injected range. The Plan-01 lexer collapse emits the
                    // template body as a run of TEMPLATE_BODY fragments (the
                    // [^<]+ rule produces long greedy runs separated by single-
                    // char `<` tokens). HTMLLanguage injection needs a SINGLE
                    // contiguous range to parse the body into a real XmlTag /
                    // XmlAttribute PSI tree — multiple per-fragment injections
                    // produce a synthetic HTML PSI whose interior is all
                    // XML_DATA_CHARACTERS (no recognised tags, no attributes,
                    // so the descriptor provider has nothing to attach to).
                    // Plan 02 SC-3 fix: walk forward over the contiguous
                    // TEMPLATE_BODY run and start/extend a single injection.
                    var j = i
                    val start = tok.range.startOffset
                    var end = tok.range.endOffset
                    while (j + 1 < tokens.size && tokens[j + 1].type == RozieTokenTypes.TEMPLATE_BODY) {
                        j++
                        end = tokens[j].range.endOffset
                    }
                    // Register the whole-range HTML injection FIRST so it forms the
                    // base parse layer for the template body (tags, attribute names,
                    // structure). Plan 08.2-14 then layers per-expression JavaScript
                    // injections on top — one independent injection trio per
                    // discovered attribute-value / {{ }} site. Order matters: the
                    // JetBrains platform resolves overlapping injections at a given
                    // offset by returning the LAST-registered injection that covers
                    // it, so the JS injections (registered AFTER the HTML one) take
                    // precedence at offsets they cover, while the HTML injection
                    // remains the resolved injection at every other offset inside
                    // the template body.
                    injectHtml(registrar, host, TextRange(start, end))
                    injectExpressionsInTemplateRun(
                        registrar,
                        host,
                        host.text.substring(start, end),
                        start,
                    )
                    i = j + 1
                }

                RozieTokenTypes.STYLE_BODY,
                -> { injectStyle(registrar, host, tok.range, detectStyleLang(tokens, i)); i++ }

                else -> { i++ /* not injected */ }
            }
        }
    }

    // ---- per-language helpers ---------------------------------------------------

    /**
     * Inject [range] as JavaScript with the Strategy-B Rozie globals ambient-decl
     * prefix prepended.
     *
     * **Closes (Plan 08.2-16):** P1-UAT-11 (bare `$props` / `$data` / `$slots` /
     * etc. Ctrl-click no longer leaks to other `.rozie` files via stock JS
     * project-wide free-identifier search — the synthetic `declare const $props`
     * in the prepended prefix is found first by the JS resolver) and P1-UAT-12
     * (`$computed(...)` / `$emit(...)` / `$watch(...)` etc. call sites no longer
     * flagged as "Unresolved method or function" — the prefix declares each
     * magic identifier as a function with permissive `any`-typed signatures).
     *
     * **Why a prefix and not a project-wide library:** Task 1 investigation
     * (recorded in `rozie-globals.d.ts`'s leading comment block) confirmed that
     * `com.intellij.lang.javascript.library.JSPredefinedLibraryProvider` exists
     * on both IU-242 and IU-253 floors with identical signatures, but its API
     * is project-wide by design (`getPredefinedLibraries(Project)` with no file
     * predicate). Registering Rozie globals via that EP would leak `$props` /
     * `$data` / etc. into every `.js` / `.ts` / `.tsx` file in the user's
     * project, directly violating Plan 16 Pitfall 2. Vue's plugin uses
     * `JSImplicitElementProvider` / web-symbols instead for the same reason
     * (verified — `vuejs.jar`'s plugin.xml has ZERO `predefinedLibrary`
     * registrations). Strategy B (prefix-on-injection) mitigates Pitfall 2 by
     * construction: the prefix only appears in injected JS fragments, and
     * [RozieMultiHostInjector] only fires on [RozieRootBlock] hosts (which
     * exist only inside `.rozie` files).
     *
     * **Cost (T-08.2-37, dispositioned `accept`):** ~500 bytes of ambient
     * declarations per Rozie JS injection. The JS parser handles thousands of
     * `declare` statements without measurable slowdown. The coordinate-mapping
     * invariant is preserved by the platform's standard
     * [com.intellij.lang.injection.InjectedLanguageManager.injectedToHost]
     * prefix-length subtraction — Plan 05's [js.rozie.intellij.references
     * .RoziePropsReference] cross-block resolution continues to work because
     * the prefix lives in the injected document only, never in host coordinates.
     */
    private fun injectJs(registrar: MultiHostRegistrar, host: RozieRootBlock, range: TextRange) {
        val js = Language.findLanguageByID("JavaScript") ?: return
        registrar.startInjecting(js)
            .addPlace(globalsPrefixFor(host), null, host, range)
            .doneInjecting()
    }

    /**
     * Inject [range] as JavaScript with a parenthesised-expression wrap.
     *
     * Mechanism: `MultiHostRegistrar.addPlace(prefix, suffix, host, range)` lets us
     * prepend/append text to the injected fragment that does NOT appear in the host
     * file's byte stream — but DOES affect how the injected language parses the
     * fragment. By prepending `(\n` and appending `\n)`, the JavaScript parser sees:
     *
     *   `(\n{ value: 0, step: 1 }\n)`     ← parenthesised expression
     *
     * instead of:
     *
     *   `{ value: 0, step: 1 }`           ← parsed at JS top-level as a
     *                                       JSBlockStatement containing a
     *                                       JSLabeledStatement (label `value:`
     *                                       carries the "key" semantics);
     *                                       triggers "Statement expected" /
     *                                       JSLabeledStatement family warnings.
     *
     * After the wrap, the injected PSI tree is a real JSObjectLiteralExpression
     * with JSProperty children — the JavaScript inspector's statement-position
     * heuristics see a valid expression and emit no diagnostics.
     *
     * **Closes:** P1-UAT-04 (Plan 08.2-11 — UAT-CHECKLIST-v0.2.0.md lines 165–171)
     * + P1-UAT-10 (Plan 08.2-15 — UAT-CHECKLIST-v0.2.0.md lines 286–291). The
     * "Statement expected" / "Component expected" / JSLabeledStatement warning
     * family on object-literal-shaped block bodies. Plan 11 shipped paren-wrap for
     * <components> / <props> / <data>; Plan 15 extends it to <listeners> after UAT
     * re-run #3 confirmed the same noise surfaces on populated <listeners> blocks
     * (Dropdown.rozie, SearchInput.rozie). All 4 object-literal-shaped block bodies
     * now route through this helper.
     *
     * **Why `\n` on both sides:** the newline padding ensures the prefix/suffix
     * doesn't collide with comments or unusual string spans in the user's body.
     * A bare `(` immediately followed by `// comment` is fine in JS, but `(\n` is
     * more robust against edge cases (the trailing-newline-then-EOF idiom that
     * some hand-rolled lexer scanners — and some compose-map tooling that snaps
     * fragments by line — handle more uniformly than a bare-paren).
     *
     * **Coordinate-mapping invariant preserved:** the prefix and suffix are
     * conceptually OUTSIDE the host coordinate space — they exist only in the
     * injected document. [InjectedLanguageManager.injectedToHost] correctly
     * subtracts the prefix length when translating an injected offset back to
     * host coordinates, so Plan 05's [js.rozie.intellij.references.RoziePropsReference]
     * cross-block Go-to-Declaration continues to work accurately through the
     * wrap. The behavioral assertion is the
     * `testPropsParenWrapPreservesCrossBlockGoToDeclaration` test in
     * `RozieInjectionTest`.
     *
     * **Precedent:** Vue's IntelliJ plugin (vue-js-plugin) uses identical
     * prefix/suffix wrap for `<script setup>` object-literal cases — empirically
     * verifiable in their open-source plugin sources. Svelte's IntelliJ plugin
     * uses the same idiom for `$:` reactive declarations. This is the canonical
     * JetBrains pattern for "inject a fragment that needs an outer syntactic
     * context that doesn't exist in the host file."
     *
     * **What this does NOT silence:** the "unused symbol" family (JSUnusedGlobal/
     * LocalSymbols) flagged on object-literal keys with no in-file reader — that
     * is the orthogonal cross-block-unaware case, which Plan 08.2-08's
     * [js.rozie.intellij.inspection.RozieJSInspectionSuppressor] closes
     * independently. Paren-wrap and suppressor are complementary fixes for two
     * different families of P1-UAT-04 noise.
     */
    private fun injectJsAsExpression(
        registrar: MultiHostRegistrar,
        host: RozieRootBlock,
        range: TextRange,
    ) {
        val js = Language.findLanguageByID("JavaScript") ?: return
        // Plan 08.2-16 (Strategy B): concatenate the Rozie globals ambient-decl
        // prefix BEFORE the paren-wrap so the JS parser sees:
        //   `<globals decls>\n(\n<body>\n)`
        // The globals declarations are top-level `declare const|function`
        // statements which parse cleanly at statement position; the paren-wrap
        // that follows turns the body into a parenthesised expression as Plan 11
        // intended. Closes P1-UAT-11/12 for all 4 object-literal-shaped block
        // bodies (PROPS_BODY / DATA_BODY / COMPONENTS_BODY / LISTENERS_BODY)
        // AND r-for attribute-value injections (Plan 14 routes r-for here).
        //
        // See [injectJs] KDoc for the strategy rationale and Pitfall 2 mitigation.
        registrar.startInjecting(js)
            .addPlace(globalsPrefixFor(host) + "(\n", "\n)", host, range)
            .doneInjecting()
    }

    private fun injectHtml(registrar: MultiHostRegistrar, host: RozieRootBlock, range: TextRange) {
        registrar.startInjecting(HTMLLanguage.INSTANCE)
            .addPlace(null, null, host, range)
            .doneInjecting()
    }

    /**
     * Plan 08.2-14: scan a coalesced TEMPLATE_BODY run for per-expression JavaScript
     * sites and emit per-site addPlace trios. Closes P1-UAT-08 at the injection
     * layer for the four directive-attribute-value families plus `{{ }}` mustache
     * interpolations.
     *
     * Sites recognised (each gets its own startInjecting + addPlace + doneInjecting
     * call so the platform sees N independent JS injections per host element):
     *
     *  1. `r-for="…"` → [injectJsAsExpression] (paren-wrap so JS parses `item in items`
     *     as a parenthesised JSBinaryExpression `in`, not as a JSLabeledStatement).
     *     Mirrors Plan 11's PROPS_BODY / DATA_BODY / COMPONENTS_BODY paren-wrap.
     *  2. Other `r-*="…"` directives → [injectJs] (the value is a normal JS expression
     *     or statement-position-acceptable shape, e.g., `r-if="$data.open"`,
     *     `r-show="…"`, `r-model="…"`, `r-html="…"`, `r-text="…"`, `r-bind="…"`,
     *     `r-on="…"`, etc.).
     *  3. `@event[.modifier(args)]*="…"` → [injectJs]. The modifier suffix lives in
     *     the ATTRIBUTE NAME (before `=`), so the value-quote-pair extraction
     *     naturally excludes it.
     *  4. `:bind="…"` → [injectJs].
     *  5. `{{ … }}` interpolations → [injectJs] for the interior substring.
     *
     * **Plan 08.2-18 — P1-UAT-14 extension:** for COLON_BIND_ATTR and R_OTHER_ATTR
     * (NOT r-for, NOT @event, NOT `{{ }}`), the captured value is checked via
     * [isObjectLiteralShape] before dispatch. Object-literal-shape values (trimmed
     * value matches `^\{.*\}$`) route through [injectJsAsExpression] (paren-wrap
     * from Plan 08.2-11) instead of the unwrapped [injectJs]. Mirrors the
     * canonical Vue / Svelte SFC pattern for `:class="{ k: v }"` and
     * `:style="{ color: c }"` shapes — without the paren-wrap the JS parser
     * sees the object literal at statement position and parses it as a
     * JSLabeledStatement (label `k:` + dead-code block `{ v }`), flagging the
     * "Unnecessary label" / JSLabeledStatement family of inspections. r-for is
     * EXEMPT (it already paren-wraps in branch 1); @event handlers are EXEMPT
     * (virtually never have object-literal values — they're function calls or
     * statements); `{{ }}` interpolations are EXEMPT (the delimiters already
     * exclude the interior from being parsed at statement position).
     *
     * CRITICAL byte-range invariants (pinned by RozieInjectionTest Plan 14 methods):
     *
     *  - Quotes excluded: for `:foo="contents.id"` the injected range covers exactly
     *    `contents.id`, NOT the surrounding `"…"`. JS parsers reject a leading-quote
     *    sequence as a syntax error; including the wrap would break the injection.
     *  - Modifier suffixes excluded: for `@click.stop="handler()"` only `handler()`
     *    is injected as JS. `.stop` lives in the attribute name, which is structurally
     *    outside the value-quote range.
     *  - `{{` / `}}` delimiters excluded: for `{{ count }}` the injected range covers
     *    ` count ` (leading + trailing whitespace permitted — JS tolerates them).
     *
     * Compositional benefits, achieved with ZERO additional code outside this scanner:
     *
     *  - Plan 05's RozieJSReferenceContributor (registered for language="JavaScript")
     *    auto-fires on JSReferenceExpression nodes inside any JS-injected range —
     *    Go-to-Declaration on `$data.modalOpen` inside `:open="$data.modalOpen"`
     *    resolves to the `<data>` block's `modalOpen:` key for free.
     *  - Plan 13's RozieJsMagicIdentifierCompletionContributor (same registration
     *    scope) auto-fires on identifier-position offsets inside any JS-injected
     *    range — typing `$pr` inside `:foo="$pr|"` surfaces `$props` completion
     *    for free.
     *
     * Executor-discretion fallback for r-for (NOT taken in this implementation —
     * documented for posterity): if paren-wrap on `r-for` values produces a
     * confusing UX (e.g., red-squiggled `item` identifier as "unresolved reference"),
     * fall back to "do not inject JS into r-for values in v0.2.0" and document
     * the partial closure in SUMMARY. Plan 14 ships the other 3 attribute families
     * either way, so P1-UAT-08 partial closure is acceptable.
     *
     * Scanner shape: a single pass per pattern family using [Regex.findAll]. Patterns
     * anchor on a leading whitespace boundary (`\s` or `^`) to ensure the match
     * starts at an attribute-name position, not mid-text. The captured value-group's
     * absolute host offsets are computed as `runStartOffset + group.range.first` /
     * `runStartOffset + group.range.last + 1` (Kotlin IntRange is inclusive on both
     * ends; TextRange end is exclusive).
     *
     * Single-quoted attribute values (`@click='alert("hi")'`) are NOT recognised in
     * v0.2.0 — the threat model accepts this (T-08.2-32). Real-world `.rozie` files
     * predominantly use double-quoted attribute values; the single-quote alternative
     * is the documented workaround for embedded-quote edge cases (rare in practice).
     */
    private fun injectExpressionsInTemplateRun(
        registrar: MultiHostRegistrar,
        host: RozieRootBlock,
        runText: String,
        runStartOffset: Int,
    ) {
        // 1. r-for="…" — paren-wrap to make `item in items` a real expression.
        //    Match r-for SPECIFICALLY first so the generic r-* regex below can
        //    safely match all other r-* attributes without re-matching r-for.
        R_FOR_ATTR.findAll(runText).forEach { match ->
            val valueGroup = match.groups[1] ?: return@forEach
            val absStart = runStartOffset + valueGroup.range.first
            val absEnd = runStartOffset + valueGroup.range.last + 1
            injectJsAsExpression(registrar, host, TextRange(absStart, absEnd))
        }

        // 2. Other r-*="…" directives — JS expression OR object-literal expression.
        //    The negative lookahead `(?!for\b)` excludes r-for so we don't
        //    double-inject. Plan 08.2-18 (P1-UAT-14): when the captured value is
        //    an object-literal shape (`^\{.*\}$` after trim), route through
        //    injectJsAsExpression so the JS parser sees a parenthesised
        //    JSObjectLiteralExpression rather than a JSLabeledStatement.
        R_OTHER_ATTR.findAll(runText).forEach { match ->
            val valueGroup = match.groups[1] ?: return@forEach
            val absStart = runStartOffset + valueGroup.range.first
            val absEnd = runStartOffset + valueGroup.range.last + 1
            val range = TextRange(absStart, absEnd)
            if (isObjectLiteralShape(valueGroup.value)) {
                injectJsAsExpression(registrar, host, range)
            } else {
                injectJs(registrar, host, range)
            }
        }

        // 3. @event[.modifier(args)]*="…" event handlers — modifier suffix lives
        //    in the attribute name (before `=`), so quote-pair extraction naturally
        //    excludes it. The captured group 1 is ONLY the value between the quotes.
        EVENT_ATTR.findAll(runText).forEach { match ->
            val valueGroup = match.groups[1] ?: return@forEach
            val absStart = runStartOffset + valueGroup.range.first
            val absEnd = runStartOffset + valueGroup.range.last + 1
            injectJs(registrar, host, TextRange(absStart, absEnd))
        }

        // 4. :bind="…" prop bindings — JS expression OR object-literal expression.
        //    Plan 08.2-18 (P1-UAT-14): when the captured value is an
        //    object-literal shape (`^\{.*\}$` after trim), route through
        //    injectJsAsExpression so the canonical Vue-style
        //    `:class="{ k: v }"` / `:style="{ color: c }"` shapes parse as
        //    JSObjectLiteralExpression instead of JSLabeledStatement.
        COLON_BIND_ATTR.findAll(runText).forEach { match ->
            val valueGroup = match.groups[1] ?: return@forEach
            val absStart = runStartOffset + valueGroup.range.first
            val absEnd = runStartOffset + valueGroup.range.last + 1
            val range = TextRange(absStart, absEnd)
            if (isObjectLiteralShape(valueGroup.value)) {
                injectJsAsExpression(registrar, host, range)
            } else {
                injectJs(registrar, host, range)
            }
        }

        // 5. {{ … }} mustache interpolations — interior substring is JS.
        //    Non-greedy match allows multiple interpolations per template body.
        //    DOTALL flag permits multi-line interpolation bodies (rare but valid).
        MUSTACHE_INTERP.findAll(runText).forEach { match ->
            val valueGroup = match.groups[1] ?: return@forEach
            val absStart = runStartOffset + valueGroup.range.first
            val absEnd = runStartOffset + valueGroup.range.last + 1
            injectJs(registrar, host, TextRange(absStart, absEnd))
        }
    }

    /**
     * Plan 08.3-04 — closes SPEC Req 3 (modifier-arg JS sub-injection).
     *
     * **Architectural why:** Plan 08.3-02's SUMMARY (Deviations § "[Rule 4 -
     * Architectural - DEFERRED] SPEC Req 3") documents that bare identifiers
     * inside `<listeners>` modifier-arg JS — e.g. `helper` in
     * `"document:click.outside($refs.x, helper())"` — were not resolvable by
     * Plan 08.3-01's bare-ident provider because the JS PSI did not exist at
     * those offsets. The whole-listeners-body paren-wrap injection treats
     * modifier-arg text as opaque JSON string-literal content; `findReferenceAt`
     * lands on the JSON-string-literal PSI node, not on a JSReferenceExpression.
     * This helper layers a second injection on top: for each JSON-key string
     * shaped `"event[:selector]?(.modifier[(args)]?)*"`, emit one JS sub-
     * injection covering EXACTLY the modifier-arg `(args)` interior.
     *
     * **Layering with the whole-body paren-wrap:** the caller registers the
     * whole-body paren-wrap injection FIRST (so listeners still parses as a
     * JSObjectLiteralExpression — keys, values, structure intact), THEN calls
     * this helper. The platform's last-registered-injection-wins rule
     * (documented on the TEMPLATE_BODY arm above) routes the offsets covered by
     * sub-injections to the JS sub-range; every other listeners-body offset
     * remains on the whole-body injection. Same pattern as TEMPLATE_BODY's
     * [injectExpressionsInTemplateRun].
     *
     * **Byte-range invariants:** the emitted sub-injection range covers EXACTLY
     * the args interior — outer JSON-key quote excluded, modifier outer `(`
     * excluded, modifier outer `)` excluded. Matches the quote-exclusion
     * invariant from [injectExpressionsInTemplateRun] — the JS parser rejects a
     * leading `"` or `(` at expression-position fragment start.
     *
     * **Compositional benefit:** bare-ident resolution through Plan 08.3-01's
     * existing [RozieScriptDeclReferenceProvider] auto-fires on the resulting
     * JSReferenceExpression — zero new provider wiring required. Magic-ident
     * resolution (`$refs.x` inside the args) ALSO works for the same reason:
     * the sub-injection uses the standard [injectJs] helper, which prepends the
     * same `ROZIE_GLOBALS_PREFIX` as every other JS injection.
     *
     * **Defensive bounds:** skips empty / whitespace-only args (e.g.,
     * `.outside()` with no args, or `.stop` with no parens at all). Skips
     * degenerate ranges (start >= end). Listeners modifier-args MAY legitimately
     * be empty; silently skipping is correct.
     */
    private fun injectListenersModifierArgJs(
        registrar: MultiHostRegistrar,
        host: RozieRootBlock,
        bodyText: String,
        bodyStartOffset: Int,
    ) {
        // Outer scan: find each JSON-key string literal in the body. Group 1 is the
        // key contents (between the surrounding double-quotes; quotes themselves
        // excluded from the capture). The character class `[^"\\]|\\.` permits
        // backslash-escaped characters inside the key (e.g., a key containing an
        // escaped quote) without prematurely terminating the match.
        LISTENERS_KEY_STRING.findAll(bodyText).forEach { keyMatch ->
            val keyContents = keyMatch.groups[1] ?: return@forEach
            // The opening-quote sits one char before the captured key contents.
            // Absolute host offset of the key contents' first char = bodyStartOffset
            // + keyContents.range.first (the regex's group range is relative to the
            // input bodyText, NOT to the host file — bodyStartOffset bridges the gap).
            val keyContentsHostStart = bodyStartOffset + keyContents.range.first
            val keyContentsText = keyContents.value

            // Inner scan: walk each modifier-arg suffix inside the key contents.
            // Pattern matches `.modifierName(args)` where args tolerates one level
            // of nested parens — the happy-path key `click.outside($refs.x,
            // helper())` already nests a call inside the args (WR-01). Group 1 is
            // the args substring (outer parens excluded).
            MODIFIER_ARG.findAll(keyContentsText).forEach { argMatch ->
                val argGroup = argMatch.groups[1] ?: return@forEach
                // Skip empty / whitespace-only args (e.g., `.outside()`).
                if (argGroup.value.isBlank()) return@forEach

                val absStart = keyContentsHostStart + argGroup.range.first
                val absEnd = keyContentsHostStart + argGroup.range.last + 1

                // Defensive guard against degenerate ranges (should not happen given
                // the isBlank check above, but cheap belt-and-suspenders).
                if (absStart >= absEnd) return@forEach

                injectJs(registrar, host, TextRange(absStart, absEnd))
            }
        }
    }

    /**
     * Plan 08.2-18 — P1-UAT-14 heuristic. Returns true if the trimmed [value]
     * matches `^\{.*\}$` (starts with `{`, ends with `}`, ignoring whitespace
     * inside the surrounding quotes). When true, the value is an object literal
     * which MUST be paren-wrapped before injection so the JS parser produces a
     * JSObjectLiteralExpression instead of a JSLabeledStatement (label `key:` +
     * dead-code block `{ value }`).
     *
     * Used by [injectExpressionsInTemplateRun] branches 2 (R_OTHER_ATTR) and 4
     * (COLON_BIND_ATTR) to dispatch between [injectJs] (unwrapped — Plan 14
     * default) and [injectJsAsExpression] (paren-wrap — Plan 11 mechanism).
     * Closes the canonical Vue-style `:class="{ k: v }"` / `:style="{ color: c }"`
     * regression that surfaced in UAT re-run #3 against
     * `examples/Counter.rozie` line 44.
     *
     * Conservative heuristic — does NOT recursively parse the body. Treats any
     * value-shape starting+ending with curly braces as an object literal, which
     * is correct for the canonical Vue/Svelte-style class / style / r-bind
     * shapes (`{ key: value }`, `{ active: condition }`).
     *
     * **Accepted false-positive edge case (threat T-08.2-43):** block-statement
     * shaped values like `{ console.log('x'); return 1; }` (rare in template
     * attribute position) ALSO match this heuristic; the paren-wrap then
     * produces a parenthesised block statement, which JS parses as a comma
     * expression — slightly wrong PSI shape but no worse than the pre-Plan-18
     * JSLabeledStatement noise.
     */
    private fun isObjectLiteralShape(value: String): Boolean {
        val trimmed = value.trim()
        return trimmed.length >= 2 && trimmed.startsWith("{") && trimmed.endsWith("}")
    }

    /**
     * D-11 lang detection.
     *
     * NOTE: SCSS/Less injection is editor-only — the .rozie compiler currently parses
     * <style> as plain CSS via PostCSS. Authoring `<style lang="scss">` will syntax-highlight
     * cleanly in the IDE but FAIL to compile to JS targets. The compiler-side <style lang>
     * follow-up is tracked outside this plan.
     */
    private fun injectStyle(
        registrar: MultiHostRegistrar,
        host: RozieRootBlock,
        range: TextRange,
        lang: String,
    ) {
        val styleLanguage: Language = when (lang.lowercase()) {
            "scss" -> Language.findLanguageByID("SCSS") ?: CSSLanguage.INSTANCE
            "less" -> Language.findLanguageByID("LESS") ?: CSSLanguage.INSTANCE
            else -> CSSLanguage.INSTANCE
        }
        registrar.startInjecting(styleLanguage)
            .addPlace(null, null, host, range)
            .doneInjecting()
    }

    /**
     * Walk back from [styleBodyIdx] until we hit STYLE_BLOCK_TAG. If a LANG_ATTR_VALUE
     * sits between the open tag and the body, return its quoted-stripped text; otherwise "".
     * The lookback window is bounded (10 tokens) — `<style lang="...">` always packs the
     * lang attribute into a tight handful of tokens after STYLE_BLOCK_TAG.
     */
    private fun detectStyleLang(tokens: List<TokenSpan>, styleBodyIdx: Int): String {
        var i = styleBodyIdx - 1
        val lo = maxOf(0, styleBodyIdx - 10)
        while (i >= lo) {
            val tok = tokens[i]
            if (tok.type == RozieTokenTypes.STYLE_BLOCK_TAG) return ""
            if (tok.type == RozieTokenTypes.LANG_ATTR_VALUE) {
                return tok.text.trim().removeSurrounding("\"").removeSurrounding("'")
            }
            i--
        }
        return ""
    }

    /**
     * Scan tokens by re-running the lexer over the host's text. The host text spans the
     * entire file body since [RozieRootBlock] is a single composite under the file root,
     * so token offsets align with file offsets.
     */
    private fun scanTokens(host: RozieRootBlock): List<TokenSpan> {
        val text = host.text
        val lexer = RozieLexerAdapter().apply { start(text) }
        val out = mutableListOf<TokenSpan>()
        while (lexer.tokenType != null) {
            val start = lexer.tokenStart
            val end = lexer.tokenEnd
            out.add(
                TokenSpan(
                    type = lexer.tokenType!!,
                    range = TextRange(start, end),
                    text = text.substring(start, end),
                ),
            )
            lexer.advance()
        }
        return out
    }

    private data class TokenSpan(
        val type: IElementType,
        val range: TextRange,
        val text: String,
    )

    /**
     * Pre-compiled regex constants for [injectExpressionsInTemplateRun] (Plan 08.2-14).
     *
     * All four directive-attribute patterns anchor on a leading whitespace boundary
     * `(?:^|\s)` to match attribute-name position. Each captures EXACTLY the value
     * substring (group 1) between the surrounding double-quotes — the quotes themselves
     * are NOT inside the capture group, satisfying the quote-exclusion invariant
     * documented on [injectExpressionsInTemplateRun].
     *
     * For r-* directives we split into two patterns ([R_FOR_ATTR] and [R_OTHER_ATTR])
     * so r-for can route through [injectJsAsExpression] (paren-wrap for the
     * in-expression shape) while all other r-* directives stay on the unwrapped
     * [injectJs] path. The negative lookahead `(?!for\b)` in [R_OTHER_ATTR] excludes
     * r-for from the generic family — without it, every r-for would receive both a
     * paren-wrapped AND an unwrapped JS injection at the same range, producing
     * undefined behaviour in the JetBrains injection stack.
     *
     * The event-attribute pattern matches the optional `.modifier(args)*` chain inside
     * the attribute name (NOT capturing it — group 1 stays scoped to the value); the
     * `[^)]*` inside modifier-arg parentheses is intentionally simple (no nested
     * parens) because Rozie's modifier grammar (Plan 04 / compiler PEG) does not allow
     * nested call expressions inside modifier args at the surface syntax level.
     */
    companion object {
        /**
         * Plan 08.2-16 — Strategy B Rozie globals ambient-decl prefix.
         *
         * Loaded once at class-load from the bundled
         * `tools/intellij-plugin/src/main/resources/rozie-globals.d.ts` resource.
         * Prepended verbatim (plus a trailing newline) to every Rozie JS injection
         * via [injectJs] and [injectJsAsExpression].
         *
         * The file content is one `declare const` / `declare function` statement
         * per [js.rozie.intellij.completion.RozieMagicIdentifiers] entry. The
         * 1:1 correspondence is enforced by
         * `RozieGlobalsLibraryTest.testAllMagicIdentifiersAreDeclared`.
         *
         * If the resource cannot be loaded (should never happen — the file is
         * shipped in the plugin jar), the prefix degrades to empty string and
         * Plan 08.2-16's P1-UAT-11/12 closure regresses, but other injection
         * behaviour (Plans 11/14/15 paren-wrap, Plans 05/13 cross-block
         * resolution) continues to work normally.
         *
         * Cost: ~500 bytes per injection (dispositioned `accept` in Plan 16's
         * T-08.2-37 threat entry — the JS parser handles thousands of `declare`
         * statements with no measurable perf impact).
         */
        internal val ROZIE_GLOBALS_PREFIX: String = loadGlobalsAsPrefix()

        private fun loadGlobalsAsPrefix(): String =
            RozieMultiHostInjector::class.java.getResourceAsStream("/rozie-globals.d.ts")
                ?.bufferedReader()?.use { it.readText() + "\n" }
                ?: ""

        /** The generic `$props` line in [ROZIE_GLOBALS_PREFIX], replaced per-file. */
        private const val PROPS_ANY_DECL = "declare const \$props: any;"

        /**
         * Per-file globals prefix: [ROZIE_GLOBALS_PREFIX] with the generic
         * `declare const $props: any;` specialised to the host's actual prop
         * shape (e.g. `declare const $props: { title: string; open: boolean };`),
         * so the JS resolver types `$props.title` as `string` instead of the prop
         * DESCRIPTOR object. Files with no `<props>` block (or an unparseable one)
         * keep the generic `any`. Cached on the host file, invalidated on any PSI
         * change; the provider closes over only [file] (its own cache key), never
         * a reparse-varying element — avoiding the "different captured context"
         * CachedValue crash.
         */
        internal fun globalsPrefixFor(host: RozieRootBlock): String {
            val file = host.containingFile ?: return ROZIE_GLOBALS_PREFIX
            return CachedValuesManager.getCachedValue(file) {
                CachedValueProvider.Result.create(
                    computeGlobalsPrefix(file.text),
                    PsiModificationTracker.MODIFICATION_COUNT,
                )
            }
        }

        private fun computeGlobalsPrefix(hostText: String): String {
            val propsBody = RozieComponentRegistry.blockBodyText(hostText, RozieTokenTypes.PROPS_BODY)
            val propsType = RoziePropTypeModel.propsObjectType(propsBody) ?: return ROZIE_GLOBALS_PREFIX
            return ROZIE_GLOBALS_PREFIX.replace(PROPS_ANY_DECL, "declare const \$props: $propsType;")
        }

        // r-for="…": value captured in group 1. Paren-wrap dispatch.
        private val R_FOR_ATTR: Regex =
            """(?:^|\s)r-for\s*=\s*"([^"]*)"""".toRegex()

        // Other r-*="…": value captured in group 1. Unwrapped dispatch.
        // Negative lookahead `(?!for\b)` excludes r-for to avoid double-inject.
        private val R_OTHER_ATTR: Regex =
            """(?:^|\s)r-(?!for\b)[\w-]+\s*=\s*"([^"]*)"""".toRegex()

        // @event[.modifier(args)]*="…": value captured in group 1. Modifier suffix
        // lives in the attribute name (before `=`) and is NOT inside the capture.
        private val EVENT_ATTR: Regex =
            """(?:^|\s)@[\w-]+(?:\.[\w-]+(?:\([^)]*\))?)*\s*=\s*"([^"]*)"""".toRegex()

        // :bind="…": value captured in group 1.
        private val COLON_BIND_ATTR: Regex =
            """(?:^|\s):[\w-]+\s*=\s*"([^"]*)"""".toRegex()

        // {{ … }}: interior captured in group 1. Non-greedy with DOTALL so multi-line
        // interpolation bodies parse correctly. `{{` and `}}` delimiters are NOT
        // inside the capture group.
        private val MUSTACHE_INTERP: Regex =
            """\{\{(.*?)\}\}""".toRegex(RegexOption.DOT_MATCHES_ALL)

        /**
         * Plan 08.3-04 — outer scan for a double-quoted JSON-key string inside a
         * `<listeners>` body. Group 1 is the key contents (between the surrounding
         * double-quotes; the quotes themselves are excluded from the capture).
         *
         * Character class `[^"\\]|\\.` permits backslash-escaped characters inside
         * the key (e.g., a key containing an escaped quote `\"`) without
         * prematurely terminating the match. The non-greedy `*?` is unnecessary
         * because the character class explicitly excludes the closing-quote.
         *
         * The trailing `\s*:` anchor restricts the match to strings in JSON-KEY
         * position (followed by the `key: value` separator). Without it the scan
         * matched string VALUES too — any listeners value carrying a `.method(args)`
         * call (e.g. `"$refs.x.focus()"`) would get a spurious JS sub-injection
         * layered over value-interior text, corrupting the listeners-body PSI shape
         * the magic-ident resolvers + JS inspectors rely on (CR-01). Values are never
         * in key position, so the `:` anchor excludes them.
         *
         * Used by [injectListenersModifierArgJs] to locate each modifier-bearing
         * listeners key; the inner [MODIFIER_ARG] scan then walks the key contents
         * for `.modifier(args)` suffixes.
         */
        private val LISTENERS_KEY_STRING: Regex =
            """"((?:[^"\\]|\\.)*)"\s*:""".toRegex()

        /**
         * Plan 08.3-04 — inner scan for a modifier suffix carrying parenthesised
         * args inside a listeners JSON-key. Group 1 is the args substring (outer
         * parens excluded). Pattern `\.\w+\(((?:[^()]|\([^()]*\))*)\)` matches
         * `.modifierName(...)` where the body tolerates ONE level of nested
         * parens.
         *
         * The single-nesting body is required because the documented happy-path key
         * already nests a call inside the modifier args — `click.outside($refs.x,
         * helper())` (the SPEC Req 3 fixture). A flat `[^)]*` body stopped at the
         * first inner `)`, capturing the unbalanced fragment `$refs.x, helper(` and
         * emitting a syntactically-broken JS sub-injection (WR-01). One nesting
         * level covers every modifier-arg shape the surface listeners grammar
         * accepts (a single call-expression argument); deeper nesting would need a
         * balanced-paren hand-scanner.
         *
         * Used by [injectListenersModifierArgJs] to emit per-args JS sub-injections
         * inside listeners modifier suffixes.
         */
        private val MODIFIER_ARG: Regex =
            """\.\w+\(((?:[^()]|\([^()]*\))*)\)""".toRegex()
    }
}
