package js.rozie.intellij.highlighting

import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.Annotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.psi.PsiElement
import com.intellij.psi.xml.XmlAttribute
import com.intellij.psi.xml.XmlTag
import com.intellij.psi.xml.XmlToken
import com.intellij.psi.xml.XmlTokenType
import js.rozie.intellij.xml.RozieContextCheck

/**
 * SC-4 distinctive coloring for Rozie sigil attributes + PascalCase component
 * tags. Registered for `language="HTML"` so it fires over the HTML PSI
 * injected into `<template>` bodies of `.rozie` files (Plan 02 +
 * `RozieMultiHostInjector` coalesce the entire TEMPLATE_BODY token into a
 * single HTML-injected range; this annotator walks the resulting XmlAttribute
 * / XmlTag PSI tree).
 *
 * Coloring is layered ADDITIVELY over the platform's stock HTML coloring —
 * range targets are the attribute-name token (`attr.nameElement.textRange`)
 * or the tag-name token (`XmlTokenType.XML_NAME` child of the XmlTag),
 * NEVER the full XmlAttribute or full XmlTag range. Painting the full
 * attribute range would override HTML's string-quote coloring on the value
 * and look wrong (08.2-RESEARCH Anti-Pattern, line 778).
 *
 * Pitfall 2 mitigation: registration is `language="HTML"` which fires on
 * every `.html` file project-wide. Every `annotate(element, holder)` body
 * MUST short-circuit on `!RozieContextCheck.isRozieContext(element)` so the
 * Rozie-themed coloring does NOT leak into the user's non-Rozie HTML files
 * (e.g. an Angular template open in the same project). The shared guard is
 * factored into [RozieContextCheck] specifically so this check is visible
 * at every site.
 *
 * TextAttributesKey constants are REUSED from [RozieSyntaxHighlighter]'s
 * companion (Option A from Plan 01) — the external names (e.g.
 * `"ROZIE_R_DIRECTIVE"`) are STABLE API per T-8-03-01 and survive saved
 * user color-scheme customisations.
 */
class RozieAnnotator : Annotator {

    override fun annotate(element: PsiElement, holder: AnnotationHolder) {
        if (!RozieContextCheck.isRozieContext(element)) return
        when (element) {
            is XmlAttribute -> annotateAttribute(element, holder)
            is XmlTag -> annotateTag(element, holder)
        }
    }

    private fun annotateAttribute(attr: XmlAttribute, holder: AnnotationHolder) {
        val name = attr.name
        // Paint ONLY the attribute-name portion. attr.textRange would include the
        // value + quotes, which would override HTML's stock string-quote coloring
        // (08.2-RESEARCH Anti-Pattern line 778).
        val nameRange = attr.nameElement?.textRange ?: return
        val key = when {
            name.startsWith("r-") -> RozieSyntaxHighlighter.R_DIRECTIVE
            name.startsWith("@") -> RozieSyntaxHighlighter.EVENT_AT
            name.startsWith(":") -> RozieSyntaxHighlighter.PROP_BINDING_NAME
            name.startsWith("#") -> RozieSyntaxHighlighter.SLOT_FILL_MARKER
            name == "ref" -> RozieSyntaxHighlighter.REF_ATTR
            else -> return
        }
        holder.newSilentAnnotation(HighlightSeverity.INFORMATION)
            .range(nameRange)
            .textAttributes(key)
            .create()
    }

    private fun annotateTag(tag: XmlTag, holder: AnnotationHolder) {
        val name = tag.name
        if (name.isEmpty() || !name[0].isUpperCase()) return
        // Tag-name token: walk the tag's children and find the XmlToken whose
        // tokenType is XmlTokenType.XML_NAME. (Painting tag.textRange would
        // include all attributes + children, swamping their stock coloring.)
        // Both open-tag <Modal> and close-tag </Modal> appear as XmlTag children
        // in HTML PSI, so this paints both name occurrences.
        val nameToken = tag.children.firstOrNull {
            it is XmlToken && it.tokenType == XmlTokenType.XML_NAME
        } ?: return
        holder.newSilentAnnotation(HighlightSeverity.INFORMATION)
            .range(nameToken.textRange)
            .textAttributes(RozieSyntaxHighlighter.COMPONENT_REF)
            .create()
    }
}
