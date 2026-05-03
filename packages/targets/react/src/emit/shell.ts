/**
 * shell.ts — Plan 04-02 Task 2 (React target).
 *
 * Composes the .tsx file via `magic-string`'s `MagicString.append` per
 * RESEARCH Pattern 1 (D-30 — hybrid skeleton + per-block AST/string body).
 *
 * Returning a `MagicString` (not a plain string) lets `emitReact` later call
 * `ms.generateMap(...)` to thread the source map (DX-01 / Plan 04-05).
 *
 * NO `import React from 'react'` line is ever generated (D-68 automatic JSX
 * runtime). The function return type uses `JSX.Element` (no type-only import
 * required, more portable across tsconfig).
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';

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
  /** JSX body string (e.g., '<div>...</div>' or '(\n  <div>...</div>\n)') */
  jsx: string;
}

export function buildShell(parts: ShellParts): MagicString {
  const ms = new MagicString('');

  // Imports section.
  if (parts.reactImports.length > 0) ms.append(parts.reactImports);
  if (parts.reactTypeImports && parts.reactTypeImports.length > 0) ms.append(parts.reactTypeImports);
  if (parts.runtimeImports.length > 0) ms.append(parts.runtimeImports);
  if (parts.cssModuleImport) ms.append(parts.cssModuleImport + '\n');
  if (parts.globalCssImport) ms.append(parts.globalCssImport + '\n');

  // Blank line between imports and interface (only if any imports).
  if (
    parts.reactImports.length > 0 ||
    (parts.reactTypeImports && parts.reactTypeImports.length > 0) ||
    parts.runtimeImports.length > 0 ||
    parts.cssModuleImport ||
    parts.globalCssImport
  ) {
    ms.append('\n');
  }

  // Slot-context interfaces — Plan 04-03 — BEFORE the props interface.
  if (parts.ctxInterfaces && parts.ctxInterfaces.length > 0) {
    for (const iface of parts.ctxInterfaces) {
      ms.append(iface);
      ms.append('\n\n');
    }
  }

  // Props interface.
  ms.append(parts.propsInterface);
  ms.append('\n\n');

  // Top-of-file scriptInjections that are NOT hooks (default-content lifts).
  // Hooks (useDebouncedCallback consts) belong inside the function body —
  // Plan 04-03 v1 places them at module top alongside lifted defaults; Plan
  // 04-04 refactors. For now: emit lifted-default `function __default...`
  // declarations at the module top, and emit hook-wrap `const _rozie...`
  // declarations inside the function body via the `script` parameter.
  if (parts.scriptInjections && parts.scriptInjections.length > 0) {
    const moduleTop = parts.scriptInjections.filter((s) => s.startsWith('function '));
    for (const inj of moduleTop) {
      ms.append(inj);
      ms.append('\n\n');
    }
  }

  // Function declaration.
  ms.append(
    `export default function ${parts.componentName}(props: ${parts.componentName}Props): JSX.Element {\n`,
  );

  // Script (hookSection + userArrowsSection) FIRST so user-authored arrows
  // are in scope when the hook-wrap injections reference them. The script
  // contract from emitScript is `hookSection ++ '\n\n' ++ userArrowsSection`
  // — all React hooks live in hookSection at the top of the function body,
  // satisfying rules-of-hooks (top-level, unconditional, stable order).
  if (parts.script.trim().length > 0) {
    // Indent each line of script by 2 spaces.
    const indented = parts.script
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented);
    ms.append('\n\n');
  }

  // In-function-body scriptInjections (hook-wraps like
  // `const _rozieDebouncedOnSearch = useDebouncedCallback(onSearch, [], 300);`).
  // Emitted AFTER the user arrows so wrap callees are in TDZ-safe scope.
  // These are still hooks, but they appear after non-hook const decls — that
  // is permitted by react-hooks/rules-of-hooks (no conditionals or loops
  // between them and the function body's top).
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

  // JSX body — wrap in `return ( ... );`.
  const jsxIndented = parts.jsx
    .split('\n')
    .map((line) => (line.length > 0 ? '    ' + line : line))
    .join('\n');
  ms.append('  return (\n');
  ms.append(jsxIndented);
  ms.append('\n  );\n}\n');

  return ms;
}
