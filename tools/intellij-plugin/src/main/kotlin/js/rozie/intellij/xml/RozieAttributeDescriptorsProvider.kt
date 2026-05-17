package js.rozie.intellij.xml

import com.intellij.psi.xml.XmlTag
import com.intellij.xml.XmlAttributeDescriptor
import com.intellij.xml.XmlAttributeDescriptorsProvider

/**
 * Recognises Rozie sigil attributes (`r-*`, `@event`, `:prop`, `#slot`, `ref`)
 * as valid XML attributes inside the HTMLLanguage PSI injected into `<template>`
 * bodies of `.rozie` files. After this provider lands, IntelliJ's
 * "HtmlUnknownAttribute" inspection no longer flags those names.
 *
 * Replaces the inspection-suppressor-only approach Phase 08 shipped — descriptors
 * integrate with completion, docs, and inspection out of the box and are the
 * JetBrains-canonical pattern (Angular's `AngularJSAttributeDescriptorsProvider`
 * is the reference; cited in 08.2-RESEARCH Pattern 2 + § Sources).
 *
 * `RozieHtmlInspectionSuppressor` stays as belt-and-suspenders defense in depth
 * per 08.2-RESEARCH Pitfall 4.
 */
class RozieAttributeDescriptorsProvider : XmlAttributeDescriptorsProvider {

    /**
     * Returns the *enumerable* set of Rozie attributes for `tag`. Only
     * [RozieKnownAttributes.KNOWN_LITERAL_ATTRS] (`ref`, `lang`, `scoped`) can
     * be enumerated by tag — their full name is fixed. The sigil-prefixed
     * families (`@event`, `:prop`, `#slot`, `r-*`) have varying suffixes and
     * are resolved by name in [getAttributeDescriptor] below; enumerating them
     * here would require choosing an arbitrary completion set that
     * [js.rozie.intellij.xml.RozieKnownAttributes.EVENT_SIGILS] et al. already
     * own (Plan 06 will surface those via the completion contributor).
     */
    override fun getAttributeDescriptors(tag: XmlTag?): Array<XmlAttributeDescriptor> {
        if (tag == null || !RozieContextCheck.isRozieContext(tag)) {
            return XmlAttributeDescriptor.EMPTY
        }
        return RozieKnownAttributes.KNOWN_LITERAL_ATTRS
            .map { name -> RozieAttributeDescriptor(name) }
            .toTypedArray()
    }

    /**
     * Returns a non-null [RozieAttributeDescriptor] when `attributeName` either
     *  - matches a literal in [RozieKnownAttributes.KNOWN_LITERAL_ATTRS], OR
     *  - starts with one of the four Rozie sigil prefixes (`r-`, `@`, `:`, `#`).
     *
     * Returns null otherwise (so HTML's existing attribute-validation pipeline
     * keeps flagging genuinely unknown attribute names — we only widen
     * recognition for the Rozie carve-outs).
     *
     * Short-circuits on `!RozieContextCheck.isRozieContext(tag)` so the
     * carve-out does NOT leak into non-Rozie `.html` files anywhere else in
     * the user's project (08.2-RESEARCH Pitfall 2 + threat T-08.2-03).
     */
    override fun getAttributeDescriptor(
        attributeName: String,
        tag: XmlTag?,
    ): XmlAttributeDescriptor? {
        if (tag == null || !RozieContextCheck.isRozieContext(tag)) return null
        return when {
            RozieKnownAttributes.KNOWN_LITERAL_ATTRS.contains(attributeName) ->
                RozieAttributeDescriptor(attributeName)
            attributeName.startsWith("r-") -> RozieAttributeDescriptor(attributeName)
            attributeName.startsWith("@") -> RozieAttributeDescriptor(attributeName)
            attributeName.startsWith(":") -> RozieAttributeDescriptor(attributeName)
            attributeName.startsWith("#") -> RozieAttributeDescriptor(attributeName)
            else -> null
        }
    }
}
