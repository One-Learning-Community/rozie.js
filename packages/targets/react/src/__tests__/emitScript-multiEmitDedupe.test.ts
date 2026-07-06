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

// Phase 73 item #8 — PREMISE VERIFICATION (backlog: "React duplicate
// `const {onX}=props` per emit-site (TS2451)" — an event emitted from 2+
// FUNCTIONS, not just escaping useCallback helpers, per the listbox port
// note: "an event emitted from 2+ functions hoists the prop-destructure once
// per site → duplicate const").
//
// Verified against the CURRENT emitter (feedback_emitter_seam_surgical_per_seam
// — premises are point-in-time notes): `collectPropsCallsToDestructure` /
// `_rozieProp_*` destructuring is minted ONLY by `tryWrapEscapingHelperUseCallback`
// — i.e. ONLY for helpers referenced from a `<listeners>` entry, a template
// `@event` binding (unified into `ir.listeners` per D-20), or a lifecycle
// setupDep. A NON-escaping function (reachable only via `$expose`, or not
// reachable via any listener/lifecycle/watcher at all) never mints ANY
// destructure for its `props.onX` calls — it always emits the raw
// `props.onX && props.onX(...)` form. So a "2+ FUNCTIONS" component can only
// produce the TS2451 duplicate-const shape when 2+ of those functions are
// ESCAPING — which is exactly the shape ITEM-1 (Phase 46) already dedupes
// (proven above for 2 AND verified here for 3, plus a MIXED
// escaping/non-escaping listbox-shaped case). No further emitter change is
// needed; this is a REGRESSION GUARD confirming the listbox source-level
// "route every emit through one wrapper" workaround
// (packages/ui/listbox/src/Listbox.rozie) is stale debt, safely removable —
// per `feedback_emitter_seam_surgical_per_seam`'s "a falsified premise ships
// as a green-×6 regression guard, not a fabricated fix."
describe('emitScript — Phase 73 item #8 premise verification (2+ FUNCTIONS, not just escaping helpers)', () => {
  // Mirrors the REAL Listbox shape: `open` is $expose-only (never referenced
  // from a listener/template/watcher — NOT escaping), `close` is referenced
  // from a document <listeners> entry (escaping), `toggle` is referenced from
  // a template @click (escaping via the D-20 template-event unification).
  // ALL THREE directly call `$emit('open-change', …)`.
  const LISTBOX_SHAPED_SRC = `<rozie name="ListboxShaped">
<data>{ open: false }</data>
<script lang="ts">
const open = () => {
  $data.open = true;
  $emit('open-change', { open: true });
};
const close = () => {
  $data.open = false;
  $emit('open-change', { open: false });
};
const toggle = () => {
  if ($data.open) { close(); } else { open(); }
  $emit('open-change', { open: $data.open });
};
$expose({ open, close, toggle });
</script>
<listeners>
<listener :target="document" @click.outside($refs.controlEl)="close" r-if="$data.open" />
</listeners>
<template>
<div ref="controlEl" @click="toggle"></div>
</template>
</rozie>
`;

  it('mixed escaping ($expose-only "open" + listener-escaping "close" + template-escaping "toggle") sharing an emit target never produces a duplicate `const {onX}=props`', () => {
    const code = emit(lowerInline(LISTBOX_SHAPED_SRC));
    // `close` and `toggle` are escaping (useCallback-wrapped); `open` is not.
    expect(code).toContain('useCallback');
    // `open`, being non-escaping, calls `props.onOpenChange` directly (never
    // destructured) — no conflicting binding with the escaping helpers' local.
    expect(code).toMatch(/function open\(\)/);
    expect(code).toMatch(/props\.onOpenChange/);
    // Exactly one destructured local for the shared prop across the escaping
    // helper(s) — never 2+ (the TS2451 shape this item's premise describes).
    expect(countDestructureDecls(code, 'onOpenChange')).toBe(1);
  });

  it('3 escaping helpers (referenced from 3 distinct <listeners> entries) sharing an emit target hoist to exactly ONE destructure', () => {
    const src = `<rozie name="Multi3">
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
const togglePopup = () => {
  if ($data.open) { closePopup() } else { openPopup() }
  $emit('open-change', { open: $data.open });
};
</script>
<listeners>
<listener :target="document" @keydown.escape="closePopup" />
<listener :target="document" @keydown.enter="openPopup" />
<listener :target="document" @keydown.tab="togglePopup" />
</listeners>
<template>
<div></div>
</template>
</rozie>
`;
    const code = emit(lowerInline(src));
    expect(code).toContain('useCallback');
    expect(countDestructureDecls(code, 'onOpenChange')).toBe(1);
  });
});
