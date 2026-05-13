/**
 * emitRModel — Lit `r-model` form-input two-way binding (Plan 06.4-02 Task 1).
 *
 * Per Claude's Discretion r-model bullet: emits the pair
 *
 *   .value=${expr} @input=${(e) => expr = (e.target as HTMLInputElement).value}
 *
 * for form inputs (input/textarea/select). For checkboxes, the caller swaps
 * `.value`/`.value` for `.checked`/`.checked`.
 *
 * @experimental — shape may change before v1.0
 */

export interface EmitRModelOpts {
  /** Already-rewritten target expression (e.g., `this._query.value`). */
  bindingExpr: string;
  /** Form-input tag — 'input' (default), 'textarea', or 'select'. */
  tagName?: string;
  /** Optional input type attribute (used to switch to `.checked` for checkboxes). */
  inputType?: string;
}

export function emitRModel(opts: EmitRModelOpts): string {
  const isCheckbox =
    opts.inputType === 'checkbox' || opts.inputType === 'radio';
  const prop = isCheckbox ? 'checked' : 'value';
  return [
    `.${prop}=\${${opts.bindingExpr}}`,
    `@input=\${(e) => ${opts.bindingExpr} = (e.target as HTMLInputElement).${prop}}`,
  ].join(' ');
}
