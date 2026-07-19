# Recipe — authoring a custom decorator node

Lexical's marquee extensibility feature is the **`DecoratorNode`**: a node whose visual representation is a framework component rendered *into* the document — a `@mention` chip, an embed, a poll, an inline reference card. `@rozie-ui/lexical` ships **one reference decorator node** (the `@mention` chip) and the infrastructure to render it across all six targets (including Lit through an open shadow root). This page is the recipe for authoring **your own** decorator node.

The pattern has **two halves**, and the split is the whole trick to making it cross-framework:

1. A **framework-neutral `DecoratorNode`** whose `decorate()` returns a plain `{ component, props }` **descriptor** — it names no framework.
2. A **per-target mount bridge** — a small, **hand-written** module that subscribes to Lexical's decorator map and renders the descriptor with the target framework's own render primitive.

::: warning The bridge is hand-written, not compiler-synthesized
Rozie does **not** synthesize the mount bridge (D-06 / REQ-39). It is a deliberate **per-target escape hatch** — the same principle as portal slots. You author roughly one ~30-line bridge per framework you support; `codegen.mjs` vendors the right one into each leaf verbatim (never routed through the compiler). This is by design: rendering a native component imperatively into an engine-owned DOM node is exactly the seam where each framework's API genuinely differs, and a hand-written bridge is clearer and safer than a synthesized one.
:::

## Part 1 — the neutral `DecoratorNode`

The node is plain-vanilla TypeScript (a `.ts` module, not a `.rozie`). It extends `DecoratorNode<Descriptor>` and its `decorate()` returns a descriptor that names **no** framework — `component` is a neutral registry key, `props` is plain data:

```ts
import { DecoratorNode, type NodeKey, type SerializedLexicalNode } from 'lexical';

// The framework-NEUTRAL descriptor every per-target bridge consumes.
export interface MentionDescriptor {
  component: 'mention';
  props: { label: string; id: string | null };
}

export class MentionNode extends DecoratorNode<MentionDescriptor> {
  __label: string;
  __id: string | null;

  static override getType() { return 'mention'; }
  static override clone(n: MentionNode) { return new MentionNode(n.__label, n.__id, n.__key); }

  constructor(label: string, id: string | null = null, key?: NodeKey) {
    super(key);
    this.__label = label;
    this.__id = id;
  }

  // The inline host span Lexical inserts into the document. The bridge renders the
  // framework-native pill INTO this element; it carries no visible text itself.
  override createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'rozie-mention-host';
    span.setAttribute('data-mention-host', '');
    return span;
  }

  override updateDOM() { return false; }
  override isInline() { return true; }

  // The cross-target seam: a plain descriptor naming no framework.
  override decorate(): MentionDescriptor {
    return { component: 'mention', props: { label: this.__label, id: this.__id } };
  }

  // Serialization so the node survives copy/paste + editor-state (de)serialization.
  static override importJSON(json: any): MentionNode {
    return new MentionNode(json.label, json.id ?? null);
  }
  override exportJSON() {
    return { ...super.exportJSON(), type: 'mention', version: 1, label: this.__label, id: this.__id };
  }
}

// Ordinary JS identifiers in a plain .ts — the Svelte `$`-reservation applies only to
// `$`-prefixed NAMED imports inside a `.rozie`, so these helpers are fine here.
export function $createMentionNode(label: string, id: string | null = null) {
  return new MentionNode(label, id);
}
export function $isMentionNode(node: unknown): node is MentionNode {
  return node instanceof MentionNode;
}
```

Two things make this node cross-target-safe:

- **`decorate()` returns data, not a component.** It never imports React / Vue / Solid / Svelte / Angular. One node definition feeds every bridge.
- **`createDOM()` returns an empty host span.** The bridge owns the content — and always renders it as **escaped text**, never as HTML (see the [safety rule](#the-safe-text-rendering-rule)).

## Part 2 — the per-target mount bridge

Each target gets one `mountDecorators(editor): () => void`. It calls `editor.registerDecoratorListener<Descriptor>(...)`, and for every live decorator key it renders the native pill into `editor.getElementByKey(key)`, tracking mounted keys so it can **tear down removed decorators** (or you leak a framework root per deleted chip). Here is the React bridge in full — the shape is ~30 lines on every target:

```ts
// The REACT bridge — a hand-written escape hatch, vendored verbatim into the leaf.
import { createElement, type FunctionComponent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LexicalEditor } from 'lexical';
import type { MentionDescriptor } from './MentionNode';

// The label is a React TEXT child — React escapes it; NEVER dangerouslySetInnerHTML.
const MentionChip: FunctionComponent<MentionDescriptor['props']> = (props) =>
  createElement('span', { className: 'rozie-mention', 'data-mention-id': props.id ?? undefined }, '@' + props.label);

export function mountDecorators(editor: LexicalEditor): () => void {
  const roots = new Map<string, Root>();

  return editor.registerDecoratorListener<MentionDescriptor>((decorators) => {
    const liveKeys = new Set(Object.keys(decorators));

    // Render / update every live decorator into its host node.
    for (const key of liveKeys) {
      const el = editor.getElementByKey(key);
      if (!el) continue;
      let root = roots.get(key);
      if (!root) { root = createRoot(el); roots.set(key, root); }
      root.render(createElement(MentionChip, decorators[key].props));
    }

    // Tear down decorators that no longer exist (no leaked roots).
    for (const key of [...roots.keys()]) {
      if (liveKeys.has(key)) continue;
      roots.get(key)!.unmount();
      roots.delete(key);
    }
  });
}
```

The **only** thing that changes per target is the render primitive — the listener body, the key bookkeeping, and the teardown are identical:

| Target | Render primitive (native) | Teardown |
| --- | --- | --- |
| **React** | `createRoot(el).render(createElement(Chip, props))` (`react-dom/client`) | `root.unmount()` |
| **Vue** | `render(h('span', …, '@' + label), el)` (`vue`) | `render(null, el)` |
| **Solid** | `render(() => domNode, el)` (`solid-js/web`) — chip is a `textContent`-escaped DOM node | `dispose()` |
| **Svelte** | `mount(MentionChip, { target: el, props })` (Svelte 5) + a vendored `MentionChip.svelte` sidecar | `unmount(inst)` |
| **Angular** | `createApplication()` → `createComponent(Cmp, { environmentInjector, hostElement })` + `attachView` | `destroy()` |
| **Lit** | ``render(html`<span class="rozie-mention">@${label}</span>`, el)`` (`lit`) — the host lives inside the editor's open shadow root | ``render(nothing, el)`` |

Svelte is the one target that needs a small companion `.svelte` file, because Svelte 5's `mount()` requires a *compiled* component (you cannot render an inline chip authored inside a `.ts`). The other five keep the chip self-contained in the `.ts` bridge. Angular obtains a root injector via `createApplication()` — the only public way to render a standalone component with no existing app — so its chip renders one microtask later (fine for a static pill; zone.js is left to the consumer's app polyfills).

### The safe-text rendering rule {#the-safe-text-rendering-rule}

::: danger Render the descriptor's user data as escaped TEXT — never as HTML
A decorator's `props` typically carry **user-supplied** text (a mention label, an embed title). Every bridge must render that text through its framework's escaping text path — a React child, Vue's `h(...)` text child, `textContent`, Svelte's `{label}`, Angular's `{{ }}`. **Never** route it through `innerHTML` / `dangerouslySetInnerHTML` / `v-html` / `{@html}`. A decorator node is a stored-content injection sink; the text path is the mitigation.
:::

## Part 3 — wiring the node + bridge into the editor

Two small edits in the editor shell tie it together (this is exactly what `LexicalEditor.rozie` does for the built-in `@mention` node):

1. **Register the node class** at editor creation — Lexical requires every node class declared up front:

   ```js
   editor = lexical.createEditor({
     nodes: [/* …built-ins… */, MentionNode, ...$props.nodes],
     // …
   })
   ```

2. **Wire the bridge** and fold its unregister fn into the same `mergeRegister` teardown, so the decorator listener tears down with everything else. It must run **after** `setRootElement` so `getElementByKey` resolves:

   ```js
   editor.setRootElement($refs.rootEl)
   const cleanup = mergeRegister(registerRichText(editor), mountDecorators(editor))
   // …return () => cleanup() in the $onMount teardown
   ```

`codegen.mjs` vendors both files into every leaf: `MentionNode.ts` (shared, neutral) copies verbatim, and the target-matched `mountDecorators.<target>.ts` copies in under the stable name `mountDecorators.ts` — so the single import specifier `./mountDecorators` resolves to a different vendored file per leaf. Neither file is ever routed through the compiler.

To author **your own** node, follow the same three parts: write a neutral `DecoratorNode`, add a bridge branch (or a new bridge) that renders your `component` key, register your node class via the shell's `nodes` prop, and render it with a custom child that inserts your node through `editor.update(() => …)`.

## Lit — the open shadow root target {#lit-the-open-shadow-root-target}

Lit is the **sixth shipped target**. Its bridge is the same shape as the other five (see the table above) — ``render(html`…`, host)`` on mount, ``render(nothing, host)`` on teardown — but the Lit editor hosts the whole editor **inside an open shadow root**, which adds a small set of obligations the light-DOM targets don't carry. The emitted `LexicalEditor` LitElement honors all of them; if you author your own Lit host, honor them too:

- **Open shadow root only** — `mode: 'open'`. Selection across the shadow boundary needs no special handling: Lexical 0.48 resolves it via `Selection.getComposedRanges`. (Closed shadow roots are unsupported.)
- **Theme CSS injected per shadow root** — shadow trees don't inherit document styles, so the editor's theme classes must live inside each root. The emitted host does this via Lit `static styles` (adopted into every shadow root); the `:root { }` global escape hatch additionally routes through `@rozie/runtime-lit`'s `injectGlobalStyles`.
- **`mousedown`-preventDefault toolbar** — same caret-preservation rule as the other targets, applied inside the shadow tree.
- **Browser floor: Chrome 137+ / Firefox 142+ / Safari 17+** — the one parity caveat for the Lit build (`getComposedRanges` is gated on those versions). This is the sibling of the Lit async-context edge; older browsers are out of support for the Lit target specifically. Every other target has no such floor.

A design note on the host: the emitted `LexicalEditor` keeps the `contenteditable` region as a **static element** in its Lit template (attribute bindings only, no child-content expressions) and calls `setRootElement` in `firstUpdated`, so LitElement's `render()` reconciliation never touches the DOM Lexical owns inside it. (This is the one Lit-specific subtlety a naive host gets wrong — putting the editable region under a dynamic template part lets a re-render wipe it.)

## Roadmap / v1.1 staging {#roadmap-v1-1-staging}

All six targets — **React / Vue / Svelte / Angular / Solid / Lit** — plus the `@mention` decorator node and its six per-target bridges are shipping today. The following remain explicitly deferred to **v1.1**, documented here so the current surface is never a surprise:

- **Markdown-shortcuts plugin** — deferred.
- **Tables plugin** — deferred.

For the consumer-facing view of this staging, see the [roadmap on the showcase page](/components/lexical#roadmap-staging) and the [comparison page's staging table](/components/lexical-comparison#staging-v1-0-vs-v1-1).

## Cross-references

- [Lexical — showcase & API](/components/lexical) — the `@mention` node in context + the composition model.
- [`MentionNode.ts` source](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/lexical/src/MentionNode.ts) — the reference neutral decorator node.
- [Lexical libraries comparison](/components/lexical-comparison) — where the decorator bridge sits versus the upstream wrappers.
