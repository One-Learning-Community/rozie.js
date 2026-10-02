/**
 * A composed child's slot `:param-types` naming a type declared in the
 * CHILD's `<types>` block (`{ group: 'ProducerGroup' }`) is threaded onto the
 * consumer's fill. Any consumer output that prints that type name must also
 * bring it into scope (an `import type` from the child module) — otherwise the
 * consumer fails TypeScript (observed: command-palette Lit leaf vs combobox's
 * `ComboboxGroup`).
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../compile.js';
import { exportedTypeNamesFromSource } from '../codegen/collectFillerTypeImports.js';

const PRODUCER = `<rozie name="Producer">
<types>
export interface ProducerGroup { id: string; label: string }
export type ProducerTone = 'a' | 'b';
</types>
<data>{ g: { id: 'a', label: 'A' }, tone: 'a' }</data>
<template>
  <div>
    <slot name="heading" :group="$data.g" :tone="$data.tone" :param-types="{ group: 'ProducerGroup | null', tone: 'ProducerTone' }" />
    <slot name="plain" :n="1" :param-types="{ n: 'number' }" />
  </div>
</template>
</rozie>
`;

const consumer = (fill: string, extra = '') => `<rozie name="Consumer">
<components>{ Producer: './Producer.rozie' }</components>
${extra}<template>
  <Producer>
    ${fill}
  </Producer>
</template>
</rozie>
`;

const TARGETS = ['react', 'vue', 'svelte', 'angular', 'solid', 'lit'] as const;

function build(src: string, target: (typeof TARGETS)[number]) {
  const dir = mkdtempSync(join(tmpdir(), 'rozie-filler-type-imports-'));
  writeFileSync(join(dir, 'Producer.rozie'), PRODUCER);
  const filename = join(dir, 'Consumer.rozie');
  writeFileSync(filename, src);
  const r = compile(src, { target, filename, resolverRoot: dir, sourceMap: false });
  expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  return r;
}

describe('consumer fill typed with a producer <types> name', () => {
  it.each(TARGETS)('%s: every printed producer type name is imported', (target) => {
    const r = build(consumer(`<template #heading="{ group, tone }"><span>{{ group?.label }}{{ tone }}</span></template>`), target);
    for (const out of [r.code, r.types ?? '']) {
      for (const name of ['ProducerGroup', 'ProducerTone']) {
        const uses = out.split('\n').filter((l) => new RegExp(`\\b${name}\\b`).test(l));
        if (uses.length === 0) continue;
        expect(
          uses.some((l) => /^import type \{[^}]*\}/.test(l) && l.includes(name)),
          `${target}: '${name}' is referenced but never imported:\n${out}`,
        ).toBe(true);
      }
    }
  });

  it('lit: imports the type from the child module the consumer already imports', () => {
    const r = build(consumer(`<template #heading="{ group }"><span>{{ group?.label }}</span></template>`), 'lit');
    expect(r.code).toContain(`import type { ProducerGroup } from './Producer.rozie';`);
    expect(r.code).toContain('scope: { group: ProducerGroup | null }');
    // Only the names the fill actually prints are imported.
    expect(r.code).not.toContain('ProducerTone');
  });

  it('lit: no producer-type reference ⇒ no extra import (byte-identity)', () => {
    const r = build(consumer(`<template #plain="{ n }"><span>{{ n }}</span></template>`), 'lit');
    expect(r.code).not.toContain('import type {');
  });

  it('lit: a consumer that declares the same name itself is not given a duplicate import', () => {
    const r = build(
      consumer(
        `<template #heading="{ group }"><span>{{ group?.label }}</span></template>`,
        `<types>\nexport interface ProducerGroup { id: string; label: string }\n</types>\n`,
      ),
      'lit',
    );
    expect(r.code).not.toContain(`import type { ProducerGroup }`);
  });

  it('lit: a name the consumer script already imports is not imported twice', () => {
    const r = build(
      consumer(
        `<template #heading="{ group }"><span>{{ group?.label }}</span></template>`,
        `<script lang="ts">\nimport type { ProducerGroup } from './Producer.rozie';\nconst keep: ProducerGroup | null = null;\n</script>\n`,
      ),
      'lit',
    );
    expect(r.code.split('ProducerGroup }').length - 1).toBe(1);
  });

  it('exportedTypeNamesFromSource reads a manifest <types> block', () => {
    expect(
      exportedTypeNamesFromSource(
        `import type { X } from 'x';\nexport interface A { a: X }\nexport type B = A[];\nexport type { X };\ninterface Hidden {}\n`,
      ).sort(),
    ).toEqual(['A', 'B', 'X']);
    expect(exportedTypeNamesFromSource('export interface (')).toEqual([]);
  });
});
