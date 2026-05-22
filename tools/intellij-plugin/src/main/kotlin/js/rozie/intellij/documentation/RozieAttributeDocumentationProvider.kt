package js.rozie.intellij.documentation

import com.intellij.lang.documentation.AbstractDocumentationProvider
import com.intellij.openapi.editor.Editor
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlAttribute
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Quick-Doc (Ctrl-Q) and hover documentation for Rozie template attributes —
 * `r-*` directives, `@event` / `r-on` listeners, `:prop` bindings, `#slot`
 * fills, `ref`, and the `.modifier` chain. Content lives in [RozieDocs].
 *
 * Registered for `language="HTML"`: the [XmlAttribute] PSI we document lives
 * in the HTMLLanguage fragment that `RozieMultiHostInjector` injects into
 * `<template>` bodies (the same Pitfall 3 reasoning the attribute-descriptor
 * provider and HTML annotator document). Every entry point short-circuits on
 * `!RozieContextCheck.isRozieContext` (Pitfall 2) so the provider stays inert
 * in non-Rozie `.html` files anywhere in the user's project.
 *
 * The `$`-magic-identifier docs are handled separately — they ride the JSDoc
 * comments on `rozie-globals.d.ts`, which the JS resolver already surfaces.
 */
class RozieAttributeDocumentationProvider : AbstractDocumentationProvider() {

    /**
     * A Rozie sigil attribute carries no `PsiReference`, so Quick-Doc has no
     * resolve target by default. This hook hands the platform the enclosing
     * [XmlAttribute] as the documentation element when the caret sits inside a
     * recognised Rozie attribute name.
     */
    override fun getCustomDocumentationElement(
        editor: Editor,
        file: PsiFile,
        contextElement: PsiElement?,
        targetOffset: Int,
    ): PsiElement? {
        val context = contextElement ?: return null
        if (!RozieContextCheck.isRozieContext(context)) return null
        val attr = PsiTreeUtil.getParentOfType(context, XmlAttribute::class.java, false)
            ?: return null
        return if (RozieDocs.attributeDoc(attr.name) != null) attr else null
    }

    override fun generateDoc(element: PsiElement?, originalElement: PsiElement?): String? {
        val attr = element as? XmlAttribute ?: return null
        if (!RozieContextCheck.isRozieContext(attr)) return null
        return RozieDocs.attributeDoc(attr.name)
    }

    override fun getQuickNavigateInfo(element: PsiElement?, originalElement: PsiElement?): String? {
        val attr = element as? XmlAttribute ?: return null
        if (!RozieContextCheck.isRozieContext(attr)) return null
        return RozieDocs.attributeQuickInfo(attr.name)
    }
}
