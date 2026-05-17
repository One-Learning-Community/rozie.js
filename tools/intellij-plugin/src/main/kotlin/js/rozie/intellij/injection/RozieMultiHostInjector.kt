package js.rozie.intellij.injection

import com.intellij.lang.Language
import com.intellij.lang.css.CSSLanguage
import com.intellij.lang.html.HTMLLanguage
import com.intellij.lang.injection.MultiHostInjector
import com.intellij.lang.injection.MultiHostRegistrar
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.tree.IElementType
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.parser.RozieRootBlock

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
                // SCRIPT_BODY + LISTENERS_BODY stay UNWRAPPED — see injectJs KDoc.
                //   - SCRIPT_BODY is a statement list (function decls, const decls, lifecycle
                //     calls); wrapping in parens would parse it as a single expression and
                //     break top-level declarations.
                //   - LISTENERS_BODY is an object literal at top level but UAT-CHECKLIST-v0.2.0
                //     (lines 165–171) did NOT name <listeners> as noisy, and a populated
                //     listeners block can legitimately read as a statement list in some
                //     authoring patterns. Conservative stance for v0.2.0 — revisit in Plan
                //     08.2-12 human UAT if needed (planner discretion per the plan's
                //     <interfaces> LISTENERS_BODY decision section).
                RozieTokenTypes.SCRIPT_BODY,
                RozieTokenTypes.LISTENERS_BODY,
                -> { injectJs(registrar, host, tok.range); i++ }

                // PROPS_BODY / DATA_BODY / COMPONENTS_BODY are by-design object literals.
                // Paren-wrap via addPlace prefix=`(\n` + suffix=`\n)` so the JS parser
                // sees `({ key: value })` (an expression) instead of `{ key: value }`
                // (a label-statement) — closes P1-UAT-04 at the injection layer.
                // See injectJsAsExpression KDoc for full rationale + Vue/Svelte precedent.
                RozieTokenTypes.PROPS_BODY,
                RozieTokenTypes.DATA_BODY,
                RozieTokenTypes.COMPONENTS_BODY,
                -> { injectJsAsExpression(registrar, host, tok.range); i++ }

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
                    injectHtml(registrar, host, TextRange(start, end))
                    i = j + 1
                }

                RozieTokenTypes.STYLE_BODY,
                -> { injectStyle(registrar, host, tok.range, detectStyleLang(tokens, i)); i++ }

                else -> { i++ /* not injected */ }
            }
        }
    }

    // ---- per-language helpers ---------------------------------------------------

    private fun injectJs(registrar: MultiHostRegistrar, host: RozieRootBlock, range: TextRange) {
        val js = Language.findLanguageByID("JavaScript") ?: return
        registrar.startInjecting(js)
            .addPlace(null, null, host, range)
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
     * **Closes:** P1-UAT-04 (UAT-CHECKLIST-v0.2.0.md lines 165–171) — the
     * "Statement expected" / "Component expected" / JSLabeledStatement warning
     * family on object-literal-shaped block bodies (<components> / <props> /
     * <data>). Implementation per Plan 08.2-11.
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
        registrar.startInjecting(js)
            .addPlace("(\n", "\n)", host, range)
            .doneInjecting()
    }

    private fun injectHtml(registrar: MultiHostRegistrar, host: RozieRootBlock, range: TextRange) {
        registrar.startInjecting(HTMLLanguage.INSTANCE)
            .addPlace(null, null, host, range)
            .doneInjecting()
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
}
