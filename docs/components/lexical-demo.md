---
title: Lexical — live demo
---

<script setup lang="ts">
import LexicalEditor, {
  Toolbar,
  HistoryPlugin,
  ListPlugin,
  LinkPlugin,
} from '@rozie-ui/lexical-vue';
</script>

# Lexical — live demo

This is the **real `@rozie-ui/lexical-vue` package** running on this page (VitePress is itself a Vue app). Type in the editor, select some text and hit the toolbar buttons — **Bold**, *Italic*, • List, and Link — and watch each button light up as the caret moves through matching formatting. Everything below is driven by the same `.rozie` sources that compile to all five frameworks.

<ClientOnly>
<div class="lexical-live">
  <div class="lexical-live__stage">
    <LexicalEditor aria-label="Demo editor">
      <Toolbar />
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
    </LexicalEditor>
  </div>
</div>
</ClientOnly>

The editor is composed the way you'd compose it in your own app: a `<LexicalEditor>` shell wrapping a `<Toolbar />` plus the `HistoryPlugin` / `ListPlugin` / `LinkPlugin` children. Each child `$inject`s the **same** shared editor instance the shell provides — no editor handle is prop-drilled. The shell registers the RichText baseline itself, so formatting and undo/redo work out of the box; the list and link buttons take effect because their plugins are nested. See the [full API](/components/lexical) for the composition model, the plugin list, and the `$inject` contract for custom children.

## One source, five outputs

You author the editor shell **once** as a `.rozie` file:

<<< ../../packages/ui/lexical/src/LexicalEditor.rozie{html}[LexicalEditor.rozie — the single source]

…and Rozie compiles it to five idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/lexical-{react,vue,svelte,angular,solid}`):

::: code-group

<<< ../../packages/ui/lexical/packages/react/src/LexicalEditor.tsx[React]
<<< ../../packages/ui/lexical/packages/vue/src/LexicalEditor.vue[Vue]
<<< ../../packages/ui/lexical/packages/svelte/src/LexicalEditor.svelte[Svelte]
<<< ../../packages/ui/lexical/packages/angular/src/LexicalEditor.ts[Angular]
<<< ../../packages/ui/lexical/packages/solid/src/LexicalEditor.tsx[Solid]

:::

Each is a real, idiomatic component for its framework — React hooks, Vue `<script setup>`, Svelte 5 runes, an Angular standalone component, and a Solid component. Same props, same `$provide`/`$inject` editor-sharing contract, same plugins, all from the one source above. (Lit is v1.1 — see the [roadmap](/components/lexical#roadmap-staging).)

## See also

- [Lexical — showcase & API](/components/lexical) — install, composition, the plugin list, the toolbar, and the decorator node.
- [Lexical libraries comparison](/components/lexical-comparison) — how `@rozie-ui/lexical` stacks up against the per-framework wrappers.
- [Decorator node authoring recipe](/components/lexical-recipe-decorator) — author a custom node + its per-target mount bridge.

<style scoped>
.lexical-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.lexical-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  overflow: hidden;
  padding: 0.5rem;
}
</style>
