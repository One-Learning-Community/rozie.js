/**
 * SC1 integration test — Counter class shape (Phase 06.4 Success Criterion 1).
 *
 * Asserts via the Counter.lit.ts.snap fixture that the emitted class matches
 * the shape locked in CONTEXT.md `<specifics>`:
 *
 *   @customElement('rozie-counter')
 *   export default class Counter extends SignalWatcher(LitElement) {
 *     static styles = css`...`;
 *     @property({ type: Number, reflect: true, ... }) _value_attr;
 *     private _valueControllable = createLitControllableProperty(...)
 *     ...
 *     render() { return html`...`; }
 *   }
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(HERE, '../fixtures/Counter.lit.ts.snap');

describe('SC1 — Counter class shape (Phase 06.4 Success Criterion 1)', () => {
  it('the Counter snapshot exists and contains the class shape', () => {
    const code = readFileSync(FIXTURE, 'utf8');

    // Class declaration
    expect(code).toContain('export default class Counter extends SignalWatcher(LitElement)');

    // Decorator
    expect(code).toContain("@customElement('rozie-counter')");

    // Static styles via Lit's css`` tagged template
    expect(code).toContain('static styles = css`');

    // @property with type token and attribute reflection (model-prop value)
    expect(code).toMatch(/@property\(\{[^}]*type:\s*Number[^}]*reflect:\s*true[^}]*\}\)/);

    // Controllable property scaffold for two-way binding
    expect(code).toContain('createLitControllableProperty<number>');
    expect(code).toContain("eventName: 'value-change'");

    // Public getter/setter pair (the model-prop façade)
    expect(code).toContain('get value(): number { return this._valueControllable.read(); }');
    expect(code).toContain('set value(v: number) { this._valueControllable.write(v); }');

    // render() returns html``
    expect(code).toMatch(/render\(\)\s*\{[^}]*return html`/s);

    // Cleanup drain in disconnectedCallback
    expect(code).toContain('for (const fn of this._disconnectCleanups) fn();');

    // attributeChangedCallback wires controlled-mode attribute updates
    expect(code).toContain("if (name === 'value') this._valueControllable.notifyAttributeChange(");
  });
});
