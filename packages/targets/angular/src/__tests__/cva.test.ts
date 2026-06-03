// cva.test.ts — Phase 23 Plan 03 (angular-cva-forms-integration).
//
// Asserts the DYNAMIC CVA behavior wired by Plan 03:
//   - Task 1: __rozieCvaOnChange injection at every internal model-write site
//             (script / template / listener), expression-context-safe via a
//             SequenceExpression, NEVER via effect().
//   - Task 2: the disabled OR-merge `(this.disabled() || this.__rozieCvaDisabled())`
//             at every internal `disabled` read on a CVA component declaring a
//             `disabled` prop only.
//   - Task 3: ROZ124 (collision error) / ROZ125 (multi-model info) /
//             ROZ126 (no-disabled info) emitted from cvaDiagnostics.ts; compile()
//             never throws.
//
// The static CVA class shape (methods/members/decorator) is Plan 02 — covered
// by cva-emit.test.ts.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { emitAngular, type EmitAngularOptions } from '../emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CVA_FIXTURES = resolve(__dirname, 'cva-fixtures');

function loadIR(src: string, filename: string): IRComponent {
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
  return lowered.ir;
}

function compileAngular(
  src: string,
  filename: string,
  opts: EmitAngularOptions = {},
): { code: string; diagnostics: Diagnostic[] } {
  const ir = loadIR(src, filename);
  const { code, diagnostics } = emitAngular(ir, { filename, source: src, ...opts });
  return { code, diagnostics };
}

function fixture(name: string): string {
  return readFileSync(resolve(CVA_FIXTURES, `${name}.rozie`), 'utf8');
}

// ---------------------------------------------------------------------------
// Task 1 — __rozieCvaOnChange injection at model-write sites.
// ---------------------------------------------------------------------------

// A single-model component whose <script> writes the model prop via a setter
// (statement-context write), plus a template handler write and a ternary
// expression-context write to exercise the SequenceExpression path.
const WRITE_SRC = `<rozie name="WriteProbe">
<props>{ value: { type: String, default: '', model: true } }</props>
<script>
function setValue(v) {
  $model.value = v
}
function setViaTernary(v, ok) {
  ok ? ($model.value = v) : null
}
</script>
<template>
  <input class="w" :value="$props.value" @input="$model.value = 'x'" />
</template>
</rozie>`;
const WRITE_FILE = 'WriteProbe.rozie';

describe('emitAngular CVA — Task 1: __rozieCvaOnChange at write sites', () => {
  const { code } = compileAngular(WRITE_SRC, WRITE_FILE);

  it('injects __rozieCvaOnChange adjacent to the statement-context script setter', () => {
    expect(code).toContain('this.value.set(v)');
    expect(code).toContain('this.__rozieCvaOnChange(v)');
  });

  it('emits a SequenceExpression for an expression-context model write', () => {
    // ok ? ($model.value = v) : null
    //   → ok ? (this.value.set(v), this.__rozieCvaOnChange(v)) : null
    expect(code).toMatch(
      /\(this\.value\.set\(v\),\s*this\.__rozieCvaOnChange\(v\)\)/,
    );
  });

  it('injects __rozieCvaOnChange at the template handler write site', () => {
    // @input="$model.value = 'x'" → value.set('x'), __rozieCvaOnChange('x')
    expect(code).toContain("value.set('x')");
    expect(code).toContain("__rozieCvaOnChange('x')");
  });

  it('does NOT wire __rozieCvaOnChange via effect()', () => {
    // No effect( ... __rozieCvaOnChange ) construct anywhere.
    expect(code).not.toMatch(/effect\([^)]*__rozieCvaOnChange/);
  });
});

describe('emitAngular CVA — Task 1: non-CVA components are untouched', () => {
  it('a multi-model component never injects __rozieCvaOnChange', () => {
    const { code } = compileAngular(
      fixture('MultiModelProbe'),
      'MultiModelProbe.rozie',
    );
    expect(code).not.toContain('__rozieCvaOnChange');
  });

  it('a single-model component with cva:false never injects __rozieCvaOnChange', () => {
    const { code } = compileAngular(WRITE_SRC, WRITE_FILE, { cva: false });
    expect(code).not.toContain('__rozieCvaOnChange');
  });
});

// ---------------------------------------------------------------------------
// Task 2 — disabled OR-merge.
// ---------------------------------------------------------------------------

// A flatpickr-shaped single-model component WITH a `disabled` prop, read in the
// <script>, a template binding, and a listener.
const DISABLED_SRC = `<rozie name="DisabledProbe">
<props>
{
  value: { type: String, default: '', model: true },
  disabled: { type: Boolean, default: false },
}
</props>
<script>
function maybeWrite(v) {
  if ($props.disabled) return
  $model.value = v
}
</script>
<template>
  <input class="d" :disabled="$props.disabled" :value="$props.value" />
</template>
</rozie>`;
const DISABLED_FILE = 'DisabledProbe.rozie';

// Same shape but NO `disabled` prop — the merge must NOT appear.
const NO_DISABLED_SRC = fixture('SingleModelNoDisabled');
const NO_DISABLED_FILE = 'SingleModelNoDisabled.rozie';

describe('emitAngular CVA — Task 2: disabled OR-merge', () => {
  const { code } = compileAngular(DISABLED_SRC, DISABLED_FILE);

  it('OR-merges __rozieCvaDisabled into the script disabled read', () => {
    expect(code).toContain('this.disabled() || this.__rozieCvaDisabled()');
  });

  it('OR-merges __rozieCvaDisabled into the template disabled binding', () => {
    // Template context drops `this.` → (disabled() || this.__rozieCvaDisabled())
    expect(code).toMatch(/disabled\(\)\s*\|\|\s*this\.__rozieCvaDisabled\(\)/);
  });

  it('does NOT merge for a non-CVA component', () => {
    const { code: off } = compileAngular(DISABLED_SRC, DISABLED_FILE, {
      cva: false,
    });
    expect(off).not.toContain('__rozieCvaDisabled()');
  });

  it('does NOT merge a non-disabled prop read', () => {
    // value is a model prop, not the disabled prop — never OR-merged.
    expect(code).not.toMatch(/value\(\)\s*\|\|\s*this\.__rozieCvaDisabled/);
  });

  it('OR-merges the disabled read inside an $onMount-paired handler (ngAfterViewInit seed)', () => {
    // The $onMount handler body is sliced into ngAfterViewInit by
    // pairClonedLifecycle on the SAME nodes rewriteRozieIdentifiers rewrites, so
    // a disabled read in the seed also OR-merges.
    const SEED = `<rozie name="SeedDisabledProbe">
<props>
{
  value: { type: String, default: '', model: true },
  disabled: { type: Boolean, default: false },
}
</props>
<script>
function seed() {
  if ($props.disabled) return
  $model.value = 'seeded'
}
$onMount(seed)
</script>
<template>
  <input class="sd" :value="$props.value" />
</template>
</rozie>`;
    const { code: seedCode } = compileAngular(SEED, 'SeedDisabledProbe.rozie');
    expect(seedCode).toMatch(
      /ngAfterViewInit[\s\S]*this\.disabled\(\)\s*\|\|\s*this\.__rozieCvaDisabled\(\)/,
    );
    // The seed write also bridges to the form.
    expect(seedCode).toContain(
      "this.value.set('seeded'), this.__rozieCvaOnChange('seeded')",
    );
  });
});

describe('emitAngular CVA — Task 2: no-disabled CVA component', () => {
  it('a single-model CVA component with no disabled prop emits no OR-merge', () => {
    const { code } = compileAngular(NO_DISABLED_SRC, NO_DISABLED_FILE);
    // setDisabledState still emits (no-op body), but no disabled READ to merge.
    expect(code).toContain('setDisabledState');
    expect(code).not.toContain('|| this.__rozieCvaDisabled()');
  });
});

// ---------------------------------------------------------------------------
// Task 3 — ROZ124 / ROZ125 / ROZ126 diagnostics.
// ---------------------------------------------------------------------------

describe('emitAngular CVA — Task 3: ROZ125 multi-model info', () => {
  it('a ≥2-model component yields exactly one ROZ125 and no NG_VALUE_ACCESSOR', () => {
    const { code, diagnostics } = compileAngular(
      fixture('MultiModelProbe'),
      'MultiModelProbe.rozie',
    );
    const roz125 = diagnostics.filter((d) => d.code === 'ROZ125');
    expect(roz125).toHaveLength(1);
    expect(roz125[0]!.severity).toBe('info');
    expect(code).not.toContain('NG_VALUE_ACCESSOR');
  });
});

describe('emitAngular CVA — Task 3: ROZ124 expose collision error', () => {
  it('CVA ON: $expose({ writeValue }) fires ROZ124 naming writeValue', () => {
    const { diagnostics } = compileAngular(
      fixture('ExposeCvaCollision'),
      'ExposeCvaCollision.rozie',
    );
    const roz124 = diagnostics.filter((d) => d.code === 'ROZ124');
    expect(roz124).toHaveLength(1);
    expect(roz124[0]!.severity).toBe('error');
    expect(roz124[0]!.message).toContain('writeValue');
  });

  it('cva:false: the same source fires NO ROZ124', () => {
    const { diagnostics } = compileAngular(
      fixture('ExposeCvaCollision'),
      'ExposeCvaCollision.rozie',
      { cva: false },
    );
    expect(diagnostics.filter((d) => d.code === 'ROZ124')).toHaveLength(0);
  });
});

describe('emitAngular CVA — Task 3: ROZ126 no-disabled info', () => {
  it('a single-model CVA component with no disabled prop fires one ROZ126', () => {
    const { code, diagnostics } = compileAngular(
      NO_DISABLED_SRC,
      NO_DISABLED_FILE,
    );
    const roz126 = diagnostics.filter((d) => d.code === 'ROZ126');
    expect(roz126).toHaveLength(1);
    expect(roz126[0]!.severity).toBe('info');
    // setDisabledState still emits as a no-op.
    expect(code).toContain('setDisabledState');
  });

  it('a CVA component WITH a disabled prop fires NO ROZ126', () => {
    const { diagnostics } = compileAngular(DISABLED_SRC, DISABLED_FILE);
    expect(diagnostics.filter((d) => d.code === 'ROZ126')).toHaveLength(0);
  });
});

describe('emitAngular CVA — Task 3: zero-model → no CVA diagnostics', () => {
  it('a zero-model component yields no ROZ124/125/126', () => {
    const ZERO = `<rozie name="ZeroModelDiag">
<props>{ label: { type: String, default: '' } }</props>
<template><div>{{ $props.label }}</div></template>
</rozie>`;
    const { diagnostics } = compileAngular(ZERO, 'ZeroModelDiag.rozie');
    for (const code of ['ROZ124', 'ROZ125', 'ROZ126']) {
      expect(diagnostics.filter((d) => d.code === code)).toHaveLength(0);
    }
  });

  it('compile never throws on any of the three Plan-01 fixtures', () => {
    expect(() =>
      compileAngular(fixture('MultiModelProbe'), 'MultiModelProbe.rozie'),
    ).not.toThrow();
    expect(() =>
      compileAngular(fixture('ExposeCvaCollision'), 'ExposeCvaCollision.rozie'),
    ).not.toThrow();
    expect(() =>
      compileAngular(
        fixture('SingleModelNoDisabled'),
        'SingleModelNoDisabled.rozie',
      ),
    ).not.toThrow();
  });
});
