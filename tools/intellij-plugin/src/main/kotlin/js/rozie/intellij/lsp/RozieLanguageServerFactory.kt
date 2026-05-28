package js.rozie.intellij.lsp

import com.intellij.openapi.project.Project
import com.redhat.devtools.lsp4ij.LanguageServerEnablementSupport
import com.redhat.devtools.lsp4ij.LanguageServerFactory
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

    override fun isEnabled(project: Project): Boolean =
        RozieLanguageServerProvider.resolveServerScript() != null

    override fun setEnabled(enabled: Boolean, project: Project) {
        // Enablement is derived purely from server-script resolvability; there
        // is no user-toggled persisted state to store.
    }
}
