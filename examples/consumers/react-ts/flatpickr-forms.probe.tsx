/**
 * flatpickr-forms.probe.tsx — GAP-1 forms-drop-in TYPE probe.
 *
 * Type-only (loaded by `tsc --strict --noEmit`, NOT a runtime app). Proves the
 * post-gap `name` prop makes `@rozie-ui/flatpickr-react` drop into a native
 * form-control role and, specifically, into react-hook-form's `register()`
 * spread contract:
 *
 *   register('field') returns { name, onChange, onBlur, ref }
 *
 * The load-bearing assertion is that RHF's `name` field (`string`) is
 * assignable to `FlatpickrProps.name` — i.e. the value flatpickr submits is
 * driven by the registered field name. (A full `{...register('field')}` spread
 * is NOT asserted: RHF's `onChange: ChangeHandler` deliberately collides with
 * this component's own `onChange` emit-prop, which is the documented edge —
 * see the guide's forms recipe. The forms-drop-in contract is the `name`
 * field, not RHF's event wiring.)
 *
 * The fixture mirrors the emitted React `.d.ts` (`FlatpickrProps`); the
 * authority is packages/ui/flatpickr/packages/react/src/Flatpickr.d.ts.
 */
import { useForm } from 'react-hook-form';
import Flatpickr, { type FlatpickrProps } from './fixtures/Flatpickr';

// 1) `name` is an accepted typed prop, typed as string.
const withName: FlatpickrProps = { name: 'birthday' };
// @ts-expect-error — name must be a string, not a number.
const withBadName: FlatpickrProps = { name: 123 };

// 2) react-hook-form `register('field')` returns { name, onChange, onBlur, ref }.
//    Its `name` field is `string`, so it must be assignable to FlatpickrProps.name.
function RhfDemo() {
  const { register } = useForm<{ birthday: string }>();
  const field = register('birthday');
  // The load-bearing assertion: RHF's `name` (string) drops into the prop.
  const nameOnly: Pick<FlatpickrProps, 'name'> = { name: field.name };
  void nameOnly;
  // The component still renders with the registered field name forwarded.
  return <Flatpickr name={field.name} date="2026-05-17" />;
}

void [withName, withBadName, RhfDemo];
