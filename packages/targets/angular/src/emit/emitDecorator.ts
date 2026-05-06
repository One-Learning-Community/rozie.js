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
import type { IRComponent } from '../../../../core/src/ir/types.js';
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
 * `[NgTemplateOutlet, FormsModule]` or empty string when no imports needed.
 */
function buildDecoratorImportsList(opts: { hasSlots: boolean; hasNgModel: boolean }): string {
  const items: string[] = [];
  if (opts.hasSlots) items.push('NgTemplateOutlet');
  if (opts.hasNgModel) items.push('FormsModule');
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
