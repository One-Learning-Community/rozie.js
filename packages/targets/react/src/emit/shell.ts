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
  /** `import { useControllableState, ... } from '@rozie/runtime-react';\n` (or empty) */
  runtimeImports: string;
  /** `import styles from './Foo.module.css';` or null (Plan 04-05 wires) */
  cssModuleImport: string | null;
  /** `import './Foo.global.css';` or null (Plan 04-05 wires) */
  globalCssImport: string | null;
  /** Body of the function above the `return ( <JSX> );`. */
  script: string;
  /** JSX body or `return null;` (Plan 04-03 fills with real JSX) */
  jsx: string;
}

export function buildShell(parts: ShellParts): MagicString {
  const ms = new MagicString('');

  // Imports section.
  if (parts.reactImports.length > 0) ms.append(parts.reactImports);
  if (parts.runtimeImports.length > 0) ms.append(parts.runtimeImports);
  if (parts.cssModuleImport) ms.append(parts.cssModuleImport + '\n');
  if (parts.globalCssImport) ms.append(parts.globalCssImport + '\n');

  // Blank line between imports and interface (only if any imports).
  if (
    parts.reactImports.length > 0 ||
    parts.runtimeImports.length > 0 ||
    parts.cssModuleImport ||
    parts.globalCssImport
  ) {
    ms.append('\n');
  }

  // Props interface.
  ms.append(parts.propsInterface);
  ms.append('\n\n');

  // Function declaration.
  ms.append(
    `export default function ${parts.componentName}(props: ${parts.componentName}Props): JSX.Element {\n`,
  );

  if (parts.script.trim().length > 0) {
    // Indent each line of script by 2 spaces.
    const indented = parts.script
      .split('\n')
      .map((line) => (line.length > 0 ? '  ' + line : line))
      .join('\n');
    ms.append(indented);
    ms.append('\n\n');
  }

  // JSX body — indented.
  const jsxIndented = parts.jsx
    .split('\n')
    .map((line) => (line.length > 0 ? '  ' + line : line))
    .join('\n');
  ms.append(jsxIndented);
  ms.append('\n}\n');

  return ms;
}
