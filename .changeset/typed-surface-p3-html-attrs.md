---
"@rozie/core": minor
"@rozie-ui/captcha-react": patch
"@rozie-ui/captcha-solid": patch
"@rozie-ui/captcha-svelte": minor
"@rozie-ui/combobox-react": patch
"@rozie-ui/combobox-solid": patch
"@rozie-ui/combobox-svelte": minor
"@rozie-ui/cropper-react": patch
"@rozie-ui/cropper-solid": patch
"@rozie-ui/cropper-svelte": minor
"@rozie-ui/date-picker-react": patch
"@rozie-ui/date-picker-solid": patch
"@rozie-ui/date-picker-svelte": minor
"@rozie-ui/dialog-react": patch
"@rozie-ui/dialog-solid": patch
"@rozie-ui/dialog-svelte": minor
"@rozie-ui/embla-react": patch
"@rozie-ui/embla-solid": patch
"@rozie-ui/embla-svelte": minor
"@rozie-ui/flatpickr-react": patch
"@rozie-ui/flatpickr-solid": patch
"@rozie-ui/flatpickr-svelte": minor
"@rozie-ui/lexical-react": patch
"@rozie-ui/lexical-solid": patch
"@rozie-ui/lexical-svelte": minor
"@rozie-ui/listbox-react": patch
"@rozie-ui/listbox-solid": patch
"@rozie-ui/listbox-svelte": minor
"@rozie-ui/maplibre-react": patch
"@rozie-ui/maplibre-solid": patch
"@rozie-ui/maplibre-svelte": minor
"@rozie-ui/number-field-react": patch
"@rozie-ui/number-field-solid": patch
"@rozie-ui/number-field-svelte": minor
"@rozie-ui/otp-react": patch
"@rozie-ui/otp-solid": patch
"@rozie-ui/otp-svelte": minor
"@rozie-ui/pagination-react": patch
"@rozie-ui/pagination-solid": patch
"@rozie-ui/pagination-svelte": minor
"@rozie-ui/pdf-react": patch
"@rozie-ui/pdf-solid": patch
"@rozie-ui/pdf-svelte": minor
"@rozie-ui/popover-react": patch
"@rozie-ui/popover-solid": patch
"@rozie-ui/popover-svelte": minor
"@rozie-ui/resizable-react": patch
"@rozie-ui/resizable-solid": patch
"@rozie-ui/resizable-svelte": minor
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-svelte": minor
"@rozie-ui/slider-react": patch
"@rozie-ui/slider-solid": patch
"@rozie-ui/slider-svelte": minor
"@rozie-ui/sortable-list-react": patch
"@rozie-ui/sortable-list-solid": patch
"@rozie-ui/sortable-list-svelte": minor
"@rozie-ui/switch-react": patch
"@rozie-ui/switch-solid": patch
"@rozie-ui/switch-svelte": minor
"@rozie-ui/tags-react": patch
"@rozie-ui/tags-solid": patch
"@rozie-ui/tags-svelte": minor
"@rozie-ui/toast-react": patch
"@rozie-ui/toast-solid": patch
"@rozie-ui/toast-svelte": minor
"@rozie-ui/wavesurfer-react": patch
"@rozie-ui/wavesurfer-solid": patch
"@rozie-ui/wavesurfer-svelte": minor
---

Props types now accept the root element's HTML attributes when a component passes attributes through to a single root element (typed public surface, phase 3).

- React: `interface XProps extends Omit<React.ComponentPropsWithoutRef<'<tag>'>, …>` — `className`, `style`, `id`, `aria-*`, `data-*`, element-specific attributes (`disabled` on a `<button>` root, …) and DOM listeners typecheck without a cast.
- Solid: the same with `ComponentProps<'<tag>'>`.
- Svelte: `interface Props extends Omit<SvelteHTMLElements['<tag>'], …>` replaces `[key: string]: unknown`. **This is stricter:** an attribute the root element does not support, which the old index signature accepted, is now a type error.
- The component's own props win on a name collision. `children` stays rejected when the component has no default slot, as do the content-replacing `dangerouslySetInnerHTML` (React) and `innerHTML` / `innerText` / `textContent` (Solid).
- An `<svg>` root gets the SVG element's attributes (`fill`, `stroke`, `viewBox`, …). Any other non-HTML root (a custom element) gets the generic `HTMLAttributes<HTMLElement>` on React and Solid, and Svelte's permissive custom-element entry.
- Components with `inherit-attrs="false"`, an `r-if` root or a component root are unchanged. Vue, Angular and Lit are unchanged; they already accepted pass-through attributes.

The `.d.rozie.ts` sidecars (React, Solid, Svelte) carry the same types. Types only — no runtime change.
