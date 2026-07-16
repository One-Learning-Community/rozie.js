/**
 * emitTemplate — Plan 04-03 Task 3 (React target).
 *
 * Top-level template-side emitter. Walks the IR's TemplateNode tree and
 * produces:
 *
 *   - jsx — the JSX body string (what goes inside `return ( ... );`)
 *   - scriptInjections — top-of-component-body lines (lifted default-content
 *     functions, modifier-helper wraps like useDebouncedCallback consts)
 *   - slotPropFields — interface FooProps lines (e.g., 'children?: ReactNode;')
 *   - slotCtxInterfaces — standalone interface declarations
 *     (e.g., 'interface TriggerCtx { open: any; toggle: any; }')
 *   - diagnostics — collected diagnostics (D-08 collected-not-thrown)
 *
 * Empty template (ir.template === null) returns 'null' for the jsx field so
 * the function body's `return ( null );` still type-checks under JSX.Element.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitNode, type EmitNodeCtx } from './emitTemplateNode.js';
import { emitSlotDecl } from './emitSlotDecl.js';
import { buildKeynavScriptInjections, resolveKeynavPlan } from './emitKeynav.js';

export interface EmitTemplateResult {
  jsx: string;
  scriptInjections: string[];
  slotPropFields: string[];
  slotCtxInterfaces: string[];
  diagnostics: Diagnostic[];
  /**
   * command-palette-portal-overlay phase — true when the template walk
   * emitted at least one `r-portal` element teleport (`emitPortalElement` in
   * emitTemplateNode.ts). Drives the conditional
   * `import { createPortal } from 'react-dom';` line in emitReact.ts —
   * mirrors the P33 `hasPortals` flag emitScript.ts threads for the
   * (distinct, untouched) slot-content primitive.
   */
  hasElementPortal: boolean;
}

export interface EmitTemplateOptions {
  /**
   * Component-scope attribute name (e.g. `data-rozie-s-abc12345`). When set,
   * every emitted HTML host element receives this attribute so the matching
   * `[<attr>]` selector tail injected by `scopeCss` actually matches.
   */
  scopeAttr?: string;
}

export function emitTemplate(
  ir: IRComponent,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
  registry: ModifierRegistry,
  opts: EmitTemplateOptions = {},
): EmitTemplateResult {
  const slotResult = emitSlotDecl(ir);
  const diagnostics: Diagnostic[] = [];
  const scriptInjections: string[] = [];

  if (ir.template === null) {
    return {
      jsx: 'null',
      scriptInjections: [],
      slotPropFields: slotResult.slotPropFields,
      slotCtxInterfaces: slotResult.slotCtxInterfaces,
      diagnostics: [],
      hasElementPortal: false,
    };
  }

  // Phase 71 (r-keynav) — resolved ONCE per component (not per element; see
  // emitKeynav.ts's module doc comment). `null` for the overwhelming
  // majority of components (no r-keynav root) — every downstream keynav
  // call site short-circuits on `null`, so this stays a cheap no-op for
  // every existing fixture (SPEC §11: "no corpus rebless").
  const keynav = resolveKeynavPlan(ir);

  // command-palette-portal-overlay phase — mutable out-flag; see
  // EmitNodeCtx.elementPortalFlag doc comment.
  const elementPortalFlag = { seen: false };

  const ctx: EmitNodeCtx = {
    ir,
    collectors,
    registry,
    diagnostics,
    scriptInjections,
    injectionCounter: { next: 0 },
    ...(opts.scopeAttr !== undefined ? { scopeAttr: opts.scopeAttr } : {}),
    keynav,
    elementPortalFlag,
  };

  const jsx = emitNode(ir.template, ctx);

  // Phase 71 (r-keynav) — the `useKeynav(...)` call + its `useRef`/`useId`
  // scaffolding. Appended AFTER the template walk (order doesn't matter for
  // THESE lines — they're independent declarations — but keeps this block
  // visually adjacent to the `keynav` resolution above).
  if (keynav !== null) {
    scriptInjections.push(...buildKeynavScriptInjections(keynav, ir, collectors));
  }

  return {
    jsx,
    scriptInjections,
    slotPropFields: slotResult.slotPropFields,
    slotCtxInterfaces: slotResult.slotCtxInterfaces,
    diagnostics,
    hasElementPortal: elementPortalFlag.seen,
  };
}
