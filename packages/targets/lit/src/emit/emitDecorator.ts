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
  // Insert hyphen before any uppercase letter that follows a lowercase letter
  // or a digit. Then lowercase the whole thing.
  const hyphenated = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2');
  return hyphenated.toLowerCase();
}

/** Compute the canonical custom-element tag name from a Rozie component name. */
export function emitTagName(componentName: string): string {
  return `rozie-${toKebabCase(componentName)}`;
}
