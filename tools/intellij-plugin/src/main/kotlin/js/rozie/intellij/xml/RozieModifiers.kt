package js.rozie.intellij.xml

/**
 * Single source of truth for Rozie modifier names — the `.modifier` chain
 * suffixes on `@event` / `r-on:event` listeners and `r-model` bindings.
 *
 * Mirrors the compiler's modifier registry verbatim:
 *  - [EVENT_MODIFIERS] ← `packages/core/src/modifiers/registerBuiltins.ts`
 *  - [KEY_FILTERS]     ← `packages/core/src/modifiers/builtins/keyFilters.ts`
 *                        (`KEY_FILTER_NAMES`)
 *  - [MODEL_MODIFIERS] ← the Phase 12 `lazy` / `number` / `trim` builtins
 *
 * The TextMate grammar matches modifiers by syntactic form only (a generic
 * `.name` / `.name(args)` chain), so this registry — not the grammar — is the
 * IntelliJ-side enumeration. Consumed by
 * [js.rozie.intellij.completion.RozieAttributeNameCompletionContributor] to
 * surface modifier names once the user types a `.` in an event/model
 * attribute name.
 */
object RozieModifiers {
    /**
     * The 9 EVENT composition modifiers — valid on any `@event` /
     * `r-on:event` listener. `debounce` / `throttle` additionally accept a
     * numeric argument (`.debounce(300)`); completion offers the bare name
     * and the author types the `(...)`.
     */
    val EVENT_MODIFIERS: List<String> = listOf(
        "stop", "prevent", "self", "capture", "once", "passive",
        "outside", "debounce", "throttle",
    )

    /**
     * The 14 key/button filter modifiers — offered additionally on keyboard
     * events ([KEYBOARD_EVENTS]). `left` / `right` / `middle` double as
     * mouse-button filters on pointer events; the compiler disambiguates by
     * event name at emit time.
     */
    val KEY_FILTERS: List<String> = listOf(
        "enter", "escape", "tab", "delete", "space",
        "up", "down", "left", "right",
        "home", "end", "pageUp", "pageDown", "middle",
    )

    /**
     * The 3 `r-model` MODEL modifiers (Phase 12) — valid only on `r-model`
     * (and its consumer-side `r-model:propName` argument form).
     */
    val MODEL_MODIFIERS: List<String> = listOf("lazy", "number", "trim")

    /** Keyboard event names that additionally accept [KEY_FILTERS]. */
    private val KEYBOARD_EVENTS: Set<String> = setOf("keydown", "keyup", "keypress")

    /**
     * Modifier names valid for an `@event` / `r-on:event` whose bare event
     * name is [eventName] (no `@` / `r-on:` prefix, no `.` chain). Keyboard
     * events get the key/button filters appended after the composition set.
     */
    fun forEvent(eventName: String): List<String> =
        if (eventName in KEYBOARD_EVENTS) EVENT_MODIFIERS + KEY_FILTERS
        else EVENT_MODIFIERS

    /** Completion-popup type-text label for [modifier] (the bare name). */
    fun typeTextFor(modifier: String): String = when (modifier) {
        in MODEL_MODIFIERS -> "r-model modifier"
        in KEY_FILTERS -> "key filter"
        else -> "event modifier"
    }

    /**
     * Extract the bare modifier names from a modifier chain such as
     * `.outside($refs.x).stop.debounce(300)` → `["outside", "stop", "debounce"]`.
     *
     * Balanced parentheses are skipped, so a `.` inside an argument expression
     * (e.g. `$refs.x`) does not split a segment — a naive `split('.')` would
     * mis-parse arg-bearing chains. [chain] is expected to begin at the first
     * `.` of the chain; a leading `.` is required for the first modifier to be
     * picked up.
     */
    fun parseModifierNames(chain: String): List<String> {
        val names = ArrayList<String>()
        var i = 0
        while (i < chain.length) {
            if (chain[i] != '.') {
                i++
                continue
            }
            i++ // past the '.'
            val start = i
            while (i < chain.length &&
                (chain[i].isLetterOrDigit() || chain[i] == '-' || chain[i] == '_')
            ) {
                i++
            }
            if (i > start) names.add(chain.substring(start, i))
            // Skip a balanced (...) argument list if one follows the name.
            if (i < chain.length && chain[i] == '(') {
                var depth = 1
                i++
                while (i < chain.length && depth > 0) {
                    when (chain[i]) {
                        '(' -> depth++
                        ')' -> depth--
                    }
                    i++
                }
            }
        }
        return names
    }
}
