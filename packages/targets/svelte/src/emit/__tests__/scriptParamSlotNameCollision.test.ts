/**
 * Phase 73 Plan 03 (emitter-hardening backlog item #1, part 2 — GREEN half).
 *
 * Task 1 (previous commit) broadened `findRForSlotNameCollisions` (core) to
 * detect a top-level `<script>` helper's PARAMETER shadowing a slot name
 * (Class 2). Because `emitScript.ts`'s merge-ident calc and
 * `emitSlotInvocation.ts`'s render-site calc both already consulted that
 * detector, the merge DECLARATION (`const header$$slot = $derived(...)`) and
 * the template RENDER SITE (`{#if header$$slot}{@render header$$slot()}`)
 * were already correctly renamed as a side effect of Task 1 alone.
 *
 * What Task 1 alone did NOT fix: the SCRIPT-SIDE `$slots.header` read (e.g.
 * inside the very helper whose param shadows it) is rewritten via
 * `rewriteScript.ts` → `portalSlotMergeName(name, ir)` — a SEPARATE helper
 * that, pre-Task-2, only knew about the props/data/computed/top-level-const
 * collision class (its own `Slot`-suffix widened set), NOT the new Class 2.
 * So `$slots.header` kept rewriting to the BARE `header` — which, inside a
 * helper whose OWN parameter is ALSO named `header`, resolves to the
 * shadowed LOCAL PARAM, not the renamed merge. This is the exact rete
 * FlowCanvas `renderNode(element, reteNode)` bug: `if ($slots.node)` would
 * read the (always-truthy) engine node instead of the true slot-presence
 * check, dropping the default-chrome fallback.
 *
 * This suite proves `portalSlotMergeName` (now the single source of truth,
 * also consulted by `findRForSlotNameCollisions` / reprojection) resolves
 * `$slots.header` to the SAME renamed identifier the merge decl + render site
 * use, so the helper's script-side presence check is no longer shadowed.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitSvelte } from '../../emitSvelte.js';

function compileSvelte(src: string, filename = 'Test.rozie'): string {
  const { ast } = parse(src, { filename });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitSvelte(ir, { filename, source: src }).code;
}

// Mirrors the rete FlowCanvas renderNode(element, reteNode) shape: a
// top-level helper's 2nd param shadows the `#header` slot, and the helper's
// OWN body reads $slots.header to decide default-chrome vs custom content.
const HEADER_PARAM_SHADOW_SCRIPT_READ = `<rozie name="HeaderParamShadowScriptRead">
<data>{ chrome: 'unset' }</data>
<script>
function chromeLabel(element, header) {
  return $slots.header ? 'CUSTOM' : 'DEFAULT'
}
$onMount(() => {
  $data.chrome = chromeLabel(null, true)
})
</script>
<template>
<div>
  <span class="chrome">{{ $data.chrome }}</span>
  <slot name="header">fallback-header</slot>
</div>
</template>
</rozie>`;

describe('script/param-scope slot shadow — script-side $slots.X coherence (Class 2, GREEN)', () => {
  it('merge decl, render site, AND the script-side $slots.header read all use the SAME renamed identifier', () => {
    const code = compileSvelte(HEADER_PARAM_SHADOW_SCRIPT_READ);

    // (a) merge decl renamed.
    expect(code).toContain(
      'const header$$slot = $derived(__headerProp ?? snippets?.header);',
    );
    // (b) render site renamed, consistent with (a).
    expect(code).toContain('{#if header$$slot}');
    expect(code).toContain('{@render header$$slot()}');
    // (c) THE FIX: the script-side `$slots.header` read inside chromeLabel
    // resolves to the renamed merge, NOT the shadowed local param `header`.
    expect(code).toContain('return header$$slot ? ');
    // (d) the helper's OWN parameter name is untouched (only the sigil READ
    // was rewritten — the author's param binding stays exactly as authored).
    expect(code).toContain('function chromeLabel(element: any, header: any)');
    // (e) no bare unshadowed `header` sigil-read site survives — the bug
    // shape (bare `return header ? ...`, colliding with the param) is gone.
    expect(code).not.toMatch(/return header \? /);
  });
});
