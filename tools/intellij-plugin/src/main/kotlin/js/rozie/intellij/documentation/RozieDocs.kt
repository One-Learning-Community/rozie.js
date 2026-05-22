package js.rozie.intellij.documentation

import com.intellij.lang.documentation.DocumentationMarkup
import js.rozie.intellij.xml.RozieModifiers

/**
 * Static documentation content for Rozie template constructs — `r-*`
 * directives, `@event` / `r-on` listeners, `:prop` bindings, `#slot` fills,
 * `ref`, and the `.modifier` chain — plus the renderer that turns an HTML
 * attribute name into a Quick-Doc HTML body.
 *
 * Consumed by [RozieAttributeDocumentationProvider]. The `$`-magic-identifier
 * docs are NOT here: those ride the JSDoc comments on `rozie-globals.d.ts`,
 * which the JS resolver already surfaces on Ctrl-Q via the synthetic ambient
 * declarations.
 */
object RozieDocs {

    private val DIRECTIVE_DOCS: Map<String, String> = mapOf(
        "r-if" to
            "Conditionally render the element. When the expression is falsy " +
            "the element and its subtree are removed from the DOM.",
        "r-else-if" to
            "Else-if branch. Renders when its expression is truthy and every " +
            "preceding <code>r-if</code> / <code>r-else-if</code> in the chain " +
            "was falsy. Must immediately follow an <code>r-if</code> or " +
            "<code>r-else-if</code> element.",
        "r-else" to
            "Else branch. Renders when every preceding <code>r-if</code> / " +
            "<code>r-else-if</code> in the chain was falsy. Must immediately " +
            "follow an <code>r-if</code> or <code>r-else-if</code> element.",
        "r-for" to
            "Repeat the element for each item of an iterable. Syntax: " +
            "<code>r-for=\"item in items\"</code> or " +
            "<code>r-for=\"(item, index) in items\"</code>.",
        "r-show" to
            "Toggle the element's visibility via the CSS <code>display</code> " +
            "property. Unlike <code>r-if</code> the element stays in the DOM.",
        "r-model" to
            "Two-way binding between a form control and reactive state. " +
            "Modifiers: <code>.lazy</code>, <code>.number</code>, " +
            "<code>.trim</code>. The consumer form <code>r-model:propName</code> " +
            "binds a child component's model prop.",
        "r-html" to
            "Set the element's <code>innerHTML</code> to the expression value. " +
            "The content is not compiled — use only with trusted input.",
        "r-text" to
            "Set the element's <code>textContent</code> to the expression value.",
        "r-bind" to
            "Object spread — bind an object of attributes onto an element. " +
            "<code>r-bind=\"obj\"</code> spreads every key of <code>obj</code> " +
            "as an attribute on this element. Object form only — there is no " +
            "<code>r-bind:attr</code> colon form (use the <code>:attr</code> " +
            "shorthand for single named bindings). <code>r-bind=\"\$attrs\"</code> " +
            "manually lands the consumer-passed attribute cluster (typically " +
            "paired with <code>&lt;rozie inherit-attrs=\"false\"&gt;</code>).",
        "r-on" to
            "Attach an event listener. Usually written in the shorthand form " +
            "<code>@event</code>. Supports modifier chains.",
        "r-match" to
            "Switch-style conditional. The <code>r-match</code> expression is " +
            "compared against each child <code>r-case</code>; the first match " +
            "renders.",
        "r-case" to
            "A branch of an <code>r-match</code> switch. Renders when its value " +
            "equals the enclosing <code>r-match</code> expression.",
        "r-default" to
            "The fallback branch of an <code>r-match</code> switch. Renders " +
            "when no <code>r-case</code> matched.",
    )

    private const val EVENT_BINDING_DOC =
        "Event listener — binds a handler expression to a DOM event. Append " +
        "modifiers with a dotted chain: <code>.stop</code>, " +
        "<code>.prevent</code>, <code>.debounce(300)</code>, or a key filter " +
        "such as <code>.enter</code>."

    private const val PROP_BIND_DOC =
        "Property / attribute binding — bind a single named attribute or DOM " +
        "property to an expression value. For an object-spread of multiple " +
        "attributes, use <code>r-bind=\"obj\"</code>."

    private const val SLOT_FILL_DOC =
        "Named slot fill — provides content for the component slot of this name."

    private const val REF_DOC =
        "Element reference — registers the element in <code>\$refs</code> " +
        "under the given name."

    private val MODIFIER_DOCS: Map<String, String> = mapOf(
        // Event composition modifiers.
        "stop" to "Call <code>event.stopPropagation()</code>.",
        "prevent" to "Call <code>event.preventDefault()</code>.",
        "self" to
            "Fire only when <code>event.target</code> is the element itself, " +
            "not a descendant.",
        "capture" to "Add the listener in the capture phase.",
        "once" to "Remove the listener after it fires once.",
        "passive" to
            "Mark the listener passive — it cannot call " +
            "<code>preventDefault()</code>; improves scroll performance.",
        "outside" to
            "Fire only when the event originates outside the element. Accepts " +
            "an optional ref / selector argument.",
        "debounce" to
            "Delay the handler until activity stops. Takes a delay in ms — " +
            "<code>.debounce(300)</code>.",
        "throttle" to
            "Run the handler at most once per interval. Takes an interval in " +
            "ms — <code>.throttle(300)</code>.",
        // Key / button filters.
        "enter" to "Fire only on the Enter key.",
        "escape" to "Fire only on the Esc key.",
        "tab" to "Fire only on the Tab key.",
        "delete" to "Fire only on the Delete / Backspace key.",
        "space" to "Fire only on the Space key.",
        "up" to "Fire only on the ArrowUp key.",
        "down" to "Fire only on the ArrowDown key.",
        "left" to
            "Fire only on the ArrowLeft key (or, on pointer events, the left " +
            "mouse button).",
        "right" to
            "Fire only on the ArrowRight key (or, on pointer events, the right " +
            "mouse button).",
        "home" to "Fire only on the Home key.",
        "end" to "Fire only on the End key.",
        "pageUp" to "Fire only on the PageUp key.",
        "pageDown" to "Fire only on the PageDown key.",
        "middle" to "Fire only on the middle mouse button.",
        // r-model modifiers.
        "lazy" to
            "<code>r-model</code> modifier — sync on the <code>change</code> " +
            "event instead of <code>input</code>.",
        "number" to
            "<code>r-model</code> modifier — cast the bound value to a number.",
        "trim" to
            "<code>r-model</code> modifier — trim leading / trailing whitespace " +
            "from the bound value.",
    )

    /**
     * Quick-Doc HTML body for a template attribute [name], or `null` when
     * [name] is not a recognised Rozie construct (so the platform falls
     * through to its own providers).
     */
    fun attributeDoc(name: String): String? {
        val (head, body) = resolve(name) ?: return null
        val modifiers = modifierSection(name)
        return DocumentationMarkup.DEFINITION_START + head + DocumentationMarkup.DEFINITION_END +
            DocumentationMarkup.CONTENT_START + body + modifiers + DocumentationMarkup.CONTENT_END
    }

    /** Short single-line hover text for [name], or `null` if unrecognised. */
    fun attributeQuickInfo(name: String): String? {
        val (head, body) = resolve(name) ?: return null
        val firstSentence = body.substringBefore(". ").substringBefore('.') + "."
        return "<code>$head</code> — $firstSentence"
    }

    /**
     * Map an attribute [name] to its `(headerLabel, descriptionHtml)` pair, or
     * `null` if it is not a Rozie construct. The header label is the full
     * attribute name as authored; the description documents the directive /
     * sigil family.
     */
    private fun resolve(name: String): Pair<String, String>? = when {
        name.startsWith("@") -> name to EVENT_BINDING_DOC
        name.startsWith("r-on:") -> name to EVENT_BINDING_DOC
        name.startsWith("r-") -> {
            val directive = name.takeWhile { it != ':' && it != '.' }
            DIRECTIVE_DOCS[directive]?.let { name to it }
        }
        name.startsWith(":") -> name to PROP_BIND_DOC
        name.startsWith("#") -> name to SLOT_FILL_DOC
        name == "ref" -> name to REF_DOC
        else -> null
    }

    /**
     * Render the `<b>Modifiers</b>` list for any `.modifier` chain in [name],
     * or the empty string when the name carries no modifiers.
     */
    private fun modifierSection(name: String): String {
        val firstDot = name.indexOf('.')
        if (firstDot < 0) return ""
        val modifiers = RozieModifiers.parseModifierNames(name.substring(firstDot))
        if (modifiers.isEmpty()) return ""
        val items = modifiers.joinToString("") { modifier ->
            val doc = MODIFIER_DOCS[modifier] ?: "Modifier."
            "<li><code>.$modifier</code> — $doc</li>"
        }
        return "<p><b>Modifiers</b></p><ul>$items</ul>"
    }
}
