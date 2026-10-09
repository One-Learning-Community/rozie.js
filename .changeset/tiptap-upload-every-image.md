---
"@rozie-ui/tiptap-react": patch
"@rozie-ui/tiptap-vue": patch
"@rozie-ui/tiptap-svelte": patch
"@rozie-ui/tiptap-angular": patch
"@rozie-ui/tiptap-solid": patch
"@rozie-ui/tiptap-lit": patch
---

Pasting or dropping several image files into an editor with `uploadImage` now uploads and inserts every one of them; only the first used to be handled. `uploadImage` is called once per image file, all at once. It may resolve to a URL string, as before, or to `{ src, alt }` to set the image's alt text. Each image is inserted as soon as its own upload finishes, in file order, and all of them go into the place they were pasted or dropped, the same list item or blockquote included, even if the document changed while the uploads ran. A slow upload does not hold back the others, and one that fails is skipped. The image used to stay selected, so the next key you typed replaced it; now the caret is moved after the last inserted image, but only if you have not moved it or typed in the meantime, and inserting an image never focuses the editor. Dropping image files no longer lets the browser open the file when the image extension could not be loaded. On Lit the paste and drop handlers were handed to ProseMirror without their component instance, so upload could not work there; they now run.
