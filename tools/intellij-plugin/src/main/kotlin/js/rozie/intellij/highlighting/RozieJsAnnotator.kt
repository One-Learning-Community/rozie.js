package js.rozie.intellij.highlighting

import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.Annotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.psi.PsiElement
import js.rozie.intellij.completion.RozieMagicIdentifiers
import js.rozie.intellij.xml.RozieContextCheck

/**
 * RESEARCH Open Question 4 resolved Option A — paint every canonical Rozie
 * `$`-magic identifier (`$props`/`$data`/`$refs`/`$emit`/`$computed`/
 * `$onMount`/`$onUnmount`/`$onUpdate`/`$watch`/`$slots`/`$el`/`$portals`/
 * `$classSelector`) with `ROZIE_MAGIC_IDENT` inside any `.rozie`-hosted
 * injected JS. Restores the visual cue that retired from the JFlex side
 * (Plan 01 removed
 * MAGIC_IDENT JFlex emission rules to keep `IN_TEMPLATE_BODY` contiguous —
 * any token-fragmenting carve-out would break HTML injection per Pitfall 1).
 *
 * No template-fragmentation cost — this annotator runs over the JS-injected
 * PSI tree (produced by `RozieMultiHostInjector` for the `<script>`, `<props>`,
 * `<data>`, `<listeners>`, `<components>` blocks and for JS expressions inside
 * attribute values), NOT over the host lexer's token stream.
 *
 * Pitfall 2 mitigation: `language="JavaScript"` fires on every `.js` file in
 * the user's project unless guarded. Every `annotate` body MUST short-circuit
 * on `!RozieContextCheck.isRozieContext(element)`. The shared guard
 * ([RozieContextCheck]) is factored specifically so this check is visible at
 * every site.
 *
 * Dispatch is on top-level [JSReferenceExpression]s (qualifier == null) whose
 * `referenceName` is one of the canonical Rozie magic identifiers
 * ([RozieMagicIdentifiers.NAMES]) — a top-level
 * reference is what matches `$props` in `$props.value` (the receiver), NOT
 * the `.value` member access (which has the `$props` reference as qualifier
 * and thus does not need re-coloring).
 *
 * The `MAGIC_IDENT` TextAttributesKey is REUSED from
 * [RozieSyntaxHighlighter]'s companion — its external name
 * `"ROZIE_MAGIC_IDENT"` is STABLE API per T-8-03-01.
 */
class RozieJsAnnotator : Annotator {

    override fun annotate(element: PsiElement, holder: AnnotationHolder) {
        if (!RozieContextCheck.isRozieContext(element)) return
        if (element !is JSReferenceExpression) return
        // Only paint TOP-LEVEL references (qualifier == null). For `$props.value`,
        // the receiver `$props` is itself a JSReferenceExpression with no
        // qualifier; the `.value` access is a separate JSReferenceExpression
        // whose qualifier IS the `$props` reference — we don't re-paint members.
        if (element.qualifier != null) return
        val name = element.referenceName ?: return
        // Membership set sourced from [RozieMagicIdentifiers] — the same
        // registry the JS completion contributor offers and the
        // `rozie-globals.d.ts` ambient-decl twin mirrors. One source of
        // truth: the painted set cannot drift from the offered set.
        if (name !in RozieMagicIdentifiers.NAMES) return
        holder.newSilentAnnotation(HighlightSeverity.INFORMATION)
            .range(element.textRange)
            .textAttributes(RozieSyntaxHighlighter.MAGIC_IDENT)
            .create()
    }
}
