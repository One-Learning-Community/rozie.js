// Phase 07.2 Plan 05 Task 3 — ROZ943 REPROJECTION_UNDECLARED_WRAPPER_SLOT
// diagnostic test (R6 / D-08).
//
// Per CONTEXT.md D-08: when a wrapper has `<slot name="X">` INSIDE a fill
// body (context: 'fill-body' per D-06's sticky-downward flag) but X does
// NOT appear in the wrapper's declared slot surface (`ir.slots`), the
// re-projection is unreachable — the wrapper has no `name="X"` slot for
// its consumer to fill. ROZ943 surfaces at the `<slot>` source location.
//
// Under current `lowerSlots` semantics, fill-body slots ARE lifted into
// ir.slots regardless of context, so the simple wrapper-with-only-fill-
// body-slot pattern (consumer-re-projection fixture) does NOT trip ROZ943
// — that re-projection IS reachable end-to-end via Vue's scoped-slot
// machinery / React's render-prop / etc. ROZ943 protects against
// adversarial / synthetic cases where ir.slots is explicitly missing the
// re-projected name (or future stricter lowering that excludes fill-body
// slots from the declared surface).
//
// This test exercises ROZ943 via direct threadParamTypes invocation
// against a synthetic IR — the only path that bypasses lowerSlots'
// universal lifting and produces a true "fill-body slot with no matching
// SlotDecl" arrangement.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { compile } from '../../src/compile.js';
import { threadParamTypes } from '../../src/ir/threadParamTypes.js';
import { IRCache } from '../../src/ir/cache.js';
import { ProducerResolver } from '../../src/resolver/index.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type {
  IRComponent,
  TemplateElementIR,
  TemplateSlotInvocationIR,
  SlotFillerDecl,
} from '../../src/ir/types.js';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';

const INNER_SRC = `<rozie name="Inner">

<template>
<div class="inner">
  <header>
    <slot name="header">default header</slot>
  </header>
</div>
</template>

</rozie>
`;

function makeTmpDir(label: string): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), `rozie-roz943-${label}-`));
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Build a minimal synthetic IRComponent for the wrapper:
 *   - ir.slots: explicitly empty (no consumer-fillable slots)
 *   - ir.template: a root with one component-tag <Inner> whose
 *     slotFillers[0].body contains a TemplateSlotInvocation with
 *     context='fill-body' and slotName='undeclaredX'
 *
 * Bypasses lowerSlots' universal lifting so we can directly assert
 * threadParamTypes emits ROZ943 for the unreachable re-projection.
 */
function buildSyntheticWrapperIR(): IRComponent {
  const reprojection: TemplateSlotInvocationIR = {
    type: 'TemplateSlotInvocation',
    slotName: 'undeclaredX',
    args: [],
    fallback: [],
    sourceLoc: { start: 100, end: 130 },
    context: 'fill-body',
  };
  const filler: SlotFillerDecl = {
    type: 'SlotFillerDecl',
    name: 'header',
    params: [],
    body: [reprojection],
    sourceLoc: { start: 90, end: 140 },
  };
  const innerComponentTag: TemplateElementIR = {
    type: 'TemplateElement',
    tagName: 'Inner',
    tagKind: 'component',
    componentRef: {
      importPath: './inner.rozie',
      sourceLoc: { start: 0, end: 30 },
    },
    attributes: [],
    events: [],
    children: [],
    slotFillers: [filler],
    sourceLoc: { start: 80, end: 150 },
  };
  return {
    type: 'IRComponent',
    name: 'Wrapper',
    props: [],
    state: [],
    computed: [],
    refs: [],
    emits: [],
    lifecycle: [],
    listeners: [],
    setupBody: {
      type: 'SetupBody',
      // biome-ignore lint/suspicious/noExplicitAny: synthetic IR for test
      scriptProgram: { type: 'Program', body: [], directives: [], sourceType: 'module' } as any,
    },
    slots: [], // empty — no consumer-fillable surface
    style: null,
    template: {
      type: 'TemplateFragment',
      children: [innerComponentTag],
      sourceLoc: { start: 0, end: 200 },
    },
    // biome-ignore lint/suspicious/noExplicitAny: synthetic IR for test
  } as any as IRComponent;
}

describe('ROZ943 REPROJECTION_UNDECLARED_WRAPPER_SLOT — Phase 07.2 Plan 05 (R6 / D-08)', () => {
  it('emits ROZ943 when a fill-body <slot> references a name not in ir.slots', () => {
    const { dir, cleanup } = makeTmpDir('synthetic');
    try {
      writeFileSync(join(dir, 'inner.rozie'), INNER_SRC, 'utf8');
      const ir = buildSyntheticWrapperIR();
      const diagnostics: Diagnostic[] = [];
      const modifierRegistry = createDefaultRegistry();
      const cache = new IRCache({ modifierRegistry });
      const resolver = new ProducerResolver({ root: dir });

      threadParamTypes(ir, join(dir, 'wrapper.rozie'), cache, resolver, diagnostics);

      const roz943 = diagnostics.find((d) => d.code === 'ROZ943');
      expect(roz943).toBeDefined();
      expect(roz943!.severity).toBe('error');
      expect(roz943!.message).toMatch(/undeclaredX/);
      expect(roz943!.loc).toBeDefined();
      expect(roz943!.loc!.start).toBe(100);
      expect(roz943!.hint).toBeDefined();
      expect(roz943!.hint!).toMatch(/undeclaredX/);
    } finally {
      cleanup();
    }
  });

  it('does NOT emit ROZ943 for the simple-wrapper pattern (fill-body slot lifted into ir.slots by lowerSlots)', () => {
    // The Wave-2 consumer-re-projection fixture is the "simple wrapper"
    // shape: wrapper has ONLY a fill-body `<slot name="title">` (no
    // top-level declaration). Under current `lowerSlots` semantics, this
    // single fill-body slot lifts to ir.slots so the consumer CAN fill it
    // and runtime works end-to-end. ROZ943 checks ir.slots membership,
    // so the simple-wrapper shape does NOT trip the diagnostic.
    const { dir, cleanup } = makeTmpDir('simple');
    try {
      writeFileSync(join(dir, 'inner.rozie'), INNER_SRC, 'utf8');
      const wrapperSrc = `<rozie name="Wrapper">

<components>
{
  Inner: './inner.rozie',
}
</components>

<template>
<Inner>
  <template #header>
    <slot name="title">default title</slot>
  </template>
</Inner>
</template>

</rozie>`;
      const wrapperPath = join(dir, 'wrapper.rozie');
      writeFileSync(wrapperPath, wrapperSrc, 'utf8');

      const result = compile(wrapperSrc, {
        target: 'vue',
        filename: wrapperPath,
        resolverRoot: dir,
      });

      expect(
        result.diagnostics.find((d) => d.code === 'ROZ943'),
      ).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it('does NOT emit ROZ943 when the wrapper ALSO declares the slot at top level', () => {
    const { dir, cleanup } = makeTmpDir('declared');
    try {
      writeFileSync(join(dir, 'inner.rozie'), INNER_SRC, 'utf8');
      const wrapperSrc = `<rozie name="Wrapper">

<components>
{
  Inner: './inner.rozie',
}
</components>

<template>
<aside>
  <slot name="title">declared default</slot>
</aside>
<Inner>
  <template #header>
    <slot name="title">re-projected default</slot>
  </template>
</Inner>
</template>

</rozie>`;
      const wrapperPath = join(dir, 'wrapper.rozie');
      writeFileSync(wrapperPath, wrapperSrc, 'utf8');

      const result = compile(wrapperSrc, {
        target: 'vue',
        filename: wrapperPath,
        resolverRoot: dir,
      });

      expect(
        result.diagnostics.find((d) => d.code === 'ROZ943'),
      ).toBeUndefined();
    } finally {
      cleanup();
    }
  });
});
