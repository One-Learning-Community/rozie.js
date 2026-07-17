/**
 * Quick 260717-8zb (Task 2 Item 2) — Angular `this.`-qualification gap for a
 * bare top-level-helper CALL inside a synthesized class-body getter.
 *
 * `hoistTemplateDoubleReadAccessor` (rewriteTemplateExpression.ts) hoists a
 * double-read `$data.X`/`$props.X` ternary attribute binding into a
 * `protected get __<attr>() { ... }` class-body getter, lowering the body
 * with `prefixThis: true` so `$data.X` becomes `this.X()`. But a bare
 * top-level `<script>` HELPER function referenced inside that SAME ternary
 * (e.g. `labelText(anchor.item)`) is NOT in the signal-identifier set
 * (`prop`/`data`/`ref`/`computed` names only) — it survives as an
 * UNQUALIFIED free identifier in the getter body, a real
 * `this`-bound class-body context (NOT an Angular template — Angular's
 * "no this. needed" auto-resolution does not apply inside a synthesized
 * getter's real TypeScript body). At runtime this throws
 * `ReferenceError: labelText is not defined` (verified empirically —
 * command-palette CommandPalette.rozie's openActionMenu/openArgsSurface
 * workarounds precompute the label to sidestep exactly this).
 *
 * RED-FIRST: this suite was authored against a codebase where the fix had
 * not yet landed; confirmed RED (getter body contained bare `labelText(`,
 * not `this.labelText(`) before the fix.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../../../../core/src/compile.js';

function component(): string {
  return `<rozie name="X">
<data>{ actionAnchor: null }</data>
<script>
const labelText = (o) => (o && o.label !== undefined ? o.label : '')
const openActionMenu = (item) => {
  $data.actionAnchor = { item, actions: [] }
}
</script>
<template>
<div :aria-label="$data.actionAnchor ? labelText($data.actionAnchor.item) : null" @click="openActionMenu({ label: 'hi' })">content</div>
</template>
</rozie>`;
}

describe('Angular this.-qualification — bare helper call inside a hoisted getter (Task 2 Item 2)', () => {
  it('compiles the double-read ternary attribute binding cleanly (no error diagnostics)', () => {
    const result = compile(component(), { target: 'angular', filename: 'X.rozie', types: true });
    const errs = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errs).toEqual([]);
  });

  it('this.-qualifies the bare helper-function CALL inside the synthesized getter body', () => {
    const result = compile(component(), { target: 'angular', filename: 'X.rozie', types: true });
    // The synthesized getter body must call `this.labelText(...)`, never a
    // bare free-identifier `labelText(...)` (which ReferenceErrors at
    // runtime — this IS real TypeScript class-body code, not an Angular
    // template, so Angular's implicit-this template resolution does not
    // apply here).
    expect(result.code).toMatch(/this\.labelText\(/);
    // A bare (unqualified, non-`this.`-prefixed) call must NOT survive.
    expect(result.code).not.toMatch(/[^.]\blabelText\(/);
  });
});
