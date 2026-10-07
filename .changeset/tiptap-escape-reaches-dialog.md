---
"@rozie-ui/tiptap-react": patch
"@rozie-ui/tiptap-vue": patch
"@rozie-ui/tiptap-svelte": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/tiptap-lit": patch
---

Escape pressed in the editor now reaches a surrounding native `<dialog>` (rozie Dialog included), which closes as it does from any other field. ProseMirror prevents the default of every Escape keydown, handled or not, and that kept the dialog from getting `cancel` while focus was in the editor. An Escape that nothing in the editor handled now keeps its default. An Escape that an extension shortcut or your own `editorProps.handleKeyDown` handles is still prevented — return `true` for Escape from `handleKeyDown` to keep the old behaviour.
