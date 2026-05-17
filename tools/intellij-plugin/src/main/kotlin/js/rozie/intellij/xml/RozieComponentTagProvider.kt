package js.rozie.intellij.xml

import com.intellij.codeInsight.lookup.LookupElement
import com.intellij.codeInsight.lookup.LookupElementBuilder
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
 * v0.2.0 status (Plan 08.2-10 update): [addTagNameVariants] consults
 * [RozieComponentRegistry] to surface file-local `<components>` declarations
 * as autocomplete [LookupElement]s — the v0.3.0 KDoc-TODO ambition lands in
 * v0.2.0 gap-closure for P1-UAT-03 (recognition half).
 * [getDescriptor] is the load-bearing piece for the "Unknown HTML tag"
 * silencer — it returns a permissive [RozieComponentElementDescriptor] for
 * ANY PascalCase-named tag in Rozie context (Plan 03's permissive fallback
 * is intentionally preserved per the Plan 08.2-10 Decision, so e.g. a
 * just-pasted component that the author has not yet added to the
 * `<components>` block keeps working).
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
     * Surfaces file-local `<components>` declarations as autocomplete
     * [LookupElement]s. Closes the recognition-half of P1-UAT-03 (Plan
     * 08.2-10) — the v0.3.0 KDoc-TODO ambition lands in v0.2.0 gap-closure.
     *
     * Consults [RozieComponentRegistry.declaredComponents] which walks the
     * host file's `<components>` block, extracts PascalCase keys via a
     * brace-aware / string-aware state machine, and caches via
     * [com.intellij.psi.util.CachedValuesManager] keyed on the file
     * modification stamp (T-08.2-20 mitigation — per-keystroke cost is
     * O(1) amortised).
     *
     * Prefix-aware: when [prefix] is non-null, only emits names that
     * start with it (case-insensitive — matches the platform convention
     * for HTML tag completion).
     */
    override fun addTagNameVariants(
        elements: MutableList<LookupElement>,
        tag: XmlTag,
        prefix: String?,
    ) {
        if (tag !is HtmlTag || !RozieContextCheck.isRozieContext(tag)) return
        val declared = RozieComponentRegistry.declaredComponents(tag)
        for (name in declared) {
            if (prefix == null || name.startsWith(prefix, ignoreCase = true)) {
                elements.add(LookupElementBuilder.create(name))
            }
        }
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
