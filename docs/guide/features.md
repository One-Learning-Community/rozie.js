# Features

Rozie tries to be the syntax a Vue developer would design if they wanted React, Svelte, Angular, Solid, and Lit output without losing the SFC ergonomics. The full feature reference lives on the seven pages below; each blurb lists what its page covers.

| Page | What it covers |
| --- | --- |
| [Templates & events](/guide/templates-and-events) | Parameterized event modifiers (`.debounce(300)`, `.outside($refs.x)`) and the built-in modifier table, custom modifiers via `registerModifier`, the `<listeners>` block for window/document wiring, `r-match` / `r-case` / `r-default` switch conditionals (comma alternatives, predicate mode, branch-swap identity, error boundaries), safe non-primitive interpolation (portable JSON, the nullish attribute drop, the `safeInterpolation` switch, ROZ978), and the smaller wins (`r-*` naming, rich inline handlers, setup-once reactivity, source maps, optional TypeScript) |
| [Props, state & two-way binding](/guide/props-and-two-way) | `<props>` / `<data>` with real JS expressions and the literal `</script>` escape rule, `required: true`, `model: true` two-way binding (reading via `$props`, writing via `$model`, the Angular `ControlValueAccessor` contract), and the `r-model` modifiers `.lazy` / `.number` / `.trim` |
| [Reactivity & lifecycle](/guide/reactivity) | `$onMount` returning a teardown, `$computed` derived values (bare reads, the plain-function alternative), `$memo` reference-keyed memoization, `$watch` (lazy default, `{ immediate: true }`, eager member-chain getters, reference-equality change detection), and `$refs` with the `$onMount` + `r-if` pattern |
| [Composition: slots, fallthrough, context, handles](/guide/composition) | The `<components>` block and self-recursion, slots with scoped params (ROZ127), `r-bind` / `r-on` fallthrough with `$attrs` / `$listeners` and the `inherit-attrs` / `inherit-listeners` flags, `$expose` imperative handles (and how consumers obtain them), `$provide` / `$inject` cross-component context, and typed `.rozie` imports |
| [Engine-wrapper toolkit](/guide/engine-wrappers) | The sigils for DOM a vanilla-JS engine owns: `$classSelector`, `r-external` + `$reconcileAfterDomMutation`, `$slotted`, `r-portal` (with the Lit theming hazard), `$restoreFocus`, `$snapshot`, and `$clone` |
| [Styling & scoped CSS](/guide/styling) | The `:root { }` escape hatch (flat custom properties and the nested engine-DOM form), why `:global()` is forbidden (ROZ128), `:deep()` cross-component reach, `::part()` across Lit shadow boundaries, and `<style lang="scss">` |
| [Keyboard navigation (`r-keynav`)](/guide/r-keynav) | Compiler-owned keyboard navigation: the two focus models, modifiers, keyboard maps, the accessibility split, active-item styling, grid mode and multi-group scoping, and its diagnostics |

## Next

See [Examples](/examples/) for the full gallery of reference components, each with byte-verbatim output across all six targets, plus a feature index for jumping straight to whichever idiom you want to see in action.

Hit a `ROZxxx` code in your terminal? The [Diagnostics reference](/reference/diagnostics) lists every diagnostic code — generated from the compiler source, so it's always current — with its severity and cause.
