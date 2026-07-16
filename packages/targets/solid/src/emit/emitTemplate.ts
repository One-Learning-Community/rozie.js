/**
 * emitTemplate — Solid target (P1 minimal).
 *
 * Top-level template-side emitter. Walks the IR's TemplateNode tree and
 * produces a JSX string for the Solid component's return statement.
 *
 * P1 minimum: emit a valid JSX tree that is syntactically parseable.
 * P2 fills directive-accurate emission (<Show>, <For>, etc.).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { emitNode, type EmitNodeCtx } from './emitTemplateNode.js';
import { buildKeynavScriptInjections, resolveKeynavPlan } from './emitKeynav.js';

export interface EmitTemplateResult {
  jsx: string;
  /**
   * Script-body injection lines from template @event debounce/throttle wrappers.
   * These are merged into the component body BEFORE the return statement.
   */
  scriptInjections: string[];
  /**
   * Quick task 260704-mf3 — true when the walk emitted at least one keyed
   * `r-for` as `<Key>` (from `@solid-primitives/keyed`). emitSolid reads this
   * to inject the matching import as a bespoke shell part (Key is not a
   * solid-js export, so it can't ride the SolidImportCollector).
   */
  needsKeyedImport: boolean;
  diagnostics: Diagnostic[];
  /**
   * command-palette-portal-overlay phase — true when the walk emitted at
   * least one `r-portal` element teleport as `<Portal>` (from `solid-js/web`).
   * emitSolid reads this to inject the matching import as a bespoke shell
   * part, mirroring `needsKeyedImport`.
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
  collectors: { solid: SolidImportCollector; runtime: RuntimeSolidImportCollector },
  registry: ModifierRegistry,
  opts: EmitTemplateOptions = {},
): EmitTemplateResult {
  const diagnostics: Diagnostic[] = [];

  if (ir.template === null) {
    return {
      jsx: 'null',
      scriptInjections: [],
      needsKeyedImport: false,
      diagnostics: [],
      hasElementPortal: false,
    };
  }

  const scriptInjections: string[] = [];
  const injectionCounter = { next: 0 };
  // Quick task 260704-mf3 — shared mutable flag set by descendant emitLoop
  // calls when they emit a keyed loop as `<Key>`. Object (not a bare boolean)
  // so the reference survives the spread-copy of every child ctx (mirrors how
  // `injectionCounter` / `scriptInjections` are threaded).
  const keyedImport = { needed: false };
  // command-palette-portal-overlay phase — mirrors keyedImport's pattern for
  // `<Portal>` (solid-js/web).
  const elementPortalImport = { needed: false };

  // Phase 71 (r-keynav) — resolved ONCE per component (not per element; see
  // emitKeynav.ts's module doc comment). `null` for the overwhelming
  // majority of components (no r-keynav root) — every downstream keynav
  // call site short-circuits on `null`, so this stays a cheap no-op for
  // every existing fixture (SPEC §11: "no corpus rebless").
  const keynav = resolveKeynavPlan(ir);

  const ctx: EmitNodeCtx = {
    ir,
    collectors,
    registry,
    diagnostics,
    scriptInjections,
    injectionCounter,
    keyedImport,
    elementPortalImport,
    keynav,
    ...(opts.scopeAttr !== undefined ? { scopeAttr: opts.scopeAttr } : {}),
  };

  const jsx = emitNode(ir.template, ctx);

  // Phase 71 (r-keynav) — the `createKeynav(...)` call + its `let`/group-id
  // scaffolding are appended AFTER the JSX walk (mirrors the React/Vue
  // references — visually adjacent to the `keynav` resolution above).
  if (keynav !== null) {
    scriptInjections.push(...buildKeynavScriptInjections(keynav, ir, collectors));
  }

  return {
    jsx,
    scriptInjections,
    needsKeyedImport: keyedImport.needed,
    diagnostics,
    hasElementPortal: elementPortalImport.needed,
  };
}
