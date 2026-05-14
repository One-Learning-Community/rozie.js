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

export type LitImport =
  | 'LitElement'
  | 'html'
  | 'css'
  | 'nothing'
  | 'svg'
  | 'PropertyValues';

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

export type LitDecoratorImport =
  | 'customElement'
  | 'property'
  | 'state'
  | 'query'
  | 'queryAsync'
  | 'queryAssignedElements'
  // D-LIT-14 (2026-05-13 correction): queryAssignedNodes is intentionally
  // EXCLUDED from this union — whitespace text-nodes between elements yield
  // false-positive presence detection, breaking $slots.X presence checks.
  // Always use queryAssignedElements with `flatten: true` instead.
  | 'eventOptions';

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

export type PreactSignalsImport =
  | 'SignalWatcher'
  | 'signal'
  | 'computed'
  | 'effect'
  | 'batch';

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

export type RuntimeLitImport =
  | 'createLitControllableProperty'
  | 'observeRozieSlotCtx'
  | 'attachOutsideClickListener'
  | 'injectGlobalStyles'
  | 'debounce'
  | 'throttle';

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
