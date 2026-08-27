package js.rozie.intellij.lsp

import com.intellij.openapi.project.Project
import com.intellij.psi.PsiFile
import com.redhat.devtools.lsp4ij.LanguageServerEnablementSupport
import com.redhat.devtools.lsp4ij.LanguageServerFactory
import com.redhat.devtools.lsp4ij.client.features.LSPClientFeatures
import com.redhat.devtools.lsp4ij.client.features.LSPCompletionFeature
import com.redhat.devtools.lsp4ij.client.features.LSPDefinitionFeature
import com.redhat.devtools.lsp4ij.client.features.LSPDocumentSymbolFeature
import com.redhat.devtools.lsp4ij.client.features.LSPHoverFeature
import com.redhat.devtools.lsp4ij.client.features.LSPReferencesFeature
import com.redhat.devtools.lsp4ij.client.features.LSPRenameFeature
import com.redhat.devtools.lsp4ij.server.StreamConnectionProvider

/**
 * LSP4IJ factory wiring the IntelliJ plugin to the shared `@rozie/language-server`
 * (Option C). The server owns the semantic surface — ROZ diagnostics today,
 * cross-block navigation / member-aware completion / rename later — so those
 * features track `@rozie/core` directly instead of being re-implemented in
 * Kotlin.
 *
 * Implements [LanguageServerEnablementSupport]: the server is enabled only when
 * its Node script is resolvable (see [RozieLanguageServerProvider.resolveServerScript]).
 * When it is not — the CI-built plugin ships no bundle, and headless tests set
 * no override — the server stays disabled and never starts, so it cannot log
 * start failures into the test logger or surface errors to users who simply
 * lack the server.
 */
class RozieLanguageServerFactory : LanguageServerFactory, LanguageServerEnablementSupport {

    override fun createConnectionProvider(project: Project): StreamConnectionProvider =
        RozieLanguageServerProvider()

    /**
     * Scope the IntelliJ LSP to **diagnostics only**. Unlike VS Code (no native
     * layer), IntelliJ already serves completion / navigation / find-usages /
     * rename / structure natively over the injected-PSI tree — and crucially,
     * LSP4IJ's caret features do not reach carets *inside* injected fragments
     * (where Rozie's `$props.x`, `<Modal>`, etc. live), so the server's
     * completion/definition/hover/rename never fire there anyway, while its
     * host-level references/documentSymbol merely *duplicate* the native ones
     * (the duplicate Find-Usages hits observed in GUI testing). Disabling those
     * six features leaves diagnostics (the ROZ codes from @rozie/core, the one
     * thing only the server provides) as the LSP's job in IntelliJ. The full
     * LSP surface remains active in VS Code via the language client.
     */
    override fun createClientFeatures(): LSPClientFeatures =
        LSPClientFeatures()
            .setCompletionFeature(object : LSPCompletionFeature() {
                override fun isEnabled(file: PsiFile): Boolean = false
            })
            .setReferencesFeature(object : LSPReferencesFeature() {
                override fun isEnabled(file: PsiFile): Boolean = false
            })
            .setRenameFeature(object : LSPRenameFeature() {
                override fun isEnabled(file: PsiFile): Boolean = false
            })
            .setHoverFeature(object : LSPHoverFeature() {
                override fun isEnabled(file: PsiFile): Boolean = false
            })
            .setDefinitionFeature(object : LSPDefinitionFeature() {
                override fun isEnabled(file: PsiFile): Boolean = false
            })
            .setDocumentSymbolFeature(object : LSPDocumentSymbolFeature() {
                override fun isEnabled(file: PsiFile): Boolean = false
            })

    override fun isEnabled(project: Project): Boolean =
        RozieLanguageServerProvider.resolveServerScript() != null

    override fun setEnabled(enabled: Boolean, project: Project) {
        // Enablement is derived purely from server-script resolvability; there
        // is no user-toggled persisted state to store.
    }
}
