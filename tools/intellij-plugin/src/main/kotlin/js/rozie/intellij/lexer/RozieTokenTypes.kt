package js.rozie.intellij.lexer

import com.intellij.psi.tree.IElementType
import com.intellij.psi.tree.TokenSet
import js.rozie.intellij.RozieLanguage

/**
 * IElementType registry for the Rozie JFlex lexer.
 *
 * Each Rozie-specific TextMate scope in `tools/textmate/syntaxes/rozie.tmLanguage.json`
 * has at least one corresponding [IElementType] field here. The D-07 drift check
 * (`TextMateGrammarParityTest`) asserts every TM scope maps to an entry below.
 *
 * Conventions:
 *  - Block-tag tokens cover the full opening-tag-name span (e.g., `<rozie` or
 *    `</template>`). The wrapping `<` / `</` is folded into the same token to
 *    keep downstream code simple. The closing `>` of an opening tag is emitted
 *    separately as [GT].
 *  - Block-body tokens are *single tokens* spanning the entire block body. The
 *    multi-host injector (Plan 04) carves ranges from these.
 *  - Template-level tokens (`r-*`, `@`, `:`, `{{ }}`, `$magic`, `ref`) are
 *    surfaced as their own IElementTypes so the highlighter (Plan 03) can give
 *    them per-token colors. HTML structure inside `<template>` is *not*
 *    recognized — that's HTML injection's job.
 */
object RozieTokenTypes {
    // --- Block opening tags (full `<rozie` / `<template` / etc. spans) ---
    @JvmField val ROZIE_BLOCK_TAG: IElementType = RozieElementType("ROZIE_BLOCK_TAG")
    @JvmField val TEMPLATE_BLOCK_TAG: IElementType = RozieElementType("TEMPLATE_BLOCK_TAG")
    @JvmField val SCRIPT_BLOCK_TAG: IElementType = RozieElementType("SCRIPT_BLOCK_TAG")
    @JvmField val PROPS_BLOCK_TAG: IElementType = RozieElementType("PROPS_BLOCK_TAG")
    @JvmField val DATA_BLOCK_TAG: IElementType = RozieElementType("DATA_BLOCK_TAG")
    @JvmField val LISTENERS_BLOCK_TAG: IElementType = RozieElementType("LISTENERS_BLOCK_TAG")
    @JvmField val STYLE_BLOCK_TAG: IElementType = RozieElementType("STYLE_BLOCK_TAG")

    // --- Block close tags (full `</rozie>` / `</template>` / etc. spans) ---
    @JvmField val ROZIE_CLOSE_TAG: IElementType = RozieElementType("ROZIE_CLOSE_TAG")
    @JvmField val TEMPLATE_CLOSE_TAG: IElementType = RozieElementType("TEMPLATE_CLOSE_TAG")
    @JvmField val SCRIPT_CLOSE_TAG: IElementType = RozieElementType("SCRIPT_CLOSE_TAG")
    @JvmField val PROPS_CLOSE_TAG: IElementType = RozieElementType("PROPS_CLOSE_TAG")
    @JvmField val DATA_CLOSE_TAG: IElementType = RozieElementType("DATA_CLOSE_TAG")
    @JvmField val LISTENERS_CLOSE_TAG: IElementType = RozieElementType("LISTENERS_CLOSE_TAG")
    @JvmField val STYLE_CLOSE_TAG: IElementType = RozieElementType("STYLE_CLOSE_TAG")

    // --- Block body tokens (single token per block body; injectors carve ranges) ---
    @JvmField val SCRIPT_BODY: IElementType = RozieElementType("SCRIPT_BODY")
    @JvmField val PROPS_BODY: IElementType = RozieElementType("PROPS_BODY")
    @JvmField val DATA_BODY: IElementType = RozieElementType("DATA_BODY")
    @JvmField val LISTENERS_BODY: IElementType = RozieElementType("LISTENERS_BODY")
    @JvmField val TEMPLATE_BODY: IElementType = RozieElementType("TEMPLATE_BODY")
    @JvmField val STYLE_BODY: IElementType = RozieElementType("STYLE_BODY")

    // --- Template-level Rozie-specific tokens ---
    @JvmField val R_DIRECTIVE: IElementType = RozieElementType("R_DIRECTIVE")
    @JvmField val EVENT_AT: IElementType = RozieElementType("EVENT_AT")
    @JvmField val EVENT_NAME: IElementType = RozieElementType("EVENT_NAME")
    @JvmField val MODIFIER_DOT: IElementType = RozieElementType("MODIFIER_DOT")
    @JvmField val MODIFIER_NAME: IElementType = RozieElementType("MODIFIER_NAME")
    @JvmField val MODIFIER_LPAREN: IElementType = RozieElementType("MODIFIER_LPAREN")
    @JvmField val MODIFIER_RPAREN: IElementType = RozieElementType("MODIFIER_RPAREN")
    @JvmField val MODIFIER_ARGS: IElementType = RozieElementType("MODIFIER_ARGS")
    @JvmField val PROP_COLON: IElementType = RozieElementType("PROP_COLON")
    @JvmField val PROP_NAME: IElementType = RozieElementType("PROP_NAME")
    @JvmField val REF_ATTR_NAME: IElementType = RozieElementType("REF_ATTR_NAME")
    @JvmField val ATTR_VALUE_JS: IElementType = RozieElementType("ATTR_VALUE_JS")
    @JvmField val ATTR_VALUE_PLAIN: IElementType = RozieElementType("ATTR_VALUE_PLAIN")
    @JvmField val MUSTACHE_OPEN: IElementType = RozieElementType("MUSTACHE_OPEN")
    @JvmField val MUSTACHE_BODY: IElementType = RozieElementType("MUSTACHE_BODY")
    @JvmField val MUSTACHE_CLOSE: IElementType = RozieElementType("MUSTACHE_CLOSE")
    @JvmField val MAGIC_IDENT: IElementType = RozieElementType("MAGIC_IDENT")

    // --- Lang attribute (for <style lang="scss"> / <script lang="ts">) ---
    @JvmField val LANG_ATTR_NAME: IElementType = RozieElementType("LANG_ATTR_NAME")
    @JvmField val LANG_ATTR_VALUE: IElementType = RozieElementType("LANG_ATTR_VALUE")

    // --- Generic / structural ---
    @JvmField val WHITE_SPACE: IElementType = RozieElementType("WHITE_SPACE")
    @JvmField val HTML_COMMENT_OPEN: IElementType = RozieElementType("HTML_COMMENT_OPEN")
    @JvmField val HTML_COMMENT_CONTENT: IElementType = RozieElementType("HTML_COMMENT_CONTENT")
    @JvmField val HTML_COMMENT_CLOSE: IElementType = RozieElementType("HTML_COMMENT_CLOSE")
    @JvmField val EQ: IElementType = RozieElementType("EQ")
    @JvmField val GT: IElementType = RozieElementType("GT")
    @JvmField val LT_SLASH: IElementType = RozieElementType("LT_SLASH")
    @JvmField val ATTR_NAME: IElementType = RozieElementType("ATTR_NAME")
    @JvmField val BAD_CHARACTER: IElementType = RozieElementType("BAD_CHARACTER")

    // --- TokenSets used by ParserDefinition + downstream plans ---

    /** All block opening + closing tag tokens. Plan 04 uses this to find injection boundaries. */
    @JvmField
    val BLOCK_TAGS: TokenSet = TokenSet.create(
        ROZIE_BLOCK_TAG, TEMPLATE_BLOCK_TAG, SCRIPT_BLOCK_TAG, PROPS_BLOCK_TAG,
        DATA_BLOCK_TAG, LISTENERS_BLOCK_TAG, STYLE_BLOCK_TAG,
        ROZIE_CLOSE_TAG, TEMPLATE_CLOSE_TAG, SCRIPT_CLOSE_TAG, PROPS_CLOSE_TAG,
        DATA_CLOSE_TAG, LISTENERS_CLOSE_TAG, STYLE_CLOSE_TAG
    )

    /**
     * Body tokens for blocks whose contents are JS-flavored (script, props, data, listeners).
     * Plan 04 JS-injects each.
     */
    @JvmField
    val SCRIPT_FLAVORED_BODY_TOKENS: TokenSet = TokenSet.create(
        SCRIPT_BODY, PROPS_BODY, DATA_BODY, LISTENERS_BODY
    )

    /** Comment tokens (used by ParserDefinition.getCommentTokens). */
    @JvmField
    val COMMENTS: TokenSet = TokenSet.create(
        HTML_COMMENT_OPEN, HTML_COMMENT_CONTENT, HTML_COMMENT_CLOSE
    )
}

/**
 * Local IElementType subclass that pins the language to [RozieLanguage]; the
 * `IElementType` constructor is `final` and the language parameter is required
 * for the platform's PSI machinery. Using a named subclass also makes
 * `LexerTestCase`'s default snapshot output emit just the debug name, which
 * keeps `.txt` snapshots stable across IElementType identity changes.
 */
private class RozieElementType(debugName: String) : IElementType(debugName, RozieLanguage)
