/**
 * Phase 73 Plan 03 (emitter-hardening backlog item #1, part 2) — the
 * SCRIPT/PARAM-SCOPE slot-name shadow class `findRForSlotNameCollisions`
 * (core) did NOT previously detect.
 *
 * `findRForSlotNameCollisions` already caught the r-for-loop-var == slot-name
 * shadow (Class 1). This suite proves the BROADENED detector also catches
 * Class 2 — a top-level `<script>` HELPER's own PARAMETER named the same as a
 * declared slot:
 *
 *   <script>
 *   function renderNode(element, node) {   // param `node`
 *     if ($slots.node) { ... }             // $slots.node lowers to the bare
 *   }                                      // slot-merge ident `node` — SHADOWED
 *   </script>                              // by the param within this body.
 *   <slot name="node" ... />
 *
 * Real precedent: `packages/ui/rete/src/FlowCanvas.rozie`'s `renderNode(element,
 * reteNode)` — the author renamed the SECOND param away from `node` by hand to
 * dodge exactly this shadow (see its inline comment). This suite (+ the
 * `scriptParamSlotNameCollision.test.ts` emitter-level suite) is what lets that
 * hand workaround be deleted.
 *
 * Distinct from the pre-existing ROZ127 hard error (slot name == a declared
 * `<props>` key) — that collision is NEVER a rename target for this detector.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { findRForSlotNameCollisions } from '../../../../../core/src/ir/findRForSlotNameCollisions.js';

function lower(rozieSrc: string) {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir, diagnostics } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!ir) throw new Error('lowerToIR() returned null');
  return { ir, diagnostics };
}

// A top-level FunctionDeclaration whose 2nd param `header` matches the
// `#header` slot name.
const FUNCTION_DECL_PARAM_SHADOW = `<rozie name="FnDeclParamShadow">
<script>
function chromeLabel(element, header) {
  return $slots.header ? 'CUSTOM' : 'DEFAULT'
}
</script>
<template>
  <div>
    <slot name="header">fallback</slot>
  </div>
</template>
</rozie>`;

// A top-level `const X = (...) => {...}` arrow helper whose param `header`
// matches the `#header` slot name — mirrors FlowCanvas's real
// `const renderNode = (element, reteNode) => {...}` shape.
const ARROW_CONST_PARAM_SHADOW = `<rozie name="ArrowConstParamShadow">
<script>
const chromeLabel = (element, header) => {
  return $slots.header ? 'CUSTOM' : 'DEFAULT'
}
</script>
<template>
  <div>
    <slot name="header">fallback</slot>
  </div>
</template>
</rozie>`;

// A helper param named `title` — no slot is named `title`, so no collision.
const NON_COLLIDING_PARAM = `<rozie name="NoCollide">
<script>
function chromeLabel(element, title) {
  return title
}
</script>
<template>
  <div>
    <slot name="header">fallback</slot>
  </div>
</template>
</rozie>`;

// A declared <props> key `header` sharing a name with `<slot name="header">`
// is the pre-existing ROZ127 HARD ERROR — never a rename target for this
// detector, regardless of whether lowerToIR still returns a (diagnostic-
// bearing) `ir` for further validator passes to run against.
const PROP_SLOT_ROZ127_COLLISION = `<rozie name="PropSlotCollide">
<props>{ header: { type: Boolean, default: false } }</props>
<template>
  <div>
    <slot name="header">fallback</slot>
  </div>
</template>
</rozie>`;

describe('findRForSlotNameCollisions — script/param-scope shadow (Class 2)', () => {
  it('flags a slot name shadowed by a top-level FunctionDeclaration parameter', () => {
    const { ir } = lower(FUNCTION_DECL_PARAM_SHADOW);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set(['header']));
  });

  it('flags a slot name shadowed by a top-level const-arrow-helper parameter', () => {
    const { ir } = lower(ARROW_CONST_PARAM_SHADOW);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set(['header']));
  });

  it('does NOT flag when the helper param name differs from every slot name', () => {
    const { ir } = lower(NON_COLLIDING_PARAM);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set());
  });

  it('does NOT flag a slot==props-key collision (ROZ127 stays a hard error, not a rename)', () => {
    const { ir, diagnostics } = lower(PROP_SLOT_ROZ127_COLLISION);
    // ROZ127 still fires — this detector must not swallow or duplicate it.
    expect(diagnostics.some((d) => d.code === 'ROZ127')).toBe(true);
    expect(findRForSlotNameCollisions(ir)).toEqual(new Set());
  });
});
