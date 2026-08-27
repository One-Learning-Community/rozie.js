package js.rozie.intellij.lsp

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
import java.io.File

/**
 * SPIKE 019 — native platform LSP client for `.rozie`.
 *
 * Replaces the LSP4IJ path. Spike 017 established that LSP4IJ contains no
 * concept of language injection anywhere in its repository, so it can never
 * serve a caret inside an injected fragment (which is where essentially every
 * Rozie semantic feature fires). The native platform API unwraps injections
 * centrally in `LspDocumentMapping.unwrapInjection()`.
 *
 * This mirrors JetBrains' own `VueLspServerSupportProvider`, which registers on
 * the same extension point and points at the Vue language server.
 *
 * Spike-only: the server path is resolved from an env var / hardcoded spike
 * location. Production ships the bundled server inside the plugin distribution.
 */
class RozieLspServerSupportProvider : LspServerSupportProvider {
  override fun fileOpened(
    project: Project,
    file: VirtualFile,
    serverStarter: LspServerSupportProvider.LspServerStarter,
  ) {
    if (file.extension == "rozie" && resolveServerScript() != null) {
      serverStarter.ensureServerStarted(RozieLspServerDescriptor(project))
    }
  }
}

private const val SPIKE_SERVER =
  "/Users/serpentblade/work/olc/rozie/.planning/spikes/019-jetbrains-volar-integration/server.mjs"

private fun resolveServerScript(): String? =
  (System.getenv("ROZIE_LSP_SERVER") ?: SPIKE_SERVER).takeIf { File(it).isFile }

private fun resolveNode(): String =
  System.getenv("ROZIE_LSP_NODE")
    ?: sequenceOf(
      "/Users/serpentblade/.nvm/versions/node/v22.14.0/bin/node",
      "/usr/local/bin/node",
      "/opt/homebrew/bin/node",
    ).firstOrNull { File(it).canExecute() }
    ?: "node"

private class RozieLspServerDescriptor(project: Project) :
  ProjectWideLspServerDescriptor(project, "Rozie") {

  override fun isSupportedFile(file: VirtualFile): Boolean = file.extension == "rozie"

  override fun createCommandLine(): GeneralCommandLine {
    val script = resolveServerScript() ?: error("Rozie language server script not found")
    return GeneralCommandLine(resolveNode(), script, "--stdio").apply {
      withWorkDirectory(File(script).parent)
      withCharset(Charsets.UTF_8)
    }
  }
}
