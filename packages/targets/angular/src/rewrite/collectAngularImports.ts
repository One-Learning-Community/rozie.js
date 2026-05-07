/**
 * collectAngularImports — Phase 5 Plan 05-04a Task 1.
 *
 * Pre-computes which `@angular/core` symbols an emitted standalone .ts file
 * will need based on the IRComponent shape. The decorator emitter (emitDecorator)
 * also separately determines which template-feature imports go into the
 * `imports: [...]` array on the @Component decorator (NgTemplateOutlet,
 * FormsModule, etc.) — this collector is for the top-of-file import line
 * `import { ... } from '@angular/core'` that brings in signal APIs.
 *
 * Per RESEARCH Pattern 6 (lines 305-326):
 *   - Always: `Component`, `ViewEncapsulation`
 *   - StateDecl present → `signal`
 *   - ComputedDecl present → `computed`
 *   - PropDecl(model:true) present → `model`
 *   - PropDecl(non-model) present → `input`
 *   - RefDecl present → `viewChild`, `ElementRef`
 *   - LifecycleHook (any phase) → `effect` (auto-tracking effect)
 *   - LifecycleHook with cleanup OR phase=mount/unmount → `inject`, `DestroyRef`
 *   - Listener (<listeners>-block) → `effect`, `inject`, `Renderer2`, `DestroyRef`
 *   - SlotDecl present → `ContentChild`, `TemplateRef`
 *   - $emit calls → `output`
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-angular` imports —
 * debounce/throttle/outsideClick all inline.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';

export type AngularCoreImport =
  | 'Component'
  | 'ViewEncapsulation'
  | 'signal'
  | 'computed'
  | 'effect'
  | 'model'
  | 'input'
  | 'output'
  | 'viewChild'
  | 'ElementRef'
  | 'inject'
  | 'DestroyRef'
  | 'Renderer2'
  | 'ContentChild'
  | 'TemplateRef'
  /**
   * Phase 06.2 P2 (RESEARCH Pitfall 5): `forwardRef` — required for the
   * self-reference idiom `imports: [forwardRef(() => Self)]` in standalone
   * Angular components. emitAngular adds it via `imports.add('forwardRef')`
   * when `tagKind: 'self'` appears anywhere in the template.
   */
  | 'forwardRef';

/** Forms-module import kind — separate import line from `@angular/forms`. */
export type AngularFormsImport = 'FormsModule';

/** Common-module import kind — separate import line from `@angular/common`. */
export type AngularCommonImport = 'NgTemplateOutlet';

export class AngularImportCollector {
  private coreSymbols = new Set<AngularCoreImport>();
  private formsSymbols = new Set<AngularFormsImport>();
  private commonSymbols = new Set<AngularCommonImport>();

  add(name: AngularCoreImport): void {
    this.coreSymbols.add(name);
  }
  addForms(name: AngularFormsImport): void {
    this.formsSymbols.add(name);
  }
  addCommon(name: AngularCommonImport): void {
    this.commonSymbols.add(name);
  }

  has(name: AngularCoreImport): boolean {
    return this.coreSymbols.has(name);
  }
  hasForms(name: AngularFormsImport): boolean {
    return this.formsSymbols.has(name);
  }
  hasCommon(name: AngularCommonImport): boolean {
    return this.commonSymbols.has(name);
  }

  coreNames(): readonly string[] {
    return [...this.coreSymbols].sort();
  }

  /**
   * Render the import lines, sorted alphabetically per source. Returns a
   * single string with one line per import source (\n-terminated each).
   */
  render(): string {
    const lines: string[] = [];
    if (this.coreSymbols.size > 0) {
      const sorted = [...this.coreSymbols].sort();
      lines.push(`import { ${sorted.join(', ')} } from '@angular/core';`);
    }
    if (this.commonSymbols.size > 0) {
      const sorted = [...this.commonSymbols].sort();
      lines.push(`import { ${sorted.join(', ')} } from '@angular/common';`);
    }
    if (this.formsSymbols.size > 0) {
      const sorted = [...this.formsSymbols].sort();
      lines.push(`import { ${sorted.join(', ')} } from '@angular/forms';`);
    }
    if (lines.length === 0) return '';
    return lines.join('\n') + '\n';
  }
}

/**
 * Build the AngularImportCollector by inspecting the IR. Note: FormsModule and
 * NgTemplateOutlet are added later by emitDecorator based on observed template
 * features (r-model presence + slot invocation usage). Here we only handle the
 * features that can be determined purely from the IR top-level decl arrays.
 */
export function collectAngularImports(ir: IRComponent): AngularImportCollector {
  const collector = new AngularImportCollector();

  // Always required (every emitted file is a @Component standalone class).
  collector.add('Component');
  collector.add('ViewEncapsulation');

  if (ir.state.length > 0) {
    collector.add('signal');
  }
  if (ir.computed.length > 0) {
    collector.add('computed');
  }

  const hasModelProps = ir.props.some((p) => p.isModel);
  const hasNonModelProps = ir.props.some((p) => !p.isModel);
  if (hasModelProps) {
    collector.add('model');
  }
  if (hasNonModelProps) {
    collector.add('input');
  }

  if (ir.refs.length > 0) {
    collector.add('viewChild');
    collector.add('ElementRef');
  }

  if (ir.emits.length > 0) {
    collector.add('output');
  }

  // Lifecycle: $effect for setup, plus inject + DestroyRef for cleanup.
  if (ir.lifecycle.length > 0) {
    collector.add('effect');
    // Any cleanup or mount/unmount lifecycle uses inject(DestroyRef).
    const needsDestroyRef = ir.lifecycle.some(
      (lh) => lh.cleanup || lh.phase === 'mount' || lh.phase === 'unmount',
    );
    if (needsDestroyRef) {
      collector.add('inject');
      collector.add('DestroyRef');
    }
  }

  // <listeners>-block entries need effect + inject + Renderer2 (+ DestroyRef
  // implicitly via effect's onCleanup).
  const blockListeners = ir.listeners.filter((l) => l.source === 'listeners-block');
  if (blockListeners.length > 0) {
    collector.add('effect');
    collector.add('inject');
    collector.add('Renderer2');
  }

  // Slots → ContentChild + TemplateRef.
  if (ir.slots.length > 0) {
    collector.add('ContentChild');
    collector.add('TemplateRef');
  }

  return collector;
}
