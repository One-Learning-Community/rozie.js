/**
 * runtimeHelperImports — Quick task 260819-qo8, Task 2.
 *
 * Red-first proof for the three emitter splice sites (`__rozieDisplay`/
 * `__rozieAttr` in emitAngular.ts, `rozieToken` in emitContext.ts) being
 * replaced by `AngularImportCollector.addRuntime()` calls that resolve
 * against real `@rozie/runtime-angular` exports (Task 1), instead of
 * inlining a module-scope copy into every emitted component.
 *
 * Four seams:
 *   A. display/attr — a component whose template wraps at least one
 *      interpolation.
 *   B. context — a component using `$provide`/`$inject`.
 *   C. byte-identity — a component using neither.
 *   Combined — a component using slots AND wrapping AND context, proving
 *      the specifiers land on ONE import line, sorted + aliased correctly.
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

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

// Quick task 260819-sg9 (Tier 2) — \`inherit-attrs="false"\` keeps this
// fixture's runtime import line scoped to the display/attr seam this test
// exercises. Without it, the default \`inherit-attrs\` auto-fallthrough
// synthesizes an \`\$attrs\` spread onto this single-root \`<button>\`, which
// would ALSO pull in \`createRozieAttrApplier\`/\`createRozieHostAttrsReader\`
// — a real, separately-proven seam (\`attrApplierRuntimeImports.test.ts\`),
// not something this display/attr-focused test should assert on.
const WRAPPING_SRC = `<rozie name="Display" inherit-attrs="false">
<data>{ obj: {} }</data>
<template>
<button>{{ obj }}</button>
</template>
</rozie>`;

const CONTEXT_ONLY_SRC = `<rozie name="ThemeProvider">
<script>
$provide('theme', { color: 'red' });
</script>
<template>
<div><slot></slot></div>
</template>
</rozie>`;

const CONSUMER_FALLBACK_SRC = `<rozie name="ThemeButton">
<script>
const theme = $inject('theme', { color: 'gray' });
</script>
<template>
<button>{{ theme.color }}</button>
</template>
</rozie>`;

// Quick task 260819-sg9 (Tier 2) — \`inherit-attrs="false"\` is now REQUIRED
// for this to be a genuine "uses none of the runtime package's exports"
// byte-identity control. Without it, the default auto-fallthrough spread
// synthesizes onto this single-root \`<button>\` too, and this fixture would
// legitimately (not spuriously) start referencing
// \`createRozieAttrApplier\`/\`createRozieHostAttrsReader\` — this seam has its
// own dedicated boundary fixture (\`examples/ROnProbe.rozie\`, see
// \`attrApplierRuntimeImports.test.ts\` Seam E); this one stays scoped to
// display/attr/context/slots.
const NEITHER_SRC = `<rozie name="Plain" inherit-attrs="false">
<data>{ count: 0 }</data>
<template>
<button @click="$data.count++">{{ $data.count }}</button>
</template>
</rozie>`;

const COMBINED_SRC = `<rozie name="Combined">
<props>{ value: { type: String, default: '' } }</props>
<script>
const theme = $inject('theme');
</script>
<template>
<div>{{ theme.color }}</div>
<slot name="cell-status" :value="value()"></slot>
</template>
</rozie>`;

describe('runtimeHelperImports — Angular emitter imports helpers from @rozie/runtime-angular', () => {
  describe('Seam A — display/attr wrap', () => {
    it('imports rozieAttr/rozieDisplay under their aliases and defines no module-scope copy', () => {
      const code = compileAngular(WRAPPING_SRC);
      expect(code).toContain(
        `import { rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';`,
      );
      expect(code).not.toContain('function __rozieDisplay(');
      expect(code).not.toContain('function __rozieAttr(');
    });

    it('still emits both delegating class methods, unchanged', () => {
      const code = compileAngular(WRAPPING_SRC);
      expect(code).toContain('rozieDisplay(v: unknown): string { return __rozieDisplay(v); }');
      expect(code).toContain('rozieAttr(v: unknown): string | null { return __rozieAttr(v); }');
    });
  });

  describe('Seam B — $provide/$inject context', () => {
    it('runtime import line includes rozieToken; no module-scope helper/registry survives', () => {
      const code = compileAngular(CONTEXT_ONLY_SRC);
      expect(code).toMatch(/import \{[^}]*\brozieToken\b[^}]*\} from '@rozie\/runtime-angular';/);
      expect(code).not.toContain('function rozieToken(');
      expect(code).not.toContain('__rozieTokenRegistry');
    });

    it('@angular/core import line drops InjectionToken but keeps inject', () => {
      const code = compileAngular(CONTEXT_ONLY_SRC);
      const coreImportLine = code
        .split('\n')
        .find((line) => line.includes("from '@angular/core';"));
      expect(coreImportLine).toBeDefined();
      expect(coreImportLine).not.toMatch(/\bInjectionToken\b/);
      expect(coreImportLine).toMatch(/\binject\b/);
    });

    it('call sites still read inject(rozieToken(...)) / provide: rozieToken(...)', () => {
      const code = compileAngular(CONTEXT_ONLY_SRC);
      expect(code).toContain("provide: rozieToken('theme'),");
    });

    it('a consumer $inject call site still reads inject(rozieToken(...))', () => {
      const code = compileAngular(CONSUMER_FALLBACK_SRC);
      expect(code).toContain("inject(rozieToken('theme'), { optional: true })");
    });
  });

  describe('Seam C — byte-identity for a non-using component', () => {
    it('emits no reference to @rozie/runtime-angular at all', () => {
      const code = compileAngular(NEITHER_SRC);
      expect(code).not.toContain('@rozie/runtime-angular');
    });
  });

  describe('Combined ordering — slots + wrapping + context', () => {
    it('emits ONE runtime import line, specifiers sorted over exported names', () => {
      const code = compileAngular(COMBINED_SRC);
      const runtimeLines = code
        .split('\n')
        .filter((line) => line.includes('@rozie/runtime-angular'));
      expect(runtimeLines).toHaveLength(1);
      // Phase 82 (multi-root-consumer-attribute-fallthrough): COMBINED_SRC's
      // template is a single `<div>` element root plus a sibling `<slot>`
      // invocation, under default inherit-attrs/inherit-listeners flags. The
      // Plan 02 root-classification generalization now recognizes this as a
      // single structural root and synthesizes the attrs/listeners spread
      // onto the `<div>`, which on Angular pulls in the
      // createRozieAttrApplier/createRozieHostAttrsReader helper pair
      // alongside the existing rozieAttr/rozieDisplay/rozieToken imports.
      // Verified via a throwaway compile() probe: zero error diagnostics,
      // the spread lands on the intended `<div>` via #rozieSpread_0 +
      // afterRenderEffect, matching the shape documented in the Phase 82
      // Plan 04 drift ledger for FlowCanvas/NodeType/MapLibre.
      expect(runtimeLines[0]).toBe(
        `import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay, rozieToken } from '@rozie/runtime-angular';`,
      );
    });
  });
});
