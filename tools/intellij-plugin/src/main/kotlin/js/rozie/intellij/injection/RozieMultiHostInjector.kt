package js.rozie.intellij.injection

import com.intellij.lang.Language
import com.intellij.lang.css.CSSLanguage
import com.intellij.lang.html.HTMLLanguage
import com.intellij.lang.injection.MultiHostInjector
import com.intellij.lang.injection.MultiHostRegistrar
import com.intellij.lang.javascript.JavascriptLanguage
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
 *  - SCRIPT_BODY / PROPS_BODY / DATA_BODY / LISTENERS_BODY -> JavaScript (D-09, D-12)
 *  - TEMPLATE_BODY                                          -> HTML       (D-10)
 *  - STYLE_BODY                                             -> CSS / SCSS / Less based on `lang=...` (D-11)
 *  - ATTR_VALUE_JS (r-* / @event / :prop / ref values)      -> JavaScript (D-09)
 *  - MUSTACHE_BODY                                          -> NOT injected in v1 (D-09 deferral)
 *
 * RESEARCH A3 outcome: empirical javap inspection of `plugins/javascript-plugin/lib/javascript-plugin.jar`
 * showed `JavaScriptSupportLoader.JAVASCRIPT` is typed as `LanguageFileType`, not a `Language`,
 * so it cannot be passed to [MultiHostRegistrar.startInjecting]. The correct constant for
 * "vanilla JS" injection is [JavascriptLanguage.INSTANCE] (a [com.intellij.lang.javascript.JSLanguageDialect]
 * extending [Language]).
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

        for (i in tokens.indices) {
            val tok = tokens[i]
            when (tok.type) {
                RozieTokenTypes.SCRIPT_BODY,
                RozieTokenTypes.PROPS_BODY,
                RozieTokenTypes.DATA_BODY,
                RozieTokenTypes.LISTENERS_BODY,
                -> injectJs(registrar, host, tok.range)

                RozieTokenTypes.TEMPLATE_BODY,
                -> injectHtml(registrar, host, tok.range)

                RozieTokenTypes.STYLE_BODY,
                -> injectStyle(registrar, host, tok.range, detectStyleLang(tokens, i))

                RozieTokenTypes.ATTR_VALUE_JS,
                -> injectJs(registrar, host, tok.range)

                else -> { /* not injected */ }
            }
        }
    }

    // ---- per-language helpers ---------------------------------------------------

    private fun injectJs(registrar: MultiHostRegistrar, host: RozieRootBlock, range: TextRange) {
        registrar.startInjecting(JavascriptLanguage.INSTANCE)
            .addPlace(null, null, host, range)
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
