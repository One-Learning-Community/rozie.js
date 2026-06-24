// angularReservedDeconflict.test.ts — Phase 61 Plan 04 (cross-target-name-collision).
//
// SC-2 (Angular leg). A single-model Angular component whose INTERNAL names
// (`<data>` / `$computed` / `$refs` / `<script>` helper / `<script>` import
// binding) collide with the widened `reservedClassMembers('angular', { singleModel })`
// set must auto-deconflict so the emitted class compiles clean at ng-packagr
// (gate 4). The renameable side is ALWAYS the internal one:
//   - data/computed/ref/helper → `X$local`
//   - import binding           → `X$import`
// Public-contract names (props, $expose verbs) are NEVER renamed.
//
// These assertions are authored to the POST-fix shape and confirmed RED before
// the Task-2 emitter change (the pre-fix output carries the duplicate
// `writeValue` member + the prop-shadowed `this.offset()` import reference).
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../../core/src/ir/types.js';
import { emitAngular, type EmitAngularOptions } from '../../emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '..', '..', '__tests__', 'fixtures');

function compileAngular(
  src: string,
  filename: string,
  opts: EmitAngularOptions = {},
): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${result.diagnostics
        .map((d) => d.code)
        .join(', ')}`,
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
  return readFileSync(resolve(FIXTURES, `${name}.rozie`), 'utf8');
}

describe('Angular reserved-member deconfliction (Phase 61 Plan 04, SC-2)', () => {
  const SRC = fixture('AngularDataReserved');
  const FILE = 'AngularDataReserved.rozie';

  it('renames a <data> field named a CVA quartet member to X$local (no duplicate class member)', () => {
    const out = compileAngular(SRC, FILE);
    // The data signal is renamed — no `writeValue = signal(...)` field colliding
    // with the generated CVA `writeValue(value)` method.
    expect(out).toContain('writeValue$local = signal(');
    expect(out).not.toMatch(/^\s*writeValue = signal\(/m);
    // The generated CVA accessor method keeps the reserved name.
    expect(out).toMatch(/writeValue\([^)]*\)\s*[:{]/);
    // Template reads the renamed signal (bare in Angular template context); the
    // class body writes via `this.writeValue$local.set(...)`.
    expect(out).toContain('writeValue$local()');
    expect(out).toContain('this.writeValue$local.set(');
  });

  it('renames a <script> helper named a lifecycle hook to X$local', () => {
    const out = compileAngular(SRC, FILE);
    expect(out).toContain('ngOnInit$local');
    // No plain user-authored `ngOnInit()` method shadowing the framework hook.
    // (The generated component has no real ngOnInit; the helper must not claim it.)
    expect(out).not.toMatch(/\bngOnInit\(\)\s*\{[^}]*writeValue/);
  });

  it('renames a $computed named an Object.prototype member to X$local (getter + reads)', () => {
    const out = compileAngular(SRC, FILE);
    expect(out).toContain('hasOwnProperty$local = computed(');
    // Template reads the renamed computed (bare in Angular template context).
    expect(out).toContain('hasOwnProperty$local()');
    // The computed body's `$props.value` lowered to the signal read `this.value()`.
    expect(out).toContain('hasOwnProperty$local = computed(() => this.value().length > 0)');
    // No bare `hasOwnProperty = computed(` overriding the inherited
    // Object.prototype member.
    expect(out).not.toMatch(/\bhasOwnProperty = computed\(/);
  });

  it('renames a $refs field AND its viewChild selector in lockstep', () => {
    const out = compileAngular(SRC, FILE);
    // The viewChild field + selector string both carry the $local suffix.
    expect(out).toContain("viewChild<ElementRef<HTMLDivElement>>('registerOnChange$local')");
    expect(out).toContain('registerOnChange$local = viewChild');
    // The template ref attribute matches the renamed selector.
    expect(out).toContain('#registerOnChange$local');
    // No bare `registerOnChange` viewChild colliding with the CVA method.
    expect(out).not.toContain("viewChild<ElementRef<HTMLDivElement>>('registerOnChange')");
  });

  it('auto-aliases a <script> import binding colliding with an author prop; the prop is untouched', () => {
    const out = compileAngular(SRC, FILE);
    // The import binding is aliased so its references no longer collapse onto
    // the prop's `this.offset()`.
    expect(out).toContain('offset$import');
    expect(out).toContain("from '@floating-ui/dom'");
    // The author prop `offset` stays a real input — never renamed.
    expect(out).toContain('offset = input');
    // The middleware object references the aliased import, NOT this.offset().
    expect(out).toMatch(/offset:\s*offset\$import/);
  });

  it('does NOT rename a non-colliding data name (byte-identity off-collision)', () => {
    // Sanity: the renamed names are ONLY the colliding ones; the prop `value`
    // (public contract) keeps its name.
    const out = compileAngular(SRC, FILE);
    expect(out).toContain('value = model');
    expect(out).not.toContain('value$local');
  });

  it('CVA quartet is single-model-GATED: cva:false leaves the writeValue data name unrenamed', () => {
    // With `cva:false` the component is NOT CVA-receiving (cvaModelProp === null
    // → singleModel off), so the CVA quartet is NOT in the reserved set and the
    // `<data> writeValue` (a CVA-only reserved name) must NOT rename. The
    // Object.prototype `hasOwnProperty` $computed + the import alias still fire
    // (those collisions are unconditional / prop-driven).
    const out = compileAngular(SRC, FILE, { cva: false });
    expect(out).toContain('writeValue = signal(');
    expect(out).not.toContain('writeValue$local');
    // The $refs `registerOnChange` is also CVA-only → unrenamed under cva:false.
    expect(out).toContain("viewChild<ElementRef<HTMLDivElement>>('registerOnChange')");
    expect(out).not.toContain('registerOnChange$local');
    // Object.prototype collision is unconditional — hasOwnProperty still renames.
    expect(out).toContain('hasOwnProperty$local');
    // The import alias is prop-driven (offset prop) — still fires.
    expect(out).toContain('offset$import');
  });
});
