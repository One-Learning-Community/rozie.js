package js.rozie.intellij

import com.intellij.psi.tree.IElementType
import js.rozie.intellij.lexer.RozieTokenTypes
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * D-07 drift check: every Rozie-specific TextMate scope (any `name` value
 * containing `.rozie` in `tools/textmate/syntaxes/rozie.tmLanguage.json`)
 * must map to a [RozieTokenTypes] [IElementType]. Adding a TM scope without
 * adding a corresponding entry to [scopeToTokenType] (and emitting that
 * IElementType from `Rozie.flex`) will cause this test to fail in CI.
 *
 * Conversely, every key in [scopeToTokenType] must actually appear in the TM
 * JSON — catches typos and stale rows that nothing in the grammar references.
 *
 * The TM JSON path is supplied via the `rozie.tmGrammarPath` system property
 * (set in `build.gradle.kts` `tasks.test` per Pitfall 10) so the test resolves
 * the file regardless of Gradle's working directory.
 *
 * Several mappings are intentional folds — multiple TM scopes that decompose
 * one TM range into begin/separator/end captures collapse onto a single host
 * IElementType, because the host lexer emits the entire span as one token.
 * Each fold is documented inline.
 */
class TextMateGrammarParityTest {
    private val tmGrammarPath: String =
        System.getProperty("rozie.tmGrammarPath")
            ?: error(
                "rozie.tmGrammarPath system property not set; check build.gradle.kts " +
                    "tasks.test block (Pitfall 10)"
            )

    /**
     * One row per Rozie-specific TextMate scope. RHS may be `null` for scopes
     * the host lexer deliberately ignores (none today; reserved for future).
     */
    private val scopeToTokenType: Map<String, IElementType?> = mapOf(
        // --- Block-tag entity names (one TM scope per block kind) ---
        "entity.name.tag.rozie.wrapper" to RozieTokenTypes.ROZIE_BLOCK_TAG,
        "entity.name.tag.rozie.block.template" to RozieTokenTypes.TEMPLATE_BLOCK_TAG,
        "entity.name.tag.rozie.block.script" to RozieTokenTypes.SCRIPT_BLOCK_TAG,
        "entity.name.tag.rozie.block.props" to RozieTokenTypes.PROPS_BLOCK_TAG,
        "entity.name.tag.rozie.block.data" to RozieTokenTypes.DATA_BLOCK_TAG,
        "entity.name.tag.rozie.block.listeners" to RozieTokenTypes.LISTENERS_BLOCK_TAG,
        "entity.name.tag.rozie.block.style" to RozieTokenTypes.STYLE_BLOCK_TAG,

        // --- Tag punctuation ---
        // The host lexer folds the leading `<` (and `</`) into the BLOCK_TAG /
        // CLOSE_TAG token rather than emitting a separate punctuation token —
        // both TM scopes for `<` map onto the same family.
        "punctuation.definition.tag.begin.rozie" to RozieTokenTypes.ROZIE_BLOCK_TAG,
        "punctuation.definition.tag.end.rozie" to RozieTokenTypes.GT,

        // --- Lang attribute (<style lang="scss">) ---
        "entity.other.attribute-name.lang.rozie" to RozieTokenTypes.LANG_ATTR_NAME,
        // <style scoped> — generic boolean attribute; host emits ATTR_NAME.
        "entity.other.attribute-name.scoped.rozie" to RozieTokenTypes.ATTR_NAME,
        "punctuation.separator.key-value.rozie" to RozieTokenTypes.EQ,
        "string.quoted.rozie" to RozieTokenTypes.LANG_ATTR_VALUE,

        // --- ref attribute ---
        "string.quoted.double.rozie" to RozieTokenTypes.ATTR_VALUE_PLAIN,
        // The TM grammar splits the value-string into begin/end punctuation;
        // the host lexer keeps the whole value as a single ATTR_VALUE_* token.
        "punctuation.definition.string.begin.rozie" to RozieTokenTypes.ATTR_VALUE_PLAIN,
        "punctuation.definition.string.end.rozie" to RozieTokenTypes.ATTR_VALUE_PLAIN,

        // --- Directives (r-if / r-for / r-model / ...) ---
        "entity.other.attribute-name.directive.rozie" to RozieTokenTypes.R_DIRECTIVE,
        // Embedded JS expression inside r-* / @ / : / ref attribute values
        // is emitted by the host as ATTR_VALUE_JS chunks (Plan 04 JS-injects).
        "meta.embedded.expression.rozie" to RozieTokenTypes.ATTR_VALUE_JS,

        // --- Event bindings (@click) ---
        "punctuation.definition.event.rozie" to RozieTokenTypes.EVENT_AT,
        "entity.name.function.event.rozie" to RozieTokenTypes.EVENT_NAME,

        // --- Modifiers (.stop, .outside(...), ...) ---
        // The TM `meta.modifier-chain.rozie` is a container for the whole chain;
        // the host's IN_MODIFIER_CHAIN state emits MODIFIER_NAME for each name
        // segment.
        "meta.modifier-chain.rozie" to RozieTokenTypes.MODIFIER_NAME,
        "punctuation.separator.modifier.rozie" to RozieTokenTypes.MODIFIER_DOT,
        "support.function.modifier.rozie" to RozieTokenTypes.MODIFIER_NAME,
        "punctuation.section.arguments.begin.rozie" to RozieTokenTypes.MODIFIER_LPAREN,
        "punctuation.section.arguments.end.rozie" to RozieTokenTypes.MODIFIER_RPAREN,

        // --- Prop bindings (:prop="...") ---
        "punctuation.definition.prop-binding.rozie" to RozieTokenTypes.PROP_COLON,
        "entity.other.attribute-name.prop-binding.rozie" to RozieTokenTypes.PROP_NAME,

        // --- ref attribute (ref="...") ---
        "entity.other.attribute-name.rozie-ref" to RozieTokenTypes.REF_ATTR_NAME,
        // The TM scope `keyword.other.rozie` is co-emitted alongside the
        // `entity.other.attribute-name.rozie-ref` in a multi-scope `name`
        // (e.g., `"entity.other.attribute-name.rozie-ref keyword.other.rozie"`);
        // both fold onto REF_ATTR_NAME on the host side.
        "keyword.other.rozie" to RozieTokenTypes.REF_ATTR_NAME,
        "entity.name.tag.reference.rozie" to RozieTokenTypes.ATTR_VALUE_PLAIN,

        // --- Mustache interpolation ({{ }}) ---
        "punctuation.section.embedded.begin.rozie" to RozieTokenTypes.MUSTACHE_OPEN,
        "punctuation.section.embedded.end.rozie" to RozieTokenTypes.MUSTACHE_CLOSE,

        // --- Magic identifiers ($props, $data, ...) ---
        // TM uses a multi-scope `variable.language.rozie support.variable.rozie`;
        // both fold onto MAGIC_IDENT on the host side.
        "variable.language.rozie" to RozieTokenTypes.MAGIC_IDENT,
        "support.variable.rozie" to RozieTokenTypes.MAGIC_IDENT,

        // --- Block-body content scopes ---
        // These are TM `contentName` scopes (not `name`), applied to the body
        // region of each block kind. Map onto the corresponding *_BODY tokens.
        "meta.embedded.block.template.rozie" to RozieTokenTypes.TEMPLATE_BODY,
        "meta.embedded.block.script.rozie" to RozieTokenTypes.SCRIPT_BODY,
        "meta.embedded.block.props.rozie" to RozieTokenTypes.PROPS_BODY,
        "meta.embedded.block.data.rozie" to RozieTokenTypes.DATA_BODY,
        "meta.embedded.block.listeners.rozie" to RozieTokenTypes.LISTENERS_BODY,
        "meta.embedded.block.style.rozie" to RozieTokenTypes.STYLE_BODY
    )

    @Test
    fun `TM grammar file is reachable`() {
        val tmFile = File(tmGrammarPath)
        assertTrue(
            "TM grammar not found at $tmGrammarPath — verify Pitfall 10 fix in build.gradle.kts",
            tmFile.exists()
        )
        val json = JSONObject(tmFile.readText())
        assertEquals("Rozie", json.getString("name"))
    }

    @Test
    fun `every Rozie-specific TM scope maps to a RozieTokenTypes IElementType`() {
        val tmFile = File(tmGrammarPath)
        val json = JSONObject(tmFile.readText())
        val tmScopes = mutableSetOf<String>()
        collectAllNames(json, tmScopes)
        val rozieScopes = tmScopes.filter { it.contains(".rozie") }
        val unmapped = rozieScopes.filter { it !in scopeToTokenType }
        assertTrue(
            "TM grammar has Rozie-specific scopes without RozieTokenTypes mappings (D-07 drift): " +
                "$unmapped. Either add the scope to scopeToTokenType in this test " +
                "(and update Rozie.flex / RozieTokenTypes if the host lexer needs to emit a new " +
                "IElementType) or remove the scope from rozie.tmLanguage.json.",
            unmapped.isEmpty()
        )
        // Belt and braces: also assert no value is null (every scope maps to
        // something — null entries would mean "intentionally ignored", a
        // future-reserved escape hatch with no current users).
        val nullMapped = scopeToTokenType.filterValues { it == null }.keys
        assertTrue(
            "scopeToTokenType has null entries (no current users for the null-allowed escape hatch): " +
                "$nullMapped",
            nullMapped.isEmpty()
        )
    }

    @Test
    fun `no orphan IElementType-to-scope mappings`() {
        val tmFile = File(tmGrammarPath)
        val json = JSONObject(tmFile.readText())
        val tmScopes = mutableSetOf<String>()
        collectAllNames(json, tmScopes)
        val orphans = scopeToTokenType.keys.filter { it !in tmScopes }
        assertTrue(
            "scopeToTokenType references TM scopes that don't exist in rozie.tmLanguage.json: " +
                "$orphans. Remove the stale row, or add the scope to the TM grammar.",
            orphans.isEmpty()
        )
    }

    /**
     * Recursively walk the TM JSON tree, accumulating every `name` and
     * `contentName` field value into [out]. Multi-scope strings
     * (space-separated, like `"string.quoted.rozie punctuation.definition.string.begin.rozie"`)
     * are split into individual scope tokens so each one can be matched.
     *
     * `contentName` is included because TM uses it to scope the *content
     * region* of begin/end constructs (e.g. `meta.embedded.expression.rozie`
     * applied to the substring inside `r-if="..."`); the host lexer's
     * ATTR_VALUE_JS token is the IElementType counterpart.
     *
     * Plain recursion (rather than a Kotlin `sequence { yield() }` builder)
     * avoids pulling in `kotlin.coroutines.jvm.internal.*` classes that the
     * IntelliJ Platform test classpath ships at a different version, which
     * surfaces as `NoClassDefFoundError: SpillingKt` at test runtime.
     */
    private fun collectAllNames(json: Any?, out: MutableSet<String>) {
        when (json) {
            is JSONObject -> {
                for (scopeField in arrayOf("name", "contentName")) {
                    if (json.has(scopeField)) {
                        val value = json.opt(scopeField)
                        if (value is String) {
                            value.split(" ")
                                .filter { it.isNotBlank() }
                                .forEach { out.add(it) }
                        }
                    }
                }
                for (key in json.keys()) {
                    collectAllNames(json.opt(key), out)
                }
            }

            is JSONArray -> {
                for (i in 0 until json.length()) {
                    collectAllNames(json.opt(i), out)
                }
            }
            // Other leaf types — no nested names.
        }
    }
}
