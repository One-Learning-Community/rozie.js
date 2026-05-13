/**
 * rewriteScript.ts — P1 stub for `<script>` AST mutation for the Lit target.
 *
 * P2 rewrites:
 *   - `$props.foo`   → `this.foo`           (class field access)
 *   - `$data.foo`    → `this._foo.value`    (signal `.value` access — D-LIT-07)
 *   - `$refs.foo`    → `this.foo` (queried via `@queryAsync` / `@query`)
 *   - `$slots.foo`   → `this._slot_foo_present`
 *   - `$emit('x', y)` → `this.dispatchEvent(new CustomEvent('x', { detail: y }))`
 *   - `$el`           → `this`
 *   - `$onMount(fn)`  → `connectedCallback() { ...; fn(); }` body insertion
 *
 * P1 stub: identity — returns the cloned Program unchanged. P2 wires the
 * @babel/traverse visitor.
 *
 * @experimental — shape may change before v1.0
 */
import type { File } from '@babel/types';

export function rewriteScript(file: File): File {
  // P1 stub — P2 swaps in the full visitor pass over the cloned Program.
  return file;
}
