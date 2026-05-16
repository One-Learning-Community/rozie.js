/**
 * threadParamTypes — Phase 07.2 Plan 01 Task 3 (R4 + R7).
 *
 * Post-pass that walks the lowered IR template, resolves each component-tag's
 * `componentRef.importPath` to a producer `.rozie` file via the resolver,
 * looks up the producer's IR via the cache, then for each consumer
 * `SlotFillerDecl`:
 *
 *   - Threads `paramTypes` from the producer's matching `SlotDecl.paramTypes`
 *     onto `filler.paramTypes` (R4 type-flow).
 *   - Validates that consumer scoped-param names exist in the producer
 *     `SlotDecl.params` — mismatches push ROZ947 `SCOPED_PARAM_MISMATCH`
 *     (D-09).
 *   - When the producer doesn't declare the filled slot at all, pushes ROZ941
 *     `UNKNOWN_SLOT_NAME` (warning per D-08).
 *
 * When the resolver returns null, pushes ROZ945 `CROSS_PACKAGE_LOOKUP_FAILED`
 * at the `<components>` source loc.
 *
 * When the cache returns null (cycle, parse failure, or unreadable file), this
 * pass silently degrades — type-flow becomes empty for that consumer-side
 * filler but the compile succeeds (collected-not-thrown discipline).
 *
 * Per D-08: NEVER throws. All failures push a diagnostic and continue.
 *
 * Per RESEARCH Pitfall 3: this pass consumes ONLY `SlotDecl.paramTypes`
 * (a `TSType[]`), never `SlotDecl.sourceLoc`. Producer source locations are
 * informational and do NOT flow into consumer-side IR.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, SlotDecl, TemplateNode } from './types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { IRCache } from './cache.js';
import type { ProducerResolver } from '../resolver/index.js';

/**
 * Recursive template walker: visit every TemplateNode in source order.
 */
function walkTemplate(
  node: TemplateNode | null,
  visit: (n: TemplateNode) => void,
): void {
  if (node === null) return;
  visit(node);
  switch (node.type) {
    case 'TemplateElement':
      for (const child of node.children) walkTemplate(child, visit);
      // Also walk into slot-filler bodies so re-projection / nested
      // component-tag fills are reached.
      if (node.slotFillers) {
        for (const filler of node.slotFillers) {
          for (const child of filler.body) walkTemplate(child, visit);
        }
      }
      break;
    case 'TemplateConditional':
      for (const branch of node.branches) {
        for (const child of branch.body) walkTemplate(child, visit);
      }
      break;
    case 'TemplateLoop':
      for (const child of node.body) walkTemplate(child, visit);
      break;
    case 'TemplateSlotInvocation':
      for (const child of node.fallback) walkTemplate(child, visit);
      break;
    case 'TemplateFragment':
      for (const child of node.children) walkTemplate(child, visit);
      break;
    case 'TemplateInterpolation':
    case 'TemplateStaticText':
      break;
  }
}

/**
 * Thread producer paramTypes onto consumer SlotFillerDecl.paramTypes for every
 * component-tag fill in `ir.template`. Emits ROZ941 / ROZ945 / ROZ947 per D-08.
 *
 * Mutates `ir` in place (the lowerer produces a fresh IR per call so this is
 * safe). Mutates `diagnostics` by pushing.
 *
 * @param ir            - the consumer's lowered IRComponent
 * @param consumerPath  - absolute path of the consumer `.rozie` file (used for
 *   the cache reverse-dep edge + resolver `fromFile` argument)
 * @param cache         - per-compiler-instance IRCache (D-01)
 * @param resolver      - per-compiler-instance ProducerResolver (D-02 / D-12)
 * @param diagnostics   - accumulator
 */
export function threadParamTypes(
  ir: IRComponent,
  consumerPath: string,
  cache: IRCache,
  resolver: ProducerResolver,
  diagnostics: Diagnostic[],
): void {
  walkTemplate(ir.template, (node) => {
    if (node.type !== 'TemplateElement') return;
    if (node.tagKind !== 'component' && node.tagKind !== 'self') return;
    if (!node.slotFillers || node.slotFillers.length === 0) return;
    if (!node.componentRef) return;

    // 'self' tagKind references the outer-name component (recursion case) — the
    // producer is the consumer itself. Skip resolver+cache; use ir.slots.
    let producerSlots: readonly SlotDecl[];
    if (node.tagKind === 'self') {
      producerSlots = ir.slots;
    } else {
      const resolvedPath = resolver.resolveProducerPath(
        node.componentRef.importPath,
        consumerPath,
      );
      if (resolvedPath === null) {
        diagnostics.push({
          code: RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED,
          severity: 'error',
          message: `Cannot resolve <components> import '${node.componentRef.importPath}' from '${consumerPath}'.`,
          loc: node.componentRef.sourceLoc,
          hint: 'Verify the path exists and is reachable via tsconfig "paths" / Node module resolution / npm install.',
        });
        return;
      }
      const producerIR = cache.getIRComponent(resolvedPath, consumerPath);
      if (producerIR === null) return; // cycle or parse failure — silent degrade
      producerSlots = producerIR.slots;
    }

    const producerSlotsByName = new Map(
      producerSlots.map((s) => [s.name, s] as const),
    );

    for (const filler of node.slotFillers) {
      // Dynamic-name fills cannot be statically matched against a producer
      // slot — skip silently (D-05: runtime miss falls back to producer's
      // defaultContent).
      if (filler.isDynamic) continue;

      const matchingSlot = producerSlotsByName.get(filler.name);
      if (matchingSlot === undefined) {
        diagnostics.push({
          code: RozieErrorCode.UNKNOWN_SLOT_NAME,
          severity: 'warning',
          message: `<template #${
            filler.name || 'default'
          }> does not match any slot declared by ${node.componentRef.importPath}.`,
          loc: filler.sourceLoc,
        });
        continue;
      }

      // R4 — thread producer paramTypes onto consumer.
      if (matchingSlot.paramTypes !== undefined) {
        filler.paramTypes = matchingSlot.paramTypes;
      }

      // D-09 / ROZ947 — validate consumer scoped-param names against producer
      // SlotDecl.params. The producer param set is the source of truth; the
      // consumer must destructure from that set.
      if (filler.params.length > 0) {
        const producerParamNames = new Set(
          matchingSlot.params.map((p) => p.name),
        );
        for (const consumerParam of filler.params) {
          if (!producerParamNames.has(consumerParam.name)) {
            diagnostics.push({
              code: RozieErrorCode.SCOPED_PARAM_MISMATCH,
              severity: 'error',
              message: `Scoped param '${consumerParam.name}' is not declared by producer slot '${
                filler.name || 'default'
              }' in ${node.componentRef.importPath}.`,
              loc: consumerParam.sourceLoc,
              hint:
                matchingSlot.params.length > 0
                  ? `Producer declares: ${matchingSlot.params
                      .map((p) => `'${p.name}'`)
                      .join(', ')}.`
                  : `Producer slot '${filler.name || 'default'}' declares no scoped params.`,
            });
          }
        }
      }
    }
  });
}
