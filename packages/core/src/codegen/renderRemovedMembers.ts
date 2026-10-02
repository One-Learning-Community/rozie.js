/**
 * renderRemovedMemberFields — removed-member tombstones (quick 261002-ekf F8).
 *
 * A `<props>` / `<emits>` entry of the form `name: { removed: '<msg>' }` keeps
 * a removed or renamed member visible to a typed consumer for a release. On the
 * targets whose props interface EXTENDS the root's native attributes (React,
 * Solid, Svelte — see `renderHtmlAttrsExtends`) a removed event's handler key
 * (`onChange`) would otherwise fall into the native passthrough and type-check
 * as the DOM handler, then never fire. Each tombstone therefore becomes a
 * `<key>?: never` interface member under a `@deprecated <msg>` JSDoc: an
 * interface member, so `collectInterfaceMemberNames` also lists it in the
 * `Omit<…>` of the native base.
 *
 * Shared by the three inline emitters and the `.d.rozie.ts` sidecar renderer
 * so the module and the sidecar can never disagree. Returns `[]` when the
 * component has no tombstones, so every other component stays byte-identical.
 *
 * @experimental — added in quick 261002-ekf (F8)
 */
import type { IRComponent } from '../ir/types.js';
import { collectInterfaceMemberNames } from './htmlAttrsExtends.js';
import { escapeSingleQuotedKey } from './escapeSingleQuotedKey.js';

const IDENT_RE = /^[A-Za-z_$][\w$]*$/;

/**
 * The tombstone field entries (each a `\n`-joined JSDoc + member block, the
 * same shape as a documented prop entry) for `ir`, to append to a props
 * interface whose live entries are `liveFields`.
 *
 * @param handlerName the target's callback-prop key for an event (React/Solid
 *   `on<Pascal>`, Svelte `on<lowercase>`) — the SAME function the target uses
 *   for live events, so a tombstone sits exactly where the live handler did.
 *   `''` ⇒ no key (skipped).
 * A tombstone whose key a live member already declares is skipped — the live
 * member wins and no duplicate member is minted (TS2300).
 *
 * @experimental — added in quick 261002-ekf (F8)
 */
export function renderRemovedMemberFields(
  ir: IRComponent,
  handlerName: (event: string) => string,
  liveFields: readonly string[],
): string[] {
  const removed = ir.removedMembers;
  if (removed === undefined || removed.length === 0) return [];
  const taken = new Set(collectInterfaceMemberNames(liveFields));
  const out: string[] = [];
  for (const r of removed) {
    const key = r.kind === 'prop' ? r.name : handlerName(r.name);
    if (key === '' || taken.has(key)) continue;
    taken.add(key);
    const renderedKey = IDENT_RE.test(key) ? key : `'${escapeSingleQuotedKey(key)}'`;
    const body = `@deprecated ${r.message.replace(/\*\//g, '*\\/')}`
      .split('\n')
      .map((l) => `   * ${l}`.trimEnd())
      .join('\n');
    out.push(`  /**\n${body}\n   */\n  ${renderedKey}?: never;`);
  }
  return out;
}
