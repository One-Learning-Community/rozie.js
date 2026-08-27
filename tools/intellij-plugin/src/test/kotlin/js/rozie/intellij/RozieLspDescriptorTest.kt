package js.rozie.intellij

import com.intellij.platform.lsp.api.LspServerSupportProvider
import com.intellij.testFramework.LightVirtualFile
import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.lsp.RozieLspServerDescriptor
import js.rozie.intellij.lsp.resolveNode
import js.rozie.intellij.lsp.resolveServerScript
import js.rozie.intellij.lsp.startIfResolved
import java.io.File

/**
 * Headless contract test for [js.rozie.intellij.lsp.RozieLspServerSupportProvider]'s
 * resolution and command-line-construction logic — no IDE (`./gradlew runIde`), no
 * real Node process, no environment mutation.
 *
 * Every state exercised here is a state a real user will hit: no server staged, no
 * Node configured, and both present (T-85-14's resolve-everything-or-stay-inert
 * contract). `resolveNode`/`resolveServerScript` take their environment-variable
 * override as an explicit function parameter (defaulting to the real
 * `System.getenv` read in production) specifically so this test can drive every
 * branch with temp-file paths instead of mutating the real process environment —
 * the same override mechanism that makes monorepo dev possible doubles as the
 * test seam.
 *
 * The wire-level behavior of the server itself is covered by the language-server
 * package's own probe (`packages/language-server/src/__tests__/volar/wire.probe.test.ts`);
 * the in-IDE behavior is covered by the human checkpoint in Plan 85-07. This test
 * takes the cheap verdict at this level only (REQ-V5).
 *
 * JUnit-3 method-name convention applies: every test method MUST start with `test`
 * (see RozieInjectionTest.kt for the canonical comment on why).
 */
class RozieLspDescriptorTest : BasePlatformTestCase() {

    // === Behavior 1: file-support filtering ===

    fun testRozieFileIsSupported() {
        val descriptor = RozieLspServerDescriptor(project, "node", "server.mjs")
        assertTrue(descriptor.isSupportedFile(LightVirtualFile("Component.rozie")))
    }

    fun testNonRozieFilesAreNotSupported() {
        val descriptor = RozieLspServerDescriptor(project, "node", "server.mjs")
        assertFalse(descriptor.isSupportedFile(LightVirtualFile("Component.ts")))
        assertFalse(descriptor.isSupportedFile(LightVirtualFile("Component.vue")))
        assertFalse(descriptor.isSupportedFile(LightVirtualFile("Component.html")))
    }

    // === Behavior 2: server script unresolved -> no start, no exception ===

    fun testMissingServerScriptResolvesToNullAndStartsNoServer() {
        val missing = File(tempDir, "does-not-exist.mjs").absolutePath
        assertNull(
            "an override pointed at a path that does not exist must not resolve",
            resolveServerScript(overrideEnv = missing),
        )

        val starter = RecordingServerStarter()
        val rozieFile = LightVirtualFile("Component.rozie")
        // Node resolves fine here (a real, executable placeholder) — the missing
        // server script alone must be enough to keep the gate closed.
        val node = createExecutableFile("node-placeholder")
        startIfResolved(project, rozieFile, starter, node.absolutePath, resolveServerScript(overrideEnv = missing))
        assertFalse("no server should start when the script does not resolve", starter.started)
    }

    // === Behavior 3: Node unresolved (non-executable) -> no start, no exception ===

    fun testNonExecutableNodeResolvesToNullAndStartsNoServer() {
        val script = createRealFile("server.mjs")
        val nonExecutable = File(tempDir, "node-not-executable")
        nonExecutable.writeText("#!/bin/sh\necho not actually executable\n")
        assertTrue(nonExecutable.exists())
        assertFalse(nonExecutable.canExecute())

        assertNull(
            "an override pointed at a non-executable path must not resolve",
            resolveNode(project, overrideEnv = nonExecutable.absolutePath),
        )

        val starter = RecordingServerStarter()
        val rozieFile = LightVirtualFile("Component.rozie")
        startIfResolved(
            project,
            rozieFile,
            starter,
            resolveNode(project, overrideEnv = nonExecutable.absolutePath),
            script,
        )
        assertFalse("no server should start when Node does not resolve", starter.started)
    }

    // === Behavior 4 + 5: both resolved -> correct argv, working directory, charset;
    //                     a path with spaces/shell metacharacters survives as ONE argument ===

    fun testBothResolvedProducesArgvCommandLineNeverShellReparsed() {
        // A directory name containing a space, a semicolon and a `$(...)` shell
        // substitution — if the command line were ever handed to a shell for
        // re-parsing rather than passed as an argv array, this would either
        // split into multiple arguments or attempt command substitution.
        val trickyDir = File(tempDir, "rozie server; \$(echo pwned)")
        trickyDir.mkdirs()
        val script = File(trickyDir, "server-standalone.cjs")
        script.writeText("// fixture\n")
        val node = createExecutableFile("node with spaces")

        val descriptor = RozieLspServerDescriptor(project, node.absolutePath, script.absolutePath)
        val commandLine = descriptor.createCommandLine()

        assertEquals(node.absolutePath, commandLine.exePath)
        val params = commandLine.parametersList.parameters
        assertEquals(2, params.size)
        assertEquals(
            "the tricky script path must arrive as exactly ONE argument, untouched",
            script.absolutePath,
            params[0],
        )
        assertEquals("--stdio", params[1])
        assertEquals(trickyDir.absolutePath, commandLine.workDirectory?.path)
        assertEquals(Charsets.UTF_8, commandLine.charset)

        // And the resolve-everything-or-stay-inert gate DOES start a server when
        // both resolve — the mirror image of behaviors 2 and 3 above.
        val starter = RecordingServerStarter()
        startIfResolved(project, LightVirtualFile("Component.rozie"), starter, node.absolutePath, script.absolutePath)
        assertTrue("a server should start when both Node and the script resolve", starter.started)
    }

    // === Helpers ===

    private fun createRealFile(name: String): String {
        val file = File(tempDir, name)
        file.writeText("// fixture\n")
        return file.absolutePath
    }

    private fun createExecutableFile(name: String): File {
        val file = File(tempDir, name)
        file.writeText("#!/bin/sh\necho fixture\n")
        file.setExecutable(true)
        return file
    }

    private val tempDir: File
        get() = File(project.basePath ?: System.getProperty("java.io.tmpdir")).apply { mkdirs() }

    /**
     * Records whether [ensureServerStarted] was invoked, without ever spawning a
     * real process — the platform only calls it asynchronously when a real LSP
     * session is actually wired up, which this structural test deliberately never
     * triggers.
     */
    private class RecordingServerStarter : LspServerSupportProvider.LspServerStarter {
        var started: Boolean = false
            private set

        override fun ensureServerStarted(descriptor: com.intellij.platform.lsp.api.LspServerDescriptor) {
            started = true
        }
    }
}
