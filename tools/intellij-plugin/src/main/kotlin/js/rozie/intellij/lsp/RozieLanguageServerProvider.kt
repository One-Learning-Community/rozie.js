package js.rozie.intellij.lsp

import com.intellij.execution.configurations.GeneralCommandLine
import com.intellij.openapi.diagnostic.logger
import com.redhat.devtools.lsp4ij.server.OSProcessStreamConnectionProvider
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * Spawns the shared `@rozie/language-server` (the Option-C brain) as
 * `node server-standalone.cjs --stdio`. LSP4IJ pipes the connection; the server
 * publishes `@rozie/core` diagnostics (ROZ codes) for `.rozie` host files.
 *
 * The server script is resolved lazily and may be absent (no bundle, no
 * override) — [RozieLanguageServerFactory] gates on
 * [resolveServerScript] via LanguageServerEnablementSupport so the server is
 * simply *disabled* when unresolvable, rather than failing loudly. That keeps
 * headless tests and the server-less CI plugin build quiet.
 */
class RozieLanguageServerProvider : OSProcessStreamConnectionProvider() {

    init {
        val script = resolveServerScript()
        if (script != null) {
            setCommandLine(GeneralCommandLine(resolveNodeExe(), script.absolutePath, "--stdio"))
        }
    }

    companion object {
        private val LOG = logger<RozieLanguageServerProvider>()

        /** Standalone bundle path within the plugin's classpath resources. */
        private const val BUNDLED_RESOURCE = "/language-server/server-standalone.cjs"

        @Volatile private var extractionAttempted = false
        @Volatile private var extractedServer: File? = null

        /**
         * Resolve the Node script for the language server, or null when
         * unavailable. Order:
         *   1. explicit override — system property `rozie.languageServer.path`
         *      or env `ROZIE_LANGUAGE_SERVER` (monorepo dev: point at
         *      `packages/language-server/dist-standalone/server-standalone.cjs`);
         *   2. the standalone bundle shipped in plugin resources (zero-config,
         *      once a release build copies it in);
         *   3. null → the server is disabled.
         */
        fun resolveServerScript(): File? {
            val override = System.getProperty("rozie.languageServer.path")
                ?: System.getenv("ROZIE_LANGUAGE_SERVER")
            if (!override.isNullOrBlank()) {
                val file = File(override)
                if (file.isFile) return file
                LOG.warn("rozie.languageServer.path / ROZIE_LANGUAGE_SERVER='$override' is not a file; ignoring.")
            }
            return extractBundledServer()
        }

        /** The Node executable: override via `rozie.node.path` / `ROZIE_NODE`, else PATH `node`. */
        fun resolveNodeExe(): String =
            System.getProperty("rozie.node.path")
                ?: System.getenv("ROZIE_NODE")
                ?: "node"

        /**
         * Extract the bundled standalone server to a temp file once (it's a
         * multi-MB resource). Returns null when the resource is absent — the
         * case for the CI-built plugin, which ships without the Node bundle.
         */
        private fun extractBundledServer(): File? {
            if (extractionAttempted) return extractedServer
            synchronized(this) {
                if (extractionAttempted) return extractedServer
                extractionAttempted = true
                val stream = RozieLanguageServerProvider::class.java
                    .getResourceAsStream(BUNDLED_RESOURCE) ?: return null
                extractedServer = stream.use { input ->
                    val target = File(
                        System.getProperty("java.io.tmpdir"),
                        "rozie-language-server/server-standalone.cjs",
                    )
                    target.parentFile?.mkdirs()
                    Files.copy(input, target.toPath(), StandardCopyOption.REPLACE_EXISTING)
                    target
                }
                return extractedServer
            }
        }
    }
}
