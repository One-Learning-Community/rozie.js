package js.rozie.intellij.editor

import com.intellij.codeInsight.template.TemplateActionContext
import com.intellij.codeInsight.template.TemplateContextType
import js.rozie.intellij.xml.RozieContextCheck

/**
 * Live-template context for `.rozie` files. Gates the bundled Rozie snippet set
 * (`resources/liveTemplates/Rozie.xml`) so the SFC-scaffolding templates
 * (`rcomponent`, `rtemplate`, `rscript`, …) are offered only inside `.rozie`
 * files and never pollute the user's other files.
 *
 * The context id (`ROZIE`) lives on the `<liveTemplateContext>` EP in
 * plugin.xml; the no-id `TemplateContextType(presentableName)` constructor is
 * the platform-current form on both the 2024.2.5 and 2025.3 floors.
 */
class RozieTemplateContextType : TemplateContextType("Rozie") {

    override fun isInContext(templateActionContext: TemplateActionContext): Boolean =
        RozieContextCheck.isRozieContext(templateActionContext.file)
}
