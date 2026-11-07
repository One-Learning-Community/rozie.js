/**
 * `.passive` / `.once` on a JSX-prop TEMPLATE `@event` have no React form. React used to WARN and
 * then bind the handler without the option, so a `.once` handler fired every time. It is now an
 * error, matching Solid, Svelte and Angular. `.capture` still maps to `on<Event>Capture`, and
 * `<input @change>` (bound with addEventListener) still takes all three options.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

function emit(template: string) {
  const src = `<rozie name="Test">
<script>
const onKey = () => {}
</script>
<template>
  ${template}
</template>
</rozie>`;
  const { ast } = parse(src, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null');
  return emitReact(ir, { filename: 'Test.rozie', modifierRegistry: registry });
}

const modifierDiagnostics = (ds: { message: string }[]) =>
  ds.filter((d) => /has no JSX-prop equivalent/.test(d.message));

describe('template @event native modifiers on React', () => {
  for (const mod of ['passive', 'once']) {
    it(`.${mod} on a JSX-prop template @event is an error, not a warning`, () => {
      const ds = modifierDiagnostics(emit(`<div @keydown.${mod}="onKey"></div>`).diagnostics);
      expect(ds).toHaveLength(1);
      expect(ds[0]!.severity).toBe('error');
      expect(ds[0]!.message).toContain('<listeners>');
    });
  }

  it('.capture still compiles to the Capture JSX prop', () => {
    const { code, diagnostics } = emit(`<div @keydown.capture="onKey"></div>`);
    expect(modifierDiagnostics(diagnostics)).toHaveLength(0);
    expect(code).toContain('onKeyDownCapture');
  });

  it('.once on <input @change> (addEventListener path) still compiles', () => {
    const { code, diagnostics } = emit(`<input @change.once="onKey" />`);
    expect(modifierDiagnostics(diagnostics)).toHaveLength(0);
    expect(code).toContain('once: true');
  });
});
