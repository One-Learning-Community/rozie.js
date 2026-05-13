/**
 * rewriteTemplateExpression.ts — P1 stub for in-template expression rewriting.
 *
 * P2 rewrites `$props.foo`/`$data.foo`/etc. references inside `${...}`
 * interpolation expressions to the Lit class-body equivalents
 * (`this.foo` / `this._foo.value`).
 *
 * @experimental — shape may change before v1.0
 */

export function rewriteTemplateExpression(expr: string): string {
  // P1 stub — identity. P2 wires the @babel/parser parseExpression + traverse.
  return expr;
}
