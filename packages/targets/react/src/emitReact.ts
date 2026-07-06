/**
 * emitReact — top-level React 18+ functional-component emitter.
 *
 * Plan 04-02 wires emitScript + emitPropsInterface + shell.
 * Plan 04-03 fills in JSX template emission.
 * Plan 04-04 layers <listeners>-block lowering + listener wrappers between
 *   hookSection and userArrowsSection, plus lifecycleEffectsSection placement.
 * Plan 04-05 wires emitStyle + composeSourceMap (DX-01).
 *
 * Public surface (D-67): emitReact(ir, opts) → { code, css, globalCss?, map, diagnostics }.
 *
 * The CSS routing (Plan 04-05; Phase 25 de-CSS-Modules):
 *   - moduleCss → emitted alongside `.tsx` as a plain sibling `.css` file by
 *     `@rozie/unplugin`'s React-branch load hook. The `.tsx` body imports it
 *     for side effect via `import './${name}.css';` (NO `styles` binding —
 *     class names are un-hashed; `[data-rozie-s-HASH]` attribute scoping is the
 *     sole isolation layer). The `css` result field name is retained (it is
 *     simply "the scoped CSS string"); only its destination extension changed.
 *   - globalCss → emitted alongside `.tsx` as a sibling `.global.css` file
 *     when the .rozie has `:root` rules. The `.tsx` body imports it for
 *     side effect via `import './${name}.global.css';`.
 *
 * No class hashing (Phase 25): emitStyle outputs plain class-name strings and
 * `@rozie/unplugin` routes the scoped slice as a plain `.css` stylesheet. The
 * `[data-rozie-s-<hash>]` attribute selectors below are the sole isolation
 * layer — the prior `.module.css`/CSS-Modules routing was redundant and was
 * removed (it also broke webpack css-loader's pure-selector rule).
 *
 * Component-scope attribute rewriting (paired with the always-scoped Vue
 * model): every scoped CSS selector is rewritten to append
 * `[data-rozie-s-<hash>]` and every HTML host element in the template gets
 * the matching attribute. This gives React the same per-component CSS
 * isolation Vue/Svelte/Angular/Lit have by default. `:root { ... }` rules
 * bypass this pass entirely — they route to `.global.css` unchanged.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import {
  deconflictRefsAgainstUserBindings,
  collectTopLevelFunctionNames,
} from '../../../core/src/rewrite/deconflict.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '@rozie/core';
import type { BlockMap } from '../../../core/src/ast/types.js';
import type { SourceMap } from 'magic-string';
import { splitBlocks } from '../../../core/src/splitter/splitBlocks.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { rewriteRozieImport } from '../../../core/src/codegen/rewriteRozieImport.js';
import { resolveComponentRefs } from '../../../core/src/codegen/resolveComponentRefs.js';
import { synthesizeHandleType } from '../../../core/src/codegen/synthesizeHandleType.js';
import { emitScript } from './emit/emitScript.js';
import { emitPropsInterface } from './emit/emitPropsInterface.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';
import { buildPartialLineOffsets } from '../../../core/src/codegen/composeMaps.js';
import { computeScopeHash, scopeAttrName } from './emit/scopeHash.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from './rewrite/collectReactImports.js';

export interface EmitReactOptions {
  filename?: string;
  source?: string;
  modifierRegistry?: ModifierRegistry;
  /**
   * Phase 06.1 Plan 01 (DX-04): block byte offsets from splitBlocks() —
   * required by buildShell() for accurate source maps. When omitted,
   * derived from `opts.source` via splitBlocks() if available, otherwise
   * the legacy fallback path is taken.
   */
  blockOffsets?: BlockMap;
}

export interface EmitReactResult {
  code: string;
  /** CSS body for the sibling plain `.css` file (D-53). Empty string when no scoped rules. */
  css: string;
  /** CSS body for the sibling `.global.css` file (D-54). Undefined when no `:root` rules. */
  globalCss?: string;
  /** magic-string SourceMap pointing emitted .tsx positions back to .rozie source. Null when filename + source not provided. */
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

export function emitReact(
  ir: IRComponent,
  opts: EmitReactOptions = {},
): EmitReactResult {
  const reactImports = new ReactImportCollector();
  const runtimeImports = new RuntimeReactImportCollector();
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  // Compute the per-component scope hash up front so emitStyle's selector
  // rewriter and emitTemplate's host-element attribute injector use the same
  // token. Derived from the filename when present (stable across re-emit and
  // disambiguates same-name components in different paths); falls back to
  // the IR's component name otherwise (covers test-only synthetic IRs).
  const scopeHash = computeScopeHash(ir.name, opts.filename);
  const scopeAttr = scopeAttrName(scopeHash);

  // Spike-012 R3-5 — a `ref="X"` name colliding with a TOP-LEVEL user `function X`
  // (often an `$expose` verb) both mint a program-scope `X` binding (`const X =
  // useRef(...)` + `function X(){}`) → duplicate declaration. The accessor-shadow
  // pass renames a colliding `const`/`let X` to `X$local`, but it skips function
  // declarations, and an exposed `function X` is public contract (its name feeds
  // the emitted `useImperativeHandle` handle) so it CANNOT be renamed. The
  // renameable side is the INTERNAL ref → rename it to `<name>Ref` (field +
  // `$refs.X` rewrite + JSX `ref={}` all read the renamed IR). Only-on-collision
  // (function names only), so the const/let path + the non-colliding corpus stay
  // byte-identical. Runs on this target's OWN fresh IR before any emit reads a ref.
  deconflictRefsAgainstUserBindings(
    ir,
    collectTopLevelFunctionNames(ir.setupBody.scriptProgram),
  );

  // Spike 004 — reuse the per-component `scopeHash` for the `@portal` closure
  // setAttribute so it matches the emitted `@portal` CSS selectors.
  const scriptOpts: { filename?: string; portalScopeHash?: string } = {
    portalScopeHash: scopeHash,
  };
  if (opts.filename !== undefined) scriptOpts.filename = opts.filename;
  const {
    hasPortals,
    hookSection,
    userArrowsSection,
    userImports: userScriptImports,
    hoistedTypeDecls: userHoistedTypeDecls,
    lifecycleEffectsSection,
    hasPropsDefaults,
    hookSectionLines,
    scriptMap,
    providerOpen,
    providerClose,
    diagnostics: scriptDiags,
  } = emitScript(
    ir,
    { react: reactImports, runtime: runtimeImports, filename: opts.filename },
    scriptOpts,
  );

  // Portal-slot primitive (Spike 003) — when the script emit synthesized a
  // portals closure, the shell needs the matching react-dom/client import.
  // `Root` is type-only so the line uses `type Root` to avoid a runtime
  // import (the value-side reference is `createRoot`).
  // The flushSync line lives in 'react-dom' (not 'react-dom/client'); it
  // forces synchronous portal-tree commits so engine callbacks never see
  // an unmounted-but-DOM-attached node mid-reconciliation (see emitPortals.ts
  // for the rationale).
  const portalImport = hasPortals
    ? "import { createRoot, type Root } from 'react-dom/client';\nimport { flushSync } from 'react-dom';\n"
    : '';

  // Plan 04-03: emit the template-side JSX, slot-prop fields + ctx interfaces.
  // Threads scopeAttr through to emitTemplateNode so every HTML host element
  // emits the matching attribute. Component tags (tagKind 'component'/'self')
  // skip the attribute — their own bundles carry their own scope.
  const tmpl = emitTemplate(
    ir,
    { react: reactImports, runtime: runtimeImports },
    registry,
    { scopeAttr },
  );

  // Plan 04-04: emit <listeners>-block entries (4-class A/B/C/D classifier).
  const listeners = emitListeners(
    ir,
    { react: reactImports, runtime: runtimeImports },
    registry,
  );

  // Plan 04-05: emit styles per D-53 + D-54. emitStyle requires the original
  // `.rozie` source text to slice rule bodies by absolute byte offset (the
  // IR's StyleSection only carries StyleRule.loc, not cssText). When
  // opts.source is missing, skip style emission entirely so back-compat with
  // older callers (Plan 04-02 tests) is preserved.
  const styleResult = opts.source !== undefined
    ? emitStyle(ir.styles, opts.source, scopeHash)
    : { moduleCss: '', globalCss: null as string | null, diagnostics: [] };
  const moduleCss = styleResult.moduleCss;
  const globalCss = styleResult.globalCss;
  const styleDiags = styleResult.diagnostics;

  const propsInterface = emitPropsInterface(ir, tmpl.slotPropFields);

  // Build the type-only `import type { ReactNode } from 'react';` line if
  // the props interface or scriptInjections reference ReactNode.
  const referencesReactNode =
    propsInterface.includes('ReactNode') ||
    tmpl.slotCtxInterfaces.some((s) => s.includes('ReactNode')) ||
    tmpl.scriptInjections.some((s) => s.includes('ReactNode'));
  const reactTypeImports = referencesReactNode
    ? "import type { ReactNode } from 'react';\n"
    : '';

  // Phase 25 — synthesize the scoped CSS sibling import as a PLAIN side-effect
  // import (`import './X.css';`), NOT a CSS-Modules default import. React class
  // names are no longer hashed; attribute scoping (`[data-rozie-s-HASH]`,
  // applied by scopeCss/emitStyle) is the sole isolation layer, matching the
  // other five targets. `$classSelector` lowers to a static `"." + "x"` string
  // with no `styles` dependency, so the obsolete ROZ968 (no-`source`) guard is
  // gone — a `$classSelector` call is now safe on every emit path.
  const cssModuleImport =
    moduleCss.length > 0 ? `import './${ir.name}.css';` : null;
  const globalCssImport =
    globalCss !== null ? `import './${ir.name}.global.css';` : null;

  // Plan 04-04 composition order (Wave 0 spike Variant A):
  //   hookSection (state hooks)
  //     → userArrowsSection (useCallback wraps + plain helpers + computed)
  //     → lifecycleEffectsSection (lifecycle useEffects — moved here per
  //        Plan 04-04 to fix Plan 04-03 deferred TDZ limitation #1)
  //     → wrapper consts (`scriptInjections`, template + listener)
  //     → listener useEffect blocks (`listenerEffects`)
  //     → return JSX
  const script = [hookSection, userArrowsSection, lifecycleEffectsSection]
    .filter((s) => s.length > 0)
    .join('\n\n');

  const allScriptInjections = [...tmpl.scriptInjections, ...listeners.scriptInjections];

  // Phase 06.1 Plan 01 (DX-04) — resolve blockOffsets via:
  //   1. opts.blockOffsets (caller threaded splitBlocks result through)
  //   2. derive from opts.source via splitBlocks() (back-compat for tests
  //      that pass { filename, source } without re-parsing for ast.blocks)
  //   3. degenerate empty BlockMap (no source available — fully back-compat
  //      with pre-Phase-06.1 callers; produces a legacy-fallback MagicString).
  let resolvedBlockOffsets: BlockMap;
  if (opts.blockOffsets !== undefined) {
    resolvedBlockOffsets = opts.blockOffsets;
  } else if (opts.source !== undefined) {
    resolvedBlockOffsets = splitBlocks(opts.source, opts.filename);
  } else {
    resolvedBlockOffsets = {};
  }

  // Phase 06.2 P2 (D-118): synthesize user-component import lines from
  // ir.components, SKIPPING entries whose `localName === ir.name` (Pitfall 7
  // — React's named-function declaration handles self-reference natively;
  // a redundant `import { TreeNode } from './TreeNode'` would shadow the
  // enclosing function declaration in the same file).
  // Defensive `?? []` guards pre-P1 hand-rolled IRs in legacy tests.
  const components = ir.components ?? [];
  // Phase 66 (D-2 Handle-INTERFACE route, SC-1): the set of composed-component
  // LOCAL names that are the target of a `$refs.X` in this component. For those
  // — and ONLY those — the import is augmented to also bring the child's
  // already-exported `type <Name>Handle` (react barrel `index.ts:5`) so the
  // parent's `useRef<<Name>Handle | null>` (emitScript.ts) resolves. A composed
  // component that is NOT ref'd keeps its default-only import byte-identical.
  const refdComponentNames = new Set(resolveComponentRefs(ir).values());
  const componentImportsLines: string[] = components
    .filter((decl) => decl.localName !== ir.name) // skip redundant self-entry
    .map((decl) => {
      const rewritten = rewriteRozieImport(decl.importPath, 'react');
      if (refdComponentNames.has(decl.localName)) {
        return `import ${decl.localName}, { type ${decl.localName}Handle } from '${rewritten}';`;
      }
      return `import ${decl.localName} from '${rewritten}';`;
    });
  const componentImportsBlock =
    componentImportsLines.length > 0
      ? componentImportsLines.join('\n') + '\n'
      : '';

  // Phase 21 ($expose, REQ-5 / REQ-10, D-03) — branch STRICTLY on
  // ir.expose.length. When empty, none of these parts are passed and the shell
  // emits the byte-for-byte unchanged plain-function shape. When non-empty:
  //   - add `forwardRef` + `useImperativeHandle` to the `react` import line,
  //   - synthesize the exported `export interface <Name>Handle {...}` so leaf
  //     barrels and consumers can `import type` it directly from the `.tsx`,
  //   - build the `useImperativeHandle(ref, () => ({ a, b }), []);` block.
  let exposeNames: string[] | undefined;
  let handleInterface: string | undefined;
  let imperativeHandleBlock: string | undefined;
  // Defensive `?? []` guards pre-Phase-21 hand-rolled IRs (legacy tests).
  const exposeMethods = ir.expose ?? [];
  if (exposeMethods.length > 0) {
    reactImports.add('forwardRef');
    reactImports.add('useImperativeHandle');
    reactImports.add('useRef');
    exposeNames = exposeMethods.map((e) => e.name);
    // synthesizeHandleType returns the bare `interface <Name>Handle {...}` (or
    // null); prepend `export ` so the named handle type is importable from the
    // emitted `.tsx`. The `.d.ts` sidecar (emitTypes.ts) prepends its own
    // export, so this only affects the `.tsx` surface — no double-export.
    const synthesized = synthesizeHandleType(ir, `${ir.name}Handle`);
    handleInterface = synthesized != null ? `export ${synthesized}` : undefined;
    // Quick task 260618-ao9 (ROZ138 stale-read class applied to $expose verbs) —
    // STABLE-IDENTITY, LIVE-READ handle. Previously this emitted
    // `useImperativeHandle(ref, () => ({ a, b }), [])`: the `[]` dep array froze
    // the handle's verb references at RENDER 0, so a verb that reads reactive
    // state ($data / derived / props) returned stale render-0 values when called
    // later (data-table grid: `focusCell(1,1)`→(0,0), `getActiveCell()`→(0,0)
    // because they clamp/read against the render-0 empty row model).
    //
    // Fix: keep `ref.current` referentially STABLE (the handle object is still
    // built ONCE with `[]` deps), but route each verb through a `useRef` mirror
    // (`_rozieExposeRef.current.<verb>`) that is re-synced each render to the
    // LATEST closure. The exposed verbs are plain per-render `function`
    // declarations (recreated each render → they already read live state), so a
    // dispatch wrapper over the live mirror is sufficient — no per-verb body
    // rewrite or `_<X>Ref` state-mirror generation needed.
    //
    // The factory now references ONLY `_rozieExposeRef` (a `useRef`), which
    // `react-hooks/exhaustive-deps` treats as a stable dependency it never
    // requires in the dep array — so the empty `[]` is CORRECT without any
    // disable. (The previous direct `({ a, b })` form referenced the verb
    // closures, which the rule WOULD flag; that emitted a targeted
    // `eslint-disable-line`. With the ref-dispatch form the disable would be an
    // UNUSED directive — a warning under the strict `--report-unused-disable-
    // directives` fixture-lint gate — so it is deliberately omitted.)
    // `Parameters<typeof X>` / `ReturnType<typeof X>` preserve each verb's exact
    // signature so the emitted handle stays type-clean against
    // `export interface <Name>Handle`.
    const refInit = `const _rozieExposeRef = useRef({ ${exposeNames.join(', ')} });`;
    const refSync = `_rozieExposeRef.current = { ${exposeNames.join(', ')} };`;
    const dispatchers = exposeNames
      .map(
        (n) =>
          `${n}: (...args: Parameters<typeof ${n}>): ReturnType<typeof ${n}> => _rozieExposeRef.current.${n}(...args)`,
      )
      .join(', ');
    const handleLine = `useImperativeHandle(ref, () => ({ ${dispatchers} }), []);`;
    imperativeHandleBlock = `${refInit}\n${refSync}\n${handleLine}`;
  }

  const { ms, scriptOutputOffset, userCodeLineOffset, scriptMap: shellScriptMap } = buildShell({
    componentName: ir.name,
    propsInterface,
    reactImports: reactImports.render(),
    reactTypeImports,
    portalImport,
    runtimeImports: runtimeImports.render(),
    userImports: userScriptImports,
    hoistedTypeDecls: userHoistedTypeDecls,
    cssModuleImport,
    globalCssImport,
    ctxInterfaces: tmpl.slotCtxInterfaces,
    scriptInjections: allScriptInjections,
    script,
    listenerEffects: listeners.code,
    hasPropsDefaults,
    hookSectionLines,
    jsx: tmpl.jsx,
    rozieSource: opts.source ?? '',
    blockOffsets: resolvedBlockOffsets,
    scriptMap,
    componentImportsBlock,
    exposeNames,
    handleInterface,
    imperativeHandleBlock,
    providerOpen,
    providerClose,
  });

  const code = ms.toString();

  // Phase 06.1 P2 (D-109): composeSourceMap is now a thin wrapper around
  // composeMaps() — chains the shell map with emitScript's per-expression
  // child map (when present) at scriptOutputOffset.
  const map =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(ms, {
          filename: opts.filename,
          source: opts.source,
          scriptMap: shellScriptMap,
          scriptOutputOffset,
          userCodeLineOffset,
          // Phase 55 Plan 03 (SC-2): spliced `.rzts` line-restore table, built
          // from the lowered script AST (carries `extra.__roziePartialOrigin`).
          partialLineOffsets: buildPartialLineOffsets(ir.setupBody.scriptProgram),
        })
      : null;

  const result: EmitReactResult = {
    code,
    css: moduleCss,
    map,
    diagnostics: [
      ...scriptDiags,
      ...tmpl.diagnostics,
      ...listeners.diagnostics,
      ...styleDiags,
    ],
  };
  if (globalCss !== null) {
    result.globalCss = globalCss;
  }
  return result;
}
