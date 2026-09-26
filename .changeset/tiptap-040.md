---
"@rozie-ui/tiptap-react": minor
"@rozie-ui/tiptap-vue": minor
"@rozie-ui/tiptap-svelte": minor
"@rozie-ui/tiptap-solid": minor
"@rozie-ui/tiptap-lit": minor
"@rozie-ui/tiptap-angular": minor
---

Two findings from dogfooding, both consumer-visible on install and on construction timing.

**BREAKING — `@tiptap/extension-bubble-menu` is now a required peer dependency, not
optional.** The built-in link editor is a `BubbleMenu` on every editor, unconditionally, so
declaring it optional was never accurate — a consumer who never installed it simply never
noticed until they hit the link-editor path. If you don't already have it installed:

```
npm install @tiptap/extension-bubble-menu
```

**`character-count`, `image`, and `floating-menu` extension peers are now lazy-loaded, only
when their feature is actually used**, instead of being statically imported by every leaf
regardless of whether the consumer installed them. `@tiptap/extension-character-count` loads
only when `maxLength` (or the `#count` slot) is used; `@tiptap/extension-image` only when
`uploadImage` is used; `@tiptap/extension-floating-menu` only when the `floatingMenu` slot is
used. Declaring these peers `peerDependenciesMeta.optional: true` is now actually true — you may
drop whichever of the three you don't use.

**New event: `ready`.** Fired once per mount, on both the synchronous and the (new) lazy
construction path, with the live `Editor` instance as its payload. **If your component uses
`maxLength`, `uploadImage`, or a `floatingMenu` slot, construction is now asynchronous** — use
`ready` (`onReady` / `@ready`) to know when calling a handle verb like `focusEditor()` will
actually work, rather than an arbitrary delay. With none of the three lazy features in use, the
editor is still constructed synchronously at mount, exactly as before. `ready`'s payload is typed
`unknown`, matching every other emitted event today.

**`tiptap-vue` — Vue's `inherit-attrs`/`inherit-listeners` opt-out now applies** (see the
`@rozie/core` changeset in this same release for the underlying emitter fix): undeclared
attributes and listeners no longer fall through onto `tiptap-vue`'s wrapper element, matching the
other five targets. This is a **behaviour change** if you were relying on that fallthrough on Vue
specifically.

**Solid packaging.** `@rozie-ui/tiptap-solid` ships the same compiled-JS-by-default,
JSX-under-the-`solid`-condition packaging shape as every other published Solid leaf this release
— see the dedicated Solid packaging changeset for the full description. No API change.

Docs updated: the install line now lists all four required peers plus the three optional ones
(it previously omitted `@tiptap/extensions` and `bubble-menu` and claimed both menu peers were
optional).
