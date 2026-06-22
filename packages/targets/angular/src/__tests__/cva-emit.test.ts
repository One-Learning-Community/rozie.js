// cva-emit.test.ts — Phase 23 Plan 02 (angular-cva-forms-integration).
//
// Asserts the STATIC CVA class shape emitted by emitAngular for a single
// `model: true` prop component:
//   - Task 1: the single `cvaModelProp` gate (opts.cva ?? true; one-model → ON;
//             zero/≥2 model → OFF; opts.cva === false → OFF).
//   - Task 2: the four CVA methods + __rozieCvaOnTouched + three private members,
//             with writeValue null→default coercion.
//   - Task 3: providers: NG_VALUE_ACCESSOR + host: (focusout) on the decorator,
//             NG_VALUE_ACCESSOR from @angular/forms + forwardRef from @angular/core.
//
// The dynamic write-site/disabled-read hookup + diagnostics are Plan 03; the
// config gate default-OFF wiring is Plan 04 — out of scope here.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitAngular, type EmitAngularOptions } from '../emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CVA_FIXTURES = resolve(__dirname, 'cva-fixtures');

function compileAngular(
  src: string,
  filename: string,
  opts: EmitAngularOptions = {},
): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) {
    throw new Error(`lowerToIR() returned null IR for ${filename}`);
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src, ...opts });
  return code;
}

function fixture(name: string): string {
  return readFileSync(resolve(CVA_FIXTURES, `${name}.rozie`), 'utf8');
}

// A single-model component with a String `value` default `''`.
const SINGLE_MODEL_SRC = fixture('SingleModelNoDisabled');
const SINGLE_MODEL_FILE = 'SingleModelNoDisabled.rozie';

// A two-model component — the gate must yield null (no CVA).
const MULTI_MODEL_SRC = fixture('MultiModelProbe');
const MULTI_MODEL_FILE = 'MultiModelProbe.rozie';

// A zero-model component — the gate must yield null (byte-identical baseline).
const ZERO_MODEL_SRC = `<rozie name="ZeroModel">
<props>{ label: { type: String, default: '' } }</props>
<template>
  <div class="zero-model"><span>{{ $props.label }}</span></div>
</template>
</rozie>`;
const ZERO_MODEL_FILE = 'ZeroModel.rozie';

const CVA_METHOD_NAMES = [
  'writeValue',
  'registerOnChange',
  'registerOnTouched',
  'setDisabledState',
  '__rozieCvaOnTouched',
] as const;

describe('emitAngular CVA — Task 2: methods + members (single-model)', () => {
  const code = compileAngular(SINGLE_MODEL_SRC, SINGLE_MODEL_FILE);

  it('emits all four CVA methods + __rozieCvaOnTouched', () => {
    for (const m of CVA_METHOD_NAMES) {
      expect(code).toContain(m);
    }
  });

  it('emits the CVA backing members (two private, one protected)', () => {
    expect(code).toContain('private __rozieCvaOnChange');
    expect(code).toContain('private __rozieCvaOnTouchedFn');
    // `protected`, not `private`: it is read from the template `disabled` binding
    // (`this.__rozieCvaDisabled()`), which Angular's TCB cannot do for a `private`
    // member — a `private` here regresses ng-packagr/strict-tsc to TS2341.
    expect(code).toContain('protected __rozieCvaDisabled = signal(false)');
    expect(code).not.toContain('private __rozieCvaDisabled');
  });

  it('writeValue coerces null to the declared default ("")', () => {
    // The single-model fixture prop `value` has default `''`.
    expect(code).toContain("this.value.set(v ?? '')");
  });

  // WR-04 — a required-no-default model prop must NOT re-read its required
  // signal inside writeValue(null) (NG0950 risk during the forms binding
  // window). The emitted accessor guards the write so writeValue(null) is a
  // no-op that reads nothing.
  it('writeValue guards (no signal re-read) for a required-no-default model prop', () => {
    const reqCode = compileAngular(
      fixture('SingleModelRequired'),
      'SingleModelRequired.rozie',
    );
    // The required-no-default shape emits the guard, not a `?? this.value()`
    // re-read of the not-yet-bound required signal.
    expect(reqCode).toContain('if (v != null) this.value.set(v);');
    expect(reqCode).not.toContain('this.value.set(v ?? this.value())');
  });

  it('registerOnChange / registerOnTouched store the framework callbacks', () => {
    expect(code).toContain('this.__rozieCvaOnChange = fn;');
    expect(code).toContain('this.__rozieCvaOnTouchedFn = fn;');
  });

  it('setDisabledState writes the internal disabled signal', () => {
    expect(code).toContain('this.__rozieCvaDisabled.set(isDisabled)');
  });
});

describe('emitAngular CVA — Task 3: decorator providers + host (single-model)', () => {
  const code = compileAngular(SINGLE_MODEL_SRC, SINGLE_MODEL_FILE);

  it('emits the NG_VALUE_ACCESSOR provider self-referencing the class', () => {
    expect(code).toContain('NG_VALUE_ACCESSOR');
    expect(code).toContain('useExisting: forwardRef(() => SingleModelNoDisabled)');
    expect(code).toContain('multi: true');
    expect(code).toMatch(/providers:\s*\[/);
  });

  it('emits the (focusout) host binding', () => {
    expect(code).toContain("'(focusout)': '__rozieCvaOnTouched()'");
    expect(code).toMatch(/host:\s*\{/);
  });

  it('imports NG_VALUE_ACCESSOR from @angular/forms', () => {
    expect(code).toMatch(
      /import \{[^}]*\bNG_VALUE_ACCESSOR\b[^}]*\} from '@angular\/forms';/,
    );
  });

  it('imports forwardRef from @angular/core', () => {
    expect(code).toMatch(
      /import \{[^}]*\bforwardRef\b[^}]*\} from '@angular\/core';/,
    );
  });
});

describe('emitAngular CVA — Task 1 gate: zero-model is byte-identical', () => {
  it('zero-model component emits none of the CVA methods or members', () => {
    const code = compileAngular(ZERO_MODEL_SRC, ZERO_MODEL_FILE);
    for (const m of CVA_METHOD_NAMES) {
      expect(code).not.toContain(m);
    }
    expect(code).not.toContain('NG_VALUE_ACCESSOR');
    expect(code).not.toContain('(focusout)');
    expect(code).not.toContain('__rozieCvaDisabled');
  });

  it('zero-model output is identical with cva omitted vs cva:true vs cva:false', () => {
    const omitted = compileAngular(ZERO_MODEL_SRC, ZERO_MODEL_FILE);
    const on = compileAngular(ZERO_MODEL_SRC, ZERO_MODEL_FILE, { cva: true });
    const off = compileAngular(ZERO_MODEL_SRC, ZERO_MODEL_FILE, { cva: false });
    expect(on).toBe(omitted);
    expect(off).toBe(omitted);
  });
});

describe('emitAngular CVA — Task 1 gate: multi-model yields null', () => {
  it('a ≥2-model component emits NO CVA shape', () => {
    const code = compileAngular(MULTI_MODEL_SRC, MULTI_MODEL_FILE);
    for (const m of CVA_METHOD_NAMES) {
      expect(code).not.toContain(m);
    }
    expect(code).not.toContain('NG_VALUE_ACCESSOR');
    expect(code).not.toContain('(focusout)');
  });
});

describe('emitAngular CVA — Task 1 gate: opts.cva === false suppresses CVA', () => {
  it('single-model + cva:false emits NO CVA shape (byte-identical to no-model path)', () => {
    const on = compileAngular(SINGLE_MODEL_SRC, SINGLE_MODEL_FILE);
    const off = compileAngular(SINGLE_MODEL_SRC, SINGLE_MODEL_FILE, {
      cva: false,
    });
    // ON emits CVA; OFF must not.
    expect(on).toContain('writeValue');
    for (const m of CVA_METHOD_NAMES) {
      expect(off).not.toContain(m);
    }
    expect(off).not.toContain('NG_VALUE_ACCESSOR');
    expect(off).not.toContain('(focusout)');
  });

  it('omitting cva defaults ON for a single-model component', () => {
    const omitted = compileAngular(SINGLE_MODEL_SRC, SINGLE_MODEL_FILE);
    const on = compileAngular(SINGLE_MODEL_SRC, SINGLE_MODEL_FILE, { cva: true });
    expect(omitted).toBe(on);
    expect(omitted).toContain('writeValue');
  });
});
