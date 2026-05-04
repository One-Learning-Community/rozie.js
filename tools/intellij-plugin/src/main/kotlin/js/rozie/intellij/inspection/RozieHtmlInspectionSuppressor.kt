package js.rozie.intellij.inspection

import com.intellij.codeInspection.XmlSuppressionProvider
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.xml.XmlAttribute

/**
 * Suppresses HTML "unknown attribute" / "required attribute" diagnostics for
 * Rozie-specific attribute names (`r-*`, `@event`, `:prop`, `ref`) when the host
 * file is a `.rozie` file with an HTML-injected `<template>` body.
 *
 * SC-4 carve-out: HTML inspections by default flag `r-if` / `@click` / `:open` as
 * unknown. RESEARCH Pattern 5 recommends "approach 2" (suppression) over a
 * lexer-level carve-out for v1 simplicity.
 *
 * Empirical javap notes (verified against IU 2024.2.5 lib/app.jar):
 *  - Extension-point qualified name: `com.intellij.xml.xmlSuppressionProvider`
 *  - `XmlSuppressionProvider.isProviderAvailable(file)` takes `PsiFile`, not
 *    `PsiElement` (the plan's stub had the wrong signature).
 *  - `isSuppressedFor(element, inspectionId)` is the per-element gate the
 *    XML/HTML inspections call before surfacing a diagnostic.
 */
class RozieHtmlInspectionSuppressor : XmlSuppressionProvider() {

    /**
     * The plan's suggested check `containingFile.fileType.name == "Rozie"` does NOT
     * fire for HTML-injected fragments — the injected fragment's containingFile is the
     * synthetic HTML view, not the .rozie host. We resolve the top-level host via
     * [InjectedLanguageManager.getTopLevelFile] so suppression activates whether the
     * HTML inspection sees the injected fragment or the host file directly.
     */
    override fun isProviderAvailable(file: PsiFile): Boolean {
        val project = file.project
        val host = InjectedLanguageManager.getInstance(project).getTopLevelFile(file) ?: file
        return host.fileType.name == "Rozie"
    }

    override fun isSuppressedFor(element: PsiElement, inspectionId: String): Boolean {
        // Only the HTML attribute-name inspections are in scope. Other HTML inspections
        // (e.g., HtmlExtraClosingTag) keep firing — that's a real authoring error.
        if (inspectionId != "HtmlUnknownAttribute" && inspectionId != "RequiredAttributes") {
            return false
        }
        val attr = (element as? XmlAttribute) ?: element.parent as? XmlAttribute ?: return false
        return isRozieAttribute(attr.name)
    }

    // The IDE never asks us to *write* a suppression marker into a .rozie file
    // (there's no @SuppressWarnings comment shape in Rozie). Both methods are no-ops.
    override fun suppressForFile(element: PsiElement, inspectionId: String) {
        // No-op: Rozie files don't carry written suppression markers.
    }

    override fun suppressForTag(element: PsiElement, inspectionId: String) {
        // No-op: Rozie files don't carry written suppression markers.
    }

    private fun isRozieAttribute(name: String): Boolean =
        name.startsWith("r-") ||
            name.startsWith("@") ||
            name.startsWith(":") ||
            name == "ref"
}
