package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.lang.javascript.psi.JSObjectLiteralExpression
import com.intellij.lang.javascript.psi.JSProperty
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiElement
import com.intellij.psi.tree.IElementType
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.util.ProcessingContext
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.parser.RozieRootBlock
import js.rozie.intellij.references.RoziePropsReference
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Descriptor-key + type-token autocomplete inside a `.rozie` `<props>` block —
 * the second authoring convenience after [RozieMemberCompletionContributor]'s
 * `$props.member` access.
 *
 * Two positions are recognised, both confined to the `<props>` injected JS
 * fragment (NOT `<script>`/`<data>`/`<listeners>` — those also inject
 * JavaScript, so the contributor checks the caret's host token is
 * [RozieTokenTypes.PROPS_BODY] before doing anything):
 *
 *   1. **Descriptor-key position** — inside a prop's descriptor object literal
 *      (`title: { <caret> }`), offers the four valid descriptor keys
 *      [DESCRIPTOR_KEYS] (`type`, `default`, `model`, `required`), minus keys
 *      the descriptor already declares. Owns the position (`stopHere`) so stock
 *      JS object-literal noise doesn't flood the popup.
 *   2. **`type:` value position** — `title: { type: <caret> }`, offers the six
 *      recognised type tokens [TYPE_TOKENS] (`String`, `Number`, `Boolean`,
 *      `Array`, `Object`, `Function`). These are real JS globals, so this does
 *      NOT `stopHere` — it just seeds the popup with the Rozie-meaningful subset
 *      ordered first.
 *
 * The valid key/token sets are sourced from the compiler's own `<props>` lowerer
 * (`packages/core/src/ir/lowerers/lowerProps.ts`): it reads exactly `type`,
 * `default`, `model`, and `required`, and `inferTypeAnnotation` recognises the
 * six identifier type tokens (plus `[A, B]` union arrays). Keeping this list in
 * lockstep with the compiler is the DRY contract — there is no `validator` key.
 *
 * Why native (not LSP): same reason as the member contributor — LSP4IJ
 * completion does not reach carets inside injected language fragments, so the
 * IntelliJ LSP is scoped to diagnostics-only.
 */
class RoziePropsDescriptorCompletionContributor : CompletionContributor() {

    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement(),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet,
                ) {
                    val pos = parameters.position
                    if (!RozieContextCheck.isRozieContext(pos)) return
                    // Only inside the <props> block — <script>/<data>/<listeners>
                    // also inject JavaScript, so a bare "in injected JS" check
                    // would leak descriptor keys into plain script object literals.
                    if (!injectedCaretInBlock(pos, parameters.offset, RozieTokenTypes.PROPS_BODY)) return

                    val descriptor = PsiTreeUtil.getParentOfType(pos, JSObjectLiteralExpression::class.java)
                        ?: return
                    // A descriptor object literal is the VALUE of a top-level prop
                    // entry: its parent is a JSProperty whose containing object is
                    // the props root (whose own parent is the paren-wrap, not a
                    // property). The top-level props object itself, and the
                    // `default: { … }` nested objects, are both excluded.
                    if (!isDescriptorObject(descriptor)) return

                    val enclosingProp = PsiTreeUtil.getParentOfType(pos, JSProperty::class.java)
                    val onTypeValue = enclosingProp?.name == "type" &&
                        enclosingProp.value?.let { parameters.offset >= it.textRange.startOffset } == true

                    if (onTypeValue) {
                        // Real JS globals — seed, don't own the position.
                        for (token in TYPE_TOKENS) {
                            result.addElement(
                                LookupElementBuilder.create(token).withTypeText("prop type"),
                            )
                        }
                        return
                    }

                    // Descriptor-key position — offer the keys not already present.
                    val existing = descriptor.properties.mapNotNull { it.name }.toSet()
                    var added = false
                    for ((key, doc) in DESCRIPTOR_KEYS) {
                        if (key in existing) continue
                        result.addElement(
                            LookupElementBuilder.create(key).bold().withTypeText(doc),
                        )
                        added = true
                    }
                    // Own the position only when we actually contributed — a fully
                    // populated descriptor falls through to stock completion.
                    if (added) result.stopHere()
                }
            },
        )
    }

    private companion object {
        /** Descriptor key → type-text doc. Mirrors `lowerProps.ts` recognised keys. */
        val DESCRIPTOR_KEYS: List<Pair<String, String>> = listOf(
            "type" to "prop type token(s)",
            "default" to "default value / factory",
            "model" to "two-way bindable",
            "required" to "required prop",
        )

        /** `type:` value tokens — mirrors `inferTypeAnnotation` in `lowerProps.ts`. */
        val TYPE_TOKENS: List<String> = listOf(
            "String", "Number", "Boolean", "Array", "Object", "Function",
        )

        /**
         * True iff [obj] is a prop's descriptor object — the value of a property
         * on the top-level `<props>` object. The top-level object's parent is the
         * injection's paren-wrap (a non-property), so a descriptor is exactly one
         * `JSProperty` hop below it.
         */
        fun isDescriptorObject(obj: JSObjectLiteralExpression): Boolean {
            val parentProp = obj.parent as? JSProperty ?: return false
            val outer = parentProp.parent as? JSObjectLiteralExpression ?: return false
            return outer.parent !is JSProperty
        }

        /**
         * True iff the injected [pos] (with caret at injected-doc offset
         * [caretInInjected]) maps back to a host range covered by the
         * [token]-typed SFC block body. Reuses [RoziePropsReference]'s
         * lexer-backed block-range detection and the `injectedToHost` mapping.
         */
        fun injectedCaretInBlock(pos: PsiElement, caretInInjected: Int, token: IElementType): Boolean {
            val ilm = InjectedLanguageManager.getInstance(pos.project)
            val host = (ilm.getInjectionHost(pos) as? RozieRootBlock)
                ?: (pos.containingFile?.context as? RozieRootBlock)
                ?: return false
            val hostOffset = ilm.injectedToHost(pos, caretInInjected)
            val range = RoziePropsReference.findBlockBodyRange(host, token) ?: return false
            return range.containsOffset(hostOffset)
        }
    }
}
