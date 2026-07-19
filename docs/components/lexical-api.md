# API reference

The `<LexicalEditor>` shell surface. The table below is generated **live from the `LexicalEditor.rozie` IR** on every docs build, so it can never drift from the compiled output. For the compositional model (plugin children, the `$inject` contract), the toolbar, and the decorator node see the [showcase](/components/lexical); for the per-framework consumption code see the [usage page](/components/lexical-usage).

## Props

The shell's props are the editor-construction surface — extra `nodes`, the Lexical `namespace`, the host `ariaLabel`, and the `theme` class map. Behavior (undo, lists, links, formatting) is added by nesting plugin children, not by props.

```rozie-props LexicalEditor
```

## Plugins & toolbar

The plugin and toolbar components are **composition**, not props — nest them as children of `<LexicalEditor>` and they `$inject` the shared editor. See the [showcase's Plugins section](/components/lexical#plugins) for the full list (`RichTextPlugin` / `HistoryPlugin` / `ListPlugin` / `LinkPlugin`) and the [toolbar section](/components/lexical#the-selection-reading-toolbar). Custom children join the same editor via the [`$inject('rozie-lexical-editor')` contract](/components/lexical#inject-contract).

## See also

- [Lexical — showcase & API](/components/lexical) — install, composition, the plugin list, the toolbar, and the scope/posture notes.
- [Lexical libraries comparison](/components/lexical-comparison) — how `@rozie-ui/lexical` stacks up against the per-framework wrappers.
- [Decorator node authoring recipe](/components/lexical-recipe-decorator) — author a custom node + its per-target mount bridge.
