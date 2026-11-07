/**
 * `.capture` / `.passive` / `.once` on a TEMPLATE `@event` are `<listeners>`-only. Svelte (ROZ621),
 * Angular (ROZ722) and Lit (TARGET_LIT_RESERVED) reject them with an ERROR. Solid used to only
 * WARN and then bind the handler without the option — a capture-phase handler silently ran in the
 * bubble phase. It is now an error too, so the four targets agree and nothing compiles wrong.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitTemplate } from '../emit/emitTemplate.js';
import {
  RuntimeSolidImportCollector,
  SolidImportCollector,
} from '../rewrite/collectSolidImports.js';

function diagnosticsFor(attr: string) {
  const src = `<rozie name="Test">
<script>
const onKey = () => {}
</script>
<template>
  <div ${attr}="onKey"></div>
</template>
</rozie>`;
  const { ast } = parse(src, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error('lowerToIR() returned null');
  const { diagnostics } = emitTemplate(
    ir,
    { solid: new SolidImportCollector(), runtime: new RuntimeSolidImportCollector() },
    registry,
  );
  return diagnostics.filter((d) => /has no JSX-prop equivalent/.test(d.message));
}

describe('template @event native modifiers on Solid', () => {
  for (const mod of ['capture', 'passive', 'once']) {
    it(`.${mod} on a template @event is an error, not a warning`, () => {
      const ds = diagnosticsFor(`@keydown.${mod}`);
      expect(ds).toHaveLength(1);
      expect(ds[0]!.severity).toBe('error');
      expect(ds[0]!.message).toContain('<listeners>');
    });
  }
});
