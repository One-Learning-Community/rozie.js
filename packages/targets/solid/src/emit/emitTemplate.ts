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
import type { Diagnostic, IRComponent, ModifierRegistry } from '@rozie/core';
import type {
  RuntimeSolidImportCollector,
  SolidImportCollector,
} from '../rewrite/collectSolidImports.js';
import {
  buildKeynavFocusScopeInjections,
  buildKeynavScriptInjections,
  resolveKeynavFocusScopeRefs,
  resolveKeynavPlans,
} from './emitKeynav.js';
import { type EmitNodeCtx, emitNode } from './emitTemplateNode.js';

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
  // emitKeynav.ts's module doc comment). Phase 77 — one plan PER root, `[]`
  // for the overwhelming majority of components (no r-keynav root) — every
  // downstream keynav call site short-circuits on an empty array, so this
  // stays a cheap no-op for every existing fixture (SPEC §7.4: "no corpus
  // rebless").
  const keynavPlans = resolveKeynavPlans(ir);
  // Plan 260806-lz7 — the component-WIDE strict-containment focus scope,
  // resolved once alongside `keynavPlans` (`[]` when there are no plans —
  // see `resolveKeynavFocusScopeRefs`'s doc comment).
  const keynavScopeRefs = resolveKeynavFocusScopeRefs(ir, keynavPlans);

  const ctx: EmitNodeCtx = {
    ir,
    collectors,
    registry,
    diagnostics,
    scriptInjections,
    injectionCounter,
    keyedImport,
    elementPortalImport,
    keynav: keynavPlans,
    keynavScope: keynavScopeRefs,
    ...(opts.scopeAttr !== undefined ? { scopeAttr: opts.scopeAttr } : {}),
  };

  const jsx = emitNode(ir.template, ctx);

  // Plan 260806-lz7 — the fresh scope-ref `let` declarations, ONCE per
  // component (not once per plan — see `buildKeynavFocusScopeInjections`'s
  // doc comment).
  scriptInjections.push(...buildKeynavFocusScopeInjections(keynavScopeRefs));

  // Phase 71 (r-keynav), extended Phase 77 — ONE `createKeynav(...)` call +
  // its `let`/group-id scaffolding PER resolved plan, appended AFTER the JSX
  // walk (mirrors the React/Vue references — visually adjacent to the
  // `keynavPlans` resolution above).
  for (const plan of keynavPlans) {
    scriptInjections.push(...buildKeynavScriptInjections(plan, ir, collectors, keynavScopeRefs));
  }

  return {
    jsx,
    scriptInjections,
    needsKeyedImport: keyedImport.needed,
    diagnostics,
    hasElementPortal: elementPortalImport.needed,
  };
}
