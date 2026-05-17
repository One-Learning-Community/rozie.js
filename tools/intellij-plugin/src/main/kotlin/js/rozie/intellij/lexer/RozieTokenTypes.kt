package js.rozie.intellij.lexer

import com.intellij.psi.tree.IElementType
import com.intellij.psi.tree.TokenSet
import js.rozie.intellij.RozieLanguage

/**
 * IElementType registry for the Rozie JFlex lexer.
 *
 * POST-PIVOT (Phase 08.2): the registry is intentionally small — the lexer's
 * job is SFC block boundary detection only. Template-level Rozie carve-outs
 * (`r-*`, `@`, `:`, `{{ }}`, `$magic`, `ref`, `#slot`, `<Component>`) are
 * recognised inside the HTMLLanguage-injected PSI by RozieAttributeDescriptors-
 * Provider / RozieComponentTagProvider / RozieAnnotator (Plans 02–04), NOT by
 * fragmenting tokens at the host-lexer layer.
 *
 * Conventions:
 *  - Block-tag tokens cover the full opening-tag-name span (e.g., `<rozie` or
 *    `</template>`). The wrapping `<` / `</` is folded into the same token to
 *    keep downstream code simple. The closing `>` of an opening tag is emitted
 *    separately as [GT].
 *  - Block-body tokens are *single tokens* spanning the entire block body. The
 *    multi-host injector carves ranges from these.
 */
object RozieTokenTypes {
    // --- Block opening tags (full `<rozie` / `<template` / etc. spans) ---
    @JvmField val ROZIE_BLOCK_TAG: IElementType = RozieElementType("ROZIE_BLOCK_TAG")
    @JvmField val TEMPLATE_BLOCK_TAG: IElementType = RozieElementType("TEMPLATE_BLOCK_TAG")
    @JvmField val SCRIPT_BLOCK_TAG: IElementType = RozieElementType("SCRIPT_BLOCK_TAG")
    @JvmField val PROPS_BLOCK_TAG: IElementType = RozieElementType("PROPS_BLOCK_TAG")
    @JvmField val DATA_BLOCK_TAG: IElementType = RozieElementType("DATA_BLOCK_TAG")
    @JvmField val LISTENERS_BLOCK_TAG: IElementType = RozieElementType("LISTENERS_BLOCK_TAG")
    @JvmField val COMPONENTS_BLOCK_TAG: IElementType = RozieElementType("COMPONENTS_BLOCK_TAG")
    @JvmField val STYLE_BLOCK_TAG: IElementType = RozieElementType("STYLE_BLOCK_TAG")

    // --- Block close tags (full `</rozie>` / `</template>` / etc. spans) ---
    @JvmField val ROZIE_CLOSE_TAG: IElementType = RozieElementType("ROZIE_CLOSE_TAG")
    @JvmField val TEMPLATE_CLOSE_TAG: IElementType = RozieElementType("TEMPLATE_CLOSE_TAG")
    @JvmField val SCRIPT_CLOSE_TAG: IElementType = RozieElementType("SCRIPT_CLOSE_TAG")
    @JvmField val PROPS_CLOSE_TAG: IElementType = RozieElementType("PROPS_CLOSE_TAG")
    @JvmField val DATA_CLOSE_TAG: IElementType = RozieElementType("DATA_CLOSE_TAG")
    @JvmField val LISTENERS_CLOSE_TAG: IElementType = RozieElementType("LISTENERS_CLOSE_TAG")
    @JvmField val COMPONENTS_CLOSE_TAG: IElementType = RozieElementType("COMPONENTS_CLOSE_TAG")
    @JvmField val STYLE_CLOSE_TAG: IElementType = RozieElementType("STYLE_CLOSE_TAG")

    // --- Block body tokens (single token per block body; injectors carve ranges) ---
    @JvmField val SCRIPT_BODY: IElementType = RozieElementType("SCRIPT_BODY")
    @JvmField val PROPS_BODY: IElementType = RozieElementType("PROPS_BODY")
    @JvmField val DATA_BODY: IElementType = RozieElementType("DATA_BODY")
    @JvmField val LISTENERS_BODY: IElementType = RozieElementType("LISTENERS_BODY")
    @JvmField val COMPONENTS_BODY: IElementType = RozieElementType("COMPONENTS_BODY")
    @JvmField val TEMPLATE_BODY: IElementType = RozieElementType("TEMPLATE_BODY")
    @JvmField val STYLE_BODY: IElementType = RozieElementType("STYLE_BODY")

    // --- Block-attribute value (e.g. `<style lang="scss">`, `<rozie name="X">`) ---
    // Block-tag attribute values stay tokenised (lexer scans `<rozie ...>` etc.
    // outside of any injection). Template-body attribute values live inside the
    // contiguous TEMPLATE_BODY token and are HTML-PSI-parsed.
    @JvmField val ATTR_VALUE_PLAIN: IElementType = RozieElementType("ATTR_VALUE_PLAIN")

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
        DATA_BLOCK_TAG, LISTENERS_BLOCK_TAG, COMPONENTS_BLOCK_TAG, STYLE_BLOCK_TAG,
        ROZIE_CLOSE_TAG, TEMPLATE_CLOSE_TAG, SCRIPT_CLOSE_TAG, PROPS_CLOSE_TAG,
        DATA_CLOSE_TAG, LISTENERS_CLOSE_TAG, COMPONENTS_CLOSE_TAG, STYLE_CLOSE_TAG
    )

    /**
     * Body tokens for blocks whose contents are JS-flavored (script, props, data, listeners).
     * Plan 04 JS-injects each.
     */
    @JvmField
    val SCRIPT_FLAVORED_BODY_TOKENS: TokenSet = TokenSet.create(
        SCRIPT_BODY, PROPS_BODY, DATA_BODY, LISTENERS_BODY, COMPONENTS_BODY
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
