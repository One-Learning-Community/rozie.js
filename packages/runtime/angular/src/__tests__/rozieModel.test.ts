import { computed, isSignal, signal, untracked } from '@angular/core';
import type { OutputEmitterRef } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { rozieModel } from '../rozieModel';

function setup(bound: string | undefined) {
  const input = signal<string | undefined>(bound);
  const emitted: string[] = [];
  const change = { emit: (v: string) => emitted.push(v) } as unknown as OutputEmitterRef<string>;
  return { input, emitted, model: rozieModel<string>(input, change, 'init', { signal, computed, untracked }) };
}

describe('rozieModel', () => {
  it('controlled: a refused write emits, then the value goes back to the bound one', async () => {
    const { emitted, model } = setup('apple');
    model.set('banana');
    expect(emitted).toEqual(['banana']);
    // The consumer never sends 'banana' back: after one task the bound value wins.
    await new Promise((r) => setTimeout(r, 0));
    expect(model()).toBe('apple');
  });

  it('controlled: a read right after a write sees the written value (key bursts)', () => {
    // Angular pushes the consumer's answer down only on its next change detection,
    // a task later. A second keydown in between used to read the old value and
    // build on it, losing the first write (number-field ArrowUp ×10 → +1).
    const { emitted, model } = setup('1');
    model.set(String(Number(model()) + 1));
    model.set(String(Number(model()) + 1));
    model.set(String(Number(model()) + 1));
    expect(emitted).toEqual(['2', '3', '4']);
    expect(model()).toBe('4');
  });

  it('controlled: any value the consumer sends wins over the pending write', () => {
    const { input, model } = setup('apple');
    model.set('banana');
    input.set('cherry'); // accepted and transformed (e.g. clamped)
    expect(model()).toBe('cherry');
    input.set('apple'); // and a later value is honored too
    expect(model()).toBe('apple');
  });

  it('controlled: a newer write keeps its pending value past the older write\'s timer', async () => {
    const { model } = setup('apple');
    model.set('banana');
    await new Promise((r) => setTimeout(r, 0));
    expect(model()).toBe('apple');
    model.set('cherry');
    expect(model()).toBe('cherry');
  });

  it('uncontrolled: a write updates the local value and emits', () => {
    const { emitted, model } = setup(undefined);
    expect(model()).toBe('init');
    model.set('banana');
    expect(model()).toBe('banana');
    expect(emitted).toEqual(['banana']);
  });

  it('is a WritableSignal, so it can feed a child [(x)] binding', () => {
    const { model } = setup('a');
    expect(isSignal(model)).toBe(true);
    expect(typeof model.set).toBe('function');
  });

  it('an unset required input (NG0950 on read) counts as not bound', () => {
    const emitted: string[] = [];
    const change = { emit: (v: string) => emitted.push(v) } as unknown as OutputEmitterRef<string>;
    const model = rozieModel<string>(() => { throw new Error('NG0950'); }, change, undefined as unknown as string, { signal, computed, untracked });
    model.set('seeded');
    expect(model()).toBe('seeded');
  });

  it("builds on the component's own primitives, never this package's @angular/core", () => {
    // Another copy of @angular/core makes signals the app's change detection cannot see.
    const used: string[] = [];
    const prims = {
      signal: <U,>(v: U) => { used.push('signal'); return signal(v); },
      computed: <U,>(fn: () => U) => { used.push('computed'); return computed(fn); },
      untracked: <U,>(fn: () => U) => { used.push('untracked'); return untracked(fn); },
    };
    const input = signal<string | undefined>(undefined);
    const change = { emit: () => {} } as unknown as OutputEmitterRef<string>;
    const model = rozieModel<string>(input, change, 'init', prims);
    model.set('b');
    expect(used).toEqual(['signal', 'signal', 'computed', 'untracked']);
    const view = computed(() => model());
    expect(view()).toBe('b');
    input.set('bound');
    expect(view()).toBe('bound');
  });
});
