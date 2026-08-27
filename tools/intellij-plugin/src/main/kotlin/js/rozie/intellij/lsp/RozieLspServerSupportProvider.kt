package js.rozie.intellij.lsp

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.ide.plugins.PluginManagerCore
import com.intellij.javascript.nodejs.interpreter.NodeJsInterpreterManager
import com.intellij.javascript.nodejs.interpreter.local.NodeJsLocalInterpreter
import com.intellij.openapi.extensions.PluginId
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.platform.lsp.api.ProjectWideLspServerDescriptor
import java.io.File

/**
 * Native platform LSP client for `.rozie` (Phase 85 Plan 04, built on Spike 019's
 * proof — see plugin-status.txt in the spike-findings skill for the patch this
 * file promotes).
 *
 * Replaces the LSP4IJ path (D4/REQ-V2). Spike 017 established that LSP4IJ has no
 * concept of language injection anywhere in its repository, so it can never serve
 * a caret inside an injected fragment — which is where essentially every Rozie
 * semantic feature fires. The native platform API unwraps injections centrally in
 * `LspDocumentMapping.unwrapInjection()`.
 *
 * This mirrors JetBrains' own `VueLspServerSupportProvider`, which registers on
 * the same extension point and points at the Vue language server.
 *
 * Resolve-everything-or-stay-inert (T-85-14): if either the Node interpreter or
 * the server script cannot be resolved, [fileOpened] never starts a server — no
 * exception, no dialog, no blocked IDE startup. This mirrors what the VS Code
 * extension's own `resolveServerModule` already does, and is what keeps the
 * Node-free CI plugin build meaningful.
 */
class RozieLspServerSupportProvider : LspServerSupportProvider {
  override fun fileOpened(
    project: Project,
    file: VirtualFile,
    serverStarter: LspServerSupportProvider.LspServerStarter,
  ) {
    startIfResolved(project, file, serverStarter, resolveNode(project), resolveServerScript())
  }
}

/**
 * The resolve-everything-or-stay-inert gate (T-85-14), factored out from
 * [RozieLspServerSupportProvider.fileOpened] so `RozieLspDescriptorTest` can
 * drive it directly with already-resolved node/script arguments — no real Node
 * process, no IDE, no environment mutation required.
 */
internal fun startIfResolved(
  project: Project,
  file: VirtualFile,
  serverStarter: LspServerSupportProvider.LspServerStarter,
  node: String?,
  serverScript: String?,
) {
  if (file.extension != "rozie" || node == null || serverScript == null) return
  serverStarter.ensureServerStarted(RozieLspServerDescriptor(project, node, serverScript))
}

/**
 * The server script the descriptor should point at, first hit wins:
 *  1. `ROZIE_LSP_SERVER` — an explicit override, validated against the real
 *     filesystem. Set, this is the entire answer (no silent fallback to the
 *     staged bundle below) — this is what makes monorepo dev and the headless
 *     descriptor test possible.
 *  2. the bundle staged inside THIS plugin's own install directory by the
 *     Gradle `bundleLanguageServer` task (T-85-13) — resolved from the
 *     platform's own plugin-install path via [PluginManagerCore], never a
 *     workspace-relative or user-configurable location, so a repository
 *     cannot plant the script the IDE runs.
 *
 * `null` when neither resolves — never a spike path baked into the jar, and
 * never a bare filename relying on inherited PATH.
 */
internal fun resolveServerScript(overrideEnv: String? = System.getenv("ROZIE_LSP_SERVER")): String? {
  if (overrideEnv != null) return overrideEnv.takeIf { File(it).isFile }
  val pluginPath = PluginManagerCore.getPlugin(PluginId.getId("js.rozie"))?.pluginPath ?: return null
  val staged = pluginPath.resolve("language-server").resolve("server-standalone.cjs").toFile()
  return staged.takeIf { it.isFile }?.absolutePath
}

/**
 * The Node interpreter the descriptor should spawn, first hit wins:
 *  1. `ROZIE_LSP_NODE` — an explicit override, validated with [File.canExecute]
 *     (also what makes the headless descriptor test possible without a real
 *     IDE Node-interpreter configuration).
 *  2. the project's own configured Node interpreter (Settings → Languages &
 *     Frameworks → Node.js), narrowed to a **local** interpreter. JetBrains
 *     already solved interpreter discovery across nvm/Homebrew/system/remote
 *     targets and ships the settings UI for it — reimplementing any part of
 *     that (a candidate-path list, a bare `"node"` PATH fallback) is exactly
 *     the hazard this replaces.
 *
 * `null` when neither resolves: no configured interpreter, or a non-local one
 * (WSL/Docker/remote) — never a bare command name relying on inherited PATH.
 */
internal fun resolveNode(project: Project, overrideEnv: String? = System.getenv("ROZIE_LSP_NODE")): String? {
  if (overrideEnv != null) return overrideEnv.takeIf { File(it).canExecute() }
  val interpreter = NodeJsInterpreterManager.getInstance(project).interpreter as? NodeJsLocalInterpreter
  return interpreter?.interpreterSystemDependentPath
}

/**
 * Base class deliberately kept as the spike left it — `ProjectWideLspServerDescriptor`,
 * not the `JSFrameworkLspServerDescriptor` lead RESEARCH.md surfaces. That class was
 * found in one locally-installed platform build and NOT in another across a single
 * minor version, so its availability at this phase's 2026.1 floor is unproven; the
 * simpler descriptor here is already working live (Spike 019) and needs no further
 * validation. Swapping the base class is a future targeted spike's job, not this plan's.
 */
internal class RozieLspServerDescriptor(
  project: Project,
  private val nodePath: String,
  private val serverScript: String,
) : ProjectWideLspServerDescriptor(project, "Rozie") {

  override fun isSupportedFile(file: VirtualFile): Boolean = file.extension == "rozie"

  override fun createCommandLine(): GeneralCommandLine =
    GeneralCommandLine(nodePath, serverScript, "--stdio").apply {
      withWorkDirectory(File(serverScript).parent)
      withCharset(Charsets.UTF_8)
    }
}
