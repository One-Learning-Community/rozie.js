package js.rozie.intellij.folding

import com.intellij.lang.ASTNode
import com.intellij.lang.folding.FoldingBuilderEx
import com.intellij.lang.folding.FoldingDescriptor
import com.intellij.openapi.editor.Document
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElement
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * Collapses each Rozie SFC block — `<template>`, `<script>`, `<props>`,
 * `<data>`, `<listeners>`, `<components>`, `<style>`, and the outer `<rozie>`
 * wrapper — to a one-line placeholder. This is the same affordance Vue and
 * Svelte single-file-component editors give: fold the blocks you are not
 * editing.
 *
 * **Why a token walk, not a PSI walk:** the host PSI is intentionally flat —
 * [js.rozie.intellij.parser.RozieParserDefinition] emits a single
 * `RozieRootBlock` wrapping a leaf-token stream with no per-block composite
 * nodes (the injection-first pivot, Phase 08.2). Fold regions are therefore
 * derived by pairing each `*_BLOCK_TAG` opening token with its matching
 * `*_CLOSE_TAG` token via a stack walk over the leaf tokens. SFC blocks do
 * not overlap (`<template>` … `<style>` are siblings, all nested only inside
 * `<rozie>`), so a stack pairs them correctly for well-formed input and
 * silently skips unmatched tags otherwise.
 *
 * Single-line blocks are not offered a fold region (nothing to collapse).
 * Fold ranges are in host coordinates; the HTML/JS/CSS folding builders
 * continue to fold inside the injected fragments independently.
 */
class RozieFoldingBuilder : FoldingBuilderEx(), DumbAware {

    override fun buildFoldRegions(
        root: PsiElement,
        document: Document,
        quick: Boolean,
    ): Array<FoldingDescriptor> {
        val blockTags = ArrayList<ASTNode>()
        collectBlockTags(root.node, blockTags)

        val descriptors = ArrayList<FoldingDescriptor>()
        val openStack = ArrayDeque<ASTNode>()
        for (tag in blockTags) {
            when (tag.elementType) {
                in RozieTokenTypes.BLOCK_OPEN_TAGS -> openStack.addLast(tag)
                in RozieTokenTypes.BLOCK_CLOSE_TAGS -> {
                    val open = openStack.removeLastOrNull() ?: continue
                    val range = TextRange(open.startOffset, tag.textRange.endOffset)
                    // Skip single-line blocks — there is nothing worth collapsing.
                    if (range.isEmpty ||
                        document.getLineNumber(range.startOffset) ==
                        document.getLineNumber(range.endOffset)
                    ) {
                        continue
                    }
                    descriptors.add(FoldingDescriptor(open, range))
                }
            }
        }
        return descriptors.toTypedArray()
    }

    /**
     * The anchor [node] is always a block-opening tag token whose text is the
     * `<`-prefixed tag name (e.g. `<template`). Render it as `<template>...`.
     */
    override fun getPlaceholderText(node: ASTNode): String = node.text + ">..."

    /** SFC blocks start expanded — the author opened the file to edit them. */
    override fun isCollapsedByDefault(node: ASTNode): Boolean = false

    private fun collectBlockTags(node: ASTNode, out: MutableList<ASTNode>) {
        if (node.elementType in RozieTokenTypes.BLOCK_TAGS) {
            out.add(node)
            return
        }
        var child = node.firstChildNode
        while (child != null) {
            collectBlockTags(child, out)
            child = child.treeNext
        }
    }
}
