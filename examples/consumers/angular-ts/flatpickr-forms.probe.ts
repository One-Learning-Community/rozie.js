/**
 * flatpickr-forms.probe.ts — GAP-1 forms-drop-in TYPE probe (Angular).
 *
 * Type-only (loaded by `tsc --strict --noEmit`, NOT a runtime app). Proves the
 * emitted Angular `Flatpickr` exposes a typed `name` input (signal-era
 * `input<string>()`), so a consumer can bind `[name]="..."` (and, with
 * @angular/forms ReactiveFormsModule, drive it from a `formControlName` host
 * input) WITHOUT a custom ControlValueAccessor / Controller shim.
 *
 * @angular/forms ^19 is already a devDependency of this probe project; we touch
 * its types to keep the reactive-forms relevance explicit, then assert the
 * `name()` signal returns `string`.
 *
 * The fixture mirrors the emitted Angular `name = input<string>('')` member;
 * the authority is packages/ui/flatpickr/packages/angular/src/Flatpickr.ts.
 */
import type { InputSignal } from '@angular/core';
import type { FormControl } from '@angular/forms';
import { FlatpickrName } from './fixtures/FlatpickrName';

type FlatpickrShape = InstanceType<typeof FlatpickrName>;
declare const fp: FlatpickrShape;

// 1) `name` is a typed signal input returning string.
const nameSignal: InputSignal<string> = fp.name;
const nameValue: string = fp.name();
// @ts-expect-error — the name input signal yields string, not number.
const nameBad: number = fp.name();

// 2) Reactive-forms relevance: the host's FormControl<string> value is the
//    string the `name`/value binding consumes — no CVA shim needed for the
//    plain `name` form-control attribute path.
declare const ctrl: FormControl<string>;
const ctrlVal: string | null = ctrl.value;

void [nameSignal, nameValue, nameBad, ctrlVal, FlatpickrName];
