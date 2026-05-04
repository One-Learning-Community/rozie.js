package js.rozie.intellij

import com.intellij.lang.Language

/**
 * Rozie language descriptor.
 *
 * Note: extends plain [Language] (NOT `JSLanguageDialect`) because Rozie's `<script>`
 * body is plain JS injected via `MultiHostInjector` — this is the MDX pattern, not the
 * Astro pattern (RESEARCH.md Pattern 1).
 */
object RozieLanguage : Language("Rozie")
