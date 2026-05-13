/**
 * shell.ts — P1 stub for the Lit target shell builder.
 *
 * Per `<interfaces>` in 06.4-01-PLAN.md, the buildShell() output is the
 * MagicString-anchored .ts assembly fused from:
 *   - import lines (lit, lit-decorators, preact-signals, runtime-lit, components)
 *   - optional ctxInterfaces from emitSlotDecl
 *   - @customElement decorator
 *   - `export class <Name> extends SignalWatcher(LitElement) { ... }`
 *   - optional `injectGlobalStyles(id, css)` call after the class for :root rules
 *   - `customElements.define(tagName, <Name>)` registration
 *
 * P1 stub: returns a minimal MagicString wrapping the placeholder class so
 * the emitLit stub flows through buildShell without TS errors. P2 fills in
 * the real assembly logic per PATTERNS.md §"packages/targets/lit/src/emit/shell.ts".
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { BlockMap } from '../../../../core/src/ast/types.js';

export interface LitShellParts {
  /** `import { LitElement, html, css } from 'lit';\n...` */
  importLines: string;
  /**
   * Side-effect composition imports — for cross-rozie `<components>` entries
   * we emit `import './Foo.rozie';` (D-LIT — module load registers the custom
   * element via customElements.define). No symbol binding.
   */
  componentImportsBlock?: string;
  /** Standalone `interface XCtx { ... }` declarations from emitSlotDecl. */
  interfaceDecls: string[];
  /** `@customElement('rozie-counter')` decorator line. */
  customElementDecorator: string;
  /** Component class name (e.g. `Counter`). */
  componentName: string;
  /** `SignalWatcher(LitElement)` — D-LIT-08 reactive base. */
  baseClassExpression: string;
  /** Pre-assembled class body — fields, decorators, methods, render(). */
  classBody: string;
  /** Optional `injectGlobalStyles('rozie-counter-global', ...);` IIFE emitted AFTER the class. */
  globalStyleIife?: string;
  /** Original .rozie source — used by sourcemap/compose. */
  rozieSource: string;
  /** Block byte offsets from splitBlocks. */
  blockOffsets: BlockMap;
  /** Per-expression child map from emitScript (P2 wires; P1 always null). */
  scriptMap?: EncodedSourceMap | null;
  /** 0-indexed line offset of user-authored script statements in shell output. */
  preambleSectionLines?: number;
}

export interface BuildShellResult {
  ms: MagicString;
  scriptOutputOffset: number;
  scriptMap: EncodedSourceMap | null;
}

/**
 * P1 stub: returns a MagicString wrapping the placeholder class. P2 replaces
 * with the real shell-assembly logic.
 */
export function buildShell(parts: LitShellParts): BuildShellResult {
  // P1 stub uses the parts.classBody when supplied, otherwise falls back to
  // the minimal placeholder. P2 will compose all the import / interface /
  // decorator / class-body / customElements.define pieces in order.
  const placeholder =
    `export default class ${parts.componentName || 'STUB'} {}\n`;
  return {
    ms: new MagicString(placeholder),
    scriptOutputOffset: 0,
    scriptMap: parts.scriptMap ?? null,
  };
}
