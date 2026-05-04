package js.rozie.intellij.highlighting

import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.fileTypes.SyntaxHighlighter
import com.intellij.openapi.options.colors.AttributesDescriptor
import com.intellij.openapi.options.colors.ColorDescriptor
import com.intellij.openapi.options.colors.ColorSettingsPage
import js.rozie.intellij.RozieIcons
import java.util.ResourceBundle
import javax.swing.Icon

/**
 * Settings → Editor → Color Scheme → Rozie panel exposing every Rozie token
 * class as a separate user-themable slot (D-06). The live-preview pane
 * renders [getDemoText] through [RozieSyntaxHighlighter] so users can see
 * each color change applied to a real `.rozie` excerpt.
 */
class RozieColorSettingsPage : ColorSettingsPage {

    private val bundle: ResourceBundle = ResourceBundle.getBundle("messages.RozieBundle")
    private fun msg(key: String): String = bundle.getString(key)

    private val descriptors: Array<AttributesDescriptor> = arrayOf(
        AttributesDescriptor(msg("rozie.color.block.tag"), RozieSyntaxHighlighter.BLOCK_TAG),
        AttributesDescriptor(msg("rozie.color.r.directive"), RozieSyntaxHighlighter.R_DIRECTIVE),
        AttributesDescriptor(msg("rozie.color.event.at"), RozieSyntaxHighlighter.EVENT_AT),
        AttributesDescriptor(msg("rozie.color.event.name"), RozieSyntaxHighlighter.EVENT_NAME),
        AttributesDescriptor(msg("rozie.color.modifier"), RozieSyntaxHighlighter.MODIFIER),
        AttributesDescriptor(
            msg("rozie.color.modifier.punctuation"),
            RozieSyntaxHighlighter.MODIFIER_PUNCTUATION
        ),
        AttributesDescriptor(
            msg("rozie.color.prop.binding.punctuation"),
            RozieSyntaxHighlighter.PROP_BINDING_PUNCTUATION
        ),
        AttributesDescriptor(
            msg("rozie.color.prop.binding.name"),
            RozieSyntaxHighlighter.PROP_BINDING_NAME
        ),
        AttributesDescriptor(
            msg("rozie.color.interpolation.delim"),
            RozieSyntaxHighlighter.INTERPOLATION_DELIM
        ),
        AttributesDescriptor(msg("rozie.color.magic.ident"), RozieSyntaxHighlighter.MAGIC_IDENT),
        AttributesDescriptor(msg("rozie.color.ref.attr"), RozieSyntaxHighlighter.REF_ATTR),
        AttributesDescriptor(msg("rozie.color.lang.attr"), RozieSyntaxHighlighter.LANG_ATTR),
        AttributesDescriptor(
            msg("rozie.color.html.attr.name"),
            RozieSyntaxHighlighter.HTML_ATTR_NAME
        ),
        AttributesDescriptor(msg("rozie.color.html.comment"), RozieSyntaxHighlighter.HTML_COMMENT),
        AttributesDescriptor(
            msg("rozie.color.bad.character"),
            RozieSyntaxHighlighter.BAD_CHARACTER
        )
    )

    override fun getAttributeDescriptors(): Array<AttributesDescriptor> = descriptors

    override fun getColorDescriptors(): Array<ColorDescriptor> = ColorDescriptor.EMPTY_ARRAY

    override fun getDisplayName(): String = msg("rozie.color.settings.page.name")

    override fun getIcon(): Icon = RozieIcons.FILE

    override fun getHighlighter(): SyntaxHighlighter = RozieSyntaxHighlighter()

    override fun getAdditionalHighlightingTagToDescriptorMap(): Map<String, TextAttributesKey>? =
        null

    /**
     * Demo `.rozie` snippet shown in the live-preview pane. Exercises every
     * descriptor above so users see the effect of each color tweak.
     *
     * Note on `${'$'}` escaping: Kotlin raw strings still interpret `$` as a
     * template-substitution sigil; we use `${'$'}` to literally emit `$` for
     * Rozie's magic identifiers.
     */
    override fun getDemoText(): String = """
        <!-- Live demo of Rozie syntax highlighting -->
        <rozie name="Counter">
        <props>
        {
          value: { type: Number, default: 0, model: true },
          step: { type: Number, default: 1 }
        }
        </props>

        <data>
        {
          hovering: false
        }
        </data>

        <script>
        const canDecrement = ${'$'}computed(() => ${'$'}props.value > 0)
        ${'$'}onMount(() => {
          console.log("Counter mounted with value", ${'$'}props.value)
        })
        </script>

        <listeners>
        {
          "window:resize.debounce(200)": {
            when: "${'$'}data.hovering",
            handler: "() => { console.log('resize') }"
          }
        }
        </listeners>

        <template>
          <div class="counter counter--{{ ${'$'}props.value > 0 ? 'active' : 'idle' }}"
               ref="root"
               @mouseenter="${'$'}data.hovering = true"
               @mouseleave.stop="${'$'}data.hovering = false">
            <button :disabled="!canDecrement"
                    @click.prevent="${'$'}props.value -= ${'$'}props.step">
              − Decrement
            </button>
            <span r-if="${'$'}props.value !== 0">{{ ${'$'}props.value }}</span>
            <span r-else>Zero</span>
          </div>
        </template>

        <style lang="scss">
        .counter {
          padding: 1rem;
          &--active { color: green; }
        }
        </style>
        </rozie>
    """.trimIndent()
}
