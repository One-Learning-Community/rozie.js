package js.rozie.intellij.structure

import com.intellij.icons.AllIcons
import com.intellij.ide.structureView.StructureViewBuilder
import com.intellij.ide.structureView.StructureViewModel
import com.intellij.ide.structureView.StructureViewModelBase
import com.intellij.ide.structureView.StructureViewTreeElement
import com.intellij.ide.structureView.TreeBasedStructureViewBuilder
import com.intellij.ide.util.treeView.smartTree.TreeElement
import com.intellij.lang.ASTNode
import com.intellij.lang.PsiStructureViewFactory
import com.intellij.navigation.ItemPresentation
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.fileEditor.OpenFileDescriptor
import com.intellij.psi.PsiFile
import js.rozie.intellij.RozieIcons
import js.rozie.intellij.lexer.RozieTokenTypes
import javax.swing.Icon

/**
 * Structure view (the "Structure" tool window) for `.rozie` files — lists the
 * SFC blocks (`<rozie>`, `<template>`, `<script>`, `<props>`, `<data>`,
 * `<listeners>`, `<components>`, `<style>`) so they can be jumped to from the
 * tool window, the same affordance a Vue / Svelte SFC gives.
 *
 * The host PSI is flat ([js.rozie.intellij.parser.RozieParserDefinition] emits
 * a leaf-token stream), so the block list is collected by scanning for
 * `*_BLOCK_TAG` opening tokens — the same approach
 * [js.rozie.intellij.folding.RozieFoldingBuilder] takes.
 */
class RozieStructureViewFactory : PsiStructureViewFactory {
    override fun getStructureViewBuilder(psiFile: PsiFile): StructureViewBuilder =
        object : TreeBasedStructureViewBuilder() {
            override fun createStructureViewModel(editor: Editor?): StructureViewModel =
                RozieStructureViewModel(psiFile, editor)
        }
}

private class RozieStructureViewModel(file: PsiFile, editor: Editor?) :
    StructureViewModelBase(file, editor, RozieStructureViewElement(file, null)),
    StructureViewModel.ElementInfoProvider {

    override fun isAlwaysShowsPlus(element: StructureViewTreeElement): Boolean =
        element is RozieStructureViewElement && !element.isBlock

    override fun isAlwaysLeaf(element: StructureViewTreeElement): Boolean =
        element is RozieStructureViewElement && element.isBlock
}

/**
 * One structure-view node. [anchor] is `null` for the file root, or the
 * block's opening-tag ASTNode for an SFC block node.
 */
private class RozieStructureViewElement(
    private val file: PsiFile,
    private val anchor: ASTNode?,
) : StructureViewTreeElement, ItemPresentation {

    /** True for an SFC-block node, false for the file root. */
    val isBlock: Boolean get() = anchor != null

    override fun getValue(): Any = anchor?.psi ?: file

    override fun getPresentation(): ItemPresentation = this

    override fun getChildren(): Array<TreeElement> {
        if (anchor != null) return TreeElement.EMPTY_ARRAY // blocks are leaves
        val blocks = ArrayList<ASTNode>()
        collectBlockOpenTags(file.node, blocks)
        return blocks.map { RozieStructureViewElement(file, it) }.toTypedArray()
    }

    // --- ItemPresentation ---

    override fun getPresentableText(): String =
        anchor?.text?.removePrefix("<") ?: file.name

    override fun getIcon(unused: Boolean): Icon =
        if (anchor != null) AllIcons.Nodes.Tag else RozieIcons.FILE

    // --- Navigatable ---

    override fun navigate(requestFocus: Boolean) {
        val node = anchor ?: return
        val virtualFile = file.virtualFile ?: return
        OpenFileDescriptor(file.project, virtualFile, node.startOffset).navigate(requestFocus)
    }

    override fun canNavigate(): Boolean = anchor != null

    override fun canNavigateToSource(): Boolean = anchor != null

    private fun collectBlockOpenTags(node: ASTNode, out: MutableList<ASTNode>) {
        if (node.elementType in RozieTokenTypes.BLOCK_OPEN_TAGS) {
            out.add(node)
            return
        }
        var child = node.firstChildNode
        while (child != null) {
            collectBlockOpenTags(child, out)
            child = child.treeNext
        }
    }
}
