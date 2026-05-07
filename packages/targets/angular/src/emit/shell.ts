/**
 * shell.ts — Phase 5 Plan 05-04a Task 3 (default-export added in Plan 05-04b);
 * Phase 06.1 Plan 01 Task 4 rearchitecture.
 *
 * Composes the Angular standalone-component .ts file by anchoring
 * `magic-string`'s MagicString at the original `.rozie` source bytes and
 * using `ms.overwrite(...)` over the `<rozie>` envelope's byte range with
 * the entire Angular module body (Phase 06.1 P1, DX-04). Per-expression
 * accuracy inside the class body lands in P2 via @babel/generator's child
 * sourcemap chained through composeMaps().
 *
 * Block order:
 *
 *   1. Imports (`@angular/core`, `@angular/common`, `@angular/forms`)
 *   2. Per-slot context interfaces (rendered above the class)
 *   3. @Component({...}) decorator
 *   4. export class Name { ... }
 *   5. export default Name; (Plan 05-04b — consumer-side default-import compat).
 *
 * Returning a `BuildShellResult` (not a plain MagicString) lets `emitAngular`
 * later call `composeSourceMap(ms, ...)` to thread the source map.
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { BlockMap } from '../../../../core/src/ast/types.js';

export interface ShellParts {
  /** `import { ... } from '@angular/core';` (and common/forms lines if needed). */
  importLines: string;
  /** Standalone interface declarations for slot contexts (rendered above class). */
  interfaceDecls: string[];
  /** Full @Component({...}) decorator block. */
  decorator: string;
  /** Component class name (e.g., `Counter`). */
  componentName: string;
  /** Class body (lines inside `class X { ... }`, without surrounding braces). */
  classBody: string;
  /**
   * Phase 06.1 Plan 01: original `.rozie` source text — anchors the MagicString.
   */
  rozieSource: string;
  /**
   * Phase 06.1 Plan 01: block byte offsets from splitBlocks() — used to
   * anchor the Angular module's overwrite range at the `<rozie>` envelope.
   */
  blockOffsets: BlockMap;
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
  /** Byte offset within ms.toString() where the class body opens (after `export class Name {\n`). */
  scriptOutputOffset: number;
}

export function buildShell(parts: ShellParts): BuildShellResult {
  const blocks = parts.blockOffsets;

  // Back-compat fallback: empty rozieSource or missing envelope offsets.
  if (parts.rozieSource.length === 0 || !blocks.rozie) {
    return buildShellLegacy(parts);
  }

  const ms = new MagicString(parts.rozieSource);

  // Assemble the entire Angular standalone-component module as a single string.
  // Same approach as React: anchor at the <rozie> envelope's byte range;
  // remove everything outside.
  const moduleParts: string[] = [];

  if (parts.importLines.length > 0) {
    moduleParts.push(parts.importLines);
    moduleParts.push('\n');
  }

  if (parts.interfaceDecls.length > 0) {
    for (const decl of parts.interfaceDecls) {
      moduleParts.push(decl);
      moduleParts.push('\n\n');
    }
  }

  moduleParts.push(parts.decorator);
  moduleParts.push('\n');
  moduleParts.push(`export class ${parts.componentName} {\n`);

  // Record class-body offset BEFORE class body content (P2 will use this).
  const preClassBodyLength = moduleParts.join('').length;

  // Indent each line of class body by 2 spaces.
  const indented = parts.classBody
    .split('\n')
    .map((line) => (line.length > 0 ? '  ' + line : line))
    .join('\n');
  moduleParts.push(indented);
  moduleParts.push('\n}\n');

  // Plan 05-04b: emit `export default ClassName;` so consumer-side
  // `import Foo from './Foo.rozie'` works (mirrors how Vue/Svelte/React
  // synthesise default exports for their respective virtual ids).
  moduleParts.push(`\nexport default ${parts.componentName};\n`);

  const moduleSource = moduleParts.join('');

  // Anchor the entire Angular module at the `<rozie>` envelope's byte range.
  const anchorStart = blocks.rozie.loc.start;
  const anchorEnd = blocks.rozie.loc.end;
  ms.overwrite(anchorStart, anchorEnd, moduleSource);

  // Remove pre-envelope and post-envelope characters (e.g. leading whitespace,
  // trailing newlines, HTML comments outside the envelope).
  if (anchorStart > 0) ms.remove(0, anchorStart);
  if (anchorEnd < parts.rozieSource.length)
    ms.remove(anchorEnd, parts.rozieSource.length);

  return { ms, scriptOutputOffset: preClassBodyLength };
}

/**
 * Legacy fallback path — empty rozieSource or missing envelope.
 * Constructs the Angular module from scratch on an empty MagicString,
 * preserving pre-Phase-06.1 behavior so old callers (tests that don't
 * thread opts.source through) keep working.
 */
function buildShellLegacy(parts: ShellParts): BuildShellResult {
  const ms = new MagicString('');

  if (parts.importLines.length > 0) {
    ms.append(parts.importLines);
    ms.append('\n');
  }

  if (parts.interfaceDecls.length > 0) {
    for (const decl of parts.interfaceDecls) {
      ms.append(decl);
      ms.append('\n\n');
    }
  }

  ms.append(parts.decorator);
  ms.append('\n');
  ms.append(`export class ${parts.componentName} {\n`);

  const indented = parts.classBody
    .split('\n')
    .map((line) => (line.length > 0 ? '  ' + line : line))
    .join('\n');
  ms.append(indented);
  ms.append('\n}\n');

  ms.append(`\nexport default ${parts.componentName};\n`);

  return { ms, scriptOutputOffset: 0 };
}
