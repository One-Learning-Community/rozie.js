package js.rozie.intellij.xml

import com.intellij.codeInsight.lookup.LookupElement
import com.intellij.psi.html.HtmlTag
import com.intellij.psi.impl.source.xml.XmlElementDescriptorProvider
import com.intellij.psi.xml.XmlTag
import com.intellij.xml.XmlElementDescriptor
import com.intellij.xml.XmlTagNameProvider
import com.intellij.xml.util.XmlUtil

/**
 * Recognises Rozie PascalCase component references (e.g. `<Modal>`, `<Counter>`,
 * `<CardHeader>`) as valid XML tags inside the HTMLLanguage PSI injected into
 * `<template>` bodies of `.rozie` files. After this provider lands, IntelliJ's
 * "HtmlUnknownTag" inspection no longer flags those tag names.
 *
 * Implements BOTH [XmlTagNameProvider] (autocomplete suggestions) AND
 * [XmlElementDescriptorProvider] (tag-existence recognition for inspections)
 * in a single class — mirrors Angular's `AngularJSTagDescriptorsProvider`
 * precedent (one class, two `<xml.*>` plugin.xml entries pointing at the
 * same FQN). RESEARCH Pattern 3 (lines 419–476) + Key Finding 11.
 *
 * v0.2.0 ambition: [addTagNameVariants] is a no-op per RESEARCH Open Question
 * 3 — the CompletionContributor in Plan 06 will handle prefix-typed completion;
 * v0.3.0 will mine the `<components>` block here for ranked autocomplete.
 * [getDescriptor] is the load-bearing piece — it returns a permissive
 * [RozieComponentElementDescriptor] for any PascalCase-named tag in Rozie
 * context, silencing the "Unknown HTML tag" inspection.
 *
 * Both methods short-circuit on `!RozieContextCheck.isRozieContext(tag)` per
 * RESEARCH Pitfall 2 + threat T-08.2-05 to avoid contaminating non-Rozie
 * `.html` files anywhere else in the user's project.
 *
 * Pitfall 7 acceptance note (RESEARCH lines 864–871): [XmlElementDescriptorProvider]
 * lives under `com.intellij.psi.impl.source.xml` — semi-internal package.
 * Angular has used the same import for ~10 years with no incident.
 */
class RozieComponentTagProvider : XmlTagNameProvider, XmlElementDescriptorProvider {

    /**
     * v0.2.0: no-op. The CompletionContributor scheduled for Plan 06 will
     * handle prefix-typed completion in HTML attribute / tag positions. The
     * platform still surfaces tag-names already present in the host file via
     * its own index even without anything added here.
     *
     * TODO(v0.3.0): mine the `<components>` block from the host PSI and add
     * one [LookupElement] per declared PascalCase import. Requires a host-PSI
     * walk from the injected fragment + per-file caching to avoid quadratic
     * cost on every keystroke.
     */
    override fun addTagNameVariants(
        elements: MutableList<LookupElement>,
        tag: XmlTag,
        prefix: String?,
    ) {
        if (tag !is HtmlTag || !RozieContextCheck.isRozieContext(tag)) return
        // intentional no-op for v0.2.0 — see TODO above.
    }

    /**
     * Returns a non-null [RozieComponentElementDescriptor] iff:
     *  1. The tag is an HTML PSI tag ([HtmlTag] subtype — we don't handle raw
     *     XML hosts because Rozie injection only targets HTMLLanguage), AND
     *  2. The enclosing top-level file is a `.rozie` file (Pitfall 2 guard
     *     via [RozieContextCheck]), AND
     *  3. The tag name is NOT already defined by an XML namespace
     *     ([XmlUtil.isTagDefinedByNamespace] — Angular's pattern; namespaced
     *     tags get descriptors from their namespace, not us), AND
     *  4. The tag name starts with an uppercase letter (PascalCase
     *     component-reference convention; matches the JFlex `{PASCAL_IDENT}`
     *     rule that just retired in Plan 01).
     *
     * Returns null otherwise — lowercase tags fall through to HTML's stock
     * descriptors (which carry real validation + completion data); non-Rozie
     * files get null so the Rozie carve-out doesn't leak.
     */
    override fun getDescriptor(tag: XmlTag): XmlElementDescriptor? {
        if (tag !is HtmlTag || !RozieContextCheck.isRozieContext(tag)) return null
        if (XmlUtil.isTagDefinedByNamespace(tag)) return null
        val name = tag.name
        if (name.isEmpty() || !name[0].isUpperCase()) return null
        return RozieComponentElementDescriptor(tag)
    }
}
