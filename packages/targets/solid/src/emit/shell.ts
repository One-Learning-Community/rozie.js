/**
 * shell.ts — Solid target shell builder.
 *
 * Composes the .tsx file for a Solid component using magic-string anchored
 * at the original `.rozie` source bytes. Port of react/src/emit/shell.ts
 * with these key differences:
 *
 *   - Interface is `SolidShellParts` (not `ShellParts`).
 *   - No `reactImports`/`reactTypeImports`/`cssModuleImport`/`globalCssImport` fields.
 *   - Has `solidImports` + `runtimeImports` + `splitPropsCall` + `hasDefaultSlot`.
 *   - Function param is ALWAYS `_props` (D-141 universal splitProps).
 *   - After functionSignature, `splitPropsCall` is inserted first, then
 *     optionally the `children()` accessor line (D-131), then a blank line.
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { BlockMap } from '../../../../core/src/ast/types.js';

export interface SolidShellParts {
  componentName: string;
  /** `interface FooProps {...}` from emitPropsInterface */
  propsInterface: string;
  /** `import { createSignal, ... } from 'solid-js';\n` (or empty) */
  solidImports: string;
  /** `import { createControllableSignal, ... } from '@rozie/runtime-solid';\n` (or empty) */
  runtimeImports: string;
  /**
   * Standalone interface declarations for slot-context types.
   * Each entry is a complete `interface XCtx { ... }` block.
   */
  ctxInterfaces?: string[];
  /**
   * `const _merged = mergeProps({ step: 1, ... }, _props);\n` — present when
   * any non-model prop has a declared default. Emitted immediately before
   * splitPropsCall so `local.*` receives the declared defaults.
   */
  mergePropsCall?: string;
  /**
   * The `const [local, rest] = splitProps(_merged|_props, [...]);\n` call (D-141).
   * Always present — even for no-props components (emits `splitProps(_props, [])`).
   */
  splitPropsCall: string;
  /**
   * When true, emits `const resolved = children(() => local.children);\n`
   * immediately after `splitPropsCall` (D-131 default slot accessor).
   */
  hasDefaultSlot?: boolean;
  /** Body of the function above the `return ( <JSX> );`. */
  script: string;
  /**
   * `<listeners>`-block createEffect / createOutsideClick blocks.
   * Placed AFTER splitPropsCall and script body.
   */
  listenerEffects?: string;
  /**
   * Script-body injection lines from debounce/throttle wrappers in emitListeners.
   * Placed AFTER listenerEffects but BEFORE the return statement.
   */
  scriptInjections?: string[];
  /**
   * Inline <style> JSX from emitStyle (Pitfall 3 — no CSS Modules for Solid).
   * When non-empty, the JSX return is wrapped in a fragment: `<>{styleJsx}{jsx}</>`.
   */
  styleJsx?: string;
  /** JSX body string (e.g., '<div>...</div>' or '(\n  <div>...</div>\n)') */
  jsx: string;
  /**
   * Phase 06.1 Plan 01: original `.rozie` source text — anchors the MagicString.
   */
  rozieSource: string;
  /**
   * Phase 06.1 Plan 01: block byte offsets from splitBlocks() — used to
   * anchor the Solid module's overwrite range at the `<rozie>` envelope.
   */
  blockOffsets: BlockMap;
  /**
   * Phase 06.1 P2 (D-101): per-expression child sourcemap from emitScript;
   * pass-through to BuildShellResult for composeMaps() consumption.
   */
  scriptMap?: EncodedSourceMap | null;
  /**
   * Phase 06.2 P2 (D-118): synthesized component-import lines for the
   * top-of-file imports section.
   */
  componentImportsBlock?: string;
  /**
   * Number of hook-section statement lines (from emitScript.hookSectionLines).
   * Used to compute where userArrowsSection starts in the output so the script
   * source map can be line-adjusted correctly.
   */
  hookSectionLines?: number;
}

/**
 * Phase 06.1 Plan 01 D-101: buildShell return shape.
 */
export interface BuildShellResult {
  ms: MagicString;
  scriptOutputOffset: number;
  /**
   * 0-indexed line offset of the user-authored statements within the tsx output.
   * Computed right before the script body is appended, accounting for the
   * module header and hookSection lines. Used by composeMaps to shift the
   * @babel/generator script map so it references tsx output lines, not script-body lines.
   */
  userCodeLineOffset: number;
  scriptMap: EncodedSourceMap | null;
}

export function buildShell(parts: SolidShellParts): BuildShellResult {
  const blocks = parts.blockOffsets;

  // Back-compat fallback: when rozieSource is empty (old callers without
  // opts.source / opts.blockOffsets), construct the module body on an empty
  // MagicString. This preserves pre-Phase-06.1 behavior.
  if (parts.rozieSource.length === 0 || !blocks.rozie) {
    return buildShellLegacy(parts);
  }

  const ms = new MagicString(parts.rozieSource);
  const moduleParts: string[] = [];

  if (parts.solidImports.length > 0) moduleParts.push(parts.solidImports);
  if (parts.runtimeImports.length > 0) moduleParts.push(parts.runtimeImports);
  // Phase 06.2 P2 (D-118): user-component imports.
  if (parts.componentImportsBlock && parts.componentImportsBlock.length > 0) {
    moduleParts.push(parts.componentImportsBlock);
  }

  // Blank line between imports and interface (only if any imports).
  if (
    parts.solidImports.length > 0 ||
    parts.runtimeImports.length > 0 ||
    (parts.componentImportsBlock !== undefined && parts.componentImportsBlock.length > 0)
  ) {
    moduleParts.push('\n');
  }

  // Slot-context interfaces — BEFORE the props interface.
  if (parts.ctxInterfaces && parts.ctxInterfaces.length > 0) {
    for (const iface of parts.ctxInterfaces) {
      moduleParts.push(iface);
      moduleParts.push('\n\n');
    }
  }

  // Props interface.
  moduleParts.push(parts.propsInterface);
  moduleParts.push('\n\n');

  // Function declaration. Always uses `_props` parameter (D-141 universal splitProps).
  const functionSignature = `export default function ${parts.componentName}(_props: ${parts.componentName}Props): JSX.Element {\n`;

  const preBodyLength = moduleParts.join('').length;
  moduleParts.push(functionSignature);
  const scriptOutputOffset = preBodyLength + functionSignature.length;

  // mergeProps for non-model defaults — must precede splitPropsCall.
  if (parts.mergePropsCall) {
    moduleParts.push('  ' + parts.mergePropsCall);
  }
  // splitPropsCall immediately after function open (D-141).
  moduleParts.push('  ' + parts.splitPropsCall);

  // children() accessor for default slot (D-131).
  if (parts.hasDefaultSlot) {
    moduleParts.push('  const resolved = children(() => local.children);\n');
  }

  moduleParts.push('\n');

  // Compute where user-authored statements start in the output (0-indexed lines).
  // This is used by composeMaps to shift the @babel/generator script map.
  const preScriptNewlines = (moduleParts.join('').match(/\n/g) ?? []).length;
  const hookSectionLines = parts.hookSectionLines ?? 0;
  // When hookSection is non-empty, a '\n\n' separator precedes userArrowsSection,
  // producing hookSectionLines statement lines + 1 blank line before user code.
  const userCodeLineOffset = preScriptNewlines + (hookSectionLines > 0 ? hookSectionLines + 1 : 0);

  // Script body — indented 2 spaces per line.
  if (parts.script.trim().length > 0) {
    const indented = parts.script
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    moduleParts.push(indented);
    moduleParts.push('\n\n');
  }

  // Listener createEffect blocks.
  if (parts.listenerEffects && parts.listenerEffects.trim().length > 0) {
    const indented = parts.listenerEffects
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    moduleParts.push(indented);
    moduleParts.push('\n\n');
  }

  // Script injections (debounce/throttle wrappers from listener emitter).
  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    for (const inj of parts.scriptInjections) {
      const indented = inj
        .split('\n')
        .map((line) => (line.length > 0 ? '  ' + line : line))
        .join('\n');
      moduleParts.push(indented);
      moduleParts.push('\n');
    }
    moduleParts.push('\n');
  }

  // JSX body — wrap in `return ( ... );`.
  // When styleJsx is present, wrap the return in a fragment.
  const effectiveJsx = (parts.styleJsx && parts.styleJsx.length > 0)
    ? `<>\n${parts.styleJsx}\n${parts.jsx}\n</>`
    : parts.jsx;
  const jsxIndented = effectiveJsx
    .split('\n')
    .map((line) => (line.length > 0 ? '    ' + line : line))
    .join('\n');
  moduleParts.push('  return (\n');
  moduleParts.push(jsxIndented);
  moduleParts.push('\n  );\n}\n');

  const moduleSource = moduleParts.join('');

  // Anchor the entire Solid module at the `<rozie>` envelope's byte range.
  const anchorStart = blocks.rozie.loc.start;
  const anchorEnd = blocks.rozie.loc.end;
  ms.overwrite(anchorStart, anchorEnd, moduleSource);

  if (anchorStart > 0) ms.remove(0, anchorStart);
  if (anchorEnd < parts.rozieSource.length)
    ms.remove(anchorEnd, parts.rozieSource.length);

  return { ms, scriptOutputOffset, userCodeLineOffset, scriptMap: parts.scriptMap ?? null };
}

/**
 * Legacy fallback path — empty rozieSource or missing blockOffsets.
 */
function buildShellLegacy(parts: SolidShellParts): BuildShellResult {
  const ms = new MagicString('');

  if (parts.solidImports.length > 0) ms.append(parts.solidImports);
  if (parts.runtimeImports.length > 0) ms.append(parts.runtimeImports);
  if (parts.componentImportsBlock && parts.componentImportsBlock.length > 0) {
    ms.append(parts.componentImportsBlock);
  }

  if (
    parts.solidImports.length > 0 ||
    parts.runtimeImports.length > 0 ||
    (parts.componentImportsBlock !== undefined && parts.componentImportsBlock.length > 0)
  ) {
    ms.append('\n');
  }

  if (parts.ctxInterfaces && parts.ctxInterfaces.length > 0) {
    for (const iface of parts.ctxInterfaces) {
      ms.append(iface);
      ms.append('\n\n');
    }
  }

  ms.append(parts.propsInterface);
  ms.append('\n\n');

  // Always _props (D-141).
  ms.append(
    `export default function ${parts.componentName}(_props: ${parts.componentName}Props): JSX.Element {\n`,
  );

  // mergeProps for non-model defaults — must precede splitPropsCall.
  if (parts.mergePropsCall) {
    ms.append('  ' + parts.mergePropsCall);
  }
  // splitPropsCall (D-141).
  ms.append('  ' + parts.splitPropsCall);

  // children() accessor (D-131).
  if (parts.hasDefaultSlot) {
    ms.append('  const resolved = children(() => local.children);\n');
  }

  ms.append('\n');

  if (parts.script.trim().length > 0) {
    const indented = parts.script
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented);
    ms.append('\n\n');
  }

  if (parts.listenerEffects && parts.listenerEffects.trim().length > 0) {
    const indented = parts.listenerEffects
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented);
    ms.append('\n\n');
  }

  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    for (const inj of parts.scriptInjections) {
      const indented = inj
        .split('\n')
        .map((line) => (line.length > 0 ? '  ' + line : line))
        .join('\n');
      ms.append(indented);
      ms.append('\n');
    }
    ms.append('\n');
  }

  const effectiveJsx = (parts.styleJsx && parts.styleJsx.length > 0)
    ? `<>\n${parts.styleJsx}\n${parts.jsx}\n</>`
    : parts.jsx;
  const jsxIndented = effectiveJsx
    .split('\n')
    .map((line) => (line.length > 0 ? '    ' + line : line))
    .join('\n');
  ms.append('  return (\n');
  ms.append(jsxIndented);
  ms.append('\n  );\n}\n');

  return { ms, scriptOutputOffset: 0, userCodeLineOffset: 0, scriptMap: parts.scriptMap ?? null };
}
