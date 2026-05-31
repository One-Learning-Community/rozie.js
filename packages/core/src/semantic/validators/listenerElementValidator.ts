/**
 * Phase 19 (D-08) — misplaced-`<listener>` validator (ROZ206).
 *
 * A `<listener>` element belongs ONLY inside the `<listeners>` block. There,
 * `r-if` on a `<listener>` means conditional ATTACH/DETACH of an event binding.
 * Inside `<template>`, `r-if` means conditional RENDER — a fundamentally
 * different semantics — so a `<listener>` in `<template>` is always an author
 * mistake and is forbidden.
 *
 * This validator walks every TemplateElement via `walkTemplateElements` and
 * emits ROZ206 for any tag whose name case-folds to `listener`. Case-folding is
 * deliberate (RESEARCH risk #7): parseTemplate preserves tag case, so a
 * PascalCase `<Listener>` would otherwise route to component resolution
 * (ROZ920). Catching both spellings here gives the author one clear message
 * instead of a confusing "unknown component" error.
 *
 * Per D-08 collected-not-thrown: NEVER throws. Has no binding dependency, so it
 * runs as the FINAL pass in `analyzeAST`.
 *
 * @experimental — shape may change before v1.0
 */
import type { RozieAST } from '../../ast/types.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../diagnostics/codes.js';
import { walkTemplateElements } from '../walkTemplate.js';

/**
 * Run the misplaced-`<listener>` validator over the AST. Emits ROZ206 for every
 * `<listener>` (case-insensitive) found anywhere inside `<template>`. NEVER
 * throws (D-08).
 */
export function runListenerElementValidator(
  ast: RozieAST,
  diagnostics: Diagnostic[],
): void {
  if (!ast.template) return;
  walkTemplateElements(ast.template, (el) => {
    if (el.tagName.toLowerCase() === 'listener') {
      diagnostics.push({
        code: RozieErrorCode.LISTENER_ELEMENT_MISPLACED,
        severity: 'error',
        message:
          '<listener> may only appear inside the <listeners> block — `r-if` on a <listener> means conditional attach/detach, not conditional render.',
        loc: el.loc,
        hint: 'Move this <listener> into the <listeners> block, or use a <template r-if> wrapper if you meant conditional rendering.',
      });
    }
  });
}
