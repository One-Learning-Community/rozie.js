/**
 * validateTwoWayBindings — Phase 07.3 Plan 02.
 *
 * Post-IR pass that walks every `TemplateElementIR` in the consumer's lowered
 * IR and validates each `AttributeBinding` of `kind: 'twoWayBinding'` (emitted
 * by the lowerer when it encounters `r-model:propName="expr"`).
 *
 * Three diagnostic codes (registered by Plan 01 in `diagnostics/codes.ts`):
 *
 *   - ROZ950 TWO_WAY_ARG_OR_TARGET_INVALID — shape errors:
 *       (a) `r-model:` argument is empty (`r-model:="$data.x"`) — the parser
 *           produced `name === 'model:'` and the lowerer's `propName.slice(6)`
 *           produced an empty string.
 *       (b) `r-model:propName` applied to a non-component HTML tag
 *           (`<div r-model:foo=`) — the producer-side machinery the directive
 *           drives only exists on Rozie components (`tagKind: 'component' | 'self'`).
 *
 *   - ROZ951 TWO_WAY_LHS_NOT_WRITABLE — RHS fails `isWritableLValue` per the
 *     D-03 permissive rule (literals, ternaries, calls, $computed refs,
 *     $refs.x, unknown $data members, $props without model:true).
 *
 *   - ROZ949 TWO_WAY_PROP_NOT_MODEL — semantic mismatch: producer's prop
 *     declaration lacks `model: true`. Mirrors ROZ947's dual-frame approach
 *     — primary frame at the consumer's `r-model:propName=` site, secondary
 *     frame (via `related[]`) at the producer's prop declaration.
 *
 * Diagnostic priority for a single binding (we deliberately emit at most ONE
 * per binding to keep error output tractable):
 *   1. Shape errors (ROZ950) — empty propName OR non-component target.
 *   2. LHS errors (ROZ951) — RHS is not a writable lvalue.
 *   3. Semantic mismatch (ROZ949) — only checked when both shape AND LHS are
 *      valid; requires producer IR lookup, which is skipped for invalid shapes.
 *
 * Producer lookup mirrors `threadParamTypes` verbatim:
 *   - 'self' tagKind (recursive self-reference) uses `ir.props` directly.
 *   - 'component' tagKind resolves the importPath via `ProducerResolver`,
 *     fetches the producer's IR via `IRCache.getIRComponent`.
 *   - Resolver returns null → push ROZ945 CROSS_PACKAGE_LOOKUP_FAILED at the
 *     `<components>` decl loc (parity with threadParamTypes' error path).
 *   - Cache returns null (cycle / parse failure / unreadable) → silent
 *     degrade (no false ROZ949 — matches threadParamTypes).
 *
 * Per D-08 collected-not-thrown: NEVER throws. All failures push a diagnostic
 * and continue. Mutates `diagnostics` in place; never mutates `ir`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, PropDecl, TemplateNode } from './types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { IRCache } from './cache.js';
import type { ProducerResolver } from '../resolver/index.js';
import { isWritableLValue } from '../semantic/lvalue.js';

/**
 * Recursive template walker — mirrors threadParamTypes.walkTemplate so the
 * two passes traverse exactly the same node set (slot-filler bodies included).
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
 * Validate every `r-model:propName=` two-way binding in the consumer's IR.
 *
 * @param ir            - the consumer's lowered IRComponent
 * @param consumerPath  - absolute path of the consumer `.rozie` file (used for
 *   the cache reverse-dep edge + resolver `fromFile` argument)
 * @param cache         - per-compiler-instance IRCache (D-01) — shared with
 *   threadParamTypes so producers parsed once during threading are reused here
 * @param resolver      - per-compiler-instance ProducerResolver (D-02 / D-12)
 * @param diagnostics   - accumulator (mutated in place; ROZ949/950/951/945 pushed)
 */
export function validateTwoWayBindings(
  ir: IRComponent,
  consumerPath: string,
  cache: IRCache,
  resolver: ProducerResolver,
  diagnostics: Diagnostic[],
): void {
  walkTemplate(ir.template, (node) => {
    if (node.type !== 'TemplateElement') return;
    // Collect all twoWayBinding attributes on this element (most elements
    // have zero; iterate once to avoid a costly tagKind / producer lookup
    // on elements with no two-way bindings).
    const twoWayAttrs = node.attributes.filter(
      (a) => a.kind === 'twoWayBinding',
    );
    if (twoWayAttrs.length === 0) return;

    // Resolve the producer ONCE per element (lazy; only when needed for ROZ949).
    // Use null sentinel for "not yet attempted"; another null sentinel
    // (producerProps === null after lookup attempted) means lookup failed
    // and ROZ949 silently degrades.
    let producerProps: readonly PropDecl[] | null = null;
    let producerLookupAttempted = false;
    let producerLookupHardFailed = false;

    const resolveProducerProps = (): readonly PropDecl[] | null => {
      if (producerLookupAttempted) return producerProps;
      producerLookupAttempted = true;

      // 'self' tagKind references the outer-name component (recursion) — the
      // producer IS the consumer itself. Skip resolver+cache; use ir.props.
      if (node.tagKind === 'self') {
        producerProps = ir.props;
        return producerProps;
      }

      if (node.tagKind !== 'component' || !node.componentRef) {
        // Non-component target — ROZ950 handles this branch separately, so
        // we never even attempt producer lookup. Returning null here means
        // ROZ949 silently degrades (the shape error covers the case).
        producerLookupHardFailed = true;
        return null;
      }

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
        producerLookupHardFailed = true;
        return null;
      }
      const producerIR = cache.getIRComponent(resolvedPath, consumerPath);
      if (producerIR === null) {
        // Cycle / parse failure / unreadable — silent degrade (no false ROZ949).
        producerLookupHardFailed = true;
        return null;
      }
      producerProps = producerIR.props;
      return producerProps;
    };

    for (const attr of twoWayAttrs) {
      // Narrow the discriminated union; attr.kind === 'twoWayBinding' is
      // guaranteed by the filter above.
      if (attr.kind !== 'twoWayBinding') continue;

      // ----- Priority 1: ROZ950 shape errors. -----
      //
      // (a) Empty propName — the parser produced 'model:' (no segment after
      //     the colon), the lowerer set name='' on this attribute.
      if (attr.name === '') {
        diagnostics.push({
          code: RozieErrorCode.TWO_WAY_ARG_OR_TARGET_INVALID,
          severity: 'error',
          message: `r-model: argument is empty — the argument-form requires a propName (write 'r-model:open="$data.x"' not 'r-model:="$data.x"').`,
          loc: attr.sourceLoc,
          hint: 'Specify the producer prop name after the colon (e.g. r-model:open, r-model:value).',
        });
        continue;
      }

      // (b) Non-component target — the consumer-side two-way machinery only
      //     engages on Rozie components (`tagKind: 'component' | 'self'`).
      //     HTML tags (`<div>`, `<input>`, custom elements) have no producer
      //     prop to drive; this is almost certainly a typo for bare `r-model`.
      if (node.tagKind !== 'component' && node.tagKind !== 'self') {
        diagnostics.push({
          code: RozieErrorCode.TWO_WAY_ARG_OR_TARGET_INVALID,
          severity: 'error',
          message: `r-model:${attr.name}= can only be applied to Rozie component tags — '<${node.tagName}>' is an HTML tag and has no consumer-side two-way machinery to engage.`,
          loc: attr.sourceLoc,
          hint: `For form inputs, use bare r-model="…" (no colon). For custom Rozie components, declare <${node.tagName}> in the <components> block.`,
        });
        continue;
      }

      // ----- Priority 2: ROZ951 LHS errors. -----
      //
      // The RHS must satisfy the D-03 permissive whitelist (writable lvalue).
      if (!isWritableLValue(attr.expression, ir)) {
        diagnostics.push({
          code: RozieErrorCode.TWO_WAY_LHS_NOT_WRITABLE,
          severity: 'error',
          message: `r-model:${attr.name}= requires a writable lvalue on the right-hand side — literals, ternaries, function calls, and $computed refs cannot be two-way bound.`,
          loc: attr.sourceLoc,
          hint: 'Bind to a $data member (e.g. $data.open) or, in a wrapper component, a $props member declared with model: true.',
        });
        continue;
      }

      // ----- Priority 3: ROZ949 semantic — producer prop lacks model:true. -----
      //
      // Lookup the producer IR (lazy + cached per element). Silent-degrade on
      // null per threadParamTypes' contract — we'd rather miss one ROZ949 than
      // emit a false positive on a cycle / parse failure.
      const producerPropDecls = resolveProducerProps();
      if (producerPropDecls === null) {
        // Either lookup hard-failed (already pushed ROZ945) or silently
        // degraded — either way, skip ROZ949 for this binding.
        continue;
      }
      // Mark lookup-hard-failed loop-suppressed access (TS noUnusedLocals fix —
      // the flag is consumed transitively via producerProps but readers want
      // an explicit marker for "we tried and gave up").
      void producerLookupHardFailed;

      const producerProp = producerPropDecls.find((p) => p.name === attr.name);
      if (producerProp === undefined) {
        // Producer doesn't declare this prop at all. This is NOT ROZ949 —
        // it's an unknown prop write. We deliberately do NOT emit a new
        // code here: the missing-prop case is rare in practice (typos catch
        // at threadParamTypes' slot-name check pattern; a future iteration
        // can add ROZ952 if needed). Silent.
        continue;
      }

      if (!producerProp.isModel) {
        // Dual-frame ROZ949 — primary frame at the consumer site, secondary
        // frame at the producer's prop declaration. Mirrors ROZ947.
        const producerImportPath =
          node.tagKind === 'self'
            ? '(self-reference)'
            : (node.componentRef?.importPath ?? '(unknown)');
        diagnostics.push({
          code: RozieErrorCode.TWO_WAY_PROP_NOT_MODEL,
          severity: 'error',
          message: `r-model:${attr.name}= cannot bind to '${attr.name}' on ${producerImportPath} — the producer prop is not declared with model: true.`,
          loc: attr.sourceLoc,
          hint: `Add 'model: true' to the '${attr.name}' prop declaration on ${producerImportPath}, or pass a one-way value via :${attr.name}="…" instead.`,
          related: [
            {
              message: `'${attr.name}' declared here without model: true`,
              loc: producerProp.sourceLoc,
            },
          ],
        });
        continue;
      }
    }
  });
}
