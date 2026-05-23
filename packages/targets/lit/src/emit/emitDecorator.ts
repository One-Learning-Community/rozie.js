/**
 * emitDecorator.ts — P1 stub for `@customElement(tagName)` decorator emission.
 *
 * P2 emits the `@customElement('rozie-<kebab-name>')` decorator above the class,
 * plus the trailing `customElements.define(tagName, ClassName)` registration.
 *
 * Per the plan: the `toKebabCase(name)` helper is exported VERBATIM from
 * packages/targets/angular/src/emit/emitDecorator.ts:23-28 — same algorithm
 * across both targets (tag names are derived identically: `rozie-<kebab>`).
 *
 * @experimental — shape may change before v1.0
 */

/** Convert `Counter` / `TodoList` / `SearchInput` → `rozie-counter` / `rozie-todo-list` / `rozie-search-input`. */
export function toKebabCase(name: string): string {
  // Insert hyphen at every word boundary, then lowercase. Two boundary forms:
  //   1. lowercase/digit → uppercase           (`Counter` → `counter`, `TodoList` → `todo-list`)
  //   2. uppercase → uppercase-then-lowercase  (`URLPath` → `url-path`, `ROnProbe` → `r-on-probe`)
  // Without (2), adjacent-uppercase runs collapse: `ROnProbe` mis-emits as `ron-probe`,
  // mismatching the harness-expected custom-element tag `rozie-r-on-probe`.
  const hyphenated = name.replace(/([a-z0-9]|[A-Z](?=[A-Z][a-z]))([A-Z])/g, '$1-$2');
  return hyphenated.toLowerCase();
}

/** Compute the canonical custom-element tag name from a Rozie component name. */
export function emitTagName(componentName: string): string {
  return `rozie-${toKebabCase(componentName)}`;
}
