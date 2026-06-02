/*
 * SPIKE 005/006 — Angular CVA forms-integration probes (spike code, throwaway).
 *
 * Spike 005 (baseline-gap): what do `[(ngModel)]` / `[formControl]` on the
 * CURRENT generated `@rozie-ui/flatpickr-angular` class do today? (Expected:
 * runtime NG01203 "no value accessor".)
 *
 * Spike 006 (cva-directive): a hand-written ControlValueAccessor wrapper
 * DIRECTIVE around the generated Flatpickr class — the exact behavior the
 * Angular emitter's auto-CVA capability (compiler-config-gated, default ON)
 * must produce. The directive is the spike approximation: the real
 * implementation lives INSIDE the emitted class where internal model-prop
 * writes can be hooked directly.
 *
 * Findings land in the .planning/spikes/ 005 + 006 READMEs and the decision
 * doc .planning/research/angular-cva-decision.md.
 *
 * NEVER hand-edit the generated leaf (packages/ui/flatpickr/packages/angular/).
 * This file only consumes the compiled .rozie output.
 */
import {
  Component,
  Directive,
  effect,
  forwardRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormControl,
  FormsModule,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  type ControlValueAccessor,
} from '@angular/forms';

// Resolved by @rozie/unplugin (target: angular) → cross-tree disk-cache
// `Flatpickr.rozie.ts` (prebuildExtraRoots covers packages/ui/flatpickr/src).
import Flatpickr from '../../../packages/ui/flatpickr/src/Flatpickr.rozie';
import 'flatpickr/dist/flatpickr.css';

/* ════════════════════════════════════════════════════════════════════════
 * SPIKE 005 — BASELINE (no CVA anywhere)
 * ════════════════════════════════════════════════════════════════════════ */

/** 005-A: [(ngModel)] on the raw generated component. Expected: NG01203. */
@Component({
  selector: 'cva-baseline-ngmodel-host',
  standalone: true,
  imports: [FormsModule, Flatpickr],
  template: `
    <h3>Baseline: [(ngModel)] — no CVA</h3>
    <rozie-flatpickr [(ngModel)]="value" />
    <p data-testid="baseline-ngmodel-value">{{ value }}</p>
  `,
})
export class CvaBaselineNgModelHost {
  value = '2026-06-02';
}

/** 005-B: [formControl] on the raw generated component. Expected: NG01203. */
@Component({
  selector: 'cva-baseline-reactive-host',
  standalone: true,
  imports: [ReactiveFormsModule, Flatpickr],
  template: `
    <h3>Baseline: [formControl] — no CVA</h3>
    <rozie-flatpickr [formControl]="ctrl" />
    <p data-testid="baseline-reactive-value">{{ ctrl.value }}</p>
  `,
})
export class CvaBaselineReactiveHost {
  ctrl = new FormControl<string>('2026-06-02');
}

/**
 * 005-C: plain [(date)] model binding, no forms directive — the current
 * supported consumer contract. Expected: works, zero errors (control case
 * proving the baseline failures are forms-specific, not component breakage).
 */
@Component({
  selector: 'cva-baseline-date-host',
  standalone: true,
  imports: [Flatpickr],
  template: `
    <h3>Baseline: [(date)] only — current contract</h3>
    <rozie-flatpickr [(date)]="picked" />
    <p data-testid="baseline-date-value">{{ picked() }}</p>
  `,
})
export class CvaBaselineDateHost {
  picked = signal('2026-06-02');
}

/* ════════════════════════════════════════════════════════════════════════
 * SPIKE 006 — THE CVA WRAPPER DIRECTIVE (the emitter design, hand-written)
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * The CVA shape the Angular emitter must generate (as class members of the
 * emitted component itself, not a directive).
 *
 * Key design points being validated:
 *
 *  1. writeValue → `date.set(v ?? '')`. The model prop's $watch reconciler
 *     (`instance.setDate(v, false)` — note triggerChange=FALSE) pushes the
 *     value into flatpickr WITHOUT firing flatpickr's own onChange. So the
 *     forms→view path cannot echo back into onChange. (Sub-question 3.)
 *
 *  2. registerOnChange hookup: subscribe to the component's `change` OUTPUT —
 *     which fires ONLY from flatpickr user interaction — NOT to the `date`
 *     model signal (which also changes on writeValue → echo). The emitter
 *     equivalent: call `__cvaOnChange(v)` at the internal model-write site
 *     (`this.date.set(dateStr)` inside the flatpickr onChange handler).
 *
 *  3. registerOnTouched → host `focusout`. Empirical question: does clicking
 *     a date in the body-appended popup fire focusout (touched-before-commit)?
 *
 *  4. setDisabledState: the generated `disabled` prop is a READ-ONLY input()
 *     signal — a wrapper cannot write it. Directive workaround: reach into
 *     `fp.instance.input.disabled` (engine-specific, and racy before mount —
 *     needs the pending stash below). Emitter answer: internal
 *     `__cvaDisabled = signal(false)` OR'd into every internal `disabled()`
 *     read. This clumsiness IS the evidence that CVA belongs in the emitter.
 *
 *  5. null-coercion: form.reset() passes null → coerce to the prop's declared
 *     default ('' for flatpickr's `date`).
 */
@Directive({
  selector: 'rozie-flatpickr[rozieCva]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RozieFlatpickrCva),
      multi: true,
    },
  ],
  host: {
    '(focusout)': 'handleFocusOut()',
  },
})
export class RozieFlatpickrCva implements ControlValueAccessor {
  // The generated component instance on the same element (element injector).
  private fp = inject(Flatpickr);

  /** Spec-observable counters (signals so CD picks them up reliably). */
  onChangeCalls = signal(0);
  onTouchedCalls = signal(0);
  writeValueCalls = signal(0);

  /**
   * Forensic event journal — every CVA/output event in order, with values.
   * Spike observability layer; the spec dumps this to isolate event ordering.
   */
  journal: string[] = [];
  private seq = 0;
  private log(entry: string): void {
    this.journal.push(`${this.seq++}:${entry}`);
  }
  journalText(): string {
    return this.journal.join(' | ');
  }

  private cvaOnChange: (v: string) => void = () => {};
  private cvaOnTouched: () => void = () => {};
  /** setDisabledState can arrive BEFORE flatpickr constructs (engine mounts in
   *  ngAfterViewInit). Stash and apply on `ready`. */
  private pendingDisabled: boolean | null = null;

  constructor() {
    // View → model: the `change` output fires only from flatpickr's own
    // onChange (user interaction). It does NOT fire on writeValue's
    // date.set → $watch → setDate(v, false) path. This is the no-echo hookup.
    this.fp.change.subscribe((ev: { value: string }) => {
      this.log(`change-output(${ev.value})`);
      this.onChangeCalls.update((n: number) => n + 1);
      this.cvaOnChange(ev.value);
    });
    // Journal the other engine outputs to see ordering.
    this.fp.valueUpdate.subscribe((ev: { value: string }) => {
      this.log(`valueUpdate-output(${ev.value})`);
    });
    this.fp.ready.subscribe(() => {
      this.log('ready-output');
      if (this.pendingDisabled !== null) {
        this.applyDisabled(this.pendingDisabled);
        this.pendingDisabled = null;
      }
    });
  }

  writeValue(v: string | null): void {
    this.log(`writeValue(${v === null ? 'NULL' : v})`);
    this.writeValueCalls.update((n: number) => n + 1);
    // Null-coercion rule: form.reset() passes null → the prop's declared default.
    this.fp.date.set(v ?? '');
  }

  registerOnChange(fn: (v: string) => void): void {
    this.cvaOnChange = (v: string) => {
      this.log(`cvaOnChange→form(${v})`);
      fn(v);
    };
  }

  registerOnTouched(fn: () => void): void {
    this.cvaOnTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (this.fp.instance) {
      this.applyDisabled(isDisabled);
    } else {
      this.pendingDisabled = isDisabled;
    }
  }

  handleFocusOut(): void {
    this.onTouchedCalls.update((n: number) => n + 1);
    this.cvaOnTouched();
  }

  /** Diagnostic: the component's current `date` model signal value. */
  currentFpDate(): string {
    return this.fp.date();
  }

  private applyDisabled(isDisabled: boolean): void {
    // Directive limitation: `fp.disabled` is a read-only input() signal. Reach
    // into the engine instance instead. (Emitter impl: internal signal merge.)
    const inst = this.fp.instance;
    if (inst?.altInput) inst.altInput.disabled = isDisabled;
    if (inst?.input) inst.input.disabled = isDisabled;
  }
}

/**
 * ANTI-PATTERN control: the "naive" CVA that hooks view→model through an
 * effect() on the `date` model signal instead of the interaction-only `change`
 * output. Expected failure mode (the double-emission echo): programmatic
 * ctrl.setValue() → writeValue → date.set → effect fires → cvaOnChange echoes
 * the value back into the form → control is marked DIRTY by a programmatic
 * write (and re-enters setValue). Demonstrates WHY the hookup must be the
 * interaction path, not the model signal.
 */
@Directive({
  selector: 'rozie-flatpickr[rozieCvaNaive]',
  standalone: true,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RozieFlatpickrCvaNaive),
      multi: true,
    },
  ],
})
export class RozieFlatpickrCvaNaive implements ControlValueAccessor {
  private fp = inject(Flatpickr);
  onChangeCalls = signal(0);
  private cvaOnChange: (v: string) => void = () => {};
  private first = true;

  constructor() {
    effect(() => {
      const v = this.fp.date();
      // Skip the initial-value run (every effect fires once on creation).
      if (this.first) {
        this.first = false;
        return;
      }
      this.onChangeCalls.update((n: number) => n + 1);
      this.cvaOnChange(v);
    });
  }

  writeValue(v: string | null): void {
    this.fp.date.set(v ?? '');
  }
  registerOnChange(fn: (v: string) => void): void {
    this.cvaOnChange = fn;
  }
  registerOnTouched(): void {}
}

/* ──────────────────────────────────────────────────────────────────────────
 * Spike 006 hosts
 * ────────────────────────────────────────────────────────────────────────── */

/** 006-A: [(ngModel)] two-way through the CVA directive. */
@Component({
  selector: 'cva-ngmodel-host',
  standalone: true,
  imports: [FormsModule, Flatpickr, RozieFlatpickrCva],
  template: `
    <h3>CVA: [(ngModel)]</h3>
    <rozie-flatpickr rozieCva [(ngModel)]="value" />
    <p data-testid="ngmodel-value">{{ value }}</p>
    <p data-testid="ngmodel-writevalue-calls">{{ cva()?.writeValueCalls() ?? -1 }}</p>
    <p data-testid="ngmodel-fp-date">{{ cva()?.currentFpDate() ?? 'NO-DIR' }}</p>
    <p data-testid="ngmodel-journal">{{ cva()?.journalText() }}</p>
    <button data-testid="ngmodel-set" (click)="value = '2026-07-04'">
      set from model
    </button>
  `,
})
export class CvaNgModelHost {
  value = '2026-06-02';
  cva = viewChild(RozieFlatpickrCva);
}

/** 006-B: reactive FormControl — setValue / reset / disable / touched / echo counters. */
@Component({
  selector: 'cva-reactive-host',
  standalone: true,
  imports: [ReactiveFormsModule, Flatpickr, RozieFlatpickrCva],
  template: `
    <h3>CVA: [formControl]</h3>
    <rozie-flatpickr rozieCva [formControl]="ctrl" />
    <p data-testid="ctrl-value">{{ ctrl.value === null ? 'NULL' : ctrl.value }}</p>
    <p data-testid="ctrl-touched">{{ ctrl.touched }}</p>
    <p data-testid="ctrl-dirty">{{ ctrl.dirty }}</p>
    <p data-testid="ctrl-disabled">{{ ctrl.disabled }}</p>
    <p data-testid="cva-onchange-calls">{{ cva()?.onChangeCalls() ?? -1 }}</p>
    <p data-testid="cva-ontouched-calls">{{ cva()?.onTouchedCalls() ?? -1 }}</p>
    <p data-testid="cva-writevalue-calls">{{ cva()?.writeValueCalls() ?? -1 }}</p>
    <button data-testid="ctrl-setvalue" (click)="ctrl.setValue('2026-07-04')">setValue</button>
    <button data-testid="ctrl-reset" (click)="ctrl.reset()">reset</button>
    <button data-testid="ctrl-disable" (click)="ctrl.disable()">disable</button>
    <button data-testid="ctrl-enable" (click)="ctrl.enable()">enable</button>
  `,
})
export class CvaReactiveHost {
  ctrl = new FormControl<string>('2026-06-02');
  cva = viewChild(RozieFlatpickrCva);
}

/** 006-C: coexistence — [formControl] AND [(date)] on the same element. */
@Component({
  selector: 'cva-coexist-host',
  standalone: true,
  imports: [ReactiveFormsModule, Flatpickr, RozieFlatpickrCva],
  template: `
    <h3>CVA: [formControl] + [(date)] simultaneously</h3>
    <rozie-flatpickr rozieCva [formControl]="ctrl" [(date)]="picked" />
    <p data-testid="coexist-ctrl-value">{{ ctrl.value === null ? 'NULL' : ctrl.value }}</p>
    <p data-testid="coexist-date-value">{{ picked() }}</p>
    <p data-testid="coexist-onchange-calls">{{ cva()?.onChangeCalls() ?? -1 }}</p>
    <button data-testid="coexist-setvalue" (click)="ctrl.setValue('2026-07-04')">setValue</button>
    <button data-testid="coexist-setdate" (click)="picked.set('2026-08-15')">set [(date)]</button>
  `,
})
export class CvaCoexistHost {
  ctrl = new FormControl<string>('2026-06-02');
  picked = signal('2026-06-02');
  cva = viewChild(RozieFlatpickrCva);
}

/** 006-D: the naive/echo anti-pattern control. */
@Component({
  selector: 'cva-echo-host',
  standalone: true,
  imports: [ReactiveFormsModule, Flatpickr, RozieFlatpickrCvaNaive],
  template: `
    <h3>CVA naive (echo anti-pattern)</h3>
    <rozie-flatpickr rozieCvaNaive [formControl]="ctrl" />
    <p data-testid="echo-ctrl-value">{{ ctrl.value === null ? 'NULL' : ctrl.value }}</p>
    <p data-testid="echo-ctrl-dirty">{{ ctrl.dirty }}</p>
    <p data-testid="echo-onchange-calls">{{ cvaNaive()?.onChangeCalls() ?? -1 }}</p>
    <button data-testid="echo-setvalue" (click)="ctrl.setValue('2026-07-04')">setValue</button>
  `,
})
export class CvaEchoHost {
  ctrl = new FormControl<string>('2026-06-02');
  cvaNaive = viewChild(RozieFlatpickrCvaNaive);
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
