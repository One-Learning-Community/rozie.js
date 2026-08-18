/**
 * emitTemplateNode — Phase 80 Plan 07 (rebless of Phase 07.3.2.1 Plan 01 Task 1).
 *
 * §dyn-slot-rozieSlot-marker — consumer-side dynamic-name slot dispatch emits a
 * `<ng-template [rozieSlot]="<keyExpr>">` marker declaration as a plain projected
 * child of the producer tag (NOT an Angular property INPUT binding, NOT a
 * `<ng-container *ngTemplateOutlet="templates[...]">` child).
 *
 * Phase 80 replaced the `[templates]="templates"` class-body-getter mechanism
 * (the shape this file used to assert — see git history at the pre-fix baseline
 * commit recorded in tests/angular-runtime/RED-EVIDENCE.md) with a marker
 * directive collected by the producer's own `contentChildren(RozieSlot, {
 * descendants: true })` content query (Phase 80 Plan 04) and folded into
 * `__rozieFillMap` (Phase 80 Plan 04) which the producer's merged guard
 * `@if ((headerTpl ?? __rozieFillMap()['header'] ?? templates()?.['header']))`
 * resolves at runtime. `templates` survives unchanged as the lower-precedence
 * escape-hatch input (SPEC prohibition #3) — it is simply no longer the sole
 * dispatch path for consumer-authored dynamic-name fills.
 *
 * New-shape assertions are proven correct by
 * `packages/targets/angular/src/__tests__/consumerRozieSlotFill.test.ts` (Phase
 * 80 Plan 05, Tasks 1–3, 12/12 passing) — that file is the runtime evidence this
 * rebless cites per SPEC prohibition #5. This file re-runs the same shape
 * against the `ModalConsumer` fixture specifically to keep the original
 * F-07.3.2-11-A regression coverage (Angular row of Phase 07.3.2 SC#5) alive
 * under the new emission form.
 *
 * Closes F-07.3.2-11-A (Angular row of Phase 07.3.2 SC#5; 5/6 → 6/6), re-verified
 * against the Phase 80 marker-directive shape.
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

describe('§dyn-slot-rozieSlot-marker — consumer-side dynamic-name slot dispatch emits a [rozieSlot] marker (F-07.3.2-11-A, Phase 80 rebless)', () => {
  it('does NOT emit `[templates]="templates"` on the producer tag containing dynamic-name fills', () => {
    const code = compileExample('ModalConsumer');
    // The class-body-getter property-input binding is a net deletion (SPEC R4).
    expect(code).not.toMatch(/<rozie-modal[^>]*\[templates\]="templates"/);
  });

  it('does NOT emit a projected `<ng-container *ngTemplateOutlet="templates[...]">` child', () => {
    const code = compileExample('ModalConsumer');
    // Negative grep — the broken pre-fix shape must not appear (D-03, unchanged by Phase 80).
    expect(code).not.toMatch(/<ng-container \*ngTemplateOutlet="templates\[/);
  });

  it('emits a `<ng-template [rozieSlot]="slotName()">` marker in place of the `__dynSlot_0` ref/ViewChild pair', () => {
    const code = compileExample('ModalConsumer');
    // Phase 80: the synthetic ref name and its @ViewChild capture are gone;
    // the marker directive is bound directly to the template-scope key expression.
    expect(code).not.toContain('<ng-template #__dynSlot_0>');
    expect(code).not.toContain("@ViewChild('__dynSlot_0', { static: true })");
    expect(code).toContain('<ng-template [rozieSlot]="slotName()">');
  });

  it('does NOT emit the class-body `templates` getter (net deletion)', () => {
    const code = compileExample('ModalConsumer');
    // Phase 80 R4: the getter that composed `{ [key]: this.__dynSlot_N! }` is deleted;
    // the producer's own contentChildren query collects the marker directly.
    expect(code).not.toContain('get templates(): Record<string, TemplateRef<unknown>>');
    expect(code).not.toContain('[this.slotName()]: this.__dynSlot_0!');
  });

  it('STATIC-only producer tags (Modal 1, Modal 3) do NOT gain a [rozieSlot] marker (byte-identity)', () => {
    const code = compileExample('ModalConsumer');
    // Modal 1 (static #header + #footer + default) and Modal 3 (#brand +
    // #actions + default through wrapper) must NOT gain a [rozieSlot] marker —
    // only Modal 2's dynamic-name fill does (SPEC prohibition #4 — identifier-named
    // static fills are untouched).
    const matches = code.match(/\[rozieSlot\]=/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
