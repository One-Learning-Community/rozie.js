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
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
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

export interface EmitAngularOptions {
  filename?: string | undefined;
  source?: string | undefined;
  modifierRegistry?: ModifierRegistry | undefined;
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
  const previewRewrite = rewriteRozieIdentifiers(previewClone, ir);
  const collisionRenames = previewRewrite.collisionRenames;
  const classMembers = previewRewrite.classMembers;
  const signalMembers = previewRewrite.signalMembers;

  // 1. Script-side emission.
  const scriptResult = emitScript(ir);

  // 2. Template-side emission.
  const tmplResult = emitTemplate(ir, registry, { collisionRenames });

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

  // 6. Build the @Component decorator.
  const decorator = emitDecorator(ir, {
    componentName: ir.name,
    template: tmplResult.template,
    stylesArrayBody: styleResult.stylesArrayBody,
    hasSlots: ir.slots.length > 0,
    hasNgModel: tmplResult.hasNgModel,
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

    if (/constructor\(\) \{/.test(classBody)) {
      // Insert renderer + listener blocks right BEFORE the existing
      // constructor body's content. Match the constructor opening, then
      // splice content right after.
      classBody = classBody.replace(
        /constructor\(\) \{\n/,
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
  const ms = buildShell({
    importLines: imports.render(),
    interfaceDecls: scriptResult.interfaceDecls,
    decorator,
    componentName: ir.name,
    classBody,
  });

  const code = ms.toString();

  // 9. Source map composition.
  const map =
    opts.filename !== undefined && opts.source !== undefined
      ? composeSourceMap(ms, { filename: opts.filename, source: opts.source })
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
