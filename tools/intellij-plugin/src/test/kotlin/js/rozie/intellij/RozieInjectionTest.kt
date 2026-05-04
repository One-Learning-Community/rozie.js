package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase
import org.junit.Test

/**
 * Wave 0 scaffold for `InjectedLanguageManager`-driven injection smoke tests.
 *
 * Plan 04 will populate this with assertions for:
 *   - `<script>` body  -> JavaScriptLanguage injection
 *   - `<props>` body   -> JavaScriptLanguage injection
 *   - `<data>` body    -> JavaScriptLanguage injection
 *   - `<listeners>` body (whole object literal per D-12) -> JavaScriptLanguage injection
 *   - `<template>` body                                   -> HtmlLanguage injection
 *   - `<style>` body                                      -> CssLanguage injection
 *   - r-* / @ / : attribute values (per D-09)             -> JavaScriptLanguage injection
 *   - HTML inspections do NOT flag r-*/@/: as unknown attributes (SC-4 carve-out)
 */
class RozieInjectionTest : BasePlatformTestCase() {
    override fun getTestDataPath(): String = "src/test/testData/injection"

    @Test
    fun `placeholder until Plan 04 injector lands`() {
        // Intentionally empty — Plan 04 will populate.
        // Until then this keeps BasePlatformTestCase loadable so `./gradlew test`
        // exercises the platform-test-framework wiring end to end.
    }
}
