package js.rozie.intellij.completion

import com.intellij.codeInsight.completion.CompletionContributor
import com.intellij.codeInsight.completion.CompletionParameters
import com.intellij.codeInsight.completion.CompletionProvider
import com.intellij.codeInsight.completion.CompletionResultSet
import com.intellij.codeInsight.completion.CompletionType
import com.intellij.codeInsight.lookup.LookupElementBuilder
import com.intellij.lang.injection.InjectedLanguageManager
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.util.PsiTreeUtil
import com.intellij.psi.xml.XmlAttribute
import com.intellij.psi.xml.XmlTag
import com.intellij.util.ProcessingContext
import js.rozie.intellij.xml.RozieComponentRegistry
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Cross-file `:prop` / `@event` / `#slot` autocomplete on composed-component
 * tags inside a `.rozie` `<template>`. Typing `<Modal :|` offers Modal's REAL
 * props (`:title`, `:open`), `<Modal @|` offers its emits (`@close`), and
 * `<Modal #|` offers its named slots (`#header`, `#footer`) — instead of (well,
 * in addition to) the stock HTML DOM defaults the platform would otherwise show.
 *
 * The producer surface is resolved by [RozieProducerSurface]: follow the
 * consumer's `<components>` import path to the producer `.rozie` file and read
 * its `<props>` keys / `$emit('…')` calls / `<slot name="…">`. This is the
 * IntelliJ-native counterpart of `@rozie/language-server`'s cross-file
 * component-attribute completion (which only reaches VS Code — LSP4IJ
 * completion does not fire inside injected HTML fragments).
 *
 * Registered for `language="HTML"` (the injected `<template>` fragment, NOT the
 * host Rozie PSI) — same rationale as [RozieAttributeNameCompletionContributor].
 * The [RozieContextCheck.isRozieContext] guard keeps it inert in non-Rozie
 * `.html` files.
 *
 * Unlike [RozieMemberCompletionContributor] this does NOT `stopHere()`: a
 * component element still accepts native DOM attributes/events (`class`,
 * `@click`, …), so the producer members are purely ADDITIVE to the stock list.
 */
class RozieComponentAttributeCompletionContributor : CompletionContributor() {

    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement().inside(XmlAttribute::class.java),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet,
                ) {
                    val pos = parameters.position
                    if (!RozieContextCheck.isRozieContext(pos)) return

                    val tag = PsiTreeUtil.getParentOfType(pos, XmlTag::class.java) ?: return
                    val tagName = tag.name
                    if (tagName.isEmpty()) return

                    val host = InjectedLanguageManager.getInstance(pos.project)
                        .getTopLevelFile(pos.containingFile) ?: return

                    // Match the tag against the consumer's <components> keys
                    // (which are always PascalCase). A DOM tag (`<div>`) matches
                    // no key and falls through to stock HTML completion. Matched
                    // case-insensitively defensively — HTML PSI preserves tag case
                    // today, but this stays correct if a platform version lowercases.
                    val componentName = RozieComponentRegistry.declaredComponentImports(host).keys
                        .firstOrNull { it.equals(tagName, ignoreCase = true) } ?: return
                    val surface = RozieProducerSurface.forComponent(host, componentName) ?: return

                    val prefix = result.prefixMatcher.prefix
                    when {
                        prefix.startsWith("@") ->
                            surface.events.forEach { add(result, "@$it", "emit") }
                        prefix.startsWith("#") ->
                            surface.slots.forEach { add(result, "#$it", "slot") }
                        prefix.startsWith(":") ->
                            surface.props.forEach { add(result, ":$it", "prop") }
                        // `r-` is directive territory — owned by
                        // RozieAttributeNameCompletionContributor; don't intrude.
                        prefix.startsWith("r-") -> {}
                        // Empty / plain prefix: offer the props as static (no `:`)
                        // attribute names alongside the r-directive suggestions.
                        else -> surface.props.forEach { add(result, it, "prop") }
                    }
                }
            },
        )
    }

    private companion object {
        fun add(result: CompletionResultSet, name: String, typeText: String) {
            result.addElement(LookupElementBuilder.create(name).bold().withTypeText(typeText))
        }
    }
}
