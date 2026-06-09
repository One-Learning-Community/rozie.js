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
  // 260602-9lw — `on(deps, fn, { defer: true })` is the idiomatic Solid lazy
  // `$watch` form (skips the first `fn` run). Added to the allowlist alongside
  // `createEffect`/`untrack`. `on` is a first-class `solid-js` export.
  | 'on'
  | 'untrack'
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
  | 'createThrottledHandler'
  // Phase 26 (D-01/D-06) — portable display helper. Added by the template
  // emitters ONLY when a `wrapForDisplay` interpolation actually wraps, so a
  // primitive-only component's `@rozie/runtime-solid` import line stays
  // byte-identical to pre-phase (SPEC-3).
  | 'rozieDisplay'
  // 260608-sya — attribute-position display helper (nullish DROPS the
  // attribute, matching Vue's `:attr` semantics). Added by the attribute
  // emitter ONLY on the wrapped whole-value generic-attr binding branch.
  | 'rozieAttr'
  | 'parseInlineStyle'
  | 'normalizeAttrs'
  | 'normalizeListeners'
  | 'mergeListeners'
  /**
   * Pre-Phase-16 Item-1-residual closure — `__rozieInjectStyle` runtime
   * helper. Emitted at module top by the shell when `emitStyle` produced
   * a non-empty `injectStatement`. Replaces the previous inline
   * `<style>{...}</style>` JSX emit (which broke same-specificity cascade
   * in cross-SFC composition because each wrapper INSTANCE rendered its
   * own `<style>` element AFTER the consumer's in the DOM).
   */
  | '__rozieInjectStyle';

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
