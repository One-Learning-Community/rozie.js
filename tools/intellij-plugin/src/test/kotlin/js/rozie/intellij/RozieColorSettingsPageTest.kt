package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import js.rozie.intellij.highlighting.RozieColorSettingsPage
import js.rozie.intellij.highlighting.RozieSyntaxHighlighter

/**
 * Contract test for [RozieColorSettingsPage]: the Annotator-painted template
 * scopes — component reference in particular — are user-customizable (listed as
 * attribute descriptors) and render in the live-preview pane (mapped from demo
 * marker tags).
 *
 * JUnit-3 method-name convention: every test method MUST start with `test`.
 */
class RozieColorSettingsPageTest : BasePlatformTestCase() {

    private val page = RozieColorSettingsPage()

    fun testComponentRefIsACustomizableDescriptor() {
        val keys = page.attributeDescriptors.map { it.key }.toSet()
        assertTrue(
            "Component reference must be customizable in the color settings page",
            RozieSyntaxHighlighter.COMPONENT_REF in keys,
        )
        // The other Annotator-painted template scopes are registered too.
        assertTrue("@event scope", RozieSyntaxHighlighter.EVENT_AT in keys)
        assertTrue(":prop scope", RozieSyntaxHighlighter.PROP_BINDING_NAME in keys)
        assertTrue("#slot scope", RozieSyntaxHighlighter.SLOT_FILL_MARKER in keys)
        assertTrue("ref scope", RozieSyntaxHighlighter.REF_ATTR in keys)
    }

    fun testDemoMarkerTagsAllMapToDescriptors() {
        val map = page.additionalHighlightingTagToDescriptorMap ?: emptyMap()
        assertEquals(
            "Demo `<comp>…</comp>` regions must color as COMPONENT_REF in the preview",
            RozieSyntaxHighlighter.COMPONENT_REF,
            map["comp"],
        )
        // Every marker tag used in the demo text must be in the map, or the
        // settings page throws when rendering the preview.
        val usedTags = Regex("""<([a-z]+)>""").findAll(page.demoText)
            .map { it.groupValues[1] }
            .filter { it in map.keys || it in MARKER_CANDIDATES }
            .toSet()
        for (tag in usedTags) {
            if (tag in MARKER_CANDIDATES) {
                assertTrue("Marker tag <$tag> used in demo but missing from map", tag in map.keys)
            }
        }
    }

    private companion object {
        // The marker-tag vocabulary the demo text may use (distinguishes our
        // highlight markers from incidental lowercase tags like <button>/<template>).
        val MARKER_CANDIDATES = setOf("comp", "magic", "dir", "evt", "prop", "slot", "ref")
    }
}
