// ITEM-1 (Phase 46) — React duplicate `_rozieProp_*` destructure dedupe.
//
// When an event is `$emit`'d from 2+ ESCAPING helpers (helpers referenced from
// a useEffect via <listeners>/lifecycle deps), each wrapped helper used to mint
// its OWN `const { onOpenChange: _rozieProp_onOpenChange } = props;` prefix —
// two identical `const` declarations in the same component scope → TS2451
// "Cannot redeclare block-scoped variable."
//
// The fix collects the UNION of `_rozieProp_*` names across all wrapped escaping
// helpers and, ONLY when 2+ helpers share a name, hoists ONE combined
// destructure at the top of the user-arrows section (stripping the per-helper
// prefix for the hoisted names). Single-emit-site components stay byte-identical
// (no hoist when nothing is shared).

import { describe, expect, it } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitScript } from '../emit/emitScript.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

function lowerInline(src: string): IRComponent {
  const result = parse(src, { filename: 'MultiEmit.rozie' });
  if (!result.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return lowered.ir;
}

function emit(ir: IRComponent): string {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const { hookSection, userArrowsSection } = emitScript(ir, collectors);
  return `${hookSection}\n${userArrowsSection}`;
}

/** Count occurrences of a destructured `_rozieProp_<name>` declarator. */
function countDestructureDecls(code: string, propName: string): number {
  // Match the destructured pair `onOpenChange: _rozieProp_onOpenChange` inside a
  // `const { ... } = props;` — counting the renamed-local appearances on the LHS
  // of a destructure (i.e. in a `const { ... } = props` line).
  const re = new RegExp(
    `const\\s*\\{[^}]*_rozieProp_${propName}[^}]*\\}\\s*=\\s*props`,
    'g',
  );
  const m = code.match(re);
  return m ? m.length : 0;
}

// Two helpers both calling `$emit('open-change', …)` (→ `props.onOpenChange`),
// both ESCAPING via a <listeners> document keydown handler (so they land in a
// useEffect dep array and are wrapped in useCallback).
const MULTI_EMIT_SRC = `<rozie name="MultiEmit">
<data>{ open: false }</data>
<script lang="ts">
const openPopup = () => {
  $data.open = true;
  $emit('open-change', { open: true });
};
const closePopup = () => {
  $data.open = false;
  $emit('open-change', { open: false });
};
</script>
<listeners>
<listener :target="document" @keydown.escape="closePopup" />
<listener :target="document" @keydown.enter="openPopup" />
</listeners>
<template>
<div></div>
</template>
</rozie>
`;

// Single-emit-site control: only ONE escaping helper calls props.onOpenChange.
const SINGLE_EMIT_SRC = `<rozie name="SingleEmit">
<data>{ open: false }</data>
<script lang="ts">
const closePopup = () => {
  $data.open = false;
  $emit('open-change', { open: false });
};
</script>
<listeners>
<listener :target="document" @keydown.escape="closePopup" />
</listeners>
<template>
<div></div>
</template>
</rozie>
`;

describe('emitScript — ITEM-1 multi-emit-site _rozieProp_* dedupe', () => {
  it('emits EXACTLY ONE `_rozieProp_onOpenChange` destructure when 2+ escaping helpers share the prop', () => {
    const code = emit(lowerInline(MULTI_EMIT_SRC));
    // Both helpers are wrapped in useCallback (escaping via <listeners>).
    expect(code).toContain('useCallback');
    // The renamed prop local must be destructured EXACTLY ONCE — not once per
    // helper (which would be TS2451).
    expect(countDestructureDecls(code, 'onOpenChange')).toBe(1);
    // And the renamed local is actually used (sanity — the body references it).
    expect(code).toContain('_rozieProp_onOpenChange');
  });

  it('single-emit-site components keep the per-helper destructure (one occurrence, byte-identical path)', () => {
    const code = emit(lowerInline(SINGLE_EMIT_SRC));
    expect(code).toContain('useCallback');
    expect(countDestructureDecls(code, 'onOpenChange')).toBe(1);
  });
});
