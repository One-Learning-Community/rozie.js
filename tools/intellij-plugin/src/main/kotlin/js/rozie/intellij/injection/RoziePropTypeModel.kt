package js.rozie.intellij.injection

/**
 * Derives a TypeScript object-type literal for `$props` from the raw `<props>`
 * block body, so the JS resolver inside `.rozie` injections types `$props.title`
 * as `string` rather than the prop DESCRIPTOR object `{ type: String }`.
 *
 * Used by [RozieMultiHostInjector] to specialise the generic
 * `declare const $props: any;` line of `rozie-globals.d.ts` into a per-file
 * `declare const $props: { title: string; open: boolean };` (Strategy-B prefix).
 *
 * The mapping mirrors the Vue/Rozie prop-descriptor convention:
 *   - `title: { type: String, default: '' }`  → `title: string`
 *   - `open:  { type: Boolean }`               → `open: boolean`
 *   - `tags:  { type: Array }`                 → `tags: unknown[]`
 *   - `kind:  { type: [String, Number] }`      → `kind: string | number`
 *   - `label: String`  (shorthand)            → `label: string`
 * Anything it can't confidently map degrades to `any` for that key — never wrong,
 * at worst uninformative.
 */
internal object RoziePropTypeModel {

    /**
     * Build the TS object-type literal (e.g. `{ title: string; open: boolean }`)
     * for [propsBody] — the raw `<props>` block text including its outer braces.
     * Returns null when the body is absent or declares no keys, so the caller can
     * keep the generic `any` typing.
     */
    fun propsObjectType(propsBody: String?): String? {
        if (propsBody == null) return null
        val entries = topLevelEntries(propsBody)
        if (entries.isEmpty()) return null
        return entries.joinToString(prefix = "{ ", separator = "; ", postfix = " }") { (key, value) ->
            "$key: ${tsTypeOf(value)}"
        }
    }

    /** Map a prop's declared value (descriptor or shorthand) to a TS type. */
    private fun tsTypeOf(valueText: String): String {
        val v = valueText.trim()
        if (v.startsWith("{")) {
            // Descriptor form — read its `type:` member; fall back to any.
            val typeToken = topLevelEntries(v).firstOrNull { it.first == "type" }?.second
                ?: return "any"
            return mapTypeToken(typeToken)
        }
        // Shorthand form: the value itself is the constructor token (`String`).
        return mapTypeToken(v)
    }

    private fun mapTypeToken(token: String): String {
        val t = token.trim()
        if (t.startsWith("[")) {
            val inner = t.removePrefix("[").substringBeforeLast(']')
            val parts = inner.split(',').map { mapScalar(it.trim()) }.filter { it.isNotEmpty() }
            return if (parts.isEmpty()) "any" else parts.distinct().joinToString(" | ")
        }
        return mapScalar(t)
    }

    private fun mapScalar(token: String): String = when (token) {
        "String" -> "string"
        "Number" -> "number"
        "Boolean" -> "boolean"
        "Array" -> "unknown[]"
        "Object" -> "Record<string, unknown>"
        "Function" -> "(...args: unknown[]) => unknown"
        "Date" -> "Date"
        "Symbol" -> "symbol"
        else -> "any"
    }

    /**
     * Parse the top-level `key: value` entries of a JS object-literal [body]
     * (including its outer braces). Tracks `{}` / `[]` / `()` nesting and skips
     * string / comment spans so commas inside nested structures or default
     * factories (`() => []`) never split an entry. Returns each key paired with
     * its raw (untrimmed) value text.
     */
    private fun topLevelEntries(body: String): List<Pair<String, String>> {
        val out = ArrayList<Pair<String, String>>()
        var depth = 0
        var i = 0
        var atKeyPosition = false
        while (i < body.length) {
            val c = body[i]
            when {
                c == '\'' || c == '"' || c == '`' -> { i = skipString(body, i) }
                c == '/' && i + 1 < body.length && body[i + 1] == '/' -> {
                    while (i < body.length && body[i] != '\n') i++
                }
                c == '/' && i + 1 < body.length && body[i + 1] == '*' -> {
                    i += 2
                    while (i + 1 < body.length && !(body[i] == '*' && body[i + 1] == '/')) i++
                    if (i + 1 < body.length) i += 2
                }
                c == '{' || c == '[' || c == '(' -> { depth++; atKeyPosition = (c == '{' && depth == 1); i++ }
                c == '}' || c == ']' || c == ')' -> { depth--; atKeyPosition = false; i++ }
                c == ',' -> { atKeyPosition = (depth == 1); i++ }
                c.isWhitespace() -> i++
                atKeyPosition && (c.isLetter() || c == '_' || c == '$') -> {
                    val start = i
                    while (i < body.length && (body[i].isLetterOrDigit() || body[i] == '_' || body[i] == '$')) i++
                    val key = body.substring(start, i)
                    var j = i
                    while (j < body.length && body[j].isWhitespace()) j++
                    if (j < body.length && body[j] == ':') {
                        val valueStart = j + 1
                        val valueEnd = scanValueEnd(body, valueStart)
                        out.add(key to body.substring(valueStart, valueEnd))
                        i = valueEnd
                    }
                    atKeyPosition = false
                }
                else -> { atKeyPosition = false; i++ }
            }
        }
        return out
    }

    /** Index just past a string starting at [start] (its opening quote). */
    private fun skipString(body: String, start: Int): Int {
        val quote = body[start]
        var i = start + 1
        while (i < body.length) {
            val sc = body[i]
            if (sc == '\\') { i += 2; continue }
            if (sc == quote) return i + 1
            i++
        }
        return i
    }

    /**
     * Scan from a value's first char to the end of that value — the next
     * depth-1 `,` or the closing `}` of the enclosing object — honoring nested
     * brackets and string / comment spans.
     */
    private fun scanValueEnd(body: String, start: Int): Int {
        var depth = 0
        var i = start
        while (i < body.length) {
            val c = body[i]
            when {
                c == '\'' || c == '"' || c == '`' -> { i = skipString(body, i) }
                c == '/' && i + 1 < body.length && body[i + 1] == '/' -> {
                    while (i < body.length && body[i] != '\n') i++
                }
                c == '/' && i + 1 < body.length && body[i + 1] == '*' -> {
                    i += 2
                    while (i + 1 < body.length && !(body[i] == '*' && body[i + 1] == '/')) i++
                    if (i + 1 < body.length) i += 2
                }
                c == '{' || c == '[' || c == '(' -> { depth++; i++ }
                (c == '}' || c == ']' || c == ')') && depth == 0 -> return i // closing of enclosing object
                c == '}' || c == ']' || c == ')' -> { depth--; i++ }
                c == ',' && depth == 0 -> return i
                else -> i++
            }
        }
        return i
    }
}
