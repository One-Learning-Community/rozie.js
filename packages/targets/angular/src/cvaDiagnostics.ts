/**
 * cvaDiagnostics — Phase 23 Plan 03 (angular-cva-forms-integration).
 *
 * Angular-package, config/target-conditional CVA diagnostics. Emits the three
 * codes registered in core (Plan 01) from the EMIT side (per 23-RESEARCH.md the
 * Angular package owns CVA-specific emission; core's registry only reserves the
 * codes):
 *
 *   - ROZ124 EXPOSE_CVA_NAME_COLLISION (error) — a `$expose`d name collides with
 *     a reserved Angular ControlValueAccessor method on a CVA-receiving
 *     (single-model, `cva` active) component. The auto-emitted accessor already
 *     owns `writeValue`/`registerOnChange`/`registerOnTouched`/`setDisabledState`;
 *     exposing a method of the same name would produce a duplicate class member.
 *   - ROZ125 CVA_MULTI_MODEL_NO_ACCESSOR (info) — ≥2 `model:true` props, so a
 *     single-control accessor cannot be auto-emitted (a CVA wraps exactly one
 *     form value). The per-prop `valueChange.emit(...)` two-way binding still
 *     works; the info is purely advisory.
 *   - ROZ126 CVA_NO_DISABLED_PROP (info) — a single-model CVA component with no
 *     `disabled` prop: the emitted `setDisabledState` is a documented no-op.
 *
 * Discipline (copied from exposeValidator's ROZ121 collision loop):
 *   - iterate ONLY the well-formed canonical `ir.expose` list (the lowerer +
 *     runExposeValidator already excluded spreads / computed keys / malformed
 *     shapes, so every entry carries a trustworthy `name`).
 *   - case-sensitive name match against the fixed reserved-name set.
 *   - collect, never throw (D-08) — a malformed `$expose` simply yields an empty
 *     `ir.expose`, so nothing fires.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../core/src/diagnostics/codes.js';

/**
 * The four reserved Angular `ControlValueAccessor` method names the auto-emitted
 * accessor owns on a CVA-receiving component. A `$expose`d name matching any of
 * these collides with the generated class member.
 */
const RESERVED_CVA_NAMES: ReadonlySet<string> = new Set([
  'writeValue',
  'registerOnChange',
  'registerOnTouched',
  'setDisabledState',
]);

/**
 * Compute the CVA diagnostics for one component. Pure: depends only on the IR
 * and the resolved single-CVA-prop gate computed once in emitAngular.
 *
 * @param ir           the lowered component IR.
 * @param cvaModelProp the resolved single CVA model prop name (or null when not
 *                     CVA-receiving — zero/≥2 model props OR `cva:false`). When
 *                     null, ROZ124 and ROZ126 never fire (no accessor is
 *                     emitted, so no collision and no no-op setDisabledState).
 */
export function cvaDiagnostics(
  ir: IRComponent,
  cvaModelProp: string | null,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const modelProps = ir.props.filter((p) => p.isModel);

  // ROZ125 — ≥2 model props: no single-control accessor. Independent of the
  // `cva` flag and of cvaModelProp (which is already null for the ≥2 case): the
  // multi-model shape inherently cannot carry a CVA, so the info always fires
  // when the author declared ≥2 model props. Fires exactly once.
  if (modelProps.length >= 2) {
    const names = modelProps.map((p) => p.name).join(', ');
    diagnostics.push({
      code: RozieErrorCode.CVA_MULTI_MODEL_NO_ACCESSOR, // ROZ125
      severity: 'info',
      message: `Component '${ir.name}' declares ${modelProps.length} model props (${names}); the Angular target auto-emits a ControlValueAccessor only for a single model prop, so none was generated. The per-prop two-way binding still works via valueChange outputs.`,
      loc: (modelProps[0] ?? ir.props[0])!.sourceLoc,
      hint: 'A ControlValueAccessor wraps exactly one form value. To make this component a single Angular form control, reduce it to one model:true prop.',
    });
  }

  // ROZ124 + ROZ126 only apply when the component is CVA-receiving.
  if (cvaModelProp === null) {
    return diagnostics;
  }

  // ROZ124 — $expose name colliding with a reserved CVA method. Iterate the
  // well-formed canonical ir.expose list (spreads/computed/malformed already
  // excluded by the lowerer + runExposeValidator). Case-sensitive; fires once
  // per colliding entry; never throws.
  for (const exposed of ir.expose) {
    if (!RESERVED_CVA_NAMES.has(exposed.name)) continue;
    diagnostics.push({
      code: RozieErrorCode.EXPOSE_CVA_NAME_COLLISION, // ROZ124
      severity: 'error',
      message: `$expose({ ${exposed.name} }) collides with the reserved Angular ControlValueAccessor method '${exposed.name}' — component '${ir.name}' is a single-model CVA-receiving component, so the auto-emitted accessor already owns this method name and the two cannot share a class member.`,
      loc: exposed.sourceLoc,
      hint: `Rename the exposed method so it does not match a reserved CVA method name (writeValue / registerOnChange / registerOnTouched / setDisabledState), or set cva:false to suppress the auto-accessor on this component.`,
    });
  }

  // ROZ126 — single-model CVA component with no `disabled` prop: setDisabledState
  // is emitted as a no-op (it writes only the internal __rozieCvaDisabled signal,
  // which nothing reads when there is no `disabled` prop to OR-merge).
  const hasDisabled = ir.props.some((p) => p.name === 'disabled');
  if (!hasDisabled) {
    const cvaProp = ir.props.find((p) => p.name === cvaModelProp);
    diagnostics.push({
      code: RozieErrorCode.CVA_NO_DISABLED_PROP, // ROZ126
      severity: 'info',
      message: `Component '${ir.name}' is a single-model CVA component with no 'disabled' prop, so its auto-emitted Angular setDisabledState is a no-op — a parent form's disabled state has nothing to drive.`,
      loc: (cvaProp ?? ir.props[0])!.sourceLoc,
      hint: "Declare a `disabled` Boolean prop if the wrapped control should react to a parent form's disabled state.",
    });
  }

  return diagnostics;
}
