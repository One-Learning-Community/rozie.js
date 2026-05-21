/**
 * Angular TEMPLATE-expression double-read accessor — strictTemplates
 * narrowing regression.
 *
 * Quick task 260520-w18 follow-up. Uppy.rozie has the binding
 *
 *   :accept="$props.allowedFileTypes ? $props.allowedFileTypes.join(',') : null"
 *
 * The Angular emitter lowers `$props.allowedFileTypes` to a `signal()` call.
 * Reading it twice in one expression produced
 *
 *   [accept]="allowedFileTypes() ? allowedFileTypes().join(',') : null"
 *
 * — two independent signal calls Angular's `strictTemplates` cannot narrow
 * across (the `.join(',')` consequent still sees `string[] | null` →
 * TS2531/TS2538).
 *
 * The fix synthesises a single-read getter class member
 * (`hoistTemplateDoubleReadAccessor`) and binds the attribute to it. This
 * suite locks: (1) Uppy's emitted attr binds to a getter, NOT a double
 * signal call; (2) the getter reads the signal exactly once; (3) reference
 * examples without a double-read accessor are untouched.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseExpression } from '@babel/parser';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, PropDecl } from '../../../../core/src/ir/types.js';
import { emitAngular } from '../emitAngular.js';
import { hoistTemplateDoubleReadAccessor } from '../rewrite/rewriteTemplateExpression.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): { ir: IRComponent; src: string; filename: string } {
  const filename = resolve(EXAMPLES, `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return { ir: lowered.ir, src, filename };
}

/** Slice the `template: \`...\`,` block out of an emitted Angular component. */
function templateOf(code: string): string {
  const m = code.match(/template:\s*`([\s\S]*?)`,/);
  if (!m) throw new Error('no template block in emitted Angular output');
  return m[1]!;
}

function makeIR(props: Array<{ name: string; isModel?: boolean }>): IRComponent {
  return {
    name: 'TestComp',
    props: props.map(
      (p) => ({ name: p.name, isModel: p.isModel ?? false }) as unknown as PropDecl,
    ),
    state: [],
    refs: [],
    computed: [],
    methods: [],
    lifecycle: {},
    slots: [],
    events: [],
    template: { type: 'TemplateFragment', children: [] },
    styles: [],
    components: [],
    listenersBlock: { listeners: [] },
    emits: [],
  } as unknown as IRComponent;
}

describe('Angular template double-read accessor — Uppy :accept', () => {
  it('emitted Uppy Angular component does NOT call allowedFileTypes() twice in one binding', () => {
    const { ir, src, filename } = loadExample('Uppy');
    const { code } = emitAngular(ir, { filename, source: src });
    const template = templateOf(code);

    // The bug: `[accept]="allowedFileTypes() ? allowedFileTypes().join(',') : null"`.
    // After the fix the template binds to a getter — exactly ZERO `allowedFileTypes()`
    // signal calls survive in the template body.
    const callCount = (template.match(/allowedFileTypes\(\)/g) ?? []).length;
    expect(callCount).toBe(0);
  });

  it('Uppy :accept binds to a synthesised single-read getter member', () => {
    const { ir, src, filename } = loadExample('Uppy');
    const { code } = emitAngular(ir, { filename, source: src });
    const template = templateOf(code);

    // Attribute now binds to the getter, not an inline ternary.
    expect(template).toContain('[accept]="__accept"');

    // The getter exists, reads the signal exactly once into a local, and
    // performs the guard-and-use against the narrowed local.
    expect(code).toContain('protected get __accept()');
    const getterCalls = (code.match(/this\.allowedFileTypes\(\)/g) ?? []).length;
    // The class body reads the signal once in the getter. (The $watch on
    // allowedFileTypes references the prop via the source `restrictionsFromProps`
    // arrow — that lowers separately and is not the getter.)
    expect(code).toContain('const __allowedFileTypes = this.allowedFileTypes();');
    expect(code).toContain(
      "return __allowedFileTypes ? __allowedFileTypes.join(',') : null;",
    );
    expect(getterCalls).toBeGreaterThanOrEqual(1);
  });

  it('helper returns null when an accessor is read only once (no hoist needed)', () => {
    const ir = makeIR([{ name: 'allowedFileTypes' }]);
    // Single read — the existing single-call lowering already type-checks.
    const expr = parseExpression('$props.allowedFileTypes');
    expect(
      hoistTemplateDoubleReadAccessor(expr, ir, 'accept', new Set()),
    ).toBeNull();
  });

  it('helper returns null for two DIFFERENT accessors each read once', () => {
    const ir = makeIR([{ name: 'disabled' }, { name: 'busy' }]);
    // `$props.disabled || $props.busy` — each accessor lowers to one call;
    // no narrowing problem, must NOT synthesise a getter.
    const expr = parseExpression('$props.disabled || $props.busy');
    expect(
      hoistTemplateDoubleReadAccessor(expr, ir, 'data-x', new Set()),
    ).toBeNull();
  });

  it('helper synthesises a getter for a same-accessor double read', () => {
    const ir = makeIR([{ name: 'allowedFileTypes' }]);
    const expr = parseExpression(
      "$props.allowedFileTypes ? $props.allowedFileTypes.join(',') : null",
    );
    const hoist = hoistTemplateDoubleReadAccessor(expr, ir, 'accept', new Set());
    expect(hoist).not.toBeNull();
    expect(hoist!.memberName).toBe('__accept');
    expect(hoist!.decl).toContain(
      'const __allowedFileTypes = this.allowedFileTypes();',
    );
    // The signal is read exactly once inside the getter.
    expect((hoist!.decl.match(/this\.allowedFileTypes\(\)/g) ?? []).length).toBe(1);
  });

  it('helper disambiguates the getter name against already-taken names', () => {
    const ir = makeIR([{ name: 'allowedFileTypes' }]);
    const expr = parseExpression(
      "$props.allowedFileTypes ? $props.allowedFileTypes.join(',') : null",
    );
    const hoist = hoistTemplateDoubleReadAccessor(
      expr,
      ir,
      'accept',
      new Set(['__accept']),
    );
    expect(hoist!.memberName).toBe('__accept_2');
  });

  it('reference example Counter is untouched (no synthesised getters)', () => {
    const { ir, src, filename } = loadExample('Counter');
    const { code } = emitAngular(ir, { filename, source: src });
    expect(code).not.toContain('protected get __');
  });

  it('reference example Modal is untouched (no synthesised getters)', () => {
    const { ir, src, filename } = loadExample('Modal');
    const { code } = emitAngular(ir, { filename, source: src });
    expect(code).not.toContain('protected get __');
  });
});
