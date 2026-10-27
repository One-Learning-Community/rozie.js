/**
 * `@change` on a text control means the DOM `change` event: it fires when the
 * user commits an edit (on blur, or Enter), as it does on the other five
 * targets. React's JSX `onChange` is a different event that fires on every
 * keystroke, so on `<input>` / `<textarea>` the React emitter attaches a native
 * listener through a ref instead. `<select>` and checkbox / radio / file
 * inputs keep `onChange`, where React's event matches the native one.
 *
 * Rendered for real: the bug was per-keystroke firing, which only shows when
 * the events are dispatched.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, fireEvent, render } from '@testing-library/react';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

const SRC = `<rozie name="Commit">
<data>{ text: '', notes: '', commits: [], mountedTag: '' }</data>
<script>
// Read the value before the state write: happy-dom clears event.target once
// dispatch ends, and React runs the functional updater after that.
const log = (what, e) => {
  const entry = what + ':' + e.target.value
  $data.commits = [...$data.commits, entry]
}
$onMount(() => { $data.mountedTag = $refs.field ? $refs.field.tagName : 'none' })
</script>
<template>
<div>
<input ref="field" class="plain" type="text" @change="log('plain', $event)" />
<input class="model" r-model="$data.text" @change="log('model', $event)" />
<textarea class="area" @change.stop="log('area', $event)"></textarea>
<input class="box" type="checkbox" @change="log('box', $event)" />
<select class="sel" @change="log('sel', $event)"><option value="a">a</option><option value="b">b</option></select>
<output class="commits">{{ $data.commits.join('|') }}</output>
<output class="text">{{ $data.text }}</output>
<output class="mounted">{{ $data.mountedTag }}</output>
</div>
</template>
</rozie>`;

function emit(): string {
  const { ast } = parse(SRC, { filename: 'Commit.rozie' });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitReact(ir!, { filename: 'Commit.rozie', source: SRC }).code;
}

const code = emit();

async function mount() {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '.compiled');
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, '.gitignore'), '*\n');
  const file = resolve(dir, 'Commit.tsx');
  writeFileSync(file, code);
  const Commit = (await import(/* @vite-ignore */ file)).default;
  const { container } = render(<Commit />);
  const q = <T extends Element>(sel: string) => container.querySelector(sel) as T;
  return { container, q, commits: () => q('.commits').textContent };
}

function type(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  act(() => {
    fireEvent.input(el, { target: { value } });
  });
}

function commit(el: Element): void {
  act(() => {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('React @change on text controls is the native change event', () => {
  it('does not lower @change on a text input or textarea to onChange', () => {
    expect(code).not.toMatch(/className=\{"plain"\}[^>]*onChange/);
    expect(code).not.toMatch(/className=\{"area"\}[^>]*onChange/);
  });

  it('does not fire while typing; fires on the change event', async () => {
    const { q, commits } = await mount();
    const plain = q<HTMLInputElement>('.plain');
    type(plain, 'a');
    type(plain, 'ab');
    expect(commits()).toBe('');
    commit(plain);
    expect(commits()).toBe('plain:ab');
  });

  it('keeps the author ref working', async () => {
    const { q } = await mount();
    expect(q('.mounted').textContent).toBe('INPUT');
  });

  it('r-model still writes on every keystroke, @change only on commit', async () => {
    const { q, commits } = await mount();
    const model = q<HTMLInputElement>('.model');
    type(model, 'x');
    type(model, 'xy');
    expect(q('.text').textContent).toBe('xy');
    expect(commits()).toBe('');
    commit(model);
    expect(commits()).toBe('model:xy');
  });

  it('textarea: modifiers still apply; fires on change only', async () => {
    const { container, q, commits } = await mount();
    let bubbled = 0;
    container.addEventListener('change', () => bubbled++);
    const area = q<HTMLTextAreaElement>('.area');
    type(area, 'note');
    expect(commits()).toBe('');
    commit(area);
    expect(commits()).toBe('area:note');
    expect(bubbled).toBe(0);
  });

  it('checkbox and select keep onChange and still fire', async () => {
    const { q, commits } = await mount();
    act(() => {
      q<HTMLInputElement>('.box').click();
    });
    act(() => {
      fireEvent.change(q<HTMLSelectElement>('.sel'), { target: { value: 'b' } });
    });
    expect(commits()).toBe('box:on|sel:b');
    expect(code).toMatch(/className=\{"box"\}[^>]*onChange/);
    expect(code).toMatch(/className=\{"sel"\}[^>]*onChange/);
  });
});
