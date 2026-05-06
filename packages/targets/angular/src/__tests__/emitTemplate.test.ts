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

  it('TodoList emits *ngTemplateOutlet for slot invocations', () => {
    const ir = loadIR('TodoList');
    const { template } = emitTemplate(ir, createDefaultRegistry());
    expect(template).toContain('*ngTemplateOutlet="headerTpl');
    expect(template).toContain('*ngTemplateOutlet="defaultTpl');
    expect(template).toContain('*ngTemplateOutlet="emptyTpl');
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
