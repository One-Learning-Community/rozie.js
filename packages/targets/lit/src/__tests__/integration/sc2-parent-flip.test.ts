/**
 * SC2 integration test — parent-flip-mid-lifecycle CustomEvent + attribute reflection.
 *
 * Verifies the runtime semantics that the emitted Counter class wires together:
 *
 *   1. Programmatic `el.value = N` (property write) dispatches a `value-change`
 *      CustomEvent on the host with detail=N, bubbles=true, composed=true.
 *   2. The Counter snapshot wires `@property({ reflect: true })` so attribute
 *      reflection is in scope (we assert the snapshot shape; happy-dom DOES
 *      reflect attributes when an element actually mounts, but we test the
 *      runtime helper directly to avoid bundling a full ESM resolver).
 *
 * The emitted .ts output references TS-only syntax (decorators, generics)
 * that happy-dom + vitest can't parse without a compiler in the loop. We
 * therefore test the *runtime invariants* by instantiating
 * `createLitControllableProperty` directly with a `host` whose `dispatchEvent`
 * matches happy-dom's HTMLElement.dispatchEvent, then assert the same
 * event-shape the emitted setter would produce.
 */
import { describe, it, expect } from 'vitest';
import { createLitControllableProperty } from '../../../../../runtime/lit/src/createLitControllableProperty.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../fixtures/Counter.lit.ts.snap');

describe('SC2 — parent-flip-mid-lifecycle event dispatch + attribute reflection', () => {
  it('Counter snapshot wires attribute reflection in @property decorator', () => {
    const code = readFileSync(FIXTURE, 'utf8');
    // Reflection is required so a parent's `setAttribute('value', '20')` mirrors
    // through to the host's `value` property.
    expect(code).toMatch(/@property\(\{[^}]*reflect:\s*true[^}]*\}\)/);
    // Attribute name is the kebab-cased prop name ('value' stays 'value').
    expect(code).toContain("attribute: 'value'");
  });

  it('programmatic write dispatches value-change CustomEvent with detail + bubbles + composed', () => {
    // Simulate a Lit element instance — just need dispatchEvent.
    const dispatched: CustomEvent[] = [];
    const host = {
      dispatchEvent: (ev: Event) => {
        dispatched.push(ev as CustomEvent);
        return true;
      },
    } as unknown as HTMLElement;

    const prop = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });

    expect(prop.read()).toBe(0);

    prop.write(20);

    expect(prop.read()).toBe(20);
    expect(dispatched).toHaveLength(1);
    const ev = dispatched[0]!;
    expect(ev.type).toBe('value-change');
    expect(ev.detail).toBe(20);
    expect(ev.bubbles).toBe(true);
    expect(ev.composed).toBe(true);
  });

  it('setAttribute path: notifyAttributeChange forwards into the controllable property', () => {
    const dispatched: CustomEvent[] = [];
    const host = {
      dispatchEvent: (ev: Event) => {
        dispatched.push(ev as CustomEvent);
        return true;
      },
    } as unknown as HTMLElement;

    const prop = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });

    // Simulate the emitted attributeChangedCallback path:
    // `if (name === 'value') this._valueControllable.notifyAttributeChange(Number(value))`
    prop.notifyAttributeChange(5);
    expect(prop.read()).toBe(5);

    // Now write via property — the new value flows out.
    prop.write(20);
    expect(dispatched).toHaveLength(1);
    expect((dispatched[0] as CustomEvent).detail).toBe(20);
  });

  it('functional updater: write((prev) => prev + 1) reads + writes via the same closure', () => {
    const dispatched: CustomEvent[] = [];
    const host = {
      dispatchEvent: (ev: Event) => {
        dispatched.push(ev as CustomEvent);
        return true;
      },
    } as unknown as HTMLElement;

    const prop = createLitControllableProperty<number>({
      host,
      eventName: 'value-change',
      defaultValue: 0,
      initialControlledValue: undefined,
    });

    prop.write((prev) => prev + 1);
    expect(prop.read()).toBe(1);
    prop.write((prev) => prev + 1);
    expect(prop.read()).toBe(2);
    expect(dispatched).toHaveLength(2);
    expect((dispatched[0] as CustomEvent).detail).toBe(1);
    expect((dispatched[1] as CustomEvent).detail).toBe(2);
  });
});
