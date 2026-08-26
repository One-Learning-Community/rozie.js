---
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/rete-angular": patch
---

`<NodeType>` can now set the box size for every node of a type, and its min/max props
actually constrain what renders.

Two new props, `width` and `height`. A type that declares them renders every one of its
nodes at that size, so a node no longer changes shape as its `#body` content changes —
the design-consistency knob for graphs where node data varies in length.

And `minWidth` / `maxWidth` / `minHeight` / `maxHeight` now clamp the **rendered** box
whatever its size came from. They previously bounded only a resize drag: a
`<NodeType maxWidth="240">` whose body rendered 600px of content still rendered 600px
wide, and on a type without `resizable` they did nothing at all. If you set them expecting
them to hold, they now do.

How the three sizes resolve, most specific first:

```
instance node.width  →  type width  →  auto
```

…and the min/max clamp applies to whichever won. A node's own `width` in the bound graph —
what a `resizable` corner-drag persists — still beats the type's. An explicit width also
lowers the default 140px node floor, so `:width="120"` renders 120.

Two consequences worth knowing:

- **Double-clicking a resize handle now resets to the type's width**, not to auto, when the
  type declares one. "Reset" means back to the type default; with no type width it resets
  to auto exactly as before.
- **Nodes sitting at the minimum width render 2px narrower.** Node boxes are now
  `box-sizing: border-box`, so `:width="240"` means 240px rendered rather than 240 plus the
  borders — and the same correction applies to the built-in 140px floor, which used to
  render as 142. Cosmetic, but visible if you have pixel-tuned around it.

Nothing here is opt-out and no existing prop was removed; a `<NodeType>` that declares no
sizing props behaves exactly as before.
