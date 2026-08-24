---
"@rozie-ui/rete-react": patch
"@rozie-ui/rete-vue": patch
"@rozie-ui/rete-svelte": patch
"@rozie-ui/rete-solid": patch
"@rozie-ui/rete-lit": patch
"@rozie-ui/rete-angular": patch
---

`<FlowCanvas>` no longer ships the auto-arrange engine to consumers who never arrange.

`rete-auto-arrange-plugin` and `elkjs` have always been declared optional peers, but the
import was static and the plugin was constructed at mount, so `elk.bundled.js` — 1.5 MB of
GWT-transpiled Java in one opaque non-tree-shakeable blob — was resolved into the main chunk
of every `<FlowCanvas>` consumer. Optional to install is not the same as optional to ship.

`autoArrange()` now loads the engine with a dynamic import on its first call and reuses it
afterwards. No API change: the verb was already `async` and already a no-op before mount.

What changes for you:

- If you never call `autoArrange()`, the engine and its elkjs payload never enter your bundle.
- If you do, the first call additionally pays a chunk fetch; later calls are as before.
- If the optional peers are not installed, the returned promise now rejects instead of silently
  doing nothing — you asked to arrange, so a rejection is the honest answer.

Also fixed alongside it: the teardown now nulls the area handle after destroying it. Every
imperative verb already opened with an `if (!area) return` guard, but that only ever caught
the before-mount window — after unmount the handle stayed truthy and pointed at a destroyed
scope. Calling a verb on an unmounted canvas is now the no-op the guards always implied.
