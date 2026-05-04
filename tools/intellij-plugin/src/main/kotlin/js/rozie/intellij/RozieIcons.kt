package js.rozie.intellij

import com.intellij.openapi.util.IconLoader
import javax.swing.Icon

/**
 * Rozie file-type and plugin icons. v1 uses a single 16x16 R-mark glyph (D-08); the
 * IntelliJ IconLoader handles HiDPI scaling automatically.
 */
object RozieIcons {
    val FILE: Icon = IconLoader.getIcon("/icons/rozie.svg", RozieIcons::class.java)
}
