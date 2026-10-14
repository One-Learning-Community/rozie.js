import { isSignal, signal } from '@angular/core';
import type { OutputEmitterRef } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { rozieModel } from '../rozieModel';

function setup(bound: string | undefined) {
  const input = signal<string | undefined>(bound);
  const emitted: string[] = [];
  const change = { emit: (v: string) => emitted.push(v) } as unknown as OutputEmitterRef<string>;
  return { input, emitted, model: rozieModel<string>(input, change, 'init') };
}

describe('rozieModel', () => {
  it('controlled: a write emits but the value stays the bound one', () => {
    const { input, emitted, model } = setup('apple');
    model.set('banana');
    expect(emitted).toEqual(['banana']);
    expect(model()).toBe('apple');
    input.set('cherry');
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
    const model = rozieModel<string>(() => { throw new Error('NG0950'); }, change, undefined as unknown as string);
    model.set('seeded');
    expect(model()).toBe('seeded');
  });
});
