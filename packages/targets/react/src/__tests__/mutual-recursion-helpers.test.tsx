/**
 * Two top-level helpers that call each other, both reached from a mount
 * effect, are both wrapped in `useCallback`. Each one's dependency array names
 * the other, so whichever is declared first reads the second before its
 * declaration has run: a TS2448 in the leaf and a TDZ ReferenceError on the
 * first render. No statement order fixes a cycle, so the emitter routes the
 * forward edge through a ref declared ahead of both.
 *
 * Rendered for real (not just string-matched), because the failure is a
 * runtime throw and the fix must not leave the earlier helper calling a stale
 * copy of the later one.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, fireEvent, render } from '@testing-library/react';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

const SRC = `<rozie name="Parity">
<props>{ n: { type: Number, default: 3 } }</props>
<data>{ floor: 0, mounted: '', log: '' }</data>
<script lang="ts">
const ping = (k: number): string => (k <= 0 ? 'E' : pong(k - 1))
const pong = (k: number): string => (k <= $data.floor ? 'F' + $data.floor : ping(k - 1))
const viaMemo = $computed(() => ping($props.n))
$watch(() => ping($props.n), (v) => { $data.log = $data.log + '|' + v })
$onMount(() => { $data.mounted = ping(4) + '/' + pong(4) })
</script>
<template>
<div>
<span class="mounted">{{ $data.mounted }}</span>
<span class="ping">{{ ping($props.n) }}</span>
<span class="memo">{{ viaMemo }}</span>
<span class="log">{{ $data.log }}</span>
<button @click="$data.floor = 1">floor</button>
</div>
</template>
</rozie>`;

function emit(): string {
  const { ast } = parse(SRC, { filename: 'Parity.rozie' });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitReact(ir!, { filename: 'Parity.rozie', source: SRC }).code;
}

describe('React mutually-recursive useCallback helpers', () => {
  const code = emit();

  it('no dependency array names a helper declared further down', () => {
    const decl = (name: string): number => code.indexOf(`const ${name} = useCallback(`);
    expect(decl('ping')).toBeGreaterThan(-1);
    expect(decl('pong')).toBeGreaterThan(-1);
    for (const m of code.matchAll(/const (\w+) = useCallback\([\s\S]*?, \[([^\]]*)\]\);/g)) {
      for (const dep of m[2]!.split(', ').filter(Boolean)) {
        const at = decl(dep);
        if (at === -1) continue;
        expect(at, `${m[1]} lists ${dep}`).toBeLessThan(m.index!);
      }
    }
  });

  it('renders, and the earlier helper reaches the later one with current state', async () => {
    const dir = resolve(dirname(fileURLToPath(import.meta.url)), '.compiled');
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, '.gitignore'), '*\n');
    const file = resolve(dir, 'Parity.tsx');
    writeFileSync(file, code);
    const Parity = (await import(/* @vite-ignore */ file)).default;

    const { container } = render(<Parity n={3} />);
    expect(container.querySelector('.mounted')?.textContent).toBe('E/F0');
    expect(container.querySelector('.ping')?.textContent).toBe('F0');
    // A $computed calls ping while rendering, so the ref must be set by then.
    expect(container.querySelector('.memo')?.textContent).toBe('F0');

    // ping reaches pong, which reads floor: the memo and the watch, which
    // depend on ping's identity, have to re-run when floor changes.
    act(() => {
      fireEvent.click(container.querySelector('button')!);
    });
    expect(container.querySelector('.ping')?.textContent).toBe('F1');
    expect(container.querySelector('.memo')?.textContent).toBe('F1');
    expect(container.querySelector('.log')?.textContent).toBe('|F1');
  });
});
