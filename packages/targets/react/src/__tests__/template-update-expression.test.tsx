/**
 * `@click="$data.n++"` in a template handler. `n` is a `useState` const, so the
 * handler has to go through the setter, as `$data.n += 1` already does; a bare
 * `n++` throws "Assignment to constant variable" on click.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, fireEvent, render } from '@testing-library/react';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

const SRC = `<rozie name="Counter">
<data>{ n: 0 }</data>
<template>
<div>
<button class="inc" @click="$data.n++">+</button>
<button class="dec" @click="$data.n--">-</button>
<output>{{ $data.n }}</output>
</div>
</template>
</rozie>`;

const { ast } = parse(SRC, { filename: 'Counter.rozie' });
const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
const code = emitReact(ir!, { filename: 'Counter.rozie', source: SRC }).code;

describe('React template handler ++ / --', () => {
  it('goes through the setter', () => {
    expect(code).toContain('setN(prev => prev + 1)');
    expect(code).toContain('setN(prev => prev - 1)');
    expect(code).not.toMatch(/\bn\+\+|\bn--/);
  });

  it('counts when clicked', async () => {
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), '.compiled');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, '.gitignore'), '*\n');
    const file = resolve(dir, 'Counter.tsx');
    writeFileSync(file, code);
    const Counter = (await import(/* @vite-ignore */ file)).default;
    const { container } = render(<Counter />);
    const click = (sel: string) =>
      act(() => {
        fireEvent.click(container.querySelector(sel)!);
      });
    click('.inc');
    click('.inc');
    click('.dec');
    expect(container.querySelector('output')?.textContent).toBe('1');
  });
});
