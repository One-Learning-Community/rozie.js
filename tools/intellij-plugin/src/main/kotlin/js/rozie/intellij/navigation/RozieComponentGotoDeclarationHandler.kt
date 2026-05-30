package js.rozie.intellij.navigation

import com.intellij.codeInsight.navigation.actions.GotoDeclarationHandler
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSLiteralExpression
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.editor.Editor
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiManager
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlToken
import com.intellij.psi.xml.XmlTokenType
import js.rozie.intellij.completion.RozieProducerSurface
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.parser.RozieRootBlock
import js.rozie.intellij.references.RoziePropsReference
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Go-to-definition (Ctrl/Cmd-click, Go to Declaration) for composed components in
 * a `.rozie` file — both directions a component-library author reaches for:
 *
 *   1. **A PascalCase component tag** in the `<template>` (`<Modal>`, `</Card>`,
 *      `<CardHeader />`) → opens the producer `.rozie` file resolved through the
 *      consumer's `<components>` import path.
 *   2. **The import-path string** inside the `<components>` block
 *      (`Modal: './Modal.rozie'`) → opens that file.
 *
 * Why a native handler: LSP4IJ does not serve definition for carets inside
 * injected fragments (the component tag lives in injected HTML, the import path
 * in injected JS), and the IntelliJ LSP client disables `definition` for exactly
 * this reason — so without this handler Ctrl-click does nothing in IntelliJ. VS
 * Code gets the same navigation from the LSP brain (`componentNav.ts`).
 *
 * Resolution reuses [RozieProducerSurface] — the same import-path → file logic
 * that already backs cross-file attribute completion — so the two features can
 * never disagree about where `<Modal>` points.
 */
class RozieComponentGotoDeclarationHandler : GotoDeclarationHandler {

    override fun getGotoDeclarationTargets(
        sourceElement: PsiElement?,
        offset: Int,
        editor: Editor?,
    ): Array<PsiElement>? {
        val element = sourceElement ?: return null
        if (!RozieContextCheck.isRozieContext(element)) return null
        val target = resolveFromTag(element) ?: resolveFromImportString(element) ?: return null
        return arrayOf(target)
    }

    override fun getActionText(context: DataContext): String? = null

    private companion object {

        /**
         * A caret on a PascalCase tag-name token (`<Modal>` / `</Card>`) →
         * producer file. The open- and close-tag names are both `XML_NAME`
         * tokens, so close-tag clicks navigate too.
         */
        fun resolveFromTag(element: PsiElement): PsiElement? {
            if (element !is XmlToken || element.tokenType != XmlTokenType.XML_NAME) return null
            val name = element.text
            if (name.isEmpty() || !name[0].isUpperCase()) return null
            val host = InjectedLanguageManager.getInstance(element.project)
                .getTopLevelFile(element.containingFile) ?: return null
            if (host.fileType.name != "Rozie") return null
            val vf = RozieProducerSurface.resolveProducerFile(host, name) ?: return null
            return PsiManager.getInstance(element.project).findFile(vf)
        }

        /**
         * A caret inside a string literal in the `<components>` block → the file
         * that import path points at. Confined to `COMPONENTS_BODY` so string
         * literals elsewhere (`<script>` imports, plain strings) are left to the
         * JS plugin's own resolution.
         */
        fun resolveFromImportString(element: PsiElement): PsiElement? {
            val literal = PsiTreeUtil.getParentOfType(element, JSLiteralExpression::class.java)
                ?: return null
            if (!literal.isStringLiteral) return null
            val ilm = InjectedLanguageManager.getInstance(element.project)
            val rootBlock = (ilm.getInjectionHost(element) as? RozieRootBlock)
                ?: (element.containingFile?.context as? RozieRootBlock)
                ?: return null
            val hostOffset = ilm.injectedToHost(element, element.textOffset)
            val range = RoziePropsReference.findBlockBodyRange(rootBlock, RozieTokenTypes.COMPONENTS_BODY)
                ?: return null
            if (!range.containsOffset(hostOffset)) return null
            val path = literal.stringValue ?: return null
            val host = ilm.getTopLevelFile(element.containingFile) ?: return null
            val vf = RozieProducerSurface.resolveImportPath(host, path) ?: return null
            return PsiManager.getInstance(element.project).findFile(vf)
        }
    }
}
