package js.rozie.intellij.inspection

import com.intellij.codeInspection.InspectionSuppressor
import com.intellij.codeInspection.SuppressQuickFix
import com.intellij.psi.PsiElement

/**
 * RED-STAGE STUB (TDD): real implementation lands in the GREEN commit.
 *
 * `isSuppressedFor` returns `false` unconditionally so the contract tests in
 * [js.rozie.intellij.RozieJSInspectionSuppressorTest] FAIL until the proper
 * per-block dispatch + RozieContextCheck guard are wired in.
 */
class RozieJSInspectionSuppressor : InspectionSuppressor {

    override fun isSuppressedFor(element: PsiElement, toolId: String): Boolean = false

    override fun getSuppressActions(element: PsiElement?, toolId: String): Array<SuppressQuickFix> =
        SuppressQuickFix.EMPTY_ARRAY
}
