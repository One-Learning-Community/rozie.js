/**
 * emitAngular — Phase 5 Plan 05-04a Task 3.
 *
 * Top-level Angular 17+ standalone-component emitter. Mirrors emitVue/emitReact's
 * coordinator orchestration but emits a CLASS body (not function body):
 *
 *   1. emitScript          → { classBody, imports, interfaceDecls }
 *   2. emitTemplate        → { template, scriptInjections, hasNgModel, diagnostics }
 *   3. emitListeners       → { constructorBody, fieldInitializers, needsRenderer }
 *   4. emitStyle           → { stylesArrayBody, diagnostics }
 *   5. registerDecoratorImports — adds NgTemplateOutlet/FormsModule to import set
 *      based on observed template features (Pitfall 10).
 *   6. emitDecorator       → @Component({...}) text
 *   7. Splice template + listener scriptInjections into class body
 *   8. buildShell composes the .ts file via magic-string
 *   9. composeSourceMap produces a real SourceMap referencing the .rozie source.
 *
 * Per RESEARCH OQ A8/A9 RESOLVED: NO `@rozie/runtime-angular` imports —
 * debounce/throttle/outsideClick all inline.
 *
 * Per RESEARCH Pitfall 8: all `inject(Renderer2)` / `inject(DestroyRef)` calls
 * are constructor-body or field initializers — never inside arrow methods.
 *
 * Per CONTEXT D-67: `emitAngular(ir, opts) → { code, map, diagnostics }`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, TemplateNode } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '@rozie/core';
import type { BlockMap } from '../../../core/src/ast/types.js';
import { splitBlocks } from '../../../core/src/splitter/splitBlocks.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { rewriteRozieImport } from '../../../core/src/codegen/rewriteRozieImport.js';

/**
 * Phase 06.2 P2 — recursive walk over the IR template detecting any
 * `tagKind: 'self'` element. Mirror of emitVue/emitSvelte helpers; O(n)
 * over the IR tree per threat T-06.2-P2-04 mitigation.
 */
function templateContainsSelfReference(node: TemplateNode | null): boolean {
  if (!node) return false;
  switch (node.type) {
    case 'TemplateElement': {
      if (node.tagKind === 'self') return true;
      for (const child of node.children) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateConditional': {
      for (const branch of node.branches) {
        for (const child of branch.body) {
          if (templateContainsSelfReference(child)) return true;
        }
      }
      return false;
    }
    case 'TemplateLoop': {
      for (const child of node.body) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateSlotInvocation': {
      for (const child of node.fallback) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    case 'TemplateFragment': {
      for (const child of node.children) {
        if (templateContainsSelfReference(child)) return true;
      }
      return false;
    }
    default:
      return false;
  }
}
import * as t from '@babel/types';
import type { File } from '@babel/types';
import type { SourceMap } from 'magic-string';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitStyle } from './emit/emitStyle.js';
import { emitDecorator, registerDecoratorImports } from './emit/emitDecorator.js';
import { buildShell } from './emit/shell.js';
import { composeSourceMap } from './sourcemap/compose.js';
import { cloneScriptProgram } from './rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from './rewrite/rewriteScript.js';

/**
 * Bug 5: build a handler-name → parameter-count map from the (un-rewritten)
 * cloned script Program. Maps each top-level `const x = (a, b) => {}` arrow,
 * `const x = function (a) {}` function-expression, and `function x(a) {}`
 * declaration to its `params.length`. Used by emitTemplateEvent's guarded
 * wrapper synthesis to decide whether to pass the event arg to the inner
 * handler (`this.x(e)`) or call it bare (`this.x()`).
 */
function buildHandlerArityMap(program: File): Map<string, number> {
  const arity = new Map<string, number>();
  for (const stmt of program.program.body) {
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (!t.isIdentifier(d.id) || !d.init) continue;
        if (
          t.isArrowFunctionExpression(d.init) ||
          t.isFunctionExpression(d.init)
        ) {
          arity.set(d.id.name, d.init.params.length);
        }
      }
      continue;
    }
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      arity.set(stmt.id.name, stmt.params.length);
    }
  }
  return arity;
}

export interface EmitAngularOptions {
  filename?: string | undefined;
  source?: string | undefined;
  modifierRegistry?: ModifierRegistry | undefined;
  /**
   * Phase 06.1 Plan 01 (DX-04): block byte offsets from splitBlocks() —
   * required by buildShell() for accurate source maps. When omitted,
   * derived from `opts.source` via splitBlocks() if available.
   */
  blockOffsets?: BlockMap | undefined;
}

export interface EmitAngularResult {
  code: string;
  map: SourceMap | null;
  diagnostics: Diagnostic[];
}

export function emitAngular(
  ir: IRComponent,
  opts: EmitAngularOptions = {},
): EmitAngularResult {
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  // Pre-compute collisionRenames + classMembers + signalMembers by running a
  // "preview" rewrite — we need them for emitTemplate / emitListeners but
  // emitScript runs the real rewrite internally. The cheapest thing to do is
  // re-run rewrite on a clone here.
  const previewClone = cloneScriptProgram(ir.setupBody.scriptProgram);
  // Bug 5: compute the handler-arity map from the un-rewritten clone BEFORE
  // rewriteRozieIdentifiers mutates it (the rewrite doesn't touch param lists,
  // but compute up-front for clarity + to key by original handler names).
  const handlerArity = buildHandlerArityMap(previewClone);
  const previewRewrite = rewriteRozieIdentifiers(previewClone, ir);
  const collisionRenames = previewRewrite.collisionRenames;
  const classMembers = previewRewrite.classMembers;
  const signalMembers = previewRewrite.signalMembers;

  // 1. Script-side emission.
  // Phase 06.1 P2: thread filename for sourceFileName + capture scriptMap.
  const scriptOpts: { filename?: string } = {};
  if (opts.filename !== undefined) scriptOpts.filename = opts.filename;
  const scriptResult = emitScript(ir, scriptOpts);

  // 2. Template-side emission.
  const tmplResult = emitTemplate(ir, registry, {
    collisionRenames,
    handlerArity,
  });

  // 3. Listeners-block emission.
  const listenersResult = emitListeners(
    ir.listeners,
    ir,
    registry,
    collisionRenames,
    classMembers,
    signalMembers,
  );

  // 4. Style emission.
  const styleResult = opts.source !== undefined
    ? emitStyle(ir.styles, opts.source)
    : { stylesArrayBody: '', diagnostics: [] as Diagnostic[] };

  // 5. Register conditional imports based on template features.
  const imports = scriptResult.imports;
  registerDecoratorImports(imports, {
    hasSlots: ir.slots.length > 0,
    hasNgModel: tmplResult.hasNgModel,
  });

  // Phase 06.2 P2 (Pitfall 5): when a template contains `tagKind: 'self'`,
  // ensure `forwardRef` is in the @angular/core import line BEFORE the
  // decorator + shell render. Defensive `?? []` guards pre-P1 hand-rolled IRs.
  const components = ir.components ?? [];
  const selfReferenced = templateContainsSelfReference(ir.template);
  if (selfReferenced) {
    imports.add('forwardRef');
  }

  // Phase 07.2 Plan 04 (R5 dynamic-name): when the consumer's template emits
  // at least one dynamic-name slot filler (`<template #[expr]>`), the
  // dispatcher needs `ViewChild` + `TemplateRef` from @angular/core and
  // `NgTemplateOutlet` from @angular/common (the decorator emitter already
  // adds NgTemplateOutlet when hasSlots is true — for the consumer-side
  // case we add it explicitly here since the IR.slots list is empty on a
  // pure consumer with no producer-side slots of its own).
  if (tmplResult.hasDynamicSlotFiller) {
    imports.add('ViewChild');
    imports.add('TemplateRef');
    imports.addCommon('NgTemplateOutlet');
  }

  // 6. Build the @Component decorator.
  const decorator = emitDecorator(ir, {
    componentName: ir.name,
    template: tmplResult.template,
    stylesArrayBody: styleResult.stylesArrayBody,
    hasSlots: ir.slots.length > 0,
    hasNgModel: tmplResult.hasNgModel,
    hasDynamicSlotFiller: tmplResult.hasDynamicSlotFiller,
    componentDecls: components,
    selfReferenced,
  });

  // 7. Compose the class body. Insertion order:
  //    - existing classBody from emitScript (fields + constructor + computed + methods + guard)
  //    - listener field initializers (debounce/throttle wraps) — appended to fields
  //    - listener effect blocks — spliced into constructor body
  //    - template scriptInjections (debounce/throttle template-event wraps,
  //      guarded handler wrappers) — appended to fields
  //
  // Strategy: rather than re-parse the classBody string, we splice fragments
  // into well-known anchor positions. The classBody from emitScript has the
  // shape:
  //
  //   <field declarations>
  //
  //   constructor() {
  //     <existing constructor body>
  //   }
  //
  //   <computed properties>
  //
  //   <user methods>
  //
  //   [optional ngTemplateContextGuard]
  //
  // To inject listener effect blocks into the constructor body and add
  // listener/template field initializers, we splice both fragments into the
  // classBody string.
  let classBody = scriptResult.classBody;

  // Inject `const renderer = inject(Renderer2);` at the top of constructor
  // body when listener effect blocks are present. The fragment is spliced
  // right after `constructor() {\n` and before the existing body.
  const allFieldInjections: string[] = [
    ...listenersResult.fieldInitializers.map((fi) => fi.decl),
    ...tmplResult.scriptInjections.map((si) => si.decl),
  ];

  // Find the constructor block and splice the listener effects + renderer
  // setup INTO it. If no constructor exists yet (no script body, no
  // lifecycle, no listeners), synthesize one.
  if (listenersResult.constructorBody.length > 0) {
    const rendererSetup = `    const renderer = inject(Renderer2);`;
    const listenerBlock = `    ${listenersResult.constructorBody}`;

    if (/constructor\s*\(\s*\)\s*\{/.test(classBody)) {
      // Insert renderer + listener blocks right BEFORE the existing
      // constructor body's content. Match the constructor opening, then
      // splice content right after. Use a whitespace-flexible regex so a
      // future @babel/generator formatting change (extra space, compact flag,
      // etc.) does not silently drop the constructor injection. Closes WR-05.
      classBody = classBody.replace(
        /constructor\s*\(\s*\)\s*\{\n/,
        `constructor() {\n${rendererSetup}\n\n${listenerBlock}\n\n`,
      );
    } else {
      // No constructor — synthesize one.
      const synthesized = [
        `constructor() {`,
        rendererSetup,
        ``,
        listenerBlock,
        `}`,
      ].join('\n');
      // Append after field declarations (before any computed/method/guard sections).
      // Heuristic: append at end of fields section. Simplest — prepend before
      // first non-field block (computed/method/guard). For v1, prepend after
      // the first non-field newline. As a robust fallback, prepend the
      // synthesized constructor at the start of classBody.
      classBody = synthesized + '\n\n' + classBody;
    }
  }

  // Append additional field initializers (debounce/throttle wrappers from
  // listeners + template events, guarded handler methods). Place AFTER user
  // methods so they can reference them in arrow bodies if needed.
  if (allFieldInjections.length > 0) {
    classBody = classBody + '\n\n' + allFieldInjections.join('\n\n');
  }

  // 8. Build the .ts shell.
  // Phase 06.1 Plan 01 (DX-04) — anchor MagicString at .rozie source bytes via
  // overwrite() over the <rozie> envelope's byte range. blockOffsets resolution:
  //   1. opts.blockOffsets (caller threaded splitBlocks result through)
  //   2. derive from opts.source via splitBlocks()
  //   3. degenerate empty BlockMap (legacy fallback path).
  let resolvedBlockOffsets: BlockMap;
  if (opts.blockOffsets !== undefined) {
    resolvedBlockOffsets = opts.blockOffsets;
  } else if (opts.source !== undefined) {
    resolvedBlockOffsets = splitBlocks(opts.source, opts.filename);
  } else {
    resolvedBlockOffsets = {};
  }

  // Phase 06.2 P2 (D-118): synthesize NAMED top-of-file component imports
  // (skipping self-entry — the class is in scope of its own decorator and
  // referenced via forwardRef(() => Self) in @Component({ imports: [...] })).
  const componentImportsLines: string[] = components
    .filter((decl) => decl.localName !== ir.name)
    .map((decl) => {
      const rewritten = rewriteRozieImport(decl.importPath, 'angular');
      return `import { ${decl.localName} } from '${rewritten}';`;
    });
  const componentImportsBlock =
    componentImportsLines.length > 0
      ? componentImportsLines.join('\n') + '\n'
      : '';

  const { ms, scriptOutputOffset, scriptMap: shellScriptMap, userCodeLineOffset } = buildShell({
    importLines: imports.render(),
    interfaceDecls: scriptResult.interfaceDecls,
    decorator,
    componentName: ir.name,
    classBody,
    rozieSource: opts.source ?? '',
    blockOffsets: resolvedBlockOffsets,
    scriptMap: scriptResult.scriptMap,
    preambleSectionLines: scriptResult.preambleSectionLines,
    componentImportsBlock,
  });

  const code = ms.toString();

  // 9. Phase 06.1 P2 (D-109): composeSourceMap chains shell map + scriptMap
  // via composeMaps(). Pass userCodeLineOffset so the semicolon-prefix VLQ
  // shift aligns script map generated lines with actual .ts output lines.
  const map =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(ms, {
          filename: opts.filename,
          source: opts.source,
          scriptMap: shellScriptMap,
          scriptOutputOffset,
          userCodeLineOffset,
        })
      : null;

  return {
    code,
    map,
    diagnostics: [
      ...scriptResult.diagnostics,
      ...tmplResult.diagnostics,
      ...listenersResult.diagnostics,
      ...styleResult.diagnostics,
    ],
  };
}
