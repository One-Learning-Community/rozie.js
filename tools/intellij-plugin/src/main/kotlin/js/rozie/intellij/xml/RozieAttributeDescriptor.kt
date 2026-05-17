package js.rozie.intellij.xml

import com.intellij.psi.PsiElement
import com.intellij.xml.impl.BasicXmlAttributeDescriptor

/**
 * Minimal [BasicXmlAttributeDescriptor] for Rozie sigil attributes. v0.2.0
 * ambition: descriptor existence is sufficient to silence the HTML "Unknown
 * attribute" inspection — value validation is a v0.3.0 concern.
 *
 * The external name is the literal sigil string (e.g. `r-if`, `@click`,
 * `:disabled`, `#header`, `ref`). [js.rozie.intellij.highlighting.RozieAnnotator]
 * (Plan 03) paints them by NAME pattern, not by descriptor identity, so the
 * descriptor itself stays maximally permissive.
 *
 * A6 risk note (08.2-RESEARCH Assumptions Log): if HTML inspection requires
 * value-validation that this minimal shape doesn't provide,
 * [js.rozie.intellij.inspection.RozieHtmlInspectionSuppressor] (already shipped
 * in Phase 08 and retained per RESEARCH Pitfall 4) catches the residual cases
 * as defense in depth.
 *
 * Override surface mirrors Angular's `createDescriptor` in
 * `org.angularjs.codeInsight.attributes.AngularAttributesRegistry` — ~30 LOC of
 * straight overrides per 08.2-RESEARCH Pattern 2 prose.
 */
class RozieAttributeDescriptor(private val name: String) : BasicXmlAttributeDescriptor() {

    override fun getName(): String = name

    override fun getName(context: PsiElement?): String = name

    override fun init(element: PsiElement?) { /* no-op — descriptor has no init state */ }

    override fun getDeclaration(): PsiElement? = null

    override fun isRequired(): Boolean = false

    override fun isFixed(): Boolean = false

    override fun hasIdType(): Boolean = false

    override fun hasIdRefType(): Boolean = false

    override fun isEnumerated(): Boolean = false

    override fun getEnumeratedValues(): Array<String>? = null

    override fun getDefaultValue(): String? = null

    override fun getDependencies(): Array<Any> = emptyArray()
}
