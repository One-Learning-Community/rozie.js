/**
 * `.once` and `.passive` on a template `@event` (on a plain DOM element) attach with those listener
 * options through `rozieNativeListeners`. Rendered for real: `.once` must survive re-renders (each
 * render re-attaches the listener), and `.passive` must make `preventDefault()` a no-op.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, render } from '@testing-library/react';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

const SRC = `<rozie name="Opts">
<data>{ log: [], items: ['a', 'b'], n: 0 }</data>
<script>
const note = (what) => { $data.log = [...$data.log, what] }
const tryPrevent = (e) => { e.preventDefault(); globalThis.__roziePrevented = e.defaultPrevented }
const bump = () => { $data.n = $data.n + 1 }
</script>
<template>
<div>
<div class="once" tabindex="0" @keydown.once="note('once:' + $data.n)" @keydown="bump()"></div>
<button class="click-once" @click.once="note('click')">x</button>
<div class="passive" @keydown.passive="tryPrevent($event)"></div>
<div class="active" @keydown="tryPrevent($event)"></div>
<div class="enter" @keydown.enter.once="note('enter')"></div>
<div class="outer" @click="note('outer')"><button class="stop" @click.stop.once="note('stop')">s</button></div>
<ul><li r-for="item in $data.items" :key="item" :class="'item-' + item" @click.once="note('item:' + item)">{{ item }}</li></ul>
<output class="log">{{ $data.log.join('|') }}</output>
<output class="n">{{ $data.n }}</output>
</div>
</template>
</rozie>`;

function emit(): string {
  const { ast } = parse(SRC, { filename: 'Opts.rozie' });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  const { code, diagnostics } = emitReact(ir!, { filename: 'Opts.rozie', source: SRC });
  const errors = diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) throw new Error(JSON.stringify(errors));
  return code;
}

const code = emit();

async function mount() {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '.compiled');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, '.gitignore'), '*\n');
  const file = resolve(dir, 'Opts.tsx');
  writeFileSync(file, code);
  const Opts = (await import(/* @vite-ignore */ file)).default;
  const { container } = render(<Opts />);
  const q = <T extends Element>(sel: string) => container.querySelector(sel) as T;
  return { q, log: () => q('.log').textContent, n: () => q('.n').textContent };
}

function key(el: Element, k = 'a'): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  act(() => {
    el.dispatchEvent(ev);
  });
  return ev;
}

function click(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

describe('React template .once / .passive', () => {
  it('.once fires exactly once across re-renders; the plain listener keeps running', async () => {
    const { q, log, n } = await mount();
    const el = q('.once');
    key(el);
    key(el);
    key(el);
    // Each keydown re-rendered (n changed), re-attaching the ref callback.
    expect(n()).toBe('3');
    expect(log()).toBe('once:0');
  });

  it('.once on a <button> @click fires once', async () => {
    const { q, log } = await mount();
    const btn = q('.click-once');
    click(btn);
    click(btn);
    expect(log()).toBe('click');
  });

  it('.passive makes preventDefault() ineffective; without it, it works', async () => {
    const { q } = await mount();
    const g = globalThis as { __roziePrevented?: boolean };
    const passiveEv = key(q('.passive'));
    expect(g.__roziePrevented).toBe(false);
    expect(passiveEv.defaultPrevented).toBe(false);
    const activeEv = key(q('.active'));
    expect(g.__roziePrevented).toBe(true);
    expect(activeEv.defaultPrevented).toBe(true);
  });

  it('.once is spent by the first event, as addEventListener({ once }) is, even if a key filter skips it', async () => {
    // DOM semantics (and Vue's, and React's own <listeners> path): the key guard lives inside the
    // listener, so a non-matching key still uses up the single run.
    const { q, log } = await mount();
    const el = q('.enter');
    key(el, 'a');
    key(el, 'Enter');
    expect(log()).toBe('');
  });

  it('a key filter still applies to a .once listener', async () => {
    const { q, log } = await mount();
    const el = q('.enter');
    key(el, 'Enter');
    key(el, 'Enter');
    expect(log()).toBe('enter');
  });

  it('.stop.once stops propagation to the parent React listener', async () => {
    const { q, log } = await mount();
    click(q('.stop'));
    expect(log()).toBe('stop');
    // After the once listener is spent, .stop no longer runs either.
    click(q('.stop'));
    expect(log()).toBe('stop|outer');
  });

  it('.once inside r-for is per element', async () => {
    const { q, log } = await mount();
    click(q('.item-a'));
    click(q('.item-a'));
    click(q('.item-b'));
    click(q('.item-b'));
    expect(log()).toBe('item:a|item:b');
  });
});
