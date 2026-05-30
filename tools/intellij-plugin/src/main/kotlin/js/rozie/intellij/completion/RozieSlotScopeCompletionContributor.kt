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
import com.intellij.psi.xml.XmlAttributeValue
import com.intellij.psi.xml.XmlTag
import com.intellij.util.ProcessingContext
import js.rozie.intellij.xml.RozieComponentRegistry
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Slot-scope parameter autocomplete — typing inside a slot-fill scope binding
 * `<template #header="{ <caret> }">` offers the scope props the producer's
 * matching `<slot name="header" :close :title>` exposes (`close`, `title`).
 *
 * Unlike the bound `:class` value, a `#slot="…"` value is NOT injected as JS
 * (the per-expression injector only handles `r-*` / `@` / `:` / `{{ }}`), so the
 * caret sits in plain HTML attribute-value PSI — a `language="HTML"` contributor
 * with direct [XmlTag] access, no injected-fragment gymnastics.
 *
 * The owning component is the [XmlTag] bearing the `#slot` (when it's the
 * component tag directly, e.g. `<Modal #header="…">`) or its parent tag (the
 * common `<template #header>` inside `<Modal>` form). Resolution then mirrors
 * [RozieComponentAttributeCompletionContributor]: match the component name
 * against the consumer's `<components>` imports and read the producer's slot via
 * [RozieProducerSurface.slotProps].
 *
 * Native because LSP4IJ completion doesn't reach injected HTML carets; VS Code
 * gets the same from the LSP brain.
 */
class RozieSlotScopeCompletionContributor : CompletionContributor() {

    init {
        extend(
            CompletionType.BASIC,
            PlatformPatterns.psiElement().inside(XmlAttributeValue::class.java),
            object : CompletionProvider<CompletionParameters>() {
                override fun addCompletions(
                    parameters: CompletionParameters,
                    context: ProcessingContext,
                    result: CompletionResultSet,
                ) {
                    val pos = parameters.position
                    if (!RozieContextCheck.isRozieContext(pos)) return

                    val attr = PsiTreeUtil.getParentOfType(pos, XmlAttribute::class.java) ?: return
                    if (!attr.name.startsWith("#")) return
                    val slotName = attr.name.removePrefix("#").ifEmpty { "default" }

                    val ownerTag = PsiTreeUtil.getParentOfType(pos, XmlTag::class.java) ?: return
                    val componentTag = if (ownerTag.name.equals("template", ignoreCase = true)) {
                        PsiTreeUtil.getParentOfType(ownerTag, XmlTag::class.java) ?: return
                    } else {
                        ownerTag
                    }

                    val host = InjectedLanguageManager.getInstance(pos.project)
                        .getTopLevelFile(pos.containingFile) ?: return
                    val componentName = RozieComponentRegistry.declaredComponentImports(host).keys
                        .firstOrNull { it.equals(componentTag.name, ignoreCase = true) } ?: return

                    val props = RozieProducerSurface.slotProps(host, componentName, slotName)
                    if (props.isEmpty()) return

                    // Narrow the prefix to the identifier under the caret —
                    // the destructure is `{ a, b<caret> }`, so split off the
                    // braces / commas / whitespace the platform includes.
                    val word = result.prefixMatcher.prefix
                        .replace('{', ' ').replace(',', ' ').replace('}', ' ')
                        .substringAfterLast(' ').trim()
                    val rs = result.withPrefixMatcher(word)
                    for (name in props) {
                        rs.addElement(LookupElementBuilder.create(name).withTypeText("slot prop"))
                    }
                }
            },
        )
    }
}
