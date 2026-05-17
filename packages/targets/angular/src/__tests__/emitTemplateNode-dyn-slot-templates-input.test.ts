/**
 * emitTemplateNode — Phase 07.3.2.1 Plan 01 Task 1.
 *
 * §dyn-slot-templates-input — consumer-side dynamic-name slot dispatch
 * binds `[templates]="<getterName>"` as an Angular property INPUT on the
 * producer tag (NOT as a projected `<ng-container *ngTemplateOutlet>` child).
 *
 * The consumer's class-body `templates` getter (deterministic-name collapse
 * via scriptInjections at emitTemplateNode.ts:449) wires through the producer's
 * already-correct `templates = input<Record<string, TemplateRef<unknown>> |
 * undefined>(undefined)` signal (Phase 07.3.2 Plan 03). The producer's
 * merged guard `@if ((headerTpl ?? templates()?.['header']))` (Plan 10) then
 * resolves the dispatch at runtime.
 *
 * Static-only producer tags MUST NOT gain a `[templates]` attribute — the
 * `dynRefs.length > 0` guard (Pattern A) preserves D-04 byte-identity for
 * non-dynamic consumer-fill fixtures.
 *
 * Closes F-07.3.2-11-A (Angular row of Phase 07.3.2 SC#5; 5/6 → 6/6).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');

function compileExample(name: string): string {
  const filename = resolve(REPO_ROOT, 'examples', `${name}.rozie`);
  const src = readFileSync(filename, 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() failed for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() failed for ${name}`);
  return emitAngular(lowered.ir, { filename, source: src }).code;
}

describe('§dyn-slot-templates-input — consumer-side dynamic-name slot dispatch binds [templates]= as input (F-07.3.2-11-A)', () => {
  it('emits `[templates]="templates"` on the producer tag containing dynamic-name fills', () => {
    const code = compileExample('ModalConsumer');
    // Producer tag for Modal 2 must carry the property-input binding (D-01).
    expect(code).toMatch(/<rozie-modal[^>]*\[templates\]="templates"/);
  });

  it('does NOT emit a projected `<ng-container *ngTemplateOutlet="templates[...]">` child', () => {
    const code = compileExample('ModalConsumer');
    // Negative grep — the broken pre-fix shape must not appear (D-03).
    expect(code).not.toMatch(/<ng-container \*ngTemplateOutlet="templates\[/);
  });

  it('preserves the `<ng-template #__dynSlot_0>` declaration and `@ViewChild` injection', () => {
    const code = compileExample('ModalConsumer');
    // Pitfall #3 — the ng-template declaration + ViewChild capture must
    // survive; the getter resolves `this.__dynSlot_0!` at runtime.
    expect(code).toContain('<ng-template #__dynSlot_0>');
    expect(code).toContain("@ViewChild('__dynSlot_0', { static: true })");
  });

  it('preserves the class-body `templates` getter (single source of truth)', () => {
    const code = compileExample('ModalConsumer');
    // D-02 — the getter is the binding RHS source of truth; do not duplicate
    // the map composition inline.
    expect(code).toContain('get templates(): Record<string, TemplateRef<unknown>>');
    expect(code).toContain('[this.slotName()]: this.__dynSlot_0!');
  });

  it('STATIC-only producer tags (Modal 1, Modal 3) do NOT gain a [templates] attribute (byte-identity)', () => {
    const code = compileExample('ModalConsumer');
    // Modal 1 (static #header + #footer + default) and Modal 3 (#brand +
    // #actions + default through wrapper) must NOT gain `[templates]`.
    // Count occurrences of [templates]="templates" — must be exactly 1
    // (Modal 2 only). Pattern A / D-04 byte-identity guarantee via the
    // dynRefs.length > 0 guard.
    const matches = code.match(/\[templates\]="templates"/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
