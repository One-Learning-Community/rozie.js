package js.rozie.intellij

import com.intellij.testFramework.fixtures.BasePlatformTestCase

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
 *   - r- / @ / : attribute values (per D-09)              -> JavaScriptLanguage injection
 *   - HTML inspections do NOT flag r-, @ or `:` attributes as unknown (SC-4 carve-out)
 *
 * Note: [BasePlatformTestCase] descends from JUnit 3's `TestCase`; method names
 * must begin with `test` to be picked up by Gradle's runner (JUnit 4 `@Test`
 * annotations are ignored on JUnit-3-style classes — Rule 1 bug fix).
 */
class RozieInjectionTest : BasePlatformTestCase() {
    override fun getTestDataPath(): String = "src/test/testData/injection"

    fun testPlaceholderUntilPlan04InjectorLands() {
        // Intentionally empty — Plan 04 will populate.
        // Until then this keeps BasePlatformTestCase loadable so `./gradlew test`
        // exercises the platform-test-framework wiring end to end.
    }
}
