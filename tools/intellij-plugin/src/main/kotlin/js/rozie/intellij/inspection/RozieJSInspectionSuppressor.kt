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
 * the JavaScript layer. Silences `JSUnusedGlobalSymbols` / `JSUnusedLocalSymbols`
 * inside `.rozie` SFC blocks whose JS bodies are by-design cross-block-consumed.
 *
 * Closes:
 *  - **P1-UAT-05** (UAT-CHECKLIST-v0.2.0.md lines 173–179): functions defined in
 *    `<script>` are consumed by `<template>` event handlers / `<listeners>` /
 *    `$emit` callbacks, but the JS inspector sees the `<script>` injection in
 *    isolation and flags every top-level declaration as unused.
 *  - **P1-UAT-04 partial / JS-side belt-and-suspenders** (lines 165–171):
 *    object-literal keys in `<props>` / `<data>` / `<components>` are read by
 *    `$props.X` / `$data.X` and per-target codegen; the JS inspector cannot
 *    see those cross-block consumers and flags the keys as unused.
 *
 * Architecture notes (mirrors [RozieHtmlInspectionSuppressor], extends to the
 * JS layer):
 *  - **Pitfall 2 (carve-out leak)** — first guard is
 *    [RozieContextCheck.isRozieContext]. The suppressor is registered for
 *    `language="JavaScript"`, which means it fires on EVERY `.js` file in the
 *    user's project. Without this guard the suppression list would leak into
 *    unrelated JS files.
 *  - **Narrow allow-list** — only `JSUnusedGlobalSymbols` and
 *    `JSUnusedLocalSymbols` are suppressed. The `JSStatementExpected` /
 *    `JSLabeledStatement` family (the OTHER half of P1-UAT-04) is intentionally
 *    NOT suppressed here. Plan 08.2-11's `RozieMultiHostInjector` paren-wrap is
 *    the principled fix for those; if paren-wrap fully resolves them, this
 *    suppressor's list stays narrow.
 *
 *    **Plan 08.2-11 outcome (post-paren-wrap):** the paren-wrap on PROPS_BODY /
 *    DATA_BODY / COMPONENTS_BODY injections (via `MultiHostRegistrar.addPlace`
 *    prefix=`(\n` + suffix=`\n)`) gives the JS parser a parenthesised expression
 *    context — the object-literal block bodies now parse as a real
 *    `JSObjectLiteralExpression` with `JSProperty` children, not a
 *    `JSBlockStatement` containing `JSLabeledStatement` nodes. The
 *    Statement-expected / Component-expected / JSLabeledStatement warning family
 *    disappears at the JS-parser layer, with no suppressor work needed for that
 *    half of P1-UAT-04. **This suppressor's allow-list therefore stays narrow at
 *    `{JSUnusedGlobalSymbols, JSUnusedLocalSymbols}` — paren-wrap is the
 *    principled fix for the statement-shape family; this suppressor handles the
 *    orthogonal "key has no in-file reader" family that paren-wrap does not
 *    address.** The two close P1-UAT-04 jointly.
 *  - **Per-block dispatch** — the suppressor identifies which SFC block the
 *    inspected element belongs to via the same `RozieLexerAdapter().apply { start(text) }`
 *    + token-walk pattern that
 *    [js.rozie.intellij.references.RoziePropsReference.Companion.findBlockBodyRange]
 *    uses. Only [RozieTokenTypes.SCRIPT_BODY], [RozieTokenTypes.PROPS_BODY],
 *    [RozieTokenTypes.DATA_BODY], [RozieTokenTypes.LISTENERS_BODY], and
 *    [RozieTokenTypes.COMPONENTS_BODY] trigger suppression.
 *
 * Empirical SPI notes (verified by introspecting `com.intellij.codeInspection.InspectionSuppressor`
 * in IU 2024.2.5 lib/app.jar):
 *  - Extension-point qualified name: `com.intellij.lang.inspectionSuppressor`
 *    (NOT `com.intellij.xml.xmlSuppressionProvider` — that EP is XML-specific
 *    and used by [RozieHtmlInspectionSuppressor]; this layer uses the generic
 *    EP scoped via the `language="JavaScript"` attribute in plugin.xml).
 *  - `getSuppressActions` returns [SuppressQuickFix.EMPTY_ARRAY] — Rozie files
 *    carry no written suppression markers (same convention as
 *    [RozieHtmlInspectionSuppressor.suppressForFile] / `.suppressForTag`).
 */
class RozieJSInspectionSuppressor : InspectionSuppressor {

    override fun isSuppressedFor(element: PsiElement, toolId: String): Boolean {
        // Narrow allow-list check first — cheap and short-circuits the
        // vast majority of inspection-framework calls.
        if (toolId != "JSUnusedGlobalSymbols" && toolId != "JSUnusedLocalSymbols") {
            return false
        }

        // Pitfall 2 — stay inert on non-Rozie .js files anywhere in the user's
        // project. RozieContextCheck.isRozieContext walks via
        // InjectedLanguageManager.getTopLevelFile so this fires correctly whether
        // the platform passes us the injected fragment OR the host file directly.
        if (!RozieContextCheck.isRozieContext(element)) return false

        // Resolve the injection host. For injected JS fragments the host is the
        // RozieRootBlock composite under the file. If the element is a top-level
        // Rozie element (not injected), getInjectionHost returns null — fall back
        // through containingFile.context.
        val ilm = InjectedLanguageManager.getInstance(element.project)
        val host = (ilm.getInjectionHost(element) as? RozieRootBlock)
            ?: (element.containingFile?.context as? RozieRootBlock)
            ?: return false

        // Translate the element's range to host-absolute coordinates. For
        // injected elements, element.textRange is in the injected document's
        // coordinate space; injectedToHost translates that back to the host
        // file's coordinate space, which is what the lexer-derived *_BODY
        // ranges live in. injectedToHost is a no-op for non-injected elements,
        // so the same call is safe in both paths.
        val hostRange = ilm.injectedToHost(element, element.textRange)

        // Find the *_BODY token whose range contains the element's host-coordinate
        // start offset.
        val bodyType = findEnclosingBodyType(host, hostRange.startOffset) ?: return false

        // Per-block dispatch table. All five JS-flavored block bodies share the
        // same JS unused-symbol suppression — the per-block test (kept explicit
        // for readability + future divergence) cross-references the dispatch
        // table in the plan's <interfaces> block.
        return when (bodyType) {
            RozieTokenTypes.SCRIPT_BODY,
            RozieTokenTypes.COMPONENTS_BODY,
            RozieTokenTypes.PROPS_BODY,
            RozieTokenTypes.DATA_BODY,
            RozieTokenTypes.LISTENERS_BODY,
            -> true

            else -> false
        }
    }

    override fun getSuppressActions(element: PsiElement?, toolId: String): Array<SuppressQuickFix> =
        SuppressQuickFix.EMPTY_ARRAY

    /**
     * Re-lex [host].text via [RozieLexerAdapter] and return the [IElementType]
     * of the JS-flavored *_BODY token whose host-absolute range contains
     * [hostOffset]. Returns null if no such body covers the offset.
     *
     * Mirrors the re-lex pattern in
     * [js.rozie.intellij.references.RoziePropsReference.Companion.findBlockBodyRange]
     * (lines 146–166) and [js.rozie.intellij.injection.RozieMultiHostInjector.scanTokens]
     * (lines 159–176) — same `RozieLexerAdapter().apply { start(text) }` + walk.
     *
     * Performance: the host text is the entire file body and the lexer is a
     * pure-Java JFlex DFA — measured at microseconds per file. The inspection
     * framework calls `isSuppressedFor` on every PsiElement at every keystroke
     * in the worst case, but the early-return guards above (toolId allow-list +
     * RozieContextCheck) keep this walk off the hot path for non-Rozie files.
     * If a future profile shows hot-path cost, wrap via [com.intellij.psi.util.CachedValuesManager]
     * keyed on `host.text` (same pattern as RoziePropsReference.multiResolve).
     */
    private fun findEnclosingBodyType(host: RozieRootBlock, hostOffset: Int): IElementType? {
        val text = host.text
        val hostStart = host.textRange.startOffset
        val lexer = RozieLexerAdapter().apply { start(text) }
        while (lexer.tokenType != null) {
            val type = lexer.tokenType
            if (type != null && type in JS_FLAVORED_BODY_TYPES) {
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
        /** The five JS-injected block body tokens — see plan <interfaces> dispatch table. */
        private val JS_FLAVORED_BODY_TYPES: Set<IElementType> = setOf(
            RozieTokenTypes.SCRIPT_BODY,
            RozieTokenTypes.COMPONENTS_BODY,
            RozieTokenTypes.PROPS_BODY,
            RozieTokenTypes.DATA_BODY,
            RozieTokenTypes.LISTENERS_BODY,
        )
    }
}
