/**
 * Typed-surface P1 (Task 17 finding): when Vue emits a module `<script lang="ts">`
 * (`<types>` or `$expose` signatures), user `import` declarations in the
 * component `<script>` must sit at the HEAD of `<script setup>`. Volar/vue-tsc
 * wraps the setup body in a function once a module script exists, and an import
 * that follows `defineProps(...)` then fails with TS1232 ("import declaration
 * can only be used at the top level") plus a TS2307 cascade.
 *
 * Opt-in only: a component with no module script keeps imports where they were
 * (byte-identical to before).
 *
 * Uses the LOCAL `emitVue` source (never `compile()` from `@rozie/core`).
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitVue } from '../emitVue.js';

function emit(src: string): string {
  const { ast } = parse(src, { filename: 'T.rozie' });
  if (!ast) throw new Error('parse() null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() null');
  return emitVue(ir, { filename: 'T.rozie', source: src }).code;
}

const body = (expose: string) => `<rozie name="T">
<props>
{ n: { type: Number, default: 0 } }
</props>
<script>
// a leading comment on the import
import { clamp } from './util';
const bump = () => { return clamp($props.n + 1) }
${expose}
</script>
<template><div>{{ $props.n }}</div></template>
</rozie>
`;

describe('Vue emitter — user imports head <script setup> when a module script exists', () => {
  it('hoists the user import above defineProps (with $expose signatures)', () => {
    const out = emit(body(`$expose({ bump }, { bump: '() => void' })`));
    expect(out).toContain('<script lang="ts">');
    const imp = out.indexOf(`import { clamp } from './util';`);
    expect(imp).toBeGreaterThan(out.indexOf('<script setup lang="ts">'));
    expect(imp).toBeLessThan(out.indexOf('defineProps'));
    expect(out.match(/import \{ clamp \}/g)).toHaveLength(1);
  });

  it('leaves the import in place when there is no module script (byte-identical path)', () => {
    const out = emit(body(`$expose({ bump })`));
    expect(out).not.toContain('<script lang="ts">');
    const imp = out.indexOf(`import { clamp } from './util';`);
    expect(imp).toBeGreaterThan(out.indexOf('defineProps'));
  });
});

describe('Vue emitter — hoisted import does not duplicate the following comment', () => {
  it('prints a comment between the import and the next statement exactly once', () => {
    const src = body(`$expose({ bump }, { bump: '() => void' })`).replace(
      `const bump`,
      `// null-lets marker comment\nconst bump`,
    );
    const out = emit(src);
    expect(out.match(/null-lets marker comment/g)).toHaveLength(1);
  });
});

/**
 * Task 18 (FullCalendar) finding: `inherit-attrs="false" inherit-listeners="false"`
 * emits `defineOptions({ inheritAttrs: false })` in the shell prelude, which sat
 * ABOVE every import of `<script setup>`. With a module script present that is
 * the same TS1232 class as above, so the macro must follow the import run.
 */
describe('Vue emitter — defineOptions follows the imports when a module script exists', () => {
  const optsBody = (expose: string) =>
    body(expose).replace('<rozie name="T">', '<rozie name="T" inherit-attrs="false" inherit-listeners="false">');

  it('places defineOptions after the last import (with $expose signatures)', () => {
    const out = emit(optsBody(`$expose({ bump }, { bump: '() => void' })`));
    const opts = out.indexOf('defineOptions({ inheritAttrs: false });');
    expect(opts).toBeGreaterThan(out.indexOf(`import { clamp } from './util';`));
    expect(opts).toBeGreaterThan(out.indexOf(`from 'vue';`));
    expect(opts).toBeLessThan(out.indexOf('defineProps'));
    expect(out.match(/defineOptions\(/g)).toHaveLength(1);
  });

  it('keeps defineOptions first when there is no module script (byte-identical path)', () => {
    const out = emit(optsBody(`$expose({ bump })`));
    expect(out.indexOf('defineOptions({ inheritAttrs: false });')).toBe(
      out.indexOf('<script setup lang="ts">\n') + '<script setup lang="ts">\n'.length,
    );
  });
});
