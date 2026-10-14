/**
 * Aliased, inline and method `$expose` verbs reach the handle on all six
 * targets. Every emitter binds a verb to the script binding of its name, so
 * `{ open: openGated }`, `{ peek: () => … }` and `{ bump() {} }` used to be
 * dropped silently (React even referenced an undeclared `open`).
 * core's expandExposeAliases gives each such verb a binding of its own name;
 * a verb whose name is already taken is ROZ160.
 */
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

const SOURCE = `<rozie name="Exp">
<data>{ n: 0 }</data>
<script>
const openGated = () => { $data.n = 1 }
const shut = () => { $data.n = 0 }
$expose({ open: openGated, shut, peek: () => $data.n, bump() { $data.n = $data.n + 1 } })
</script>
<template><div>{{ $data.n }}</div></template>
</rozie>`;

/** How each target publishes a verb named `name`. */
const published: Record<(typeof TARGETS)[number], (name: string) => RegExp> = {
  react: (n) => new RegExp(`_rozieExposeRef\\.current = \\{[^}]*\\b${n}\\b`),
  vue: (n) => new RegExp(`defineExpose\\(\\{[^}]*\\b${n}\\b`),
  svelte: (n) => new RegExp(`export (const|function) ${n}\\b`),
  angular: (n) => new RegExp(`^\\s+${n} = `, 'm'),
  solid: (n) => new RegExp(`local\\.ref\\?\\.\\(\\{[^}]*\\b${n}\\b`),
  lit: (n) => new RegExp(`^\\s+${n} = `, 'm'),
};

describe('$expose aliased / inline / method verbs', () => {
  for (const target of TARGETS) {
    it(`${target}: every verb is published and bound`, () => {
      const r = compile(SOURCE, { target, filename: 'Exp.rozie' });
      expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      for (const verb of ['open', 'shut', 'peek', 'bump']) {
        expect(r.code, `${target} ${verb}`).toMatch(published[target](verb));
      }
      // The alias is declared, not left dangling.
      expect(r.code).toMatch(/\bopen = (this\.)?openGated\b/);
    });
  }

  it('ROZ160 when the verb name is already a top-level binding', () => {
    const src = SOURCE.replace(
      'const shut = () => { $data.n = 0 }',
      'const shut = () => { $data.n = 0 }\nconst open = () => {}',
    );
    const r = compile(src, { target: 'vue', filename: 'Exp.rozie' });
    expect(r.diagnostics.map((d) => d.code)).toContain('ROZ160');
  });

  it('ROZ118 for a getter verb', () => {
    const src = SOURCE.replace('bump() {', 'get bump() { return 1 }, bump2() {');
    const r = compile(src, { target: 'vue', filename: 'Exp.rozie' });
    expect(r.diagnostics.map((d) => d.code)).toContain('ROZ118');
  });
});
