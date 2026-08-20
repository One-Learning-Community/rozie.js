/**
 * attrApplierRuntimeImports — Quick task 260819-sg9, Task 2.
 *
 * Red-first proof for the two emitter splice sites (`applyAttrsHelperDecl()`
 * / `hostAttrsGetterDecl()` in `emit/emitTemplateAttribute.ts`) being
 * replaced by `AngularImportCollector.addRuntime()` calls that resolve
 * against the real `@rozie/runtime-angular` exports `createRozieAttrApplier`
 * / `createRozieHostAttrsReader` (Task 1), instead of inlining an ~85-line
 * private-field IIFE pair into every emitted component. Mirrors the shape
 * of `runtimeHelperImports.test.ts` (Quick task 260819-qo8, Tier 1).
 *
 * Six seams:
 *   A. literal `r-bind` spread, no `$attrs` — applier only.
 *   B. synthesized `$attrs` auto-fallthrough — both factories.
 *   C. field-initializer position — both `inject()` calls stay in class
 *      fields, applier field before host-getter field.
 *   D. two spreads on one template — ONE shared applier field, ONE import
 *      line.
 *   E. byte-identity boundary — a component using no spread at all.
 *   Combined ordering — slots + $attrs + display wrap + context, proving
 *      all six runtime specifiers land on ONE import line, sorted by
 *      exported name.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// packages/targets/angular/src/__tests__ -> repo root
const REPO_ROOT = resolve(HERE, '../../../../..');

function compileAngular(src: string, filename = 'Test.rozie'): string {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(`parse() failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) {
    throw new Error('lowerToIR() returned null IR');
  }
  const ir: IRComponent = lowered.ir;
  const { code } = emitAngular(ir, { filename, source: src });
  return code;
}

// `inherit-attrs="false"` disables the synthesized `$attrs` auto-fallthrough
// spread (`synthesizeAttrsFallthrough` — see established_facts / RBindProbe
// precedent) so this fixture exercises ONLY the literal r-bind spread, no
// `$attrs` lowering.
const SEAM_A_SRC = `<rozie name="SpreadLiteral" inherit-attrs="false">
<template>
<button r-bind="{ id: 'x', title: 't' }"></button>
</template>
</rozie>`;

// Default `inherit-attrs` (true) — the single-root `<button>` gets the
// synthesized `$attrs` spread appended automatically; no author-written
// r-bind is needed to exercise the host-reader lowering.
const SEAM_B_SRC = `<rozie name="SpreadAttrs">
<template>
<button></button>
</template>
</rozie>`;

// Two author-written literal spreads sharing one root; `inherit-attrs="false"`
// keeps the count at exactly two (no synthesized third).
const SEAM_D_SRC = `<rozie name="SpreadTwo" inherit-attrs="false">
<template>
<div>
  <button r-bind="{ id: 'a' }"></button>
  <button r-bind="{ id: 'b' }"></button>
</div>
</template>
</rozie>`;

// Slots (RozieSlot) + a wrapped interpolation (rozieDisplay/rozieAttr) +
// $inject context (rozieToken) + the default-on $attrs auto-fallthrough
// (createRozieAttrApplier/createRozieHostAttrsReader) — single root so the
// fallthrough synthesizer fires.
const COMBINED_SRC = `<rozie name="Combined">
<props>{ value: { type: String, default: '' } }</props>
<script>
const theme = $inject('theme');
</script>
<template>
<div>
  {{ theme.color }}
  <slot name="cell-status" :value="value()"></slot>
</div>
</template>
</rozie>`;

function runtimeImportLines(code: string): string[] {
  return code.split('\n').filter((line) => line.includes('@rozie/runtime-angular'));
}

describe('attrApplierRuntimeImports — Angular emitter imports the r-bind/$attrs helpers from @rozie/runtime-angular', () => {
  describe('Seam A — literal r-bind spread, no $attrs', () => {
    it('emits the one-line factory-call field initializer for the applier', () => {
      const code = compileAngular(SEAM_A_SRC);
      expect(code).toContain(
        'private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));',
      );
    });

    it('emits exactly ONE @rozie/runtime-angular import line naming createRozieAttrApplier but NOT createRozieHostAttrsReader', () => {
      const code = compileAngular(SEAM_A_SRC);
      const lines = runtimeImportLines(code);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('createRozieAttrApplier');
      expect(lines[0]).not.toContain('createRozieHostAttrsReader');
    });

    it('no module-scope, field-scope, or IIFE copy of the applier body survives', () => {
      const code = compileAngular(SEAM_A_SRC);
      expect(code).not.toContain('prevKeysByElement');
      expect(code).not.toContain('prevClassTokensByElement');
      expect(code).not.toContain('const renderer = inject(Renderer2);');
      expect(code).not.toMatch(/__rozieApplyAttrs = \(\(\) => \{/);
    });

    it('the @angular/core import line is unchanged — still lists inject, Renderer2, ElementRef, afterRenderEffect, viewChild', () => {
      const code = compileAngular(SEAM_A_SRC);
      const coreLine = code.split('\n').find((line) => line.includes("from '@angular/core';"));
      expect(coreLine).toBeDefined();
      for (const sym of ['inject', 'Renderer2', 'ElementRef', 'afterRenderEffect', 'viewChild']) {
        expect(coreLine).toMatch(new RegExp(`\\b${sym}\\b`));
      }
    });

    it('the per-spread afterRenderEffect field is byte-unchanged', () => {
      const code = compileAngular(SEAM_A_SRC);
      expect(code).toMatch(/private __rozieSpread_\d+_effect = afterRenderEffect\(\(\) => \{/);
      expect(code).toMatch(/this\.__rozieApplyAttrs\(el, /);
    });
  });

  describe('Seam B — synthesized $attrs auto-fallthrough', () => {
    it('emits the one-line factory-call field initializer for the host-attrs reader', () => {
      const code = compileAngular(SEAM_B_SRC);
      expect(code).toContain(
        'private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));',
      );
    });

    it('the runtime import line lists BOTH factories', () => {
      const code = compileAngular(SEAM_B_SRC);
      const lines = runtimeImportLines(code);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('createRozieAttrApplier');
      expect(lines[0]).toContain('createRozieHostAttrsReader');
    });

    it('the effect body still reads this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs())', () => {
      const code = compileAngular(SEAM_B_SRC);
      expect(code).toContain('this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());');
    });
  });

  describe('Seam C — field-initializer position (RESEARCH Pitfall 8)', () => {
    it('both inject() calls appear inside class-field initializers, never inside an arrow method body, applier field before host-getter field', () => {
      const code = compileAngular(SEAM_B_SRC);
      const applyIdx = code.indexOf(
        'private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));',
      );
      const hostIdx = code.indexOf(
        'private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));',
      );
      expect(applyIdx).toBeGreaterThan(-1);
      expect(hostIdx).toBeGreaterThan(-1);
      expect(applyIdx).toBeLessThan(hostIdx);
      // Neither inject() call is nested inside an arrow function body — both
      // lines are `private <name> = <factory>(inject(<Type>));`, a bare
      // field-initializer call expression, not `() => { ... inject ... }`.
      expect(code).not.toMatch(/=>\s*\{\s*[^}]*\binject\(Renderer2\)/s);
      expect(code).not.toMatch(/=>\s*\{\s*[^}]*\binject\(ElementRef\)/s);
    });
  });

  describe('Seam D — two spreads on one template', () => {
    it('still exactly ONE applier field, and still ONE runtime import line', () => {
      const code = compileAngular(SEAM_D_SRC);
      const helperDecls = (code.match(/__rozieApplyAttrs = createRozieAttrApplier/g) ?? []).length;
      expect(helperDecls).toBe(1);
      const lines = runtimeImportLines(code);
      expect(lines).toHaveLength(1);
    });
  });

  describe('Seam E — byte-identity boundary', () => {
    it('examples/ROnProbe.rozie emits no reference to @rozie/runtime-angular at all', () => {
      const src = readFileSync(resolve(REPO_ROOT, 'examples/ROnProbe.rozie'), 'utf8');
      const code = compileAngular(src, 'ROnProbe.rozie');
      expect(code).not.toContain('@rozie/runtime-angular');
    });
  });

  describe('Combined ordering — slots + $attrs + display wrap + context', () => {
    it('emits ONE runtime import line, all six specifiers sorted by exported name', () => {
      const code = compileAngular(COMBINED_SRC);
      const lines = runtimeImportLines(code);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(
        `import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay, rozieToken } from '@rozie/runtime-angular';`,
      );
    });
  });
});
