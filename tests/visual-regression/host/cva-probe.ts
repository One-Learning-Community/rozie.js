/*
 * SPIKE 005/006 → Plan 23-06 RE-TARGET — Angular CVA forms-integration probes.
 *
 * History: spike 005 captured the baseline gap (forms directives on the raw
 * generated component crashed with NG01203 / null writeValue), and spike 006
 * validated the CVA shape via a hand-written ControlValueAccessor wrapper
 * DIRECTIVE around the generated Flatpickr class.
 *
 * Plan 23-06 RE-TARGET: the Angular emitter now auto-emits the
 * ControlValueAccessor INSIDE the generated `<rozie-flatpickr>` class itself
 * (default-ON for single-model components). So:
 *   - The hand-written CVA wrapper directives are DELETED — the emitted class
 *     IS the value accessor.
 *   - 006-A/B/C bind `[(ngModel)]` / `[formControl]` / `[formControl]+[(date)]`
 *     DIRECTLY to `<rozie-flatpickr>` (no `rozieCva` attribute, no directive).
 *   - 005-A/B are INVERTED: attaching a forms directive no longer crashes; the
 *     value round-trips through the emitted CVA.
 *   - 006-D is repurposed as a ZERO-ECHO regression guard: a programmatic
 *     setValue() must NOT echo back into onChange (must not dirty the control) —
 *     the structural property the emitter guarantees (the internal write-site
 *     onChange hookup fires only from flatpickr user interaction, never from the
 *     forms→view writeValue path).
 *
 * Control-state is observed DIRECTLY off the FormControl / bound model
 * (`ctrl.dirty` / `ctrl.touched` / `ctrl.value` / `ctrl.disabled`) — there is no
 * wrapper directive to viewChild anymore.
 *
 * NEVER hand-edit the generated leaf (packages/ui/flatpickr/packages/angular/).
 * This file only consumes the compiled .rozie output.
 */
import { Component, signal } from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';

// Resolved by @rozie/unplugin (target: angular) → cross-tree disk-cache
// `Flatpickr.rozie.ts` (prebuildExtraRoots covers packages/ui/flatpickr/src).
// The emitted class now carries the ControlValueAccessor (NG_VALUE_ACCESSOR
// provider + writeValue/registerOnChange/registerOnTouched/setDisabledState).
import Flatpickr from '../../../packages/ui/flatpickr/src/Flatpickr.rozie';
import 'flatpickr/dist/flatpickr.css';

/* ════════════════════════════════════════════════════════════════════════
 * 005 (INVERTED) — forms directives bound directly to the emitted CVA
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * 005-A: [(ngModel)] on the emitted component. INVERTED — was "expect NG01203".
 * Now: no crash; the initial value round-trips model→view.
 */
@Component({
  selector: 'cva-baseline-ngmodel-host',
  standalone: true,
  imports: [FormsModule, Flatpickr],
  template: `
    <h3>005-A: [(ngModel)] on the emitted CVA — no crash</h3>
    <rozie-flatpickr [(ngModel)]="value" />
    <p data-testid="baseline-ngmodel-value">{{ value }}</p>
  `,
})
export class CvaBaselineNgModelHost {
  value = '2026-06-02';
}

/**
 * 005-B: [formControl] on the emitted component. INVERTED — was "expect NG01203".
 * Now: no crash; the control value round-trips into the view.
 */
@Component({
  selector: 'cva-baseline-reactive-host',
  standalone: true,
  imports: [ReactiveFormsModule, Flatpickr],
  template: `
    <h3>005-B: [formControl] on the emitted CVA — no crash</h3>
    <rozie-flatpickr [formControl]="ctrl" />
    <p data-testid="baseline-reactive-value">{{ ctrl.value === null ? 'NULL' : ctrl.value }}</p>
  `,
})
export class CvaBaselineReactiveHost {
  ctrl = new FormControl<string>('2026-06-02');
}

/**
 * 005-C: plain [(date)] model binding, no forms directive — the long-standing
 * supported consumer contract. Control case proving the component still works
 * without any forms directive attached.
 */
@Component({
  selector: 'cva-baseline-date-host',
  standalone: true,
  imports: [Flatpickr],
  template: `
    <h3>005-C: [(date)] only — current contract</h3>
    <rozie-flatpickr [(date)]="picked" />
    <p data-testid="baseline-date-value">{{ picked() }}</p>
  `,
})
export class CvaBaselineDateHost {
  picked = signal('2026-06-02');
}

/* ════════════════════════════════════════════════════════════════════════
 * 006 — forms directives bound DIRECTLY to the emitted CVA component
 * ════════════════════════════════════════════════════════════════════════ */

/** 006-A: [(ngModel)] two-way directly on the emitted component. */
@Component({
  selector: 'cva-ngmodel-host',
  standalone: true,
  imports: [FormsModule, Flatpickr],
  template: `
    <h3>CVA: [(ngModel)]</h3>
    <rozie-flatpickr [(ngModel)]="value" />
    <p data-testid="ngmodel-value">{{ value }}</p>
    <button data-testid="ngmodel-set" (click)="value = '2026-07-04'">
      set from model
    </button>
  `,
})
export class CvaNgModelHost {
  value = '2026-06-02';
}

/**
 * 006-B: reactive FormControl — setValue / reset(null-coercion) / disable /
 * enable / touched / zero-echo. Control state is observed DIRECTLY off the
 * FormControl.
 */
@Component({
  selector: 'cva-reactive-host',
  standalone: true,
  imports: [ReactiveFormsModule, Flatpickr],
  template: `
    <h3>CVA: [formControl]</h3>
    <rozie-flatpickr [formControl]="ctrl" />
    <p data-testid="ctrl-value">{{ ctrl.value === null ? 'NULL' : ctrl.value }}</p>
    <p data-testid="ctrl-touched">{{ ctrl.touched }}</p>
    <p data-testid="ctrl-dirty">{{ ctrl.dirty }}</p>
    <p data-testid="ctrl-disabled">{{ ctrl.disabled }}</p>
    <button data-testid="ctrl-setvalue" (click)="ctrl.setValue('2026-07-04')">setValue</button>
    <button data-testid="ctrl-reset" (click)="ctrl.reset()">reset</button>
    <button data-testid="ctrl-disable" (click)="ctrl.disable()">disable</button>
    <button data-testid="ctrl-enable" (click)="ctrl.enable()">enable</button>
  `,
})
export class CvaReactiveHost {
  ctrl = new FormControl<string>('2026-06-02');
}

/** 006-C: coexistence — [formControl] AND [(date)] on the same emitted element. */
@Component({
  selector: 'cva-coexist-host',
  standalone: true,
  imports: [ReactiveFormsModule, Flatpickr],
  template: `
    <h3>CVA: [formControl] + [(date)] simultaneously</h3>
    <rozie-flatpickr [formControl]="ctrl" [(date)]="picked" />
    <p data-testid="coexist-ctrl-value">{{ ctrl.value === null ? 'NULL' : ctrl.value }}</p>
    <p data-testid="coexist-ctrl-dirty">{{ ctrl.dirty }}</p>
    <p data-testid="coexist-date-value">{{ picked() }}</p>
    <button data-testid="coexist-setvalue" (click)="ctrl.setValue('2026-07-04')">setValue</button>
    <button data-testid="coexist-setdate" (click)="picked.set('2026-08-15')">set [(date)]</button>
  `,
})
export class CvaCoexistHost {
  ctrl = new FormControl<string>('2026-06-02');
  picked = signal('2026-06-02');
}

/**
 * 006-D: ZERO-ECHO regression guard (repurposed from the spike's naive
 * anti-pattern host). The emitted CVA hooks onChange at the internal model-write
 * site that fires ONLY from flatpickr user interaction — NEVER from the
 * forms→view writeValue path. So a PROGRAMMATIC setValue() must update the view
 * WITHOUT marking the control dirty (no onChange echo). This host asserts that
 * structural property directly via `ctrl.dirty` after a programmatic write.
 */
@Component({
  selector: 'cva-echo-host',
  standalone: true,
  imports: [ReactiveFormsModule, Flatpickr],
  template: `
    <h3>CVA: zero-echo guard (programmatic setValue must not dirty)</h3>
    <rozie-flatpickr [formControl]="ctrl" />
    <p data-testid="echo-ctrl-value">{{ ctrl.value === null ? 'NULL' : ctrl.value }}</p>
    <p data-testid="echo-ctrl-dirty">{{ ctrl.dirty }}</p>
    <button data-testid="echo-setvalue" (click)="ctrl.setValue('2026-07-04')">setValue</button>
  `,
})
export class CvaEchoHost {
  ctrl = new FormControl<string>('2026-06-02');
}

/* ──────────────────────────────────────────────────────────────────────────
 * Probe registry — consumed by entry.angular.ts (?cvaProbe=<key>)
 * ────────────────────────────────────────────────────────────────────────── */

export const CVA_PROBES = {
  BaselineNgModel: CvaBaselineNgModelHost,
  BaselineReactive: CvaBaselineReactiveHost,
  BaselineDate: CvaBaselineDateHost,
  NgModel: CvaNgModelHost,
  Reactive: CvaReactiveHost,
  Coexist: CvaCoexistHost,
  Echo: CvaEchoHost,
} as const;

export type CvaProbeKey = keyof typeof CVA_PROBES;
