/**
 * Typed public surface P1 (Task 8) — a consumer `<template #row="{ tone }">`
 * fill that destructures a SUBSET (or a reordering) of the producer slot's
 * params must receive the authored `:param-types` of THOSE params, keyed by
 * name — not the producer's entries by the consumer's positional index.
 * (Pre-P1 every entry lowered to `any`, so the misalignment was invisible.)
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile } from '@rozie/core';
import { describe, expect, it } from 'vitest';

const PRODUCER = `<rozie name="Producer">
<props>
{
  tone: { type: String, default: 'info' },
}
</props>
<data>
{
  count: 0,
}
</data>
<template>
  <div>
    <slot name="row" :count="$data.count" :tone="$props.tone" :param-types="{ count: 'number', tone: 'string' }" />
  </div>
</template>
</rozie>
`;

const CONSUMER = `<rozie name="Consumer">
<components>
{
  Producer: './Producer.rozie',
}
</components>
<template>
  <Producer>
    <template #row="{ tone }"><span>{{ tone }}</span></template>
  </Producer>
</template>
</rozie>
`;

describe('Lit consumer filler scope type — authored :param-types aligned by name', () => {
  it('a subset destructure gets the destructured param\'s own authored type', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rozie-filler-align-'));
    writeFileSync(join(dir, 'Producer.rozie'), PRODUCER);
    const filename = join(dir, 'Consumer.rozie');
    writeFileSync(filename, CONSUMER);
    const result = compile(CONSUMER, { target: 'lit', filename, resolverRoot: dir });
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    expect(result.code).toContain('scope: { tone: string }');
    expect(result.code).not.toContain('tone: number');
  });
});
