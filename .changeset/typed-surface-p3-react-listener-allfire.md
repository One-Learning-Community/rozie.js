---
"@rozie/core": patch
"@rozie/runtime-react": minor
"@rozie-ui/dialog-react": patch
"@rozie-ui/pagination-react": patch
"@rozie-ui/switch-react": patch
"@rozie-ui/toast-react": patch
---

React: a consumer's DOM listener now fires alongside the component's own handler when the component's root element binds its own `@event` and passes attributes through (the default). Before, the root emitted `<el {...attrs} onClick={own}>`, and JSX's last-wins rule silently dropped the consumer's `onClick` — while Vue, Svelte, Solid and Lit already fired both. The root now emits `{...mergeListeners({ onClick: own }, pickListeners(attrs))}` after its merged `className`, so both handlers fire (own first) and the merged class is never re-applied.

`@rozie/runtime-react` gains `pickListeners`, the React port of the Solid helper: it filters the pass-through bucket down to function-valued `on*` keys before the merge.
