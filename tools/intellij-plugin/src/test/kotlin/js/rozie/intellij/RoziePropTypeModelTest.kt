package js.rozie.intellij

import js.rozie.intellij.injection.RoziePropTypeModel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Pure unit test (no IntelliJ platform) for the `<props>`-block → TS object-type
 * derivation that types `$props` in the injected-JS ambient prefix
 * ([js.rozie.intellij.injection.RozieMultiHostInjector.globalsPrefixFor]).
 */
class RoziePropTypeModelTest {

    @Test
    fun descriptorTypesMapToScalars() {
        val body = """
            {
              title: { type: String, default: '' },
              open:  { type: Boolean, default: false, model: true },
              count: { type: Number },
            }
        """.trimIndent()
        assertEquals(
            "{ title: string; open: boolean; count: number }",
            RoziePropTypeModel.propsObjectType(body),
        )
    }

    @Test
    fun shorthandAndContainerAndUnionTypes() {
        val body = "{ label: String, tags: { type: Array, default: () => [] }, " +
            "meta: { type: Object }, kind: { type: [String, Number] } }"
        assertEquals(
            "{ label: string; tags: unknown[]; meta: Record<string, unknown>; kind: string | number }",
            RoziePropTypeModel.propsObjectType(body),
        )
    }

    @Test
    fun unknownTypeDegradesToAny() {
        assertEquals(
            "{ when: any }",
            RoziePropTypeModel.propsObjectType("{ when: { type: Promise } }"),
        )
    }

    @Test
    fun emptyOrNullBodyYieldsNull() {
        assertNull(RoziePropTypeModel.propsObjectType(null))
        assertNull(RoziePropTypeModel.propsObjectType("{ }"))
    }
}
