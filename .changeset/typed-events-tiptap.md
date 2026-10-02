---
"@rozie-ui/tiptap-react": patch
"@rozie-ui/tiptap-vue": patch
"@rozie-ui/tiptap-svelte": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/tiptap-lit": patch
---

TipTap: every event handler now has a real payload type instead of `(...args: any[]) => void`. `update` receives the HTML `string`, `ready` receives the live `Editor` (from `@tiptap/core`), `error` receives `TipTapErrorPayload` (`{ extension: 'floatingMenu' | 'image' | 'count'; error: unknown }`), and `selectionUpdate`, `focus` and `blur` take no argument. `TipTapErrorPayload` is exported from the package entry. A handler written against a different payload shape may now be rejected by the type checker.
