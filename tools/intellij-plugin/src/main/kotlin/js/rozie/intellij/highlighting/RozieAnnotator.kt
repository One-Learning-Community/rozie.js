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
        // Plan 08.2-10 (P1-UAT-03 coloring-half regression fix): the previous
        // implementation guarded on `tag.name[0].isUpperCase()`. HTML PSI
        // normalises tag names: `tag.name` for `<Card>` may surface as `"Card"`
        // OR (when the platform's HTML-parser lower-cases unknown tag names)
        // as `"card"`. Use `tag.localName` and additionally the FIRST XML_NAME
        // child token's text — which preserves source casing — so the
        // PascalCase guard fires reliably regardless of platform normalisation.
        val nameTokens = tag.children.filter {
            it is XmlToken && it.tokenType == XmlTokenType.XML_NAME
        }
        if (nameTokens.isEmpty()) return
        // Use the source-preserved text of the FIRST XML_NAME token (the
        // open-tag name) as the casing oracle — `tag.name` / `tag.localName`
        // can be lower-cased by HTML PSI, hiding PascalCase from the guard.
        val openSourceText = nameTokens[0].text
        if (openSourceText.isEmpty() || !openSourceText[0].isUpperCase()) return

        // Paint EVERY XML_NAME child token (open-tag AND close-tag). The pre-fix
        // implementation called `firstOrNull` which captured only the open-tag
        // name and left `</Card>` un-painted — the precise symptom the human
        // UAT surfaced (P1-UAT-03 coloring-half).
        for (nameToken in nameTokens) {
            holder.newSilentAnnotation(HighlightSeverity.INFORMATION)
                .range(nameToken.textRange)
                .textAttributes(RozieSyntaxHighlighter.COMPONENT_REF)
                .create()
        }
    }
}
