package js.rozie.intellij.xml

import com.intellij.psi.PsiElement
import com.intellij.psi.xml.XmlTag
import com.intellij.xml.impl.schema.AnyXmlElementDescriptor

/**
 * Permissive [com.intellij.xml.XmlElementDescriptor] for Rozie PascalCase
 * component references (e.g. `<Modal>`, `<Counter>`, `<CardHeader>`) inside
 * the HTMLLanguage PSI injected into `<template>` bodies of `.rozie` files.
 *
 * v0.2.0 ambition: descriptor *existence* is sufficient to silence the HTML
 * "Unknown HTML tag" inspection for any PascalCase identifier in Rozie
 * context. Accepts any attribute and any child element (inherited from
 * [AnyXmlElementDescriptor]'s permissive content model — matches the
 * behavior of the JFlex `{PASCAL_IDENT}` rule that just retired in Plan 01,
 * which also performed zero per-tag validation).
 *
 * v0.3.0 will narrow this — the descriptor will only be returned for
 * components actually declared in the `<components>` block, and
 * [getDeclaration] will then point at the declaration site so Go-to-
 * Declaration jumps to the import line. For v0.2.0 there is no per-component
 * declaration site yet (the `<components>` block is not yet symbol-indexed),
 * so [getDeclaration] MUST return `null`. Returning the tag itself would
 * self-loop Go-to-Declaration back to the use site — strictly worse than
 * "no declaration found" (plan-checker B-3).
 *
 * Pitfall 7 acceptance note (RESEARCH lines 864–871): [AnyXmlElementDescriptor]
 * lives under `com.intellij.xml.impl.schema` — semi-internal package. Angular's
 * `AngularJSTagDescriptorsProvider` has used this exact import for ~10 years
 * with no incident. If a future platform refactor breaks the import, the
 * compile error is loud and the fix is mechanical.
 *
 * Cited: 08.2-RESEARCH Pattern 3 prose (lines 458–470), Plan 03 Behavior 1-5.
 */
class RozieComponentElementDescriptor(
    private val tag: XmlTag,
) : AnyXmlElementDescriptor(null, null) {

    /** Reports the actual PascalCase identifier (e.g. "Modal", "Counter"). */
    override fun getName(): String = tag.name

    /** Qualified-name overload — same value; Rozie has no namespacing. */
    override fun getName(context: PsiElement?): String = tag.name

    /**
     * Returns null in v0.2.0 — there is no per-component declaration site yet,
     * and returning [tag] would self-loop Go-to-Declaration back to the use
     * site. The platform falls through to other reference providers when this
     * is null (including the future `RozieJSReferenceContributor` from Plan 05
     * if it ever gets registered for XML hosts).
     *
     * v0.3.0: narrow to components actually declared in the `<components>`
     * block; return the declaration-site PsiElement here.
     */
    override fun getDeclaration(): PsiElement? = null
}
