---
"@rozie/core": patch
---

A `$emit('name', …)` written only in `<template>` or only in a `<listeners>` handler is now declared as an event on all six targets. Before, the compiler only collected event names from `<script>`, so a template-only or listeners-only emit lowered its call site without declaring the event:

- React and Solid had no `on<Event>` prop in the generated props interface (or in the React `.d.ts`).
- Vue had no `defineEmits`, so `emit` was undefined and clicking the element threw.
- Svelte never declared or destructured the `on<event>` callback prop, so the handler threw a ReferenceError.
- Angular had no `output()` field for the event, which is an AOT compile error.

Lit was already correct: it dispatches a `CustomEvent` at the call site and needs no declaration.

Angular now types an event as `output<unknown>()` when any template or listeners call passes it a payload, and as `output<void>()` otherwise, matching how script-emitted events were already typed.

The collected order is `<script>` names first, then `<template>` names in document order, then `<listeners>` names, so every existing component's event order is unchanged. A component with no `<script>` block now gets its template events too. The collision checks that read the event list (ROZ148 for a prop named `on<Event>`, ROZ142 / ROZ981 for reserved and normalization collisions, and the `$expose` name check) now see template and listeners events as well.
