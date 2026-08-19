// quick 260807-cor (D4) Task 1 — `$slotted.<name>` React lowering.
//
// React has no shadow boundary — slot content is already a real light-DOM
// descendant of the component — so `$slotted.<name>` is a COMPILE-TIME
// CONSTANT `[]` on this target (mirrors the 5-no-ops/1-real shape of
// `$reconcileAfterDomMutation`). Additionally, React must never let the
// sigil leak into a `useEffect` dependency array — see renderDepArray.ts /
// emitScript.ts's explicit drop-the-scope handling.

import type { Diagnostic } from '@rozie/core';
import { compile, RozieErrorCode } from '@rozie/core';
import { describe, expect, it } from 'vitest';

const UNKNOWN_REF_CODES: ReadonlySet<string> = new Set([
  RozieErrorCode.UNKNOWN_PROPS_REF,
  RozieErrorCode.UNKNOWN_DATA_REF,
  RozieErrorCode.UNKNOWN_REFS_REF,
  RozieErrorCode.UNKNOWN_SLOTS_REF,
]);

function compileReact(source: string, filename = 'SlottedProbe.rozie') {
  return compile(source, { target: 'react', filename, types: false, sourceMap: false });
}

const READ_SOURCE = `<rozie name="SlottedProbe">
<script lang="ts">
function readSlotted(): void {
  const items = $slotted.default;
  void items;
}
</script>
<template>
<div><slot /></div>
</template>
</rozie>
`;

// Deliberately NO <slot> in this fixture's template — so 'props.children' /
// 'props.render*' cannot appear anywhere in the emitted file for any OTHER
// reason, making a whole-file absence check for those strings unambiguous
// evidence that the watcher's dep array doesn't churn on them either.
const WATCH_SOURCE = `<rozie name="SlottedWatchProbe">
<script lang="ts">
$watch(() => $slotted.default.length, () => {});
</script>
<template>
<div></div>
</template>
</rozie>
`;

describe('$slotted.<name> — React (quick 260807-cor D4)', () => {
  it('compiles cleanly with no unknown-reference diagnostic and no residual $slotted token', () => {
    const { code, diagnostics } = compileReact(READ_SOURCE);
    const errors = diagnostics.filter((d: Diagnostic) => d.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
    const unknownRefs = diagnostics.filter((d: Diagnostic) => UNKNOWN_REF_CODES.has(d.code));
    expect(unknownRefs, JSON.stringify(unknownRefs)).toEqual([]);
    expect(code).not.toContain('$slotted');
  });

  it('$slotted.default lowers to an empty array literal', () => {
    const { code } = compileReact(READ_SOURCE);
    expect(code).toMatch(/const items = \[\];/);
  });

  it('a $watch dep array over $slotted.default.length mentions neither children nor a render-prefixed member', () => {
    const { code, diagnostics } = compileReact(WATCH_SOURCE, 'SlottedWatchProbe.rozie');
    const errors = diagnostics.filter((d: Diagnostic) => d.severity === 'error');
    expect(errors, JSON.stringify(errors)).toEqual([]);
    // No <slot> at all in this fixture — 'props.children' / 'props.render*'
    // cannot arise from anything OTHER than a mis-lowered watcher dep array,
    // so a whole-file absence check is unambiguous evidence.
    expect(code).not.toContain('props.children');
    expect(code).not.toMatch(/props\.render\w*/);
    expect(code).not.toContain('$slotted');
  });
});
