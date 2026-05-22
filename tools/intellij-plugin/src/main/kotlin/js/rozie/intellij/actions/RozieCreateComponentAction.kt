package js.rozie.intellij.actions

import com.intellij.ide.actions.CreateFileFromTemplateAction
import com.intellij.ide.actions.CreateFileFromTemplateDialog
import com.intellij.ide.fileTemplates.FileTemplateManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.psi.PsiDirectory
import com.intellij.psi.PsiFile
import js.rozie.intellij.RozieIcons

/**
 * "New > Rozie Component" action — creates a `.rozie` single-file component
 * pre-filled with the skeleton in
 * `resources/fileTemplates/internal/Rozie Component.ft`. The Velocity
 * `${NAME}` placeholder is filled from the file name the author types, so a
 * `Button.rozie` file opens with `<rozie name="Button">`.
 *
 * Registered into the platform `NewGroup` action group (see plugin.xml).
 */
class RozieCreateComponentAction :
    CreateFileFromTemplateAction(
        "Rozie Component",
        "Creates a new Rozie single-file component",
        RozieIcons.FILE,
    ),
    DumbAware {

    override fun buildDialog(
        project: Project,
        directory: PsiDirectory,
        builder: CreateFileFromTemplateDialog.Builder,
    ) {
        builder
            .setTitle("New Rozie Component")
            .addKind("Rozie component", RozieIcons.FILE, TEMPLATE_NAME)
    }

    override fun getActionName(
        directory: PsiDirectory,
        newName: String,
        templateName: String,
    ): String = "Create Rozie Component"

    /**
     * Force the `.rozie` extension so the created file is recognised as a
     * Rozie file regardless of whether the author typed the extension. The
     * template carries no extension of its own — the content is purely the
     * SFC skeleton.
     */
    override fun createFile(name: String, templateName: String, dir: PsiDirectory): PsiFile? {
        val fileName = if (name.endsWith(".rozie")) name else "$name.rozie"
        val template = FileTemplateManager.getInstance(dir.project).getInternalTemplate(templateName)
        return createFileFromTemplate(fileName, template, dir)
    }

    private companion object {
        const val TEMPLATE_NAME = "Rozie Component"
    }
}
