/**
 * shell.ts — Phase 5 Plan 05-04a Task 3 (default-export added in Plan 05-04b).
 *
 * Composes the Angular standalone-component .ts file via `magic-string`'s
 * `MagicString.append`. Block order:
 *
 *   1. Imports (`@angular/core`, `@angular/common`, `@angular/forms`)
 *   2. Per-slot context interfaces (rendered above the class)
 *   3. @Component({...}) decorator
 *   4. export class Name { ... }
 *   5. export default Name; — added by Plan 05-04b so consumer-side
 *      `import Foo from './Foo.rozie'` works the same way as Vue/React/
 *      Svelte targets (where the framework plugin synthesizes default
 *      exports). Without this, AppComponent.ts's `import Counter from
 *      './Counter.rozie'` would fail at Rollup bind time with "default is
 *      not exported".
 *
 * Returning a `MagicString` (not a plain string) lets `emitAngular` later call
 * `composeSourceMap(ms, ...)` to thread the source map (DX-01).
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';

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
}

export function buildShell(parts: ShellParts): MagicString {
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

  // Indent each line of class body by 2 spaces.
  const indented = parts.classBody
    .split('\n')
    .map((line) => (line.length > 0 ? '  ' + line : line))
    .join('\n');
  ms.append(indented);
  ms.append('\n}\n');

  // Plan 05-04b: emit `export default ClassName;` so consumer-side
  // `import Foo from './Foo.rozie'` works (mirrors how Vue/Svelte/React
  // synthesise default exports for their respective virtual ids).
  ms.append(`\nexport default ${parts.componentName};\n`);

  return ms;
}
