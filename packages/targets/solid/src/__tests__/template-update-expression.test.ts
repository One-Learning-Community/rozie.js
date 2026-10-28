/**
 * `@click="$data.n++"` in a template handler (and in a `<listeners>` entry):
 * the state is a signal, so `++` / `--` must go through its setter as
 * `$data.n += 1` already does. A bare `n()++` does not compile.
 */
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../emitSolid.js';

const SRC = `<rozie name="Counter">
<data>{ n: 0 }</data>
<listeners>{ "window:keydown": { handler: () => $data.n++ } }</listeners>
<template>
<div>
<button class="inc" @click="$data.n++">+</button>
<button class="dec" @click="$data.n--">-</button>
</div>
</template>
</rozie>`;

describe('Solid template handler ++ / --', () => {
  it('goes through the setter', () => {
    const { ast } = parse(SRC, { filename: 'Counter.rozie' });
    const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
    const { code } = emitSolid(ir!, { filename: 'Counter.rozie', source: SRC });
    expect(code).not.toContain('n()++');
    expect(code).not.toContain('n()--');
  });
});
