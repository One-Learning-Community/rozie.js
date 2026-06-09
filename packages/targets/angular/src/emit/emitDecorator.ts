/**
 * emitDecorator — Phase 5 Plan 05-04a Task 1.
 *
 * Builds the `@Component({ ... })` decorator block for an Angular 17+
 * standalone component. Per Pitfall 10, conditionally includes:
 *
 *   - `NgTemplateOutlet` from `@angular/common` — when any SlotDecl is present
 *     (since slot invocations use `*ngTemplateOutlet`).
 *   - `FormsModule` from `@angular/forms` — when r-model is used on `<input>` /
 *     `<select>` / `<textarea>` (detected by the emitTemplate output containing
 *     `[(ngModel)]`).
 *
 * Selector is `rozie-{kebab-case}` (e.g., Counter → `rozie-counter`).
 * Encapsulation defaults to Emulated (default) — no explicit setting unless v2
 * adds shadow / none.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent, ComponentDecl, PropDecl } from '../../../../core/src/ir/types.js';
import { AngularImportCollector } from '../rewrite/collectAngularImports.js';

/** Convert `Counter` / `TodoList` / `SearchInput` → `rozie-counter` / `rozie-todo-list` / `rozie-search-input`. */
export function toKebabCase(name: string): string {
  // Insert hyphen before any uppercase letter that follows a lowercase letter
  // or a digit. Then lowercase the whole thing.
  const hyphenated = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  return hyphenated.toLowerCase();
}

export interface EmitDecoratorOpts {
  /** Component class name (e.g., `Counter`). */
  componentName: string;
  /** Compiled Angular template body string (no surrounding backticks). */
  template: string;
  /** Compiled style body string (single concatenated string for `styles: [\`...\`]`). */
  stylesArrayBody: string;
  /**
   * Spike 004 — body of a SEPARATE `styles` array entry for `@portal NAME
   * { ... }` rules (each selector already wrapped `:host ::ng-deep`). Empty
   * string when the component has no @portal blocks.
   */
  portalStylesEntry?: string;
  /**
   * Whether the IR has any SlotDecl — drives conditional NgTemplateOutlet
   * import in the decorator's `imports: [...]` array (Pitfall 10).
   */
  hasSlots: boolean;
  /**
   * Whether the emitted template contains `[(ngModel)]` — drives conditional
   * FormsModule import (Pitfall 10). emitTemplate returns this signal.
   */
  hasNgModel: boolean;
  /**
   * Phase 07.2 Plan 04 (R5): whether the consumer's template has at least
   * one `<template #[expr]>` dynamic-name dispatch. Drives NgTemplateOutlet
   * inclusion in the decorator's `imports: [...]` array for the consumer-
   * side `*ngTemplateOutlet` dispatch.
   */
  hasDynamicSlotFiller?: boolean;
  /**
   * Debug fix(33-04) (tiptap-nodeview): whether the emitted template contains
   * an `[ngClass]="..."` binding — drives `NgClass` inclusion in the
   * decorator's `imports: [...]` array. `[ngClass]` is NOT an Angular built-in;
   * it requires the `NgClass` directive from `@angular/common`. Without it the
   * merged class binding is inert (silently never applied). Caller (emitAngular)
   * MUST also call `imports.addCommon('NgClass')`.
   */
  usesNgClass?: boolean;
  /**
   * Debug fix(33-04): whether the emitted template contains an `[ngStyle]="..."`
   * binding — drives `NgStyle` inclusion in `imports: [...]`. Symmetric with
   * `usesNgClass`.
   */
  usesNgStyle?: boolean;
  /**
   * Phase 06.2 P2 (D-115/D-118): IR components table — non-self entries
   * are appended to `imports: [...]` as bare class names (e.g., `CardHeader`).
   * Self-entries (localName === componentName) are filtered here too —
   * the self-class is referenced via `forwardRef(() => Self)` instead.
   *
   * Defaults to empty array.
   */
  componentDecls?: readonly ComponentDecl[];
  /**
   * Phase 06.2 P2 (Pitfall 5): when true, emit `forwardRef(() => Self)`
   * inside `imports: [...]` for the standalone component's own class.
   * Caller (emitAngular) MUST also have called `imports.add('forwardRef')`
   * on the AngularImportCollector so the symbol is in the @angular/core
   * import line.
   */
  selfReferenced?: boolean;
  /**
   * Phase 23 (angular-cva-forms-integration) — the single `model: true` prop
   * the auto-`ControlValueAccessor` wraps, or `null` when CVA is off. When
   * non-null, the decorator gains:
   *   - `providers: [{ provide: NG_VALUE_ACCESSOR, useExisting:
   *     forwardRef(() => <Class>), multi: true }]`
   *   - `host: { '(focusout)': '__rozieCvaOnTouched()' }`
   * The decorator branches ONLY on `cvaModelProp !== null`. The caller
   * (emitAngular) MUST also register `NG_VALUE_ACCESSOR` (@angular/forms) and
   * `forwardRef` (@angular/core) on the import collector. The prop itself is
   * not otherwise read here — a boolean would suffice, but we keep the prop for
   * symmetry with emitScript's gate and to allow future host-binding extension.
   */
  cvaModelProp?: PropDecl | null;
  /**
   * Phase 36 ($provide) — the per-key context `providers` ENTRY strings (each a
   * `{ provide: rozieToken('k'), useFactory: () => v }` literal, 4-space
   * indented to sit inside `providers: [ ... ]`). When non-empty these are
   * MERGED with the CVA `NG_VALUE_ACCESSOR` entry into a SINGLE `providers:`
   * array — emitting two `providers:` keys (one for CVA, one for context) is
   * invalid object syntax (Pitfall 2 / REQ-31). Uses `providers`, NEVER
   * `viewProviders` (projected `ng-content` descendants are blind to
   * viewProviders). Empty `[]` for non-context components keeps the decorator
   * byte-identical to today (R12).
   */
  contextProviderEntries?: readonly string[];
}

/**
 * Side-effect: registers conditional imports (NgTemplateOutlet, FormsModule)
 * with the collector so the file's import lines reflect the decorator's
 * imports[] array.
 */
export function registerDecoratorImports(
  imports: AngularImportCollector,
  opts: { hasSlots: boolean; hasNgModel: boolean },
): void {
  if (opts.hasSlots) {
    imports.addCommon('NgTemplateOutlet');
  }
  if (opts.hasNgModel) {
    imports.addForms('FormsModule');
  }
}

/**
 * Build the imports[] list inside @Component decorator. Returns a string like
 * `[NgTemplateOutlet, FormsModule, CardHeader, forwardRef(() => Self)]` or
 * empty string when no imports needed.
 *
 * Order:
 *   1. NgTemplateOutlet (slot support)
 *   2. FormsModule (r-model on form-input)
 *   3. User component classes from `<components>` (Phase 06.2 P2 D-115)
 *   4. forwardRef(() => Self) — self-reference per Pitfall 5
 */
function buildDecoratorImportsList(opts: {
  hasSlots: boolean;
  hasNgModel: boolean;
  hasDynamicSlotFiller?: boolean;
  usesNgClass?: boolean;
  usesNgStyle?: boolean;
  componentDecls: readonly ComponentDecl[];
  selfReferenced: boolean;
  componentName: string;
}): string {
  const items: string[] = [];
  // Phase 07.2 Plan 04 (R5): NgTemplateOutlet is also required for the
  // consumer-side dynamic-name dispatch via `*ngTemplateOutlet`. Folded
  // into the same item so duplicate registrations don't surface.
  if (opts.hasSlots || opts.hasDynamicSlotFiller) items.push('NgTemplateOutlet');
  // Debug fix(33-04): the multi-source class/style merge emits `[ngClass]` /
  // `[ngStyle]`, which require these directives in `imports: [...]`. Placed
  // after NgTemplateOutlet so the @angular/common items group together and
  // before FormsModule (stable, deterministic order).
  if (opts.usesNgClass) items.push('NgClass');
  if (opts.usesNgStyle) items.push('NgStyle');
  if (opts.hasNgModel) items.push('FormsModule');
  for (const decl of opts.componentDecls) {
    if (decl.localName === opts.componentName) continue; // self handled below
    items.push(decl.localName);
  }
  if (opts.selfReferenced) {
    items.push(`forwardRef(() => ${opts.componentName})`);
  }
  if (items.length === 0) return '';
  return `[${items.join(', ')}]`;
}

/**
 * Render the @Component decorator block.
 */
export function emitDecorator(
  ir: IRComponent,
  opts: EmitDecoratorOpts,
): string {
  void ir;
  const selector = `rozie-${toKebabCase(opts.componentName)}`;
  const importsList = buildDecoratorImportsList({
    hasSlots: opts.hasSlots,
    hasNgModel: opts.hasNgModel,
    hasDynamicSlotFiller: opts.hasDynamicSlotFiller ?? false,
    usesNgClass: opts.usesNgClass ?? false,
    usesNgStyle: opts.usesNgStyle ?? false,
    componentDecls: opts.componentDecls ?? [],
    selfReferenced: opts.selfReferenced ?? false,
    componentName: opts.componentName,
  });

  const lines: string[] = [];
  lines.push('@Component({');
  lines.push(`  selector: '${selector}',`);
  lines.push(`  standalone: true,`);
  if (importsList.length > 0) {
    lines.push(`  imports: ${importsList},`);
  }
  // Template — wrap in backticks. Indent each line of the template by 4 spaces.
  // User Angular template syntax can include backticks and ${...} interpolations
  // (e.g., `:class="\`badge badge-${value}\`"`); escape both so they don't close
  // the surrounding template literal or trigger TS template-string interpolation.
  const indentedTemplate = opts.template
    .split('\n')
    .map((l) => (l.length > 0 ? '    ' + l : l))
    .join('\n');
  lines.push(`  template: \``);
  lines.push(escapeForBacktickLiteral(indentedTemplate));
  lines.push(`  \`,`);
  const portalStylesEntry = opts.portalStylesEntry ?? '';
  if (portalStylesEntry.length === 0) {
    // Existing single-entry layout — preserved byte-identical for all
    // @portal-free components.
    if (opts.stylesArrayBody.length > 0) {
      lines.push(`  styles: [\``);
      const indentedStyles = opts.stylesArrayBody
        .split('\n')
        .map((l) => (l.length > 0 ? '    ' + l : l))
        .join('\n');
      lines.push(escapeForBacktickLiteral(indentedStyles));
      lines.push(`  \`],`);
    }
  } else {
    // Spike 004 — multi-entry layout: scoped/:root entry (when present) +
    // a SECOND @portal entry wrapped in :host ::ng-deep so
    // view-encapsulation's _ngcontent-* scoping doesn't prevent matching
    // engine-created DOM.
    lines.push(`  styles: [`);
    if (opts.stylesArrayBody.length > 0) {
      lines.push(`    \``);
      const indentedStyles = opts.stylesArrayBody
        .split('\n')
        .map((l) => (l.length > 0 ? '    ' + l : l))
        .join('\n');
      lines.push(escapeForBacktickLiteral(indentedStyles));
      lines.push(`  \`,`);
    }
    lines.push(`    // Spike 004 NEW — @portal item { … } as a separate styles entry`);
    lines.push(`    // wrapped in :host ::ng-deep so view-encapsulation's`);
    lines.push(`    // _ngcontent-* attribute scoping doesn't prevent matching`);
    lines.push(`    // engine-created DOM.`);
    lines.push(`    \``);
    const indentedPortal = portalStylesEntry
      .split('\n')
      .map((l) => (l.length > 0 ? '    ' + l : l))
      .join('\n');
    lines.push(escapeForBacktickLiteral(indentedPortal));
    lines.push(`  \`,`);
    lines.push(`  ],`);
  }

  // Phase 23 (angular-cva-forms-integration) + Phase 36 ($provide context) —
  // a SINGLE merged `providers: [...]` array. Two sources contribute entries:
  //
  //   1. the auto-CVA `NG_VALUE_ACCESSOR` entry, gated on cvaModelProp (Phase 23).
  //      The host fragment is a fixed pure method-call literal (T-23-02-AOT:
  //      satisfies the AOT pure-expression constraint, Pitfall 6); the entry
  //      self-references the emitted class via forwardRef (the class is in scope
  //      of its own decorator).
  //   2. the context `{ provide: rozieToken('k'), useFactory: () => v }` entries
  //      (Phase 36 / REQ-9), each already 4-space indented.
  //
  // A component with BOTH a CVA model prop AND a `$provide` would otherwise emit
  // two `providers:` keys → invalid object literal (Pitfall 2). MERGE them into
  // ONE array. Always `providers`, NEVER `viewProviders` — projected
  // `ng-content` descendants are blind to viewProviders (REQ-31).
  const contextEntries = opts.contextProviderEntries ?? [];
  const providerEntryBlocks: string[] = [];
  if (opts.cvaModelProp != null) {
    providerEntryBlocks.push(
      [
        `    {`,
        `      provide: NG_VALUE_ACCESSOR,`,
        `      useExisting: forwardRef(() => ${opts.componentName}),`,
        `      multi: true,`,
        `    },`,
      ].join('\n'),
    );
  }
  for (const entry of contextEntries) {
    providerEntryBlocks.push(entry);
  }
  if (providerEntryBlocks.length > 0) {
    lines.push(`  providers: [`);
    for (const block of providerEntryBlocks) {
      lines.push(block);
    }
    lines.push(`  ],`);
  }
  // The CVA host binding stays gated on cvaModelProp ONLY (a $provide-only
  // component declares no host map) — byte-identical to today for both the
  // CVA-only and the no-CVA paths.
  if (opts.cvaModelProp != null) {
    lines.push(`  host: { '(focusout)': '__rozieCvaOnTouched()' },`);
  }

  lines.push('})');

  return lines.join('\n');
}

function escapeForBacktickLiteral(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
}
