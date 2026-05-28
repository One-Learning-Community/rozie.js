/**
 * emitTemplate test — Phase 5 Plan 05-04a Task 2.
 *
 * Behavior tests on the template-side emitter for Angular standalone components.
 * Drives the per-block fixture snapshots Counter.template.snap, TodoList.template.snap,
 * Modal.template.snap.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitTemplate } from '../emit/emitTemplate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadIR(name: string): IRComponent {
  const filename = resolve(EXAMPLES, `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return lowered.ir;
}

describe('emitTemplate — Counter button bindings', () => {
  it('Counter emits `(click)="decrement($event)"` and [disabled]="!canDecrement()"', () => {
    const ir = loadIR('Counter');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('(click)="decrement($event)"');
    expect(template).toContain('[disabled]="!canDecrement()"');
  });

  it('Counter does NOT use *ngIf or *ngFor (block syntax only)', () => {
    const ir = loadIR('Counter');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).not.toContain('*ngIf');
    expect(template).not.toContain('*ngFor');
  });
});

describe('emitTemplate — TodoList @for + slots + ngTemplateContextGuard', () => {
  it('TodoList emits `@for (item of items(); track item.id) { ... }`', () => {
    const ir = loadIR('TodoList');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('@for (item of items(); track item.id)');
  });

  it('TodoList emits *ngTemplateOutlet for slot invocations (Phase 07.3.2 — merged with dynamic `templates()?.[name]` signal lookup; @ContentChild static-name path on LEFT of `??` per D-02)', () => {
    const ir = loadIR('TodoList');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    // Phase 07.3.2 — each *ngTemplateOutlet binding is now the merged form
    // `(<X>Tpl ?? templates()?.['<x>'])` (D-02 static-wins; A7 signal call).
    expect(template).toContain(`*ngTemplateOutlet="(headerTpl ?? templates()?.['header'])`);
    expect(template).toContain(`*ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])`);
    expect(template).toContain(`*ngTemplateOutlet="(emptyTpl ?? templates()?.['empty'])`);
  });

  it('TodoList template is parseable Angular block-syntax template (no *ngIf/*ngFor)', () => {
    const ir = loadIR('TodoList');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).not.toContain('*ngIf');
    expect(template).not.toContain('*ngFor');
    // Block syntax present.
    expect(template).toMatch(/@if \(/);
    expect(template).toMatch(/@for \(/);
  });
});

describe('emitTemplate — HTML attribute casing (260520-hus #1, Table·angular)', () => {
  it('Table emits `[colSpan]` not `[colspan]` for dynamic :colspan', () => {
    // Regression: `:colspan="$props.columns.length"` emitted `[colspan]="…"` —
    // an Angular DOM-property binding to the lowercase `colspan`, which the
    // browser does not recognise (the property is `colSpan`). The binding was
    // a silent no-op: every footer cell stayed `colspan=1`, collapsing into
    // column 1 and forcing the table ~24px wider than the Vue baseline.
    const ir = loadIR('Table');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('[colSpan]="columns().length"');
    expect(template).not.toMatch(/\[colspan\]/);
  });
});

describe('emitTemplate — dynamic aria-*/data-* attribute bindings', () => {
  // Regression (.planning/todos angular-aria-data-dynamic-binding): a dynamic
  // `:aria-label` emitted `[aria-label]="…"` — an Angular DOM-PROPERTY binding.
  // `aria-*` / `data-*` have no scalar DOM property, so the binding assigned a
  // no-op expando and the real attribute was never set: a silent a11y
  // regression with no compile error. The correct form is `[attr.aria-label]`.
  function lowerInline(src: string): IRComponent {
    const result = parse(src, { filename: 'AriaTest.rozie' });
    if (!result.ast) {
      throw new Error(
        `parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`,
      );
    }
    const lowered = lowerToIR(result.ast, {
      modifierRegistry: createDefaultRegistry(),
    });
    if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
    return lowered.ir;
  }

  const ARIA_SRC = `<rozie name="AriaTest">
<props>{ label: { type: String }, rowId: { type: String } }</props>
<data>{ pressed: false }</data>
<template>
  <div :aria-label="$props.label" :data-row-id="$props.rowId" aria-hidden="true">
    <button :aria-pressed="$data.pressed" :data-label="static {{ $props.label }}">x</button>
  </div>
</template>
</rozie>`;

  it('dynamic :aria-* / :data-* bindings emit the `[attr.NAME]` form', () => {
    const ir = lowerInline(ARIA_SRC);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('[attr.aria-label]="label()"');
    expect(template).toContain('[attr.data-row-id]="rowId()"');
    expect(template).toContain('[attr.aria-pressed]="pressed()"');
  });

  it('interpolated aria-*/data-* attribute emits the `[attr.NAME]` form', () => {
    const ir = lowerInline(ARIA_SRC);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    // `:data-label="static {{ $props.label }}"` — a `{{ }}`-interpolated
    // binding attr, lowered to the `interpolated` AttributeBinding kind.
    expect(template).toMatch(/\[attr\.data-label\]="`static \$\{label\(\)\}`"/);
  });

  it('never emits the silent-no-op DOM-property form `[aria-*]` / `[data-*]`', () => {
    const ir = lowerInline(ARIA_SRC);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    // The buggy property-binding form — `[` immediately followed by the kebab
    // name — must not appear. `[attr.aria-label]` does not match (the prefix
    // after `[` is `attr.`).
    expect(template).not.toMatch(/\[aria-/);
    expect(template).not.toMatch(/\[data-/);
  });

  it('STATIC aria-*/data-* attributes stay plain HTML attributes', () => {
    const ir = lowerInline(ARIA_SRC);
    const { template } = emitTemplate(ir, createDefaultRegistry());
    // `aria-hidden="true"` is static — it must NOT be routed through `[attr.]`.
    expect(template).toContain('aria-hidden="true"');
    expect(template).not.toContain('[attr.aria-hidden]');
  });
});

describe('emitTemplate — Modal r-if conditional + paired close', () => {
  it('Modal r-if emits @if (open()) { ... } block syntax', () => {
    const ir = loadIR('Modal');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toMatch(/@if \(open\(\)\)/);
  });
});

describe('emitTemplate — Pitfall 3 ROZ720 enforcement', () => {
  it('TodoList r-for has :key, no ROZ720 raised', () => {
    const ir = loadIR('TodoList');
    const { diagnostics } = emitTemplate(ir, createDefaultRegistry());
    const roz720s = diagnostics.filter((d) => d.code === 'ROZ720');
    expect(roz720s).toEqual([]);
  });
});

describe('emitTemplate — r-model triggers FormsModule', () => {
  it('SearchInput template uses ngModel long-form binding and reports hasNgModel=true', () => {
    const ir = loadIR('SearchInput');
    const { template, hasNgModel } = emitTemplate(ir, createDefaultRegistry());
    // Signal-typed targets emit `[ngModel]="X()" (ngModelChange)="X.set($event)"`
    // long form because [(ngModel)] requires an LValue and signals need .set().
    expect(template).toContain('[ngModel]="query()"');
    expect(template).toContain('(ngModelChange)="query.set($event)"');
    expect(hasNgModel).toBe(true);
  });

  it('Counter has no r-model and reports hasNgModel=false', () => {
    const ir = loadIR('Counter');
    const { hasNgModel } = emitTemplate(ir, createDefaultRegistry());
    expect(hasNgModel).toBe(false);
  });
});

describe('emitTemplate — per-block snapshot fixtures', () => {
  it('Counter.template.snap', async () => {
    const ir = loadIR('Counter');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    await expect(template).toMatchFileSnapshot(resolve(FIXTURES, 'Counter.template.snap'));
  });

  it('TodoList.template.snap', async () => {
    const ir = loadIR('TodoList');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    await expect(template).toMatchFileSnapshot(resolve(FIXTURES, 'TodoList.template.snap'));
  });

  it('Modal.template.snap', async () => {
    const ir = loadIR('Modal');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    await expect(template).toMatchFileSnapshot(resolve(FIXTURES, 'Modal.template.snap'));
  });
});

// ---------------------------------------------------------------------------
// Phase 17 Plan 01 Task 2 — producer `part="body"` passthrough (SPEC-R4b).
//
// `part` is a standard HTML static attribute and flows through the Angular
// static-attr branch verbatim into the emitted template. On Angular the
// cross-shadow rule itself is a no-op (no shadow boundary) — only the
// producer attribute survives as a benign attr. Part name literal (SPEC-R6).
// ---------------------------------------------------------------------------
describe('emitTemplate — part= passthrough (SPEC-R3/R4b)', () => {
  function lowerInline(source: string, name = 'PartProducer'): IRComponent {
    const result = parse(source, { filename: `${name}.rozie` });
    if (!result.ast) throw new Error('parse() returned null AST');
    const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
    if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
    return lowered.ir;
  }

  const PRODUCER = `<rozie name="PartProducer">
<template>
<div class="card-body" part="body">
  <slot/>
</div>
</template>
</rozie>
`;

  it('emits the producer part="body" attribute verbatim into the Angular template', () => {
    const { template } = emitTemplate(lowerInline(PRODUCER), createDefaultRegistry());
    expect(template).toContain('part="body"');
  });
});
