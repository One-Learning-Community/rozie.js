// Quick-task 260519-vyv (Spike 004) — ROZ082 / ROZ084 `@portal` diagnostics.
//
// ROZ082 STYLE_PORTAL_INVALID_NESTING — `@portal` nested inside `@media` (or
//   any non-`@portal` at-rule). The valid direction (`@portal X { @media ...}`)
//   does NOT fire it.
// ROZ084 STYLE_PORTAL_SELECTOR_PARSE_ERROR — empty / malformed `@portal`
//   prelude (e.g. `@portal { ... }` with no name).
//
// ROZ083 is intentionally NOT registered — it was reserved for a `:style`
// string-literal `!important`-drop warning, but no `:style` string-literal
// parser exists in the codebase, so the code has no host to attach to.
//
// Verified through the full compile() path so the diagnostic surfaces with a
// byte-accurate `loc` the renderer can frame.
import { describe, it, expect } from 'vitest';
import { compile } from '../../src/compile.js';

/** Wrap a `<style>` body in a minimal valid component. */
function withStyle(styleBody: string): string {
  return `<rozie name="PortalDiag">

<template>
<div class="x"></div>
</template>

<style>
${styleBody}
</style>

</rozie>`;
}

describe('ROZ082 — @portal nested inside @media', () => {
  it('fires when @portal is wrapped in @media', () => {
    const src = withStyle(
      '@media (min-width: 600px) {\n  @portal item {\n    ul { margin: 0; }\n  }\n}',
    );
    const result = compile(src, { target: 'vue', filename: 'PortalDiag.rozie' });
    const roz082 = result.diagnostics.filter((d) => d.code === 'ROZ082');
    expect(roz082.length).toBe(1);
    expect(roz082[0]!.severity).toBe('error');
    // loc must point at a real byte span inside the source.
    expect(roz082[0]!.loc.start).toBeGreaterThanOrEqual(0);
    expect(roz082[0]!.loc.end).toBeGreaterThan(roz082[0]!.loc.start);
    // The byte slice at the diagnostic loc begins with the `@media` at-rule
    // (the offending nesting starts there).
    expect(src.slice(roz082[0]!.loc.start, roz082[0]!.loc.start + 7)).toBe('@portal');
  });

  it('does NOT fire for the valid direction (@portal containing @media)', () => {
    const src = withStyle(
      '@portal item {\n  @media (min-width: 600px) {\n    ul { margin: 0; }\n  }\n}',
    );
    const result = compile(src, { target: 'vue', filename: 'PortalDiag.rozie' });
    expect(result.diagnostics.some((d) => d.code === 'ROZ082')).toBe(false);
  });
});

describe('ROZ084 — malformed @portal block', () => {
  it('fires on an empty-params @portal block', () => {
    const src = withStyle('@portal {\n  ul { margin: 0; }\n}');
    const result = compile(src, { target: 'react', filename: 'PortalDiag.rozie' });
    const roz084 = result.diagnostics.filter((d) => d.code === 'ROZ084');
    expect(roz084.length).toBe(1);
    expect(roz084[0]!.severity).toBe('error');
    expect(roz084[0]!.loc.end).toBeGreaterThan(roz084[0]!.loc.start);
  });

  it('does NOT fire for a well-formed @portal block', () => {
    const src = withStyle('@portal item {\n  ul { margin: 0; }\n}');
    const result = compile(src, { target: 'react', filename: 'PortalDiag.rozie' });
    expect(result.diagnostics.some((d) => d.code === 'ROZ084')).toBe(false);
  });
});

describe('ROZ083 — explicitly out of scope', () => {
  it('is never emitted (no :style string-literal parser exists)', () => {
    const src = withStyle('@portal item {\n  ul { margin: 0 !important; }\n}');
    const result = compile(src, { target: 'react', filename: 'PortalDiag.rozie' });
    expect(result.diagnostics.some((d) => d.code === 'ROZ083')).toBe(false);
  });
});
