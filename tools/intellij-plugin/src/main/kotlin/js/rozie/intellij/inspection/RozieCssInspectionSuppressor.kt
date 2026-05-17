package js.rozie.intellij.inspection

import com.intellij.codeInspection.InspectionSuppressor
import com.intellij.codeInspection.SuppressQuickFix
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import com.intellij.psi.tree.IElementType
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.parser.RozieRootBlock
import js.rozie.intellij.xml.RozieContextCheck

/**
 * SC-3 / SC-4 supporting [com.intellij.codeInspection.InspectionSuppressor] for
 * the CSS / SCSS / Less layer. Silences `CssUnusedSymbol` inside `.rozie`
 * `<style>` blocks whose selectors are by-design cross-block-consumed (referenced
 * via `class="..."` in the sibling `<template>` block, which the CSS inspector
 * cannot see in isolation).
 *
 * Closes:
 *  - **P1-UAT-06** (UAT-CHECKLIST-v0.2.0.md lines 181-188): every CSS selector
 *    inside `<style>` flagged as unused by `CssUnusedSymbol`. The CSS inspector
 *    sees the `<style>` injection in isolation and reports all selectors as
 *    unused because it has no awareness of the sibling `<template>` `class=`
 *    consumers. Long-term fix is a cross-block CSS usage tracker (walk
 *    `<template>` `class="..."` references and link to `<style>` selectors); the
 *    suppressor is the right gap-closure deliverable for v0.2.0 per the
 *    UAT-CHECKLIST disposition.
 *
 * Architecture notes (mirrors [RozieJSInspectionSuppressor], extends to the
 * CSS layer):
 *  - **Pitfall 2 (carve-out leak)** — first guard is
 *    [RozieContextCheck.isRozieContext]. The suppressor is registered for
 *    `language="CSS"` (plus mirror entries for `SCSS` / `LESS`), which means it
 *    fires on EVERY `.css` / `.scss` / `.less` file in the user's project.
 *    Without this guard the suppression list would leak into unrelated CSS
 *    files anywhere in the user's workspace.
 *  - **Narrow allow-list** — only `CssUnusedSymbol` is suppressed. Structural
 *    CSS errors (unbalanced braces, invalid selectors) keep firing. The
 *    related `CssReplaceWithShorthandSafely` family is intentionally NOT
 *    suppressed here — extend the allow-list in a follow-up edit IF the
 *    Plan 12 human UAT surfaces it as residual noise.
 *  - **Per-block dispatch** — only [RozieTokenTypes.STYLE_BODY] triggers
 *    suppression. SCRIPT / PROPS / DATA / LISTENERS / COMPONENTS bodies host
 *    JavaScript injections and are handled by [RozieJSInspectionSuppressor];
 *    TEMPLATE_BODY hosts HTML and uses [RozieHtmlInspectionSuppressor]. The
 *    per-block guard exists so a future non-style CSS-injected block (none
 *    currently exists) wouldn't accidentally inherit the suppression.
 *
 * Empirical SPI notes (matches Plan 08 RozieJSInspectionSuppressor):
 *  - Extension-point qualified name: `com.intellij.lang.inspectionSuppressor`
 *    scoped via the `language="CSS"|"SCSS"|"LESS"` attribute in plugin.xml.
 *  - `getSuppressActions` returns [SuppressQuickFix.EMPTY_ARRAY] — Rozie files
 *    carry no written suppression markers (same convention as
 *    [RozieJSInspectionSuppressor.getSuppressActions]).
 */
class RozieCssInspectionSuppressor : InspectionSuppressor {

    override fun isSuppressedFor(element: PsiElement, toolId: String): Boolean {
        // Narrow allow-list check first — cheap and short-circuits the
        // vast majority of inspection-framework calls.
        if (toolId !in SUPPRESSED_CSS_INSPECTION_IDS) {
            return false
        }

        // Pitfall 2 — stay inert on non-Rozie .css / .scss / .less files
        // anywhere in the user's project. RozieContextCheck.isRozieContext
        // walks via InjectedLanguageManager.getTopLevelFile so this fires
        // correctly whether the platform passes us the injected fragment OR
        // the host file directly.
        if (!RozieContextCheck.isRozieContext(element)) return false

        // Resolve the injection host. For injected CSS fragments the host is
        // the RozieRootBlock composite under the file. If the element is a
        // top-level Rozie element (not injected), getInjectionHost returns
        // null — fall back through containingFile.context.
        val ilm = InjectedLanguageManager.getInstance(element.project)
        val host = (ilm.getInjectionHost(element) as? RozieRootBlock)
            ?: (element.containingFile?.context as? RozieRootBlock)
            ?: return false

        // Translate the element's range to host-absolute coordinates. For
        // injected elements, element.textRange is in the injected document's
        // coordinate space; injectedToHost translates that back to the host
        // file's coordinate space, which is what the lexer-derived STYLE_BODY
        // range lives in. injectedToHost is a no-op for non-injected elements,
        // so the same call is safe in both paths.
        val hostRange = ilm.injectedToHost(element, element.textRange)

        // Find the *_BODY token whose range contains the element's
        // host-coordinate start offset.
        val bodyType = findEnclosingBodyType(host, hostRange.startOffset) ?: return false

        // Per-block dispatch: only STYLE_BODY triggers CSS-side suppression.
        // (SCRIPT/PROPS/DATA/LISTENERS/COMPONENTS host JS — covered by
        // RozieJSInspectionSuppressor; TEMPLATE hosts HTML — covered by
        // RozieHtmlInspectionSuppressor.)
        return bodyType == RozieTokenTypes.STYLE_BODY
    }

    override fun getSuppressActions(element: PsiElement?, toolId: String): Array<SuppressQuickFix> =
        SuppressQuickFix.EMPTY_ARRAY

    /**
     * Re-lex [host].text via [RozieLexerAdapter] and return the [IElementType]
     * of the body token whose host-absolute range contains [hostOffset].
     * Returns null if no such body covers the offset.
     *
     * Mirrors the re-lex pattern in [RozieJSInspectionSuppressor.findEnclosingBodyType]
     * and [js.rozie.intellij.injection.RozieMultiHostInjector.scanTokens] —
     * same `RozieLexerAdapter().apply { start(text) }` + walk. We restrict the
     * match to STYLE_BODY only so we don't accidentally dispatch into a
     * JS-injected body (those are RozieJSInspectionSuppressor's job).
     *
     * Performance: the host text is the entire file body and the lexer is a
     * pure-Java JFlex DFA — measured at microseconds per file. The inspection
     * framework calls `isSuppressedFor` on every PsiElement at every keystroke
     * in the worst case, but the early-return guards above (toolId allow-list
     * + RozieContextCheck) keep this walk off the hot path for non-Rozie files.
     * If a future profile shows hot-path cost, wrap via
     * [com.intellij.psi.util.CachedValuesManager] keyed on `host.text` (same
     * pattern as `RoziePropsReference.multiResolve`).
     */
    private fun findEnclosingBodyType(host: RozieRootBlock, hostOffset: Int): IElementType? {
        val text = host.text
        val hostStart = host.textRange.startOffset
        val lexer = RozieLexerAdapter().apply { start(text) }
        while (lexer.tokenType != null) {
            val type = lexer.tokenType
            if (type == RozieTokenTypes.STYLE_BODY) {
                // Token offsets are RELATIVE to the lexer's input (= host.text).
                // Translate to file-absolute and check containment against
                // hostOffset (also file-absolute).
                val absStart = hostStart + lexer.tokenStart
                val absEnd = hostStart + lexer.tokenEnd
                val range = TextRange(absStart, absEnd)
                if (range.containsOffset(hostOffset)) {
                    return type
                }
            }
            lexer.advance()
        }
        return null
    }

    private companion object {
        /**
         * Narrow allow-list of CSS inspection IDs that this suppressor silences
         * inside .rozie <style> bodies. Kept intentionally minimal so structural
         * CSS errors keep firing — see class KDoc + T-08.2-19 disposition.
         *
         * Add `"CssReplaceWithShorthandSafely"` here only if Plan 12's human UAT
         * surfaces it as residual noise in WebStorm.
         */
        private val SUPPRESSED_CSS_INSPECTION_IDS: Set<String> = setOf(
            "CssUnusedSymbol",
        )
    }
}
