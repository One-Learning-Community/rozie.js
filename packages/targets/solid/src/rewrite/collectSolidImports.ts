/**
 * Collect solid-js + @rozie/runtime-solid imports needed by emitted code.
 *
 * Two collectors mirror the React target's pattern (collectReactImports.ts).
 *   - SolidImportCollector: tracks symbols imported from 'solid-js'
 *   - RuntimeSolidImportCollector: tracks symbols imported from '@rozie/runtime-solid'
 *
 * Both collectors expose add/has/names/render. render() emits a single import
 * statement with alphabetically-sorted symbols (snapshot-stable).
 *
 * @experimental — shape may change before v1.0
 */

export type SolidImport =
  | 'createSignal'
  | 'createMemo'
  | 'createEffect'
  | 'mergeProps'
  | 'onMount'
  | 'onCleanup'
  | 'Show'
  | 'For'
  | 'children'
  | 'splitProps';

export class SolidImportCollector {
  private symbols = new Set<SolidImport>();

  add(name: SolidImport): void {
    this.symbols.add(name);
  }

  has(name: SolidImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from 'solid-js';\n`;
  }
}

export type RuntimeSolidImport =
  | 'createControllableSignal'
  | 'createOutsideClick'
  | 'createDebouncedHandler'
  | 'createThrottledHandler';

export class RuntimeSolidImportCollector {
  private symbols = new Set<RuntimeSolidImport>();

  add(name: RuntimeSolidImport): void {
    this.symbols.add(name);
  }

  has(name: RuntimeSolidImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from '@rozie/runtime-solid';\n`;
  }
}
