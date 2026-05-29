package js.rozie.intellij.xml

import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.tree.IElementType
import com.intellij.psi.util.CachedValueProvider
import com.intellij.psi.util.CachedValuesManager
import js.rozie.intellij.lexer.RozieLexerAdapter
import js.rozie.intellij.lexer.RozieTokenTypes

/**
 * File-local registry of PascalCase component names declared inside a `.rozie`
 * file's `<components>` block. Closes the recognition-half of P1-UAT-03
 * (Phase 08.2 Plan 10) — the v0.3.0 ambition originally noted in
 * [RozieComponentTagProvider]'s KDoc lines 46–49 lands here in v0.2.0 gap-closure.
 *
 * Usage:
 *   - [RozieComponentTagProvider.addTagNameVariants] consults this object to
 *     emit one [com.intellij.codeInsight.lookup.LookupElement] per declared
 *     component name (autocomplete in `<template>` tag-position).
 *   - Other extensions (annotators, inspections) can also consult it as a
 *     defensive optimisation, though the v0.2.0 design keeps Plan 03's
 *     permissive any-PascalCase fallback in place — the registry NARROWS
 *     v0.2.0 behavior nowhere, it only ADDS surfaces (autocomplete + future
 *     v0.3.0 narrowing).
 *
 * Extraction strategy: re-lex the host file text via [RozieLexerAdapter] to
 * locate the first [RozieTokenTypes.COMPONENTS_BODY] token (same idiom as
 * [js.rozie.intellij.injection.RozieMultiHostInjector.scanTokens]), then
 * extract the top-level keys from the object-literal body using a small
 * brace-aware / string-aware state machine ([extractTopLevelKeys] below).
 * The state machine skips over single- / double- / template-quoted string
 * spans so a value like `'SomeWord:'` is NOT misread as a declaration key
 * (T-08.2-21 mitigation).
 *
 * Cache: results are wrapped in [CachedValuesManager.getCachedValue] keyed on
 * the file's [com.intellij.psi.util.PsiModificationTracker.MODIFICATION_COUNT]
 * — same shape as [js.rozie.intellij.references.RoziePropsReference] (Pitfall 5
 * mitigation, T-08.2-20). Per-keystroke re-introspection is O(1) amortised
 * within an edit cycle.
 *
 * File-type guard: non-`.rozie` files (e.g. plain `.html`, `.js`) return
 * `emptySet()` immediately so the registry never leaks into the user's
 * non-Rozie source (T-08.2-22 mitigation, mirrors [RozieContextCheck]).
 */
object RozieComponentRegistry {

    /**
     * Returns the set of PascalCase keys declared in [file]'s `<components>`
     * block. Returns `emptySet()` if:
     *   - [file] is not a `.rozie` file, OR
     *   - [file] has no `<components>` block, OR
     *   - the `<components>` block's object literal is empty.
     *
     * Results are cached per [file] modification stamp.
     */
    fun declaredComponents(file: PsiFile): Set<String> {
        // File-type guard — T-08.2-22 mitigation. Mirrors RozieContextCheck's
        // pattern; we use the file-type name rather than instanceof to keep
        // this module free of a hard dependency on the RozieFileType class.
        if (file.fileType.name != "Rozie") return emptySet()

        return CachedValuesManager.getCachedValue(file) {
            CachedValueProvider.Result.create(
                extractTopLevelKeys(componentsBodyText(file.text)),
                file,
            )
        }
    }

    /**
     * Convenience overload: resolves [element]'s containing file via
     * [InjectedLanguageManager.getTopLevelFile] (mirrors [RozieContextCheck]'s
     * pattern) then delegates to [declaredComponents]. Useful when the caller
     * has an injected-fragment [PsiElement] (e.g., an [com.intellij.psi.xml.XmlTag]
     * inside the HTML-injected template body) rather than the host file directly.
     */
    fun declaredComponents(element: PsiElement): Set<String> {
        val containing = element.containingFile ?: return emptySet()
        val project = containing.project
        val host = InjectedLanguageManager.getInstance(project).getTopLevelFile(containing) ?: containing
        return declaredComponents(host)
    }

    /**
     * Map of PascalCase component name → import-path string declared in [file]'s
     * `<components>` block (e.g. `Modal` → `./Modal.rozie`). Returns an empty map
     * under the same conditions as [declaredComponents]. The key set is exactly
     * [declaredComponents]; entries whose value is not a quoted string literal
     * are dropped (a `<components>` value is always an import-path string).
     *
     * Used by cross-file component-tag attribute completion
     * ([js.rozie.intellij.completion.RozieComponentAttributeCompletionContributor])
     * to resolve a consumed `<Modal>` back to its producer `.rozie` source so the
     * producer's real props / emits / slots can be offered — instead of the stock
     * HTML DOM defaults. Results are cached per [file] modification stamp.
     */
    fun declaredComponentImports(file: PsiFile): Map<String, String> {
        if (file.fileType.name != "Rozie") return emptyMap()

        return CachedValuesManager.getCachedValue(file) {
            CachedValueProvider.Result.create(
                extractTopLevelEntries(componentsBodyText(file.text)),
                file,
            )
        }
    }

    /** Injected-fragment overload of [declaredComponentImports]; mirrors [declaredComponents]. */
    fun declaredComponentImports(element: PsiElement): Map<String, String> {
        val containing = element.containingFile ?: return emptyMap()
        val project = containing.project
        val host = InjectedLanguageManager.getInstance(project).getTopLevelFile(containing) ?: containing
        return declaredComponentImports(host)
    }

    /**
     * Walk the host file text via [RozieLexerAdapter] to locate the first
     * [RozieTokenTypes.COMPONENTS_BODY] token; return its substring (raw body
     * text including the surrounding braces / whitespace).
     *
     * Returns `null` when the file has no `<components>` block — the caller
     * treats `null` as `emptySet()`.
     */
    private fun componentsBodyText(text: String): String? =
        blockBodyText(text, RozieTokenTypes.COMPONENTS_BODY)

    /**
     * Walk [text] via [RozieLexerAdapter] and return the raw substring of the
     * first [token]-typed block body (e.g. [RozieTokenTypes.COMPONENTS_BODY] or
     * [RozieTokenTypes.PROPS_BODY]). Returns `null` when no such block exists.
     *
     * Exposed `internal` so cross-file introspection
     * ([js.rozie.intellij.completion.RozieProducerSurface]) can pull the
     * `<props>` body out of a producer file's raw text (which is not necessarily
     * the open editor file) using the same lexer-backed boundary detection.
     */
    internal fun blockBodyText(text: String, token: IElementType): String? {
        val lexer = RozieLexerAdapter().apply { start(text) }
        while (lexer.tokenType != null) {
            if (lexer.tokenType == token) {
                return text.substring(lexer.tokenStart, lexer.tokenEnd)
            }
            lexer.advance()
        }
        return null
    }

    /**
     * Extract the top-level keys from a JS object-literal body. Top-level keys
     * are PascalCase identifiers followed by `:` at brace-depth 1 (just inside
     * the outer `{` of the object literal). Nested-object keys are SKIPPED
     * (they live at brace-depth >= 2). String-quoted spans (single-quoted,
     * double-quoted, template-literal backtick) are SKIPPED so a string value
     * containing `:` is NOT misread (T-08.2-21 mitigation).
     *
     * The state machine is intentionally tiny — it does NOT parse the full JS
     * grammar. It tracks:
     *   - brace depth (only depth==1 keys are extracted)
     *   - whether we're inside a quoted string (and which quote character ends it)
     *   - whether the previous non-whitespace char was `{` or `,` (the only
     *     positions where a key can start)
     */
    internal fun extractTopLevelKeys(body: String?, requireUpper: Boolean = true): Set<String> {
        if (body == null) return emptySet()
        val keys = LinkedHashSet<String>()
        var depth = 0
        var i = 0
        var atKeyPosition = false // True just after `{` or `,` at depth==1
        while (i < body.length) {
            val c = body[i]
            when {
                // String span — skip until matching quote, honoring backslash escapes.
                c == '\'' || c == '"' || c == '`' -> {
                    i++
                    while (i < body.length) {
                        val sc = body[i]
                        if (sc == '\\') { i += 2; continue }
                        if (sc == c) { i++; break }
                        i++
                    }
                }
                // Line comment.
                c == '/' && i + 1 < body.length && body[i + 1] == '/' -> {
                    while (i < body.length && body[i] != '\n') i++
                }
                // Block comment.
                c == '/' && i + 1 < body.length && body[i + 1] == '*' -> {
                    i += 2
                    while (i + 1 < body.length && !(body[i] == '*' && body[i + 1] == '/')) i++
                    if (i + 1 < body.length) i += 2 // consume `*/`
                }
                c == '{' -> {
                    depth++
                    atKeyPosition = (depth == 1)
                    i++
                }
                c == '}' -> {
                    depth--
                    atKeyPosition = false
                    i++
                }
                c == ',' -> {
                    atKeyPosition = (depth == 1)
                    i++
                }
                c.isWhitespace() -> { i++ }
                atKeyPosition && (c.isLetter() || c == '_' || c == '$') && (!requireUpper || c.isUpperCase()) -> {
                    // Identifier-key candidate. `requireUpper` keeps the
                    // `<components>` path PascalCase-only; props/data keys
                    // (camelCase) pass `requireUpper = false`. Scan to end of
                    // identifier.
                    val start = i
                    while (i < body.length) {
                        val ic = body[i]
                        if (ic.isLetterOrDigit() || ic == '_') { i++ } else { break }
                    }
                    val ident = body.substring(start, i)
                    // Skip whitespace, then require a `:` to confirm this is a key.
                    var j = i
                    while (j < body.length && body[j].isWhitespace()) j++
                    if (j < body.length && body[j] == ':') {
                        keys.add(ident)
                        // Advance past the `:` so we don't re-enter atKeyPosition for
                        // the value side.
                        i = j + 1
                    }
                    atKeyPosition = false
                }
                else -> {
                    atKeyPosition = false
                    i++
                }
            }
        }
        return keys
    }

    /**
     * Like [extractTopLevelKeys] but also captures each top-level key's
     * string-literal value (the import path). A `<components>` entry is always
     * `Name: '<path>'`, so we reuse [extractTopLevelKeys] for the robust,
     * brace-/string-aware top-level key detection, then pull each key's quoted
     * value with a targeted regex restricted to those keys — a value that
     * happens to contain `Word: 'x'` therefore can't introduce a phantom entry.
     * Keys without a quoted string value are omitted.
     */
    internal fun extractTopLevelEntries(body: String?): Map<String, String> {
        if (body == null) return emptyMap()
        val topKeys = extractTopLevelKeys(body)
        if (topKeys.isEmpty()) return emptyMap()
        val out = LinkedHashMap<String, String>()
        for (m in ENTRY_REGEX.findAll(body)) {
            val key = m.groupValues[1]
            if (key in topKeys && key !in out) {
                out[key] = m.groupValues[2]
            }
        }
        return out
    }

    /** `Name: 'path'` / `Name: "path"` — PascalCase key bound to a quoted string. */
    private val ENTRY_REGEX = Regex("""([A-Z][A-Za-z0-9_]*)\s*:\s*['"]([^'"]+)['"]""")
}
