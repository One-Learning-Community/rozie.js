---
"@rozie-ui/tiptap-react": patch
"@rozie-ui/tiptap-vue": patch
"@rozie-ui/tiptap-svelte": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/tiptap-lit": patch
---

Pasting or dropping several image files into an editor with `uploadImage` now uploads and inserts every one of them, in file order; only the first used to be handled. `uploadImage` is now called once per image file. It may resolve to a URL string, as before, or to `{ src, alt }` to set the image's alt text. The caret is placed after the inserted image (after the last one when there are several), where the image used to stay selected so the next key you typed replaced it. Images land where they were pasted or dropped even if the document changed while the upload ran, and an upload that fails no longer stops the others. On Lit the paste and drop handlers were handed to ProseMirror without their component instance, so upload could not work there; they now run.
