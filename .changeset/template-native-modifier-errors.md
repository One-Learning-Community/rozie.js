---
"@rozie/core": patch
---

Template `@event` modifiers `.capture`, `.passive` and `.once` no longer compile to a handler that silently ignores them:

- Solid: all three are now a compile error. They were a warning before, and the handler was bound without the option, so a `.capture` handler ran in the bubble phase.
- React: `.passive` and `.once` on a JSX-prop event are now a compile error. They were a warning before, and a `.once` handler fired every time. `.capture` still compiles to `on<Event>Capture`, and `<input @change>` still takes all three.

Vue and Lit support all three on template events, and Svelte and Angular already rejected them. Put the handler in a `<listener>` (with no `:target` it attaches to the component's root element) to use these modifiers on every target.
