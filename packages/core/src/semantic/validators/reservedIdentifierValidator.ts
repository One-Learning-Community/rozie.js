/**
 * SEM-02 — Reserved-identifier collision validator (ROZ202).
 *
 * Rozie's compiler reserves a fixed set of `$`-prefixed sigils as
 * template- and emit-scope identifiers:
 *
 *   $el     — the component root element (template-ref synthesis)
 *   $props  — declared <props> accessor
 *   $data   — declared <data> accessor
 *   $refs   — template-ref accessor
 *   $slots  — slot-presence accessor
 *   $emit   — event-emit accessor
 *   $event  — the closure parameter name emitted for every event handler
 *             (`($event) => …`) across the React / Svelte / Solid / Lit
 *             targets and the Vue / Angular host-listener forms (Phase 07.6).
 *   $attrs  — consumer-passed attribute cluster minus declared props (Phase 14)
 *   $listeners — consumer-passed event-listener cluster minus declared events (Phase 15)
 *   $expose — producer-side imperative-handle sigil (Phase 21)
 *   $provide — cross-component context provide sigil (Phase 36)
 *   $inject  — cross-component context inject sigil (Phase 36)
 *
 * A user-authored identifier that shadows one of these — a `<data>` field
 * name or an `r-for` loop variable — would be silently captured by the
 * emitted code, producing wrong-at-runtime output (e.g. an `r-for` loop var
 * named `$event` would shadow the handler closure param). This validator
 * catches the collision at compile time so the author sees a clear rename
 * instruction instead of a baffling runtime bug.
 *
 * The reserved set MUST stay in sync with the enumeration documented on
 * `RESERVED_IDENTIFIER_COLLISION` in `diagnostics/codes.ts`.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Mutates `diagnostics` in
 * place; never mutates `ast` / `bindings`.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST, SourceLoc } from '../../ast/types.js';
import type {
  TemplateElement,
  TemplateAttr,
} from '../../ast/blocks/TemplateAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import type { BindingsTable } from '../types.js';
import { walkTemplateElements } from '../walkTemplate.js';
import { extractRForAliases } from '../extractRForAliases.js';

/**
 * The reserved `$`-prefixed sigils. Mirrors the enumeration documented on
 * `RESERVED_IDENTIFIER_COLLISION` (ROZ202) in `diagnostics/codes.ts`.
 */
export const RESERVED_SIGILS: ReadonlySet<string> = new Set([
  '$el',
  '$props',
  '$data',
  '$refs',
  '$slots',
  '$emit',
  '$event',
  '$attrs',
  '$listeners',
  '$restoreFocus', // Phase 16
  '$model', // Phase 18 — producer-side two-way-write sigil
  '$expose', // Phase 21 — producer-side imperative-handle sigil
  '$provide', // Phase 36 — cross-component context provide sigil
  '$inject', // Phase 36 — cross-component context inject sigil
  '$clone', // Phase 45 — target-rewritten deep-clone call-form sigil
]);

const RESERVED_SIGIL_LIST =
  '$el, $props, $data, $refs, $slots, $emit, $event, $attrs, $listeners, $restoreFocus, $model, $expose, $provide, $inject, $clone';

function emitCollision(
  name: string,
  context: string,
  loc: SourceLoc,
  diagnostics: Diagnostic[],
): void {
  diagnostics.push({
    code: RozieErrorCode.RESERVED_IDENTIFIER_COLLISION,
    severity: 'error',
    message: `'${name}' is a reserved Rozie sigil and cannot be used as ${context}.`,
    loc,
    hint: `Rename it. The compiler reserves ${RESERVED_SIGIL_LIST} as built-in accessors and emit-scope identifiers.`,
  });
}

function findRForAttr(el: TemplateElement): TemplateAttr | undefined {
  return el.attributes.find((a) => a.kind === 'directive' && a.name === 'for');
}

/**
 * Run the reserved-identifier collision validator over the AST. Emits ROZ202
 * for every `<data>` field name or `r-for` loop variable that shadows a
 * reserved sigil. NEVER throws (D-08).
 */
export function runReservedIdentifierValidator(
  ast: RozieAST,
  bindings: BindingsTable,
  diagnostics: Diagnostic[],
): void {
  // <data> field names — collected (with locs) into BindingsTable.data.
  for (const entry of bindings.data.values()) {
    if (RESERVED_SIGILS.has(entry.name)) {
      emitCollision(
        entry.name,
        'a <data> field name',
        entry.sourceLoc,
        diagnostics,
      );
    }
  }

  // r-for loop variables — the item alias and the optional index alias.
  if (!ast.template) return;
  walkTemplateElements(ast.template, (el) => {
    const rForAttr = findRForAttr(el);
    if (!rForAttr || rForAttr.value === null) return;
    const aliases = extractRForAliases(rForAttr.value);
    if (!aliases) return;
    const loc = rForAttr.valueLoc ?? rForAttr.loc;
    if (RESERVED_SIGILS.has(aliases.item)) {
      emitCollision(
        aliases.item,
        'an r-for loop variable',
        loc,
        diagnostics,
      );
    }
    if (aliases.index !== null && RESERVED_SIGILS.has(aliases.index)) {
      emitCollision(
        aliases.index,
        'an r-for loop variable',
        loc,
        diagnostics,
      );
    }
  });
}
