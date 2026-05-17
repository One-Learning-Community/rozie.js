package js.rozie.intellij.inspection

import com.intellij.codeInspection.InspectionSuppressor
import com.intellij.codeInspection.SuppressQuickFix
import com.intellij.psi.PsiElement

/**
 * RED-stage stub for Plan 08.2-09 — to be replaced by the real per-block
 * dispatch implementation in the GREEN commit. Returns false unconditionally
 * so the positive `testStyleUnusedSelectorsAreSuppressed` test FAILS as required
 * by the TDD RED gate.
 */
class RozieCssInspectionSuppressor : InspectionSuppressor {
    override fun isSuppressedFor(element: PsiElement, toolId: String): Boolean = false

    override fun getSuppressActions(element: PsiElement?, toolId: String): Array<SuppressQuickFix> =
        SuppressQuickFix.EMPTY_ARRAY
}
