/**
 * shell.ts — assembles the Lit `.ts` module from emitted parts.
 *
 * Block order (D-LIT carry-forward):
 *
 *   1. Import lines (lit, lit/decorators.js, @lit-labs/preact-signals, @rozie/runtime-lit)
 *   2. Component side-effect imports (`import './Foo.rozie';` per D-LIT — module
 *      load registers the custom element via customElements.define)
 *   3. Per-slot context interfaces (e.g., `interface RozieSlotXCtx { ... }`)
 *   4. @customElement('rozie-x') decorator
 *   5. `export default class Name extends SignalWatcher(LitElement) { ... }`
 *   6. Optional `injectGlobalStyles('rozie-x-global', ...)` call AFTER the class
 *      (D-LIT-15 — non-:root rules go INTO `static styles = css\`...\``).
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { BlockMap } from '../../../../core/src/ast/types.js';

export interface LitShellParts {
  /** Import lines for `lit`, `lit/decorators.js`, `@lit-labs/preact-signals`, `@rozie/runtime-lit`. */
  importLines: string;
  /**
   * Side-effect composition imports — for cross-rozie `<components>` entries
   * we emit `import './Foo.rozie';` (D-LIT — module load registers the custom
   * element via customElements.define). No symbol binding.
   */
  componentImportsBlock?: string | undefined;
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
  /** Optional `injectGlobalStyles('rozie-counter-global', ...);` call emitted AFTER the class. */
  globalStyleIife?: string | undefined;
  /** Original .rozie source — used by sourcemap/compose (not yet wired in P2). */
  rozieSource: string;
  /** Block byte offsets from splitBlocks. */
  blockOffsets: BlockMap;
  /** Per-expression child map from emitScript (P2 unused). */
  scriptMap?: EncodedSourceMap | null | undefined;
  /** 0-indexed line offset of user-authored script statements in shell output. */
  preambleSectionLines?: number | undefined;
}

export interface BuildShellResult {
  ms: MagicString;
  scriptOutputOffset: number;
  scriptMap: EncodedSourceMap | null;
}

export function buildShell(parts: LitShellParts): BuildShellResult {
  const moduleParts: string[] = [];

  if (parts.importLines.length > 0) {
    moduleParts.push(parts.importLines);
    if (!parts.importLines.endsWith('\n')) moduleParts.push('\n');
  }

  if (parts.componentImportsBlock && parts.componentImportsBlock.length > 0) {
    moduleParts.push(parts.componentImportsBlock);
    if (!parts.componentImportsBlock.endsWith('\n')) moduleParts.push('\n');
  }

  // Blank line after imports.
  if (moduleParts.length > 0) moduleParts.push('\n');

  for (const decl of parts.interfaceDecls) {
    moduleParts.push(decl);
    moduleParts.push('\n\n');
  }

  moduleParts.push(parts.customElementDecorator);
  moduleParts.push('\n');
  moduleParts.push(
    `export default class ${parts.componentName} extends ${parts.baseClassExpression} {\n`,
  );

  // Indent class body by 2 spaces — but emitters already indent their own
  // sub-content; here we only wrap with a 2-space outer prefix for top-level
  // class statements that didn't include it.
  // The composeClassBody output already aligns lines to a 2-space class-body
  // indent. We pass it through verbatim.
  moduleParts.push(parts.classBody);
  if (!parts.classBody.endsWith('\n')) moduleParts.push('\n');
  moduleParts.push('}\n');

  if (parts.globalStyleIife && parts.globalStyleIife.trim().length > 0) {
    moduleParts.push('\n');
    moduleParts.push(parts.globalStyleIife);
    if (!parts.globalStyleIife.endsWith('\n')) moduleParts.push('\n');
  }

  const moduleSource = moduleParts.join('');
  const ms = new MagicString(moduleSource);
  return { ms, scriptOutputOffset: 0, scriptMap: parts.scriptMap ?? null };
}
