package js.rozie.intellij

import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

/**
 * Registers `.rozie` as an IDE-recognized file type bound to [RozieLanguage].
 *
 * Wired into the IDE via the `<fileType>` extension point in plugin.xml; field
 * `INSTANCE` (the singleton object) is referenced by `fieldName="INSTANCE"`.
 */
object RozieFileType : LanguageFileType(RozieLanguage) {
    override fun getName(): String = "Rozie"
    override fun getDescription(): String = "Rozie.js single-file component"
    override fun getDefaultExtension(): String = "rozie"
    override fun getIcon(): Icon = RozieIcons.FILE
}
