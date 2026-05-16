/**
 * @rozie/target-lit — top-level emitter orchestrator.
 *
 * Plan 06.4-02 (P2) replaces the P1 stub with a working Lit class emitter:
 *
 *   1. Build collectors (lit / lit-decorators / preact-signals / runtime-lit).
 *   2. emitStyle  → static-styles field + optional injectGlobalStyles call.
 *   3. emitSlotDecl → slot-presence @state + @queryAssignedElements per slot.
 *   4. emitScript → @property fields + signal fields for $data + lifecycle methods.
 *   5. emitListeners → firstUpdated() body wiring (addEventListener + outside + debounce/throttle).
 *   6. emitTemplate → render() body emitting html`` with Lit sigils.
 *   7. buildShell composes imports + decorator + class + injectGlobalStyles call
 *      + customElements.define registration.
 *
 * IMPORTANT INVARIANTS (Plan 06.4-02):
 *   - Uses @queryAssignedElements; the legacy Nodes variant is intentionally
 *     excluded per D-LIT-14 (2026-05-13 correction).
 *   - Locked invariant: lit-html's auto-escape is the only escaping surface
 *     for emitted html``; emitter NEVER imports the unsafe escape-bypass
 *     directive (T-06.4-03 mitigation; enforced by emitLit-shape.test.ts).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry } from '@rozie/core';
import type { BlockMap } from '../../../core/src/ast/types.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
// NOTE: SourceMap import removed (WR-08); EmitLitResult.map is null until Phase 7.
import {
  LitImportCollector,
  LitDecoratorImportCollector,
  PreactSignalsImportCollector,
  RuntimeLitImportCollector,
} from './rewrite/collectLitImports.js';
import { emitScript } from './emit/emitScript.js';
import { emitTemplate } from './emit/emitTemplate.js';
import { emitListeners } from './emit/emitListeners.js';
import { emitSlotDecl } from './emit/emitSlotDecl.js';
import { emitStyle } from './emit/emitStyle.js';
import { buildShell } from './emit/shell.js';
import { emitTagName } from './emit/emitDecorator.js';

export interface EmitLitOptions {
  filename?: string;
  source?: string;
  modifierRegistry?: ModifierRegistry;
  /**
   * Phase 06.1 Plan 01 (DX-04): block byte offsets from splitBlocks() —
   * required by buildShell() for accurate source maps. When omitted,
   * derived from `opts.source` via splitBlocks() if available.
   */
  blockOffsets?: BlockMap;
}

export interface EmitLitResult {
  code: string;
  /**
   * WR-08: Source map is always null in v1. `composeSourceMap` in
   * `packages/targets/lit/src/sourcemap/compose.ts` is implemented but not
   * wired — it is dead code until Phase 7 connects it here.
   * TODO(Phase 7): wire composeSourceMap here and emit base64 sourceMappingURL
   * trailer (matching the Angular path in emitRozieTsToDisk).
   */
  map: null;
  diagnostics: Diagnostic[];
}

export function emitLit(ir: IRComponent, opts: EmitLitOptions = {}): EmitLitResult {
  const litImports = new LitImportCollector();
  const decoratorImports = new LitDecoratorImportCollector();
  const signalsImports = new PreactSignalsImportCollector();
  const runtimeImports = new RuntimeLitImportCollector();

  // Every Lit class extends SignalWatcher(LitElement); always needs these.
  litImports.add('LitElement');
  litImports.add('html');
  signalsImports.add('SignalWatcher');
  decoratorImports.add('customElement');

  const diagnostics: Diagnostic[] = [];

  // Modifier registry — caller may pass a shared registry (tests / unplugin
  // layer); otherwise construct a fresh default registry per call. Mirrors
  // emitVue's pattern. emitListeners requires a non-optional registry for
  // its Plan 07.1-02 registry-driven modifier dispatch.
  const registry = opts.modifierRegistry ?? createDefaultRegistry();

  // 1. Slot declarations — must come early because emitTemplate may reference slot fields.
  const slotResult = emitSlotDecl(ir, { decorators: decoratorImports });
  diagnostics.push(...slotResult.diagnostics);

  // 2. Style emission.
  const styleResult = emitStyle(ir.styles, opts.source ?? '', {
    componentName: ir.name,
    lit: litImports,
    runtime: runtimeImports,
  });
  diagnostics.push(...styleResult.diagnostics);

  // 3. Script emission (props, state, refs, computed, lifecycle, user methods).
  const scriptResult = emitScript(ir, {
    decorators: decoratorImports,
    signals: signalsImports,
    runtime: runtimeImports,
    lit: litImports,
  });
  diagnostics.push(...scriptResult.diagnostics);

  // 4. Listeners emission (returns firstUpdated body + cleanup pushes).
  const listenersResult = emitListeners(ir, {
    decorators: decoratorImports,
    runtime: runtimeImports,
    lit: litImports,
  }, registry);
  diagnostics.push(...listenersResult.diagnostics);

  // 5. Template emission (returns html`...` body + hostListenerWiring lines).
  //    Thread the shared modifier registry so buildEventParts can
  //    registry-dispatch template-event modifiers (Plan 07.1-03).
  const templateResult = emitTemplate(ir, {
    lit: litImports,
    decorators: decoratorImports,
    runtime: runtimeImports,
    modifierRegistry: registry,
  });
  diagnostics.push(...templateResult.diagnostics);

  // 6. Compose class body.
  // Insertion order:
  //   - static styles field
  //   - @property/@state fields + signal fields
  //   - @query / @queryAssignedElements fields
  //   - private _disconnectCleanups: Array<() => void> = [];
  //   - constructor(): forwards to super (Lit handles attribute reflection).
  //   - firstUpdated(): listeners + outside + slotchange wiring + host listeners
  //   - disconnectedCallback(): drains _disconnectCleanups, runs $onUnmount hooks
  //   - updated(): runs $onUpdate hooks
  //   - render(): returns html``
  //   - user methods (rewritten from <script>)
  //   - attributeChangedCallback (for model props)
  // D-SH-02: separate the re-armable listener wiring (addEventListener,
  // outside-click, slotchange, host listeners — all push to
  // _disconnectCleanups, all drained on disconnect) from the user `$onMount`
  // hook body (mount-once semantics — must NOT re-run on reconnect). The
  // listener wiring goes into `_armListeners()`, called from `firstUpdated()`
  // the first time AND from `connectedCallback()` on every subsequent connect;
  // the `$onMount` body stays first-render-only in `firstUpdated()`.
  const listenerWiring = combineListenerWiring(
    listenersResult.firstUpdatedBody,
    templateResult.hostListenerWiring,
    slotResult.slotChangeWiring,
  );
  const classBody = composeClassBody({
    staticStylesField: styleResult.staticStylesField,
    fieldDecls: scriptResult.fieldDecls,
    debouncedFieldDecls: templateResult.debouncedFieldDecls.join('\n'),
    slotFillerClassFields: templateResult.slotFillerClassFields
      .map((f) => '  ' + f)
      .join('\n'),
    slotFields: slotResult.fields,
    cleanupField: '  private _disconnectCleanups: Array<() => void> = [];',
    listenerWiringBody: listenerWiring,
    mountHookBody: scriptResult.mountHookBody,
    disconnectedBody: scriptResult.unmountHookBody,
    updatedBody: scriptResult.updateHookBody,
    renderBody: templateResult.renderBody,
    userMethods: scriptResult.methodDecls,
    attributeChangedBody: scriptResult.attributeChangedBody,
  });

  // 7. Component side-effect imports for cross-component composition (D-LIT).
  // Filter out self-references — class self-registers via @customElement decorator.
  const components = ir.components ?? [];
  const componentImportsBlock = buildComponentImportsBlock(components, ir.name);

  // 8. Build shell.
  const allImports = [
    litImports.render(),
    decoratorImports.render(),
    signalsImports.render(),
    runtimeImports.render(),
    // CR-06 fix: read repeatUsed from templateResult instead of module-level singleton.
    templateResult.repeatUsed ? `import { repeat } from 'lit/directives/repeat.js';\n` : '',
  ].filter((s) => s.length > 0).join('');

  const shell = buildShell({
    importLines: allImports,
    componentImportsBlock,
    interfaceDecls: slotResult.ctxInterfaces,
    customElementDecorator: `@customElement('${emitTagName(ir.name)}')`,
    componentName: ir.name,
    baseClassExpression: 'SignalWatcher(LitElement)',
    classBody,
    globalStyleIife: styleResult.globalStyleCall,
    rozieSource: opts.source ?? '',
    blockOffsets: opts.blockOffsets ?? {},
  });

  return {
    code: shell.ms.toString(),
    map: null,
    diagnostics,
  };
}

/**
 * D-SH-02: combine the re-armable listener wiring (listeners, host listeners,
 * slotchange) — but NOT the `$onMount` hook body, which has mount-once
 * semantics and must stay first-render-only. The combined body is emitted into
 * a private `_armListeners()` method that both `firstUpdated()` and
 * `connectedCallback()` (on reconnect) call.
 */
function combineListenerWiring(
  listenerWiring: string,
  hostListenerWiring: string[],
  slotChangeWiring: string,
): string {
  const parts: string[] = [];
  if (listenerWiring.trim().length > 0) parts.push(listenerWiring);
  for (const wiring of hostListenerWiring) {
    if (wiring.trim().length > 0) parts.push(wiring);
  }
  if (slotChangeWiring.trim().length > 0) parts.push(slotChangeWiring);
  return parts.join('\n\n');
}

interface ComposeClassBodyParts {
  staticStylesField: string;
  fieldDecls: string;
  /**
   * Class-field declarations for template-event `.debounce`/`.throttle`
   * wrappers (WR-15). Emitted alongside the other field decls so the wrapper
   * identity is stable across render() calls.
   */
  debouncedFieldDecls: string;
  /**
   * Phase 07.2 Plan 03 — class-field declarations storing captured scoped-
   * slot fill ctx (e.g. `private _headerCtx?: { close: unknown };`). Spliced
   * in alongside the other field decls so firstUpdated()'s
   * observeRozieSlotCtx callback can assign into them.
   */
  slotFillerClassFields: string;
  slotFields: string;
  cleanupField: string;
  /**
   * D-SH-02: re-armable listener wiring (listeners + host listeners +
   * slotchange). Emitted into `_armListeners()`, called from `firstUpdated()`
   * and from `connectedCallback()` on reconnect.
   */
  listenerWiringBody: string;
  /** User `$onMount` hook body — mount-once, stays in `firstUpdated()`. */
  mountHookBody: string;
  disconnectedBody: string;
  updatedBody: string;
  renderBody: string;
  userMethods: string;
  attributeChangedBody: string;
}

function composeClassBody(parts: ComposeClassBodyParts): string {
  const sections: string[] = [];

  if (parts.staticStylesField.trim().length > 0) {
    sections.push(parts.staticStylesField);
  }
  if (parts.fieldDecls.trim().length > 0) {
    sections.push(parts.fieldDecls);
  }
  if (parts.debouncedFieldDecls.trim().length > 0) {
    sections.push(parts.debouncedFieldDecls);
  }
  if (parts.slotFillerClassFields.trim().length > 0) {
    sections.push(parts.slotFillerClassFields);
  }
  if (parts.slotFields.trim().length > 0) {
    sections.push(parts.slotFields);
  }
  sections.push(parts.cleanupField);

  const hasListenerWiring = parts.listenerWiringBody.trim().length > 0;
  const hasMountHook = parts.mountHookBody.trim().length > 0;

  // D-SH-02: re-armable listener wiring lives in `_armListeners()`, called
  // from `firstUpdated()` (first render) AND `connectedCallback()` (reconnect).
  // `disconnectedCallback()` already drains `_disconnectCleanups`, so a
  // disconnect → reconnect cycle now correctly RE-ARMS every listener instead
  // of leaving the element with zero listeners.
  if (hasListenerWiring) {
    sections.push(
      [
        '  private _armListeners(): void {',
        indent(parts.listenerWiringBody, 4),
        '  }',
      ].join('\n'),
    );

    // connectedCallback re-arms on reconnect only — `this.hasUpdated` is false
    // on the very first connect (firstUpdated has not run yet), so the first
    // arming is owned exclusively by firstUpdated() and there is no double.
    sections.push(
      [
        '  connectedCallback(): void {',
        '    super.connectedCallback();',
        '    if (this.hasUpdated) this._armListeners();',
        '  }',
      ].join('\n'),
    );
  }

  // firstUpdated(): first-render listener arming + user $onMount hooks (the
  // latter mount-once — never re-run on reconnect).
  if (hasListenerWiring || hasMountHook) {
    const firstUpdatedParts: string[] = [];
    if (hasListenerWiring) firstUpdatedParts.push('this._armListeners();');
    if (hasMountHook) firstUpdatedParts.push(parts.mountHookBody);
    sections.push(
      [
        '  firstUpdated(): void {',
        indent(firstUpdatedParts.join('\n\n'), 4),
        '  }',
      ].join('\n'),
    );
  }

  if (parts.updatedBody.trim().length > 0) {
    sections.push(
      [
        '  updated(changedProperties: Map<string, unknown>): void {',
        indent(parts.updatedBody, 4),
        '  }',
      ].join('\n'),
    );
  }

  // Always emit disconnectedCallback to drain cleanup pushes; even if no
  // user $onUnmount hooks exist, listeners often push cleanups.
  const disconnectParts: string[] = [];
  disconnectParts.push('super.disconnectedCallback();');
  if (parts.disconnectedBody.trim().length > 0) {
    disconnectParts.push(parts.disconnectedBody);
  }
  disconnectParts.push('for (const fn of this._disconnectCleanups) fn();');
  disconnectParts.push('this._disconnectCleanups = [];');
  sections.push(
    [
      '  disconnectedCallback(): void {',
      indent(disconnectParts.join('\n'), 4),
      '  }',
    ].join('\n'),
  );

  if (parts.attributeChangedBody.trim().length > 0) {
    sections.push(
      [
        '  attributeChangedCallback(name: string, old: string | null, value: string | null): void {',
        '    super.attributeChangedCallback(name, old, value);',
        indent(parts.attributeChangedBody, 4),
        '  }',
      ].join('\n'),
    );
  }

  // render() always present.
  sections.push(
    [
      '  render() {',
      `    return html\`${parts.renderBody}\`;`,
      '  }',
    ].join('\n'),
  );

  if (parts.userMethods.trim().length > 0) {
    sections.push(parts.userMethods);
  }

  return sections.join('\n\n');
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}

function buildComponentImportsBlock(
  components: ReadonlyArray<{ localName: string; importPath: string }>,
  selfName: string,
): string | undefined {
  if (components.length === 0) return undefined;
  const lines: string[] = [];
  for (const decl of components) {
    if (decl.localName === selfName) continue; // self-registers via @customElement
    // Side-effect-only import: the imported module's @customElement decorator
    // runs at module load and registers `customElements.define(tag, Class)`.
    // No symbol bind — the parent template references the registered tag.
    lines.push(`import '${decl.importPath}';`);
  }
  if (lines.length === 0) return undefined;
  return lines.join('\n') + '\n';
}
