# Examples

Seven reference components, each shipped with byte-verbatim output across all six targets (Vue, React, Svelte, Angular, Solid, Lit). Pick whichever lines up with the feature you're trying to evaluate.

## By complexity

- [Counter](/examples/counter) — `<props>` with `model: true`, `<data>`, `$computed`, template event handlers. The smallest example that's still interesting.
- [SearchInput](/examples/search-input) — `.debounce(300)` modifier, `$emit`, `$onMount` with a teardown return, `r-if` / `r-else`, `$refs`. Single-component scope with rich event-handling.
- [Modal](/examples/modal) — `<listeners>` block with side-effect handlers (body-scroll lock, focus), `.self` modifier on a backdrop click, multiple colocated lifecycle hooks, slots with scoped params, `<components>` embed. The heaviest single-file example.
- [Dropdown](/examples/dropdown) — `.outside(...$refs)`, `.throttle(100).passive`, reactive `when` predicates, named slot with scoped params. The marquee `<listeners>` showcase.
- [TreeNode](/examples/tree-node) — self-recursion via `<components>` self-import; minimal `<props>`-only component. Demonstrates the per-target self-reference idioms.
- [Card (with CardHeader)](/examples/card) — wrapper-pair composition. Two `.rozie` files; shows the kebab/camel prop bridge and the per-target child-component import + selector rewrite (notably Angular's `<rozie-card-header>`).
- [TodoList](/examples/todo-list) — `r-for` with `:key`, multiple `$emit` channels, named + default slots with per-item scoped params, fallback content, `r-if` / `r-else` empty state. Calls out the documented React render-prop divergence in slot consumer ergonomics.

## By feature

If you're looking for a specific authoring feature:

| Feature | See |
| --- | --- |
| `model: true` two-way binding | [Counter](/examples/counter), [Modal](/examples/modal), [Dropdown](/examples/dropdown), [TodoList](/examples/todo-list) |
| `$computed` | [Counter](/examples/counter), [SearchInput](/examples/search-input), [TodoList](/examples/todo-list) |
| `$emit` | [SearchInput](/examples/search-input), [Modal](/examples/modal), [TodoList](/examples/todo-list) |
| `$refs` in script | [SearchInput](/examples/search-input), [Modal](/examples/modal), [Dropdown](/examples/dropdown) |
| `$onMount` with teardown return | [SearchInput](/examples/search-input), [Modal](/examples/modal) |
| `$onMount` / `$onUnmount` colocated pair | [Modal](/examples/modal) |
| Multiple `$onMount` hooks | [Modal](/examples/modal), [Dropdown](/examples/dropdown) |
| `<listeners>` block with reactive `when` | [Modal](/examples/modal), [Dropdown](/examples/dropdown) |
| `.debounce(ms)` modifier | [SearchInput](/examples/search-input) |
| `.throttle(ms).passive` modifier chain | [Dropdown](/examples/dropdown) |
| `.outside(...$refs)` modifier | [Dropdown](/examples/dropdown) |
| `.self` modifier | [Modal](/examples/modal) |
| `.enter` / `.escape` key filters | [SearchInput](/examples/search-input) |
| `<components>` block | [Modal](/examples/modal), [Card](/examples/card), [TreeNode](/examples/tree-node) |
| Self-recursion | [TreeNode](/examples/tree-node) |
| `r-for` with `:key` | [TodoList](/examples/todo-list), [TreeNode](/examples/tree-node) |
| `r-if` / `r-else` | [SearchInput](/examples/search-input), [TodoList](/examples/todo-list) |
| `r-model` | [SearchInput](/examples/search-input), [TodoList](/examples/todo-list) |
| Named slots | [Modal](/examples/modal), [Dropdown](/examples/dropdown), [TodoList](/examples/todo-list) |
| Default slot with scoped params | [Modal](/examples/modal), [Dropdown](/examples/dropdown), [TodoList](/examples/todo-list) |
| Slot fallback content | [TodoList](/examples/todo-list) |
| `:root { }` global escape hatch in `<style>` | [Modal](/examples/modal), [Dropdown](/examples/dropdown) |

For the design rationale behind each of these, see [Features & design choices](/guide/features).
