/**
 * emitScript tests — Plan 06.4-01 Task 2 markers.
 *
 * Plan 06.4-02 (P2) fills these in with real assertions over the class-body
 * emission (lifecycle pairing source-order, @property type rendering, signal
 * field initializer shape, model-prop accessor synthesis).
 */
import { describe, it } from 'vitest';

describe('emitScript — Lit class-body assembly (P2 deferred)', () => {
  it.todo('emits @property() class fields in declaration order (Plan 06.4-02)');
  it.todo('emits signal field initializers via @lit-labs/preact-signals (Plan 06.4-02)');
  it.todo('emits lifecycle methods (connectedCallback / disconnectedCallback / firstUpdated) in source order (Plan 06.4-02)');
  it.todo('synthesizes model-prop accessor that dispatches `<prop>-change` CustomEvent (Plan 06.4-02)');
  it.todo('rewrites $props.foo → this.foo in <script> AST (Plan 06.4-02)');
  it.todo('rewrites $data.foo → this._foo.value in <script> AST (Plan 06.4-02)');
  it.todo('emits customElements.define(tagName, ClassName) after the class (Plan 06.4-02)');
});
