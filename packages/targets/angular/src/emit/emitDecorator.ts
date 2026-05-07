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
import type { IRComponent, ComponentDecl } from '../../../../core/src/ir/types.js';
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
  componentDecls: readonly ComponentDecl[];
  selfReferenced: boolean;
  componentName: string;
}): string {
  const items: string[] = [];
  if (opts.hasSlots) items.push('NgTemplateOutlet');
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
  const indentedTemplate = opts.template
    .split('\n')
    .map((l) => (l.length > 0 ? '    ' + l : l))
    .join('\n');
  lines.push(`  template: \``);
  lines.push(indentedTemplate);
  lines.push(`  \`,`);
  if (opts.stylesArrayBody.length > 0) {
    lines.push(`  styles: [\``);
    const indentedStyles = opts.stylesArrayBody
      .split('\n')
      .map((l) => (l.length > 0 ? '    ' + l : l))
      .join('\n');
    lines.push(indentedStyles);
    lines.push(`  \`],`);
  }
  lines.push('})');

  return lines.join('\n');
}
