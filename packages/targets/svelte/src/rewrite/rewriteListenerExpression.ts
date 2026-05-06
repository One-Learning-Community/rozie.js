/**
 * rewriteListenerExpression — Phase 5 Plan 02a Task 3.
 *
 * Renders a Babel Expression for inlining inside a Svelte 5 `<script>`-
 * level $effect block. Mirrors rewriteTemplateExpression — Svelte's script
 * surface and template surface BOTH consume bare identifiers (no `.value`
 * suffix because $state / $derived auto-track at read time).
 *
 * Used by emitListeners to rewrite a listener's `handler` and `when`
 * expressions — both run in script context inside the synthesized $effect
 * callback.
 *
 * Inputs are deep-cloned BEFORE traversal so the IR's referential preservation
 * (IR-04) is never violated.
 *
 * @experimental — shape may change before v1.0
 */
export { rewriteTemplateExpression as rewriteListenerExpression } from './rewriteTemplateExpression.js';
