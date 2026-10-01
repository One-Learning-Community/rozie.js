/**
 * Collect lit + lit/decorators.js + @lit-labs/preact-signals + @rozie/runtime-lit
 * imports needed by emitted code.
 *
 * Mirrors the three-builder pattern of @rozie/target-angular's
 * collectAngularImports — except Lit splits its imports across THREE source
 * packages: `lit` (value imports of `LitElement` / `html` / `css` / `nothing`),
 * `lit/decorators.js` (decorator imports — `customElement`, `property`,
 * `state`, `query`, `queryAssignedElements`), and `@lit-labs/preact-signals`
 * (the `SignalWatcher` mixin + `signal` / `computed` / `effect`). A fourth
 * builder tracks `@rozie/runtime-lit` runtime helpers.
 *
 * P1 stub: collectors accept `add(name)` and `render()` returning a single
 * sorted import statement per source. P2 wires up which symbols are added
 * for each emit step.
 *
 * @experimental — shape may change before v1.0
 */

import type {
  LIT_CONTEXT_IMPORTS,
  LIT_DECORATOR_IMPORTS,
  LIT_IMPORTS,
  LIT_PREACT_SIGNALS_IMPORTS,
  LIT_RUNTIME_IMPORTS,
} from '../../../../core/src/codegen/targetModuleImports.js';

export type LitImport = (typeof LIT_IMPORTS)[number];

export class LitImportCollector {
  private symbols = new Set<LitImport>();

  add(name: LitImport): void {
    this.symbols.add(name);
  }

  has(name: LitImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from 'lit';\n`;
  }
}

export type LitDecoratorImport = (typeof LIT_DECORATOR_IMPORTS)[number];

export class LitDecoratorImportCollector {
  private symbols = new Set<LitDecoratorImport>();

  add(name: LitDecoratorImport): void {
    this.symbols.add(name);
  }

  has(name: LitDecoratorImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from 'lit/decorators.js';\n`;
  }
}

export type PreactSignalsImport = (typeof LIT_PREACT_SIGNALS_IMPORTS)[number];

export class PreactSignalsImportCollector {
  private symbols = new Set<PreactSignalsImport>();

  add(name: PreactSignalsImport): void {
    this.symbols.add(name);
  }

  has(name: PreactSignalsImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from '@lit-labs/preact-signals';\n`;
  }
}

export type RuntimeLitImport = (typeof LIT_RUNTIME_IMPORTS)[number];

export class RuntimeLitImportCollector {
  private symbols = new Set<RuntimeLitImport>();

  add(name: RuntimeLitImport): void {
    this.symbols.add(name);
  }

  has(name: RuntimeLitImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from '@rozie/runtime-lit';\n`;
  }
}

/**
 * Phase 36 (R10) — `@lit/context` value imports for the cross-component context
 * primitive emit (`emitContext.ts`). `createContext` (identity-on-key, used with
 * `Symbol.for('rozie:'+key)` for native cross-file identity), `ContextProvider`
 * (`$provide`), `ContextConsumer` (`$inject`). The import line is emitted ONLY
 * when the component has at least one `$provide`/`$inject` — keeping non-context
 * components byte-identical (R12 / D-5). `@lit/context` is a peer dep of
 * `@rozie/runtime-lit` (devDep of `@rozie/target-lit`).
 */
export type LitContextImport = (typeof LIT_CONTEXT_IMPORTS)[number];

export class LitContextImportCollector {
  private symbols = new Set<LitContextImport>();

  add(name: LitContextImport): void {
    this.symbols.add(name);
  }

  has(name: LitContextImport): boolean {
    return this.symbols.has(name);
  }

  names(): readonly string[] {
    return [...this.symbols].sort();
  }

  render(): string {
    if (this.symbols.size === 0) return '';
    const sorted = [...this.symbols].sort();
    return `import { ${sorted.join(', ')} } from '@lit/context';\n`;
  }
}
