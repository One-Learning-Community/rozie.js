package js.rozie.intellij.inspection

import com.intellij.codeInspection.LocalInspectionTool
import com.intellij.codeInspection.ProblemsHolder
import com.intellij.lang.javascript.psi.JSAssignmentExpression
import com.intellij.lang.javascript.psi.JSDefinitionExpression
import com.intellij.lang.javascript.psi.JSElementVisitor
import com.intellij.lang.javascript.psi.JSExpression
import com.intellij.lang.javascript.psi.JSReferenceExpression
import com.intellij.psi.PsiElementVisitor
import js.rozie.intellij.props.RoziePropsModel
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Flags `$props.<name> = …` assignments inside a `.rozie` file where `<name>`
 * is a declared prop NOT marked `model: true`. Props are read-only — only a
 * `model: true` prop may be written (the compiler lowers that write into the
 * per-target two-way emit). The compiler rejects the same code with ROZ200
 * (`WRITE_TO_NON_MODEL_PROP`); this surfaces it in the editor.
 *
 * Covers every assignment form (`=`, `+=`, `-=`, …) via [JSAssignmentExpression],
 * and fires in any JS-injected block — `<script>`, `<listeners>`, and template
 * `@event` handler expressions alike. Registered for `language="JavaScript"`;
 * the visitor short-circuits on `!RozieContextCheck.isRozieContext` (Pitfall 2)
 * so it stays inert in non-Rozie `.js` files.
 *
 * Scope: a write to a *declared* prop. An assignment to an undeclared
 * `$props.ghost` is left alone — that is an unknown-prop concern (ROZ100),
 * not this inspection's.
 *
 * Prop metadata comes from [RoziePropsModel], resolved once per file pass.
 */
class RoziePropAssignmentInspection : LocalInspectionTool() {

    override fun buildVisitor(holder: ProblemsHolder, isOnTheFly: Boolean): PsiElementVisitor {
        // The <props> block walk is cheap, but there is no reason to repeat it
        // per assignment — resolve the prop set lazily, once per file pass.
        val props by lazy { RoziePropsModel.propsOf(holder.file) }

        return object : JSElementVisitor() {
            override fun visitJSAssignmentExpression(node: JSAssignmentExpression) {
                if (!RozieContextCheck.isRozieContext(node)) return
                val ref = assignmentTarget(node.lOperand) ?: return
                val qualifier = ref.qualifier as? JSReferenceExpression ?: return
                if (qualifier.referenceName != "\$props") return
                val propName = ref.referenceName ?: return

                val prop = props.firstOrNull { it.name == propName } ?: return
                if (prop.isModel) return

                holder.registerProblem(
                    ref,
                    "Cannot assign to prop '$propName' — props are read-only unless " +
                        "declared `model: true` in <props> (compiler error ROZ200).",
                )
            }
        }
    }

    /**
     * The [JSReferenceExpression] being written to — unwrapping the
     * [JSDefinitionExpression] the JS PSI wraps around an assignment target
     * (and tolerating the bare-reference shape).
     */
    private fun assignmentTarget(lOperand: JSExpression?): JSReferenceExpression? = when (lOperand) {
        is JSReferenceExpression -> lOperand
        is JSDefinitionExpression -> lOperand.expression as? JSReferenceExpression
        else -> null
    }
}
