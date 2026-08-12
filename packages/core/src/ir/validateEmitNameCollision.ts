/**
 * validateEmitNameCollision — quick task 260812-i67 (ROZ997).
 *
 * Post-IR pass that flags a component declaring two (or more) distinct `$emit`
 * names that collapse to the SAME canonical event key by kebab/camel/snake
 * separator equivalence (`sort-change` / `sortChange` / `sort_change`). Such a
 * component ALREADY compiles to broken output today — rejecting it is a fix,
 * not a tightening (the 260812-i67 pre-change probes are the evidence):
 *
 *   - React/Solid synthesize the same `on<Pascal>` callback field TWICE on one
 *     props interface (`onSortChange?: …` declared twice — hard TS2300 on
 *     every strict-TS consumer), and BOTH `$emit` calls lower to invoking that
 *     one callback, so the consumer can never distinguish the two events.
 *   - A kebab/camel pair collides the Angular `output()` class-field
 *     identifier — the same field declared twice is invalid TypeScript.
 *   - The same pair collides the Lit kebab CustomEvent dispatch name
 *     (`sortChange` and `sort-change` both dispatch `"sort-change"`).
 *
 * GROUPING KEY (read before "simplifying" it to a bare `canonicalEventKey`):
 * the key is `canonicalEventKey(name.replace(/_/g, '-'))` — underscores are
 * pre-normalized to hyphens BEFORE the collapse. `canonicalEventKey` is pinned
 * byte-identical to the Angular target's `sanitizeEventName`, whose
 * valid-identifier fast path passes an underscore-bearing name through
 * VERBATIM (`sort_change` → `sort_change`, because `_` is identifier-legal).
 * Without the pre-normalization, the snake+camel pair — the one shape that is
 * genuinely SILENT today (kebab+camel is already an error via ROZ981's Svelte
 * normalization collapse) yet breaks React/Solid with the duplicate-callback
 * TS2300 above — would never group. The pre-normalization lives HERE and only
 * here: ROZ998's consumer-side matching (threadParamTypes) must use the bare
 * `canonicalEventKey`, because Angular's `resolveEventBindingName` resolves
 * consumer listeners via plain `sanitizeEventName` equality — a snake-spelled
 * listener does NOT resolve against a camel-declared emit on Angular, so the
 * consumer side must keep warning about it, not silently equate the two.
 *
 * One ROZ997 per colliding GROUP (not one per pair) at `ir.sourceLoc` — the IR
 * carries no per-emit source locations (lower.ts dedupes `scriptResult.emits`
 * by exact string into a plain `string[]`); the `ir.sourceLoc` fallback is the
 * validateListenerFallthrough precedent. Groups are emitted in
 * first-occurrence source order so the diagnostic sequence is stable and
 * snapshot-safe.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Pushes into `diagnostics` and
 * continues; NEVER mutates `ir`.
 *
 * Wired into `lowerToIR` (`packages/core/src/ir/lower.ts`) — the single
 * chokepoint both `compile()` and `@rozie/unplugin` share — so a colliding
 * declaration fails regardless of entrypoint.
 *
 * @experimental — shape may change before v1.0
 */
import { RozieErrorCode } from '../diagnostics/codes.js';
import { canonicalEventKey } from '../diagnostics/canonicalEventKey.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type { IRComponent } from './types.js';

/**
 * Group `ir.emits` by canonical event key; push ONE ROZ997 error per group
 * holding two or more distinct spellings.
 *
 * @param ir          - the lowered IRComponent
 * @param diagnostics - accumulator (mutated in place; ROZ997 pushed per group)
 */
export function validateEmitNameCollision(
  ir: IRComponent,
  diagnostics: Diagnostic[],
): void {
  // Zero or one emit can never collide — and `ir.emits` is already deduped by
  // EXACT string in lower.ts, so the same spelling written twice never
  // reaches here as a pair.
  if (ir.emits.length < 2) return;

  // Map insertion order = first-occurrence source order (ir.emits preserves
  // the $emit declaration order).
  const byKey = new Map<string, string[]>();
  for (const name of ir.emits) {
    // Underscore→hyphen pre-normalization — see the GROUPING KEY note in the
    // module header before touching this line.
    const key = canonicalEventKey(name.replace(/_/g, '-'));
    const bucket = byKey.get(key);
    if (bucket) bucket.push(name);
    else byKey.set(key, [name]);
  }

  for (const [key, spellings] of byKey) {
    if (spellings.length < 2) continue;
    const quoted = spellings.map((s) => `'${s}'`).join(' and ');
    diagnostics.push({
      code: RozieErrorCode.EMIT_NAME_CANONICAL_COLLISION,
      severity: 'error',
      message: `$emit names ${quoted} collapse to the same canonical event key '${key}' (kebab/camel/snake equivalence). This component already compiles to broken output: React/Solid declare the duplicate 'on${key.charAt(0).toUpperCase()}${key.slice(1)}'-style callback field twice on one props interface (TS2300) and collapse both $emit calls onto ONE callback; a kebab/camel pair declares duplicate Angular output() class fields (the same class member twice — invalid TypeScript); and the Lit kebab CustomEvent dispatch names collide.`,
      loc: ir.sourceLoc,
      hint: `Settle on ONE spelling for the event — keep exactly one of ${quoted} and update every $emit call and consumer listener to it.`,
    });
  }
}
