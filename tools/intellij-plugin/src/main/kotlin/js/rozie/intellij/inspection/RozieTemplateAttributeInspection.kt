package js.rozie.intellij.inspection

import com.intellij.codeInspection.LocalInspectionTool
import com.intellij.codeInspection.LocalQuickFix
import com.intellij.codeInspection.ProblemDescriptor
import com.intellij.codeInspection.ProblemsHolder
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiElementVisitor
import com.intellij.psi.XmlElementVisitor
import com.intellij.psi.xml.XmlAttribute
import js.rozie.intellij.xml.RozieContextCheck
import js.rozie.intellij.xml.RozieKnownAttributes
import js.rozie.intellij.xml.RozieModifiers

/**
 * Flags typo'd Rozie template attributes inside `.rozie` `<template>` blocks:
 *
 *  - an `r-*` attribute whose directive is not one of the 13 known directives
 *    (`r-fi` → "Unknown Rozie directive 'r-fi'"),
 *  - a `.modifier` chain segment on an `@event` / `r-on:event` / `r-model`
 *    attribute that is not a known modifier (`@click.stpo` → "Unknown Rozie
 *    modifier 'stpo'").
 *
 * When a close known name exists (Levenshtein distance ≤ 2) a [RenameAttributeFix]
 * quick-fix is offered.
 *
 * Registered for `language="HTML"` — the [XmlAttribute] PSI lives in the
 * injected `<template>` fragment. The visitor short-circuits on
 * `!RozieContextCheck.isRozieContext` (Pitfall 2) so the inspection stays
 * inert in non-Rozie `.html` files.
 *
 * Scope note: this validates attribute *spelling* only. Semantic checks that
 * need cross-block analysis — e.g. assigning to a non-`model` prop — are left
 * to the compiler.
 */
class RozieTemplateAttributeInspection : LocalInspectionTool() {

    override fun buildVisitor(holder: ProblemsHolder, isOnTheFly: Boolean): PsiElementVisitor =
        object : XmlElementVisitor() {
            override fun visitXmlAttribute(attribute: XmlAttribute) {
                if (!RozieContextCheck.isRozieContext(attribute)) return
                inspect(attribute, holder)
            }
        }

    private fun inspect(attribute: XmlAttribute, holder: ProblemsHolder) {
        val name = attribute.name

        // --- unknown r-* directive ---
        if (name.startsWith("r-") && name.length > 2) {
            val directive = name.takeWhile { it != ':' && it != '.' }
            if (directive !in RozieKnownAttributes.R_DIRECTIVES) {
                val suggestion = closest(directive, RozieKnownAttributes.R_DIRECTIVES)
                val fix = suggestion?.let {
                    RenameAttributeFix(it + name.substring(directive.length), "Change to '$it'")
                }
                holder.registerProblem(
                    attribute,
                    TextRange(0, directive.length),
                    "Unknown Rozie directive '$directive'",
                    *listOfNotNull(fix).toTypedArray(),
                )
            }
        }

        // --- unknown modifier in the .modifier chain ---
        val firstDot = name.indexOf('.')
        if (firstDot < 0) return
        val valid: Set<String> = when {
            name.startsWith("@") || name.startsWith("r-on:") -> EVENT_MODIFIERS
            name.startsWith("r-model") -> MODEL_MODIFIERS
            else -> return // other directives carry no modifier chain we validate
        }
        for (modifier in RozieModifiers.parseModifierNames(name.substring(firstDot))) {
            if (modifier in valid) continue
            val at = name.indexOf(".$modifier")
            if (at < 0) continue
            val suggestion = closest(modifier, valid.toList())
            val fix = suggestion?.let {
                RenameAttributeFix(
                    name.replaceFirst(".$modifier", ".$it"),
                    "Change to '.$it'",
                )
            }
            holder.registerProblem(
                attribute,
                TextRange(at + 1, at + 1 + modifier.length),
                "Unknown Rozie modifier '$modifier'",
                *listOfNotNull(fix).toTypedArray(),
            )
        }
    }

    /** Quick-fix: replace the attribute name with a corrected spelling. */
    private class RenameAttributeFix(
        private val newName: String,
        private val presentableName: String,
    ) : LocalQuickFix {
        override fun getFamilyName(): String = "Rename Rozie attribute"
        override fun getName(): String = presentableName
        override fun applyFix(project: Project, descriptor: ProblemDescriptor) {
            (descriptor.psiElement as? XmlAttribute)?.setName(newName)
        }
    }

    companion object {
        private val EVENT_MODIFIERS: Set<String> =
            (RozieModifiers.EVENT_MODIFIERS + RozieModifiers.KEY_FILTERS).toSet()
        private val MODEL_MODIFIERS: Set<String> = RozieModifiers.MODEL_MODIFIERS.toSet()

        /**
         * Closest [candidates] entry to [token] by Levenshtein distance —
         * returned only when the distance is a plausible typo (1–2 edits), so
         * an unrelated name does not get a misleading "did you mean" fix.
         */
        private fun closest(token: String, candidates: List<String>): String? {
            var best: String? = null
            var bestDist = Int.MAX_VALUE
            for (candidate in candidates) {
                val d = levenshtein(token, candidate)
                if (d < bestDist) {
                    bestDist = d
                    best = candidate
                }
            }
            return if (bestDist in 1..2) best else null
        }

        private fun levenshtein(a: String, b: String): Int {
            val prev = IntArray(b.length + 1) { it }
            val cur = IntArray(b.length + 1)
            for (i in 1..a.length) {
                cur[0] = i
                for (j in 1..b.length) {
                    val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                    cur[j] = minOf(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
                }
                System.arraycopy(cur, 0, prev, 0, cur.size)
            }
            return prev[b.length]
        }
    }
}
