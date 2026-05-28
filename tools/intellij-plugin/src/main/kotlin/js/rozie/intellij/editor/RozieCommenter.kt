package js.rozie.intellij.editor

import com.intellij.lang.Commenter

/**
 * Host-level [Commenter] for `.rozie` files — used when the comment action
 * (Ctrl-/ line, Ctrl-Shift-/ block) fires on a caret that sits in HOST Rozie
 * PSI (SFC block-tag lines, the outer `<rozie>` wrapper, whitespace between
 * blocks).
 *
 * Inside an injected fragment the comment action uses the injected language's
 * own commenter instead — JavaScript's `//` in `<script>` / `<props>` /
 * `<data>` / `<listeners>` / `<components>`, CSS's slash-star in `<style>`,
 * HTML's `<!-- -->` in `<template>`. This commenter only governs the SFC
 * structural level, where the surrounding syntax is XML/HTML-shaped, so it
 * mirrors the HTML commenter (the same choice Vue's SFC support makes for the
 * top level): no line-comment form, an HTML block-comment pair.
 */
class RozieCommenter : Commenter {

    // HTML/XML has no line-comment syntax; the platform falls back to the
    // block-comment form for the line-comment action.
    override fun getLineCommentPrefix(): String? = null

    override fun getBlockCommentPrefix(): String = "<!--"

    override fun getBlockCommentSuffix(): String = "-->"

    override fun getCommentedBlockCommentPrefix(): String = "<!--"

    override fun getCommentedBlockCommentSuffix(): String = "-->"
}
