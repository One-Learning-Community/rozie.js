package js.rozie.intellij.parser

import com.intellij.extapi.psi.PsiFileBase
import com.intellij.openapi.fileTypes.FileType
import com.intellij.psi.FileViewProvider
import js.rozie.intellij.RozieFileType
import js.rozie.intellij.RozieLanguage

/**
 * Root PSI element for `.rozie` files.
 *
 * Empirical A4 finding (Plan 04 Task 3 diagnostic): the IntelliJ Platform's
 * `MultiHostInjector` dispatcher does NOT walk to `PsiFile` itself when looking
 * for injection hosts — it only visits intermediate composite PSI elements.
 * Making `RozieFile` directly a `PsiLanguageInjectionHost` was therefore
 * insufficient: even though the host class matched `elementsToInjectIn`, the
 * dispatcher never ran our injector with the file as host.
 *
 * Fix: a single composite [RozieRootBlock] element nested under the file holds the
 * `PsiLanguageInjectionHost` interface and serves as the injection target. See
 * [RozieParserDefinition] for the parse-time wrapping.
 */
class RozieFile(viewProvider: FileViewProvider) :
    PsiFileBase(viewProvider, RozieLanguage) {

    override fun getFileType(): FileType = RozieFileType

    override fun toString(): String = "Rozie File"
}
