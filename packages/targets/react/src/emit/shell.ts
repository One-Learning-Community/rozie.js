/**
 * shell.ts — Plan 04-02 Task 2 (React target); Phase 06.1 Plan 01 Task 2
 * rearchitecture.
 *
 * Composes the .tsx file by anchoring `magic-string`'s MagicString at the
 * original `.rozie` source bytes and using `ms.overwrite(...)` over the
 * `<rozie>` envelope's byte range with the entire React module body
 * (Phase 06.1 P1, DX-04). Per-expression accuracy inside the script body
 * lands in P2 via @babel/generator's child sourcemap chained through
 * composeMaps().
 *
 * Returning a `BuildShellResult` (not a plain MagicString) lets `emitReact`
 * surface the byte-anchored map and the script-body output offset for P2's
 * `composeMaps()` integration.
 *
 * NO `import React from 'react'` line is ever generated (D-68 automatic JSX
 * runtime). The function return type uses `JSX.Element` (no type-only import
 * required, more portable across tsconfig).
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { BlockMap } from '../../../../core/src/ast/types.js';

export interface ShellParts {
  componentName: string;
  /** `interface FooProps {...}` from emitPropsInterface */
  propsInterface: string;
  /** `import { useState, ... } from 'react';\n` (or empty) */
  reactImports: string;
  /** `import type { ReactNode } from 'react';\n` line (or empty) — Plan 04-03 */
  reactTypeImports?: string;
  /** `import { useControllableState, ... } from '@rozie/runtime-react';\n` (or empty) */
  runtimeImports: string;
  /** `import styles from './Foo.module.css';` or null (Plan 04-05 wires) */
  cssModuleImport: string | null;
  /** `import './Foo.global.css';` or null (Plan 04-05 wires) */
  globalCssImport: string | null;
  /**
   * Standalone interface declarations for slot-context types (Plan 04-03).
   * Each entry is a complete `interface XCtx { ... }` block. Goes BEFORE
   * the props interface.
   */
  ctxInterfaces?: string[];
  /**
   * Top-of-component-body lines (Plan 04-03):
   *   - lifted default-content functions like `function __defaultChildren(ctx) { ... }`
   *   - modifier-helper wraps like `const _rozieDebouncedSearch = useDebouncedCallback(...)`
   * Each entry is a complete declaration. Goes AFTER ctxInterfaces and
   * BEFORE the props interface (top-of-file constants).
   *
   * NOTE: in v1 we place these BEFORE the props interface so they sit at
   * the module top alongside other top-of-file declarations. The exception
   * is modifier-helper wraps that depend on hooks (e.g., useDebouncedCallback)
   * — these need to live INSIDE the function body. This v1 emits BOTH classes
   * at the module top; Plan 04-04 will refine to split.
   */
  scriptInjections?: string[];
  /** Body of the function above the `return ( <JSX> );`. */
  script: string;
  /**
   * Plan 04-04 — `<listeners>`-block useEffect / useOutsideClick blocks.
   * Placed AFTER `scriptInjections` so listener wrapper consts (which live in
   * `scriptInjections`) are in scope when the useEffect attaches them. Layout:
   *   hookSection → userArrowsSection (`script`)
   *     → wrapper consts (`scriptInjections`)
   *     → listener useEffects (`listenerEffects`)
   *     → return JSX
   */
  listenerEffects?: string;
  /**
   * When true, the function parameter is named `_props` (instead of `props`)
   * because the script body rebinds `props` to a defaults-merged version.
   * emitScript sets this whenever any non-model prop has a declared default.
   */
  hasPropsDefaults?: boolean;
  /** JSX body string (e.g., '<div>...</div>' or '(\n  <div>...</div>\n)') */
  jsx: string;
  /**
   * Phase 06.1 Plan 01: original `.rozie` source text — anchors the MagicString.
   */
  rozieSource: string;
  /**
   * Phase 06.1 Plan 01: block byte offsets from splitBlocks() — used to
   * anchor the React module's overwrite range at the `<rozie>` envelope.
   */
  blockOffsets: BlockMap;
  /**
   * Phase 06.1 P2 (D-101): per-expression child sourcemap from emitScript;
   * pass-through to BuildShellResult for composeMaps() consumption.
   */
  scriptMap?: EncodedSourceMap | null;
}

/**
 * Phase 06.1 Plan 01 D-101: buildShell return shape carries both the
 * byte-anchored MagicString AND the script-body offset within the rendered
 * shell so P2's composeMaps() can chain @babel/generator's per-expression
 * child map at the correct output position.
 */
export interface BuildShellResult {
  /** MagicString anchored to rozieSource with whole-module overwrite + outer-region remove. */
  ms: MagicString;
  /** Byte offset within ms.toString() where the React function body begins. */
  scriptOutputOffset: number;
  /**
   * Phase 06.1 P2 (D-101): pass-through of emitScript's per-expression child
   * map. composeMaps() chains this into the shell map at scriptOutputOffset.
   * null when no child map produced (D-102 fallback).
   */
  scriptMap: EncodedSourceMap | null;
}

export function buildShell(parts: ShellParts): BuildShellResult {
  const blocks = parts.blockOffsets;

  // Back-compat fallback: when rozieSource is empty (old callers without
  // opts.source / opts.blockOffsets), construct the module body on an empty
  // MagicString. This preserves pre-Phase-06.1 behavior.
  if (parts.rozieSource.length === 0 || !blocks.rozie) {
    return buildShellLegacy(parts);
  }

  const ms = new MagicString(parts.rozieSource);

  // Compose the entire React module as a single string, then overwrite the
  // <rozie> envelope's byte range with it. This anchors the React output at
  // the `<rozie>` start byte; per-block accuracy inside the script body
  // lands in P2 via @babel/generator sourceMaps:true. P1's contribution:
  // stack traces resolve to "somewhere inside <rozie>" rather than line 1
  // col 0.
  const moduleParts: string[] = [];

  if (parts.reactImports.length > 0) moduleParts.push(parts.reactImports);
  if (parts.reactTypeImports && parts.reactTypeImports.length > 0)
    moduleParts.push(parts.reactTypeImports);
  if (parts.runtimeImports.length > 0) moduleParts.push(parts.runtimeImports);
  if (parts.cssModuleImport !== null) moduleParts.push(parts.cssModuleImport + '\n');
  if (parts.globalCssImport !== null) moduleParts.push(parts.globalCssImport + '\n');

  // Blank line between imports and interface (only if any imports).
  if (
    parts.reactImports.length > 0 ||
    (parts.reactTypeImports && parts.reactTypeImports.length > 0) ||
    parts.runtimeImports.length > 0 ||
    parts.cssModuleImport !== null ||
    parts.globalCssImport !== null
  ) {
    moduleParts.push('\n');
  }

  // Slot-context interfaces — Plan 04-03 — BEFORE the props interface.
  if (parts.ctxInterfaces && parts.ctxInterfaces.length > 0) {
    for (const iface of parts.ctxInterfaces) {
      moduleParts.push(iface);
      moduleParts.push('\n\n');
    }
  }

  // Props interface.
  moduleParts.push(parts.propsInterface);
  moduleParts.push('\n\n');

  // Top-of-file scriptInjections that are NOT hooks (default-content lifts).
  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const moduleTop = parts.scriptInjections.filter((s) =>
      s.startsWith('function '),
    );
    for (const inj of moduleTop) {
      moduleParts.push(inj);
      moduleParts.push('\n\n');
    }
  }

  // Function declaration. Record the byte offset of the first byte of the
  // function body (after `export default function Name(...): JSX.Element {\n`)
  // for P2 composeMaps consumption.
  const propsParam = parts.hasPropsDefaults ? '_props' : 'props';
  const functionSignature = `export default function ${parts.componentName}(${propsParam}: ${parts.componentName}Props): JSX.Element {\n`;

  const preBodyLength = moduleParts.join('').length;
  moduleParts.push(functionSignature);
  const scriptOutputOffset = preBodyLength + functionSignature.length;

  // Script body — indented 2 spaces per line.
  if (parts.script.trim().length > 0) {
    const indented = parts.script
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    moduleParts.push(indented);
    moduleParts.push('\n\n');
  }

  // In-function-body scriptInjections (hook-wraps).
  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const inFn = parts.scriptInjections.filter((s) => !s.startsWith('function '));
    for (const inj of inFn) {
      const indented = inj
        .split('\n')
        .map((line) => (line.length > 0 ? '  ' + line : line))
        .join('\n');
      moduleParts.push(indented);
      moduleParts.push('\n');
    }
    if (inFn.length > 0) moduleParts.push('\n');
  }

  // Plan 04-04 — listener-block useEffect / useOutsideClick blocks.
  if (parts.listenerEffects && parts.listenerEffects.trim().length > 0) {
    const indented = parts.listenerEffects
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    moduleParts.push(indented);
    moduleParts.push('\n\n');
  }

  // JSX body — wrap in `return ( ... );`.
  const jsxIndented = parts.jsx
    .split('\n')
    .map((line) => (line.length > 0 ? '    ' + line : line))
    .join('\n');
  moduleParts.push('  return (\n');
  moduleParts.push(jsxIndented);
  moduleParts.push('\n  );\n}\n');

  const moduleSource = moduleParts.join('');

  // Anchor the entire React module at the `<rozie>` envelope's byte range.
  const anchorStart = blocks.rozie.loc.start;
  const anchorEnd = blocks.rozie.loc.end;
  ms.overwrite(anchorStart, anchorEnd, moduleSource);

  // Remove pre-envelope and post-envelope characters (e.g. leading whitespace,
  // trailing newlines, HTML comments outside the envelope).
  if (anchorStart > 0) ms.remove(0, anchorStart);
  if (anchorEnd < parts.rozieSource.length)
    ms.remove(anchorEnd, parts.rozieSource.length);

  return { ms, scriptOutputOffset, scriptMap: parts.scriptMap ?? null };
}

/**
 * Legacy fallback path — empty rozieSource or missing blockOffsets.
 * Constructs the React module from scratch on an empty MagicString,
 * preserving pre-Phase-06.1 behavior so old callers (tests that don't
 * thread opts.source through) keep working.
 */
function buildShellLegacy(parts: ShellParts): BuildShellResult {
  const ms = new MagicString('');

  // Imports section.
  if (parts.reactImports.length > 0) ms.append(parts.reactImports);
  if (parts.reactTypeImports && parts.reactTypeImports.length > 0)
    ms.append(parts.reactTypeImports);
  if (parts.runtimeImports.length > 0) ms.append(parts.runtimeImports);
  if (parts.cssModuleImport) ms.append(parts.cssModuleImport + '\n');
  if (parts.globalCssImport) ms.append(parts.globalCssImport + '\n');

  if (
    parts.reactImports.length > 0 ||
    (parts.reactTypeImports && parts.reactTypeImports.length > 0) ||
    parts.runtimeImports.length > 0 ||
    parts.cssModuleImport ||
    parts.globalCssImport
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

  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const moduleTop = parts.scriptInjections.filter((s) => s.startsWith('function '));
    for (const inj of moduleTop) {
      ms.append(inj);
      ms.append('\n\n');
    }
  }

  const propsParam = parts.hasPropsDefaults ? '_props' : 'props';
  ms.append(
    `export default function ${parts.componentName}(${propsParam}: ${parts.componentName}Props): JSX.Element {\n`,
  );

  if (parts.script.trim().length > 0) {
    const indented = parts.script
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented);
    ms.append('\n\n');
  }

  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const inFn = parts.scriptInjections.filter((s) => !s.startsWith('function '));
    for (const inj of inFn) {
      const indented = inj
        .split('\n')
        .map((line) => (line.length > 0 ? '  ' + line : line))
        .join('\n');
      ms.append(indented);
      ms.append('\n');
    }
    if (inFn.length > 0) ms.append('\n');
  }

  if (parts.listenerEffects && parts.listenerEffects.trim().length > 0) {
    const indented = parts.listenerEffects
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented);
    ms.append('\n\n');
  }

  const jsxIndented = parts.jsx
    .split('\n')
    .map((line) => (line.length > 0 ? '    ' + line : line))
    .join('\n');
  ms.append('  return (\n');
  ms.append(jsxIndented);
  ms.append('\n  );\n}\n');

  return { ms, scriptOutputOffset: 0, scriptMap: parts.scriptMap ?? null };
}
