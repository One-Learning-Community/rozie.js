/**
 * reservedSlotNameValidator — ROZ210 reserved unnamed-slot key collision
 * (Quick 260808-iyh, D5).
 *
 * `portalKey()` (`ir/types.ts`) and every per-target emitter's unnamed-slot
 * member sentinel (`emitSlotDecl.ts`'s `authoredKey`, `collectSlottedReads.ts`)
 * use the literal string `'default'` to address the UNNAMED slot — the same
 * key the D4 `$slotted` member sigil addresses. A `<slot name="default">`
 * collides with that sentinel: the emitter can no longer distinguish "the
 * unnamed slot" from "a slot literally named default". Catch this at author
 * time with a loud compile error rather than a downstream emitter
 * misattribution.
 *
 * This is a plain AST walk (runs in `analyzeAST`, before `lowerToIR`) and is
 * INTENTIONALLY unconditional — it fires on every `<slot name="default">`
 * regardless of whether the component also declares a default portal slot.
 * It is therefore a distinct collision class from `validateDefaultPortalCollision`
 * (ROZ979, `ir/validateDefaultPortalCollision.ts`), which only fires when BOTH
 * a default portal slot AND a `name="default"` slot are present (the
 * `$portals.default` addressing collision). Both may fire together on the
 * same component; that is expected and not double-firing on the same
 * diagnostic code.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Mutates `diagnostics` in
 * place; never mutates `ast`.
 *
 * Per D-11/D-12: the diagnostic loc points at the `name` attribute's VALUE
 * (`attr.valueLoc`), falling back to the attribute's own loc when a
 * `valueLoc` was not captured by the parser.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../../ast/types.js';
import type { TemplateElement } from '../../ast/blocks/TemplateAST.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { walkTemplateElements } from '../walkTemplate.js';

/** The reserved unnamed-slot key. Must stay byte-identical to `portalKey()`'s
 * `'default'` literal (`ir/types.ts`) and the emitters' unnamed-slot member
 * sentinel — this validator exists specifically to guard that shared string.
 */
const RESERVED_UNNAMED_SLOT_KEY = 'default';

function checkElement(el: TemplateElement, diagnostics: Diagnostic[]): void {
  if (el.tagName !== 'slot') return;
  const nameAttr = el.attributes.find(
    (a) => a.kind === 'static' && a.name === 'name' && a.value !== null,
  );
  if (!nameAttr || nameAttr.value !== RESERVED_UNNAMED_SLOT_KEY) return;

  diagnostics.push({
    code: RozieErrorCode.RESERVED_SLOT_NAME,
    severity: 'error',
    message: `<slot name="default"> collides with the reserved unnamed-slot key "default" — every per-target emitter (and the D4 $slotted member sigil) uses that literal to address the UNNAMED slot, so a slot literally named "default" cannot be distinguished from it.`,
    loc: nameAttr.valueLoc ?? nameAttr.loc,
    hint: `Rename the slot (e.g. name="defaultRow"), or drop the name attribute entirely to author an unnamed slot.`,
  });
}

/**
 * Run the reserved-slot-name validator over the AST. Emits ROZ210. NEVER
 * throws (D-08).
 */
export function runReservedSlotNameValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  if (!ast.template) return;
  walkTemplateElements(ast.template, (el) => checkElement(el, diagnostics));
}
