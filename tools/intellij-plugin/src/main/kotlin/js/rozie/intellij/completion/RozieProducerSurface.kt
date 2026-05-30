package js.rozie.intellij.completion

import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiManager
import js.rozie.intellij.lexer.RozieTokenTypes
import js.rozie.intellij.xml.RozieComponentRegistry

/**
 * The consumer-facing surface of a producer `.rozie` component — the props a
 * consumer may pass, the events it may listen to, and the slots it may fill —
 * resolved by following a consumer's `<components>` import path to the producer
 * file and introspecting it.
 *
 * This is the IntelliJ-native analog of `@rozie/language-server`'s
 * `extractProducerSurface` (`producers.ts`): the LSP serves the same data to VS
 * Code, but LSP4IJ completion does not reach carets inside injected HTML
 * fragments, so component-tag attribute completion must be served natively here
 * (the LSP is scoped diagnostics-only in IntelliJ — see RozieLanguageServerFactory).
 *
 * Extraction is deliberately a lightweight text scan, NOT a cross-file injected
 * PSI walk: the producer is frequently a sibling file the platform hasn't
 * injected, and the three things we need are cheap to recover from raw text —
 *   - props: the top-level keys of the producer's `<props>` block, via
 *     [RozieComponentRegistry.extractTopLevelKeys] on the lexed `<props>` body,
 *   - events: every `$emit('name')` across the whole producer source (events
 *     surface from `<script>`, `<listeners>`, and template handlers alike), and
 *   - slots: every `<slot name="…">` in the producer source.
 * This mirrors the LSP's own approach (`$emit` regex scan + `<slot name>` walk).
 */
object RozieProducerSurface {

    /** Resolved producer surface; empty lists when the producer declares none. */
    data class Surface(
        val props: List<String>,
        val events: List<String>,
        val slots: List<String>,
    )

    /**
     * Resolve [componentName] against [consumerHost]'s `<components>` block,
     * follow the import path to the producer `.rozie` file, and extract its
     * surface. Returns null when the name isn't a registered component, the
     * import path can't be resolved to a real file, or the producer can't be
     * read.
     */
    fun forComponent(consumerHost: PsiFile, componentName: String): Surface? {
        val producerVf = resolveProducerFile(consumerHost, componentName) ?: return null
        // Read via PSI so unsaved edits in an open producer editor are reflected.
        val producerText = PsiManager.getInstance(consumerHost.project).findFile(producerVf)?.text
            ?: return null

        val props = RozieComponentRegistry.extractTopLevelKeys(
            RozieComponentRegistry.blockBodyText(producerText, RozieTokenTypes.PROPS_BODY),
            requireUpper = false, // props/data keys are camelCase, not PascalCase
        ).toList()
        val events = EMIT_CALL.findAll(producerText).map { it.groupValues[1] }.distinct().toList()
        val slots = SLOT_NAME.findAll(producerText).map { it.groupValues[1] }.distinct().toList()
        return Surface(props = props, events = events, slots = slots)
    }

    /**
     * Resolve [componentName] against [consumerHost]'s `<components>` block to the
     * producer `.rozie` [VirtualFile] (no introspection). Shared by [forComponent]
     * and component-tag go-to-definition. Returns null when the name isn't a
     * registered component or its import path can't be resolved to a real file.
     */
    fun resolveProducerFile(consumerHost: PsiFile, componentName: String): VirtualFile? {
        val importPath = RozieComponentRegistry.declaredComponentImports(consumerHost)[componentName]
            ?: return null
        return resolveImportPath(consumerHost, importPath)
    }

    /**
     * Resolve a raw `<components>` import [path] against [consumerHost]'s directory
     * to the target [VirtualFile]. Powers go-to-definition on the import-path
     * string literal itself. `originalFile` unwraps any in-memory copy (whose
     * LightVirtualFile has no real parent) back to the on-disk file.
     */
    fun resolveImportPath(consumerHost: PsiFile, path: String): VirtualFile? {
        val baseDir = consumerHost.originalFile.virtualFile?.parent ?: return null
        return resolveRelative(baseDir, path)
    }

    /**
     * Resolve a relative import [path] (`./Foo.rozie`, `../shared/Bar.rozie`)
     * against [base] by walking the VFS segment-by-segment. Bare specifiers and
     * anything not starting with `./` / `../` / `/` return null (a `<components>`
     * value pointing at a node_modules package isn't a sibling we can introspect).
     */
    private fun resolveRelative(base: VirtualFile, path: String): VirtualFile? {
        if (!path.startsWith("./") && !path.startsWith("../") && !path.startsWith("/")) return null
        var current: VirtualFile? = base
        for (part in path.split('/')) {
            when (part) {
                "", "." -> {}
                ".." -> current = current?.parent
                else -> current = current?.findChild(part)
            }
            if (current == null) return null
        }
        return if (current?.isDirectory == false) current else null
    }

    /** `$emit('name'` / `$emit("name"` — the canonical event declaration. */
    private val EMIT_CALL = Regex("\\\$emit\\(\\s*['\"]([^'\"]+)['\"]")

    /** `<slot name="…">` / `<slot name='…'>` — a named producer slot. */
    private val SLOT_NAME = Regex("<slot\\b[^>]*\\bname\\s*=\\s*[\"']([^\"']+)[\"']")
}
