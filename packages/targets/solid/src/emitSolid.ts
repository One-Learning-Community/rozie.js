/**
 * @rozie/target-solid — top-level emitter orchestrator.
 *
 * Mirrors emitReact.ts module-for-module with these key differences:
 *   - No CSS sidecar (Pitfall 3): EmitSolidResult has no css/globalCss fields.
 *   - splitProps universally applied (D-141): function param is always '_props'.
 *   - children() accessor for default slot (D-131).
 *   - Solid-flavored slot field shapes (D-132/D-133) in emitSlotDecl/emitSlotInvocation.
 *   - createEffect+onCleanup for listeners (no useEffect dep arrays).
 *
 * Component-scope attribute rewriting (paired with the always-scoped Vue
 * model): every scoped CSS selector in the inlined `<style>` JSX is rewritten
 * to append `[data-rozie-s-<hash>]` and every HTML host element in the
 * template gets the matching attribute. This gives Solid the same
 * per-component CSS isolation Vue/Svelte/Angular/Lit have by default.
 * `:root { ... }` rules bypass this pass entirely — they emit in a
 * separate unscoped `<style>` JSX element.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '@rozie/core';
import type { BlockMap } from '../../../core/src/ast/types.js';
import type { SourceMap } from 'magic-string';
import { splitBlocks } from '../../../core/src/splitter/splitBlocks.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { rewriteRozieImport } from '../../../core/src/codegen/rewriteRozieImport.js';
import { resolveComponentRefs } from '../../../core/src/codegen/resolveComponentRefs.js';
import { synthesizeHandleType } from '../../../core/src/codegen/synthesizeHandleType.js';
import { deconflictSolidGeneratedNames } from '../../../core/src/rewrite/deconflict.js';
import {
  SOLID_EMITTER_LOCALS,
  SOLID_IMPORT_NAMES,
} from '../../../core/src/rewrite/reservedNames.js';
import {
  deconflictSolidRefSuffix,
  collectSolidTopLevelBindingNames,
} from './rewrite/deconflictRefSuffix.js';
import { SolidImportCollector, RuntimeSolidImportCollector } from './rewrite/collectSolidImports.js';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitSlotDecl } from './emit/emitSlotDecl.js';
import { emitPropsInterface } from './emit/emitPropsInterface.js';
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';
import { buildPartialLineOffsets } from '../../../core/src/codegen/composeMaps.js';
import { computeScopeHash, scopeAttrName } from './emit/scopeHash.js';

export interface EmitSolidOptions {
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

export interface EmitSolidResult {
  code: string;
  /**
   * magic-string SourceMap pointing emitted .tsx positions back to .rozie source.
   * Null when filename + source not provided.
   */
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

export function emitSolid(ir: IRComponent, opts: EmitSolidOptions = {}): EmitSolidResult {
  // Phase 61 Plan 06 (SC-2, collision-solid §"NEW risks" 1/2) — IR-LEVEL rename of
  // GENERATED `<data>`/`$computed`/`$refs` names that collide with the Solid
  // reserved set (emitter locals ∪ bare solid-js/runtime imports) or each other /
  // a model-prop. These names are minted by emitScript as STRING lines from the IR
  // (not user declarators in the cloned <script>), so the per-target
  // `deconflictGeneratedSymbols` clone-walk cannot reach them. Run on THIS fresh
  // per-target IR BEFORE any name is read (emitScript / emitTemplate / shell). Solid
  // is a FUNCTION target — the reserved set carries NO DOM/Object.prototype/CVA
  // names (collision-solid §4). Public-contract names (props + $expose verbs) are
  // never renamed. Only-on-collision: a non-colliding name is byte-identical.
  {
    const solidReserved = new Set<string>([
      ...SOLID_EMITTER_LOCALS,
      ...SOLID_IMPORT_NAMES,
    ]);
    const protectedNames = new Set<string>([
      ...(ir.expose ?? []).map((e) => e.name),
      ...ir.props.map((p) => p.name),
    ]);
    deconflictSolidGeneratedNames(ir, solidReserved, protectedNames);
  }

  // Spike-012 R5 (C4-rename-collision, Solid "make it work" half) — a template
  // ref's UNCONDITIONALLY-suffixed emitted binding (`<name>Ref`) can collide
  // with a top-level `<script>` binding of that exact suffixed name (`ref="box"`
  // + a top-level `const boxRef` both mint a `boxRef` binding; the downstream
  // `$local` rename of the colliding user const can't reach a read of it inside
  // an `ir.lifecycle` body, so the read silently re-binds to the ref instead).
  // Runs AFTER the generated-name pass above (so the taken set reflects any
  // already-renamed `<data>`/`$computed`/`$refs` name) and BEFORE any per-target
  // rewrite (`rewriteScript`/`rewriteTemplateExpression`/`emitTemplateAttribute`)
  // reads a ref name. `collectSolidTopLevelBindingNames` reads the ORIGINAL
  // (not-yet-cloned) script Program — per-target clone/rewrite happens later,
  // inside `rewriteScript`. Only-on-collision: the non-colliding corpus (the
  // entire existing example set) stays byte-identical.
  deconflictSolidRefSuffix(
    ir,
    collectSolidTopLevelBindingNames(ir.setupBody.scriptProgram),
  );

  // 1. Resolve registry + blockOffsets.
  const registry = opts.modifierRegistry ?? createDefaultRegistry();
  let resolvedBlockOffsets: BlockMap;
  if (opts.blockOffsets !== undefined) {
    resolvedBlockOffsets = opts.blockOffsets;
  } else if (opts.source !== undefined) {
    resolvedBlockOffsets = splitBlocks(opts.source, opts.filename ?? '');
  } else {
    resolvedBlockOffsets = {} as BlockMap;
  }

  // Compute the per-component scope hash up front so emitStyle's selector
  // rewriter and emitTemplate's host-element attribute injector use the same
  // token. Derived from the filename when present (stable across re-emit and
  // disambiguates same-name components in different paths); falls back to
  // the IR's component name otherwise.
  const scopeHash = computeScopeHash(ir.name, opts.filename);
  const scopeAttr = scopeAttrName(scopeHash);

  // 2. Collectors.
  const solidImports = new SolidImportCollector();
  const runtimeImports = new RuntimeSolidImportCollector();
  solidImports.add('splitProps'); // D-141 universal

  // 3. Determine default-slot presence (D-131).
  const hasDefaultSlot = (ir.slots ?? []).some((s) => s.name === '');
  // Phase 36 ($provide) — a Provider-wrapped component with a default slot emits
  // a plain lazy thunk (`const resolved = () => local.children`) instead of the
  // `children(() => …)` memo, so the children instantiate within the
  // `<C.Provider>` owner and a deep consumer's `useContext` resolves (see
  // shell.ts). In that case the `children` helper is never called, so it must
  // NOT be imported — an unused `children` import would trip TS6133 under the
  // strict leaf typecheck. The provide-side is detected from the IR's
  // `provides` field (the same `[]`-when-empty gate the emitters branch on).
  const hasProvides = (ir.provides ?? []).length > 0;
  if (hasDefaultSlot && !hasProvides) solidImports.add('children');

  // 4. Compose component-imports block from ir.components.
  let componentImportsBlock: string | undefined;
  const components = ir.components ?? [];
  // Phase 66 (D-2 Handle-INTERFACE route, SC-1): the set of composed-component
  // LOCAL names that are the target of a `$refs.X`. For those — and ONLY those —
  // the import brings the child's already-exported `type <Name>Handle` so the
  // parent's `let XRef: <Name>Handle | null` (emitScript.ts) resolves. A composed
  // component that is NOT ref'd keeps its default-only import byte-identical.
  const refdComponentNames = new Set(resolveComponentRefs(ir).values());
  const componentImportLines: string[] = components
    .filter((decl) => {
      // Filter self-references: Solid's named function declaration handles self-ref natively.
      const localName = 'localName' in decl
        ? (decl as { localName: string }).localName
        : (decl as { name: string }).name;
      return localName !== ir.name;
    })
    .map((decl) => {
      const localName = 'localName' in decl
        ? (decl as { localName: string }).localName
        : (decl as { name: string }).name;
      const importPath = 'importPath' in decl
        ? (decl as { importPath: string }).importPath
        : '';
      const rewritten = rewriteRozieImport(importPath, 'solid');
      if (refdComponentNames.has(localName)) {
        return `import ${localName}, { type ${localName}Handle } from '${rewritten}';`;
      }
      return `import ${localName} from '${rewritten}';`;
    });
  if (componentImportLines.length > 0) {
    componentImportsBlock = componentImportLines.join('\n') + '\n';
  }

  // Phase 21 ($expose, REQ-8 / REQ-10, D-05) — branch STRICTLY on
  // ir.expose.length. When empty, NONE of the three parts (splitProps 'ref'
  // push, the exported <Name>Handle interface + ref?: prop field, the onMount
  // invoke) are emitted and the Solid output stays byte-identical (D-05).
  const exposeMethods = ir.expose ?? [];
  const hasExpose = exposeMethods.length > 0;
  let handleInterface: string | undefined;
  let exposeRefField: string | undefined;
  let exposeOnMount: string | undefined;
  if (hasExpose) {
    const handleName = `${ir.name}Handle`;
    // synthesizeHandleType returns the bare `interface <Name>Handle {...}` (or
    // null); prepend `export ` so the named handle type is importable from the
    // emitted `.tsx` (leaf barrels re-export it). The `.d.ts` sidecar prepends
    // its own export, so this only affects the `.tsx` surface — no double-export.
    const synthesized = synthesizeHandleType(ir, handleName);
    handleInterface = synthesized != null ? `export ${synthesized}` : undefined;
    exposeRefField = `ref?: (h: ${handleName}) => void;`;
    const names = exposeMethods.map((e) => e.name).join(', ');
    // local.ref is the splitProps-renamed `ref` prop (pushed into propKeys
    // below) — equivalent to D-05's `_props.ref?.(handle)` after the rename.
    exposeOnMount = `onMount(() => { local.ref?.({ ${names} }); });`;
    solidImports.add('onMount');
  }

  // 5. Per-segment emit.
  const slotResult = emitSlotDecl(ir);
  const propsInterface = emitPropsInterface(ir, slotResult.fields, exposeRefField);
  // Spike 004 — reuse the per-component `scopeHash` (already computed above)
  // for the `@portal` CSS scope so the portal closure's setAttribute value
  // matches the emitted `@portal` CSS selectors.
  const scriptResult = emitScript(
    ir,
    { solidImports, runtimeImports, filename: opts.filename, portalScopeHash: scopeHash },
    registry,
  );
  // Thread scopeAttr through so every HTML host element gets the matching
  // attribute. Component tags (tagKind 'component'/'self') skip the attribute —
  // their own bundles carry their own scope.
  const templateResult = emitTemplate(
    ir,
    { solid: solidImports, runtime: runtimeImports },
    registry,
    { scopeAttr },
  );
  const listenersResult = emitListeners(ir, { solid: solidImports, runtime: runtimeImports }, registry);
  const styleResult = emitStyle(
    ir.name,
    ir.styles ?? { scopedRules: [], rootRules: [] },
    opts.source ?? '',
    scopeHash,
  );
  // Item-1-residual: register the `__rozieInjectStyle` runtime import when
  // this component has any styles. The shell splices the side-effect
  // statement at module top (after imports, before the component function).
  if (styleResult.needsInjectHelper) {
    runtimeImports.add('__rozieInjectStyle');
  }

  // 6. splitPropsCall — D-141 universal.
  // D-131: when a default slot is present, 'children' must also be split so
  // `local.children` is valid inside the `children(() => local.children)` call.
  const propKeys = (ir.props ?? []).map((p) => `'${p.name}'`);
  if (hasDefaultSlot && !propKeys.includes("'children'")) {
    propKeys.push("'children'");
  }
  // Phase 21 ($expose, D-05, Pitfall 2) — when exposed, route the callback
  // `ref` prop through splitProps locals so it is NEVER spread onto the DOM
  // (Phase-14 `$attrs` fallthrough spreads the `attrs` rest bucket to the root
  // element). Mirrors the conditional `'children'` push above.
  if (hasExpose && !propKeys.includes("'ref'")) {
    propKeys.push("'ref'");
  }
  const propNames = propKeys.join(', ');
  // When non-model defaults exist, emitScript emits `const _merged = mergeProps({...}, _props)`.
  // splitProps must use `_merged` so `local.*` gets the declared defaults.
  const propsTarget = scriptResult.mergePropsCall ? '_merged' : '_props';
  // Plan 14-05 — rename the splitProps rest binding from `rest` to `attrs`
  // so the Solid `$attrs` rewrite in rewriteTemplateExpression (which lowers
  // bare `$attrs` Identifier to `attrs`) resolves to the synthesised rest
  // bucket. Cross-framework `$attrs` parity (Vue native, Svelte __rozieAttrs,
  // React/Solid `attrs`, Angular/Lit bespoke).
  const splitPropsCall = `const [local, attrs] = splitProps(${propsTarget}, [${propNames}]);\n`;

  // Phase 15 D-19 — Solid rewrites `$listeners` directly to bare `attrs` at
  // template-expression rewrite time (see rewriteTemplateExpression.ts —
  // mirror of the `$attrs` rewrite). No separate `const $listeners = attrs`
  // declaration is needed; the rewrite handles every JSX reference inline.
  // The earlier separate-decl approach tripped eslint-plugin-solid's
  // `solid/reactivity` rule (reactive `attrs` read outside JSX).
  const listenersDecl = '';

  // 7. Compose shell.
  // Merge script injections: template-event wraps + listener wraps go after user arrows.
  const script = [
    scriptResult.hookSection,
    scriptResult.userArrowsSection,
    ...templateResult.scriptInjections,
    ...listenersResult.scriptInjections,
  ]
    .filter((s) => s.trim().length > 0)
    .join('\n\n');

  // `JSX.Element` is always used in the function signature; the JSX namespace
  // must be explicitly imported as a type-only import from solid-js.
  const jsxTypeImport = `import type { JSX } from 'solid-js';\n`;
  // Prepend JSX type import before the value imports (or stand alone if none).
  const solidImportsStr = jsxTypeImport + solidImports.render();

  // Portal-slot primitive (Spike 003) — when the script emit synthesized a
  // portals closure, add the matching solid-js/web import for `render`.
  //
  // command-palette-portal-overlay phase — a SIBLING, independent import:
  // when the template emitted at least one `r-portal` element teleport
  // (`templateResult.hasElementPortal`, `emitPortalWrap` in
  // emitTemplateNode.ts), add `import { Portal } from 'solid-js/web';`. This
  // is the NATIVE element-subtree teleport construct — orthogonal to (and may
  // coexist with) the P33 render-into-container slot machinery above.
  const portalImport =
    (scriptResult.hasPortals ? "import { render } from 'solid-js/web';\n" : '') +
    (templateResult.hasElementPortal ? "import { Portal } from 'solid-js/web';\n" : '');

  // Quick task 260704-mf3 — inject `Key` from @solid-primitives/keyed ONLY when
  // the template emitted a keyed `r-for` as `<Key>` (byte-identical import lines
  // otherwise). `Key` is not a solid-js export, so it rides its own shell part
  // rather than the SolidImportCollector — mirrors `portalImport`.
  const keyedImport = templateResult.needsKeyedImport
    ? "import { Key } from '@solid-primitives/keyed';\n"
    : '';

  const shellParts = {
    componentName: ir.name,
    propsInterface,
    solidImports: solidImportsStr,
    portalImport,
    keyedImport,
    runtimeImports: runtimeImports.render(),
    userImports: scriptResult.userImports,
    hoistedTypeDecls: scriptResult.hoistedTypeDecls,
    componentImportsBlock,
    ctxInterfaces: slotResult.ctxInterfaces,
    mergePropsCall: scriptResult.mergePropsCall ?? undefined,
    splitPropsCall,
    listenersDecl,
    hasDefaultSlot,
    handleInterface,
    exposeOnMount,
    script,
    hookSectionLines: scriptResult.hookSectionLines,
    listenerEffects: listenersResult.code,
    styleInjectStatement: styleResult.injectStatement,
    jsx: templateResult.jsx,
    providerOpen: scriptResult.providerOpen,
    providerClose: scriptResult.providerClose,
    rozieSource: opts.source ?? '',
    blockOffsets: resolvedBlockOffsets,
    scriptMap: scriptResult.scriptMap,
  };

  const shell = buildShell(shellParts);

  // 8. Compose source map.
  const finalMap =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(shell.ms, {
          filename: opts.filename,
          source: opts.source,
          scriptMap: shell.scriptMap,
          scriptOutputOffset: shell.scriptOutputOffset,
          userCodeLineOffset: shell.userCodeLineOffset,
          // Phase 55 Plan 03 (SC-2): spliced `.rzts` line-restore table.
          partialLineOffsets: buildPartialLineOffsets(ir.setupBody.scriptProgram),
        })
      : null;

  // 9. Aggregate diagnostics.
  const diagnostics: Diagnostic[] = [
    ...scriptResult.diagnostics,
    ...templateResult.diagnostics,
    ...listenersResult.diagnostics,
    ...slotResult.diagnostics,
    ...styleResult.diagnostics,
  ];

  return { code: shell.ms.toString(), map: finalMap, diagnostics };
}

