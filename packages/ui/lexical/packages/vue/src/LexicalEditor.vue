<template>

<div class="rozie-lexical" v-bind="$attrs">
  
  <div ref="rootElRef" class="rozie-lexical-content" :contenteditable="true" :aria-label="props.ariaLabel"></div>
  
  <slot></slot>
</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, provide, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Extra Lexical node classes to register at editor creation. Lexical requires every node class to be declared up front, so consumer node extensions are passed here and composed after the built-in RichText/List/Link + `@mention` `MentionNode` set (the reference DecoratorNode is registered by the shell itself; these consumer nodes are composed last so they win).
     */
    nodes?: any[];
    /**
     * The Lexical editor `namespace` (scopes clipboard/collaboration). Falls back to `rozie-lexical` when left empty.
     */
    namespace?: string;
    /**
     * Accessible name (`aria-label`) applied to the contenteditable host. Omitted from the DOM when unset — supply one for a labelled editing region.
     */
    ariaLabel?: string | null;
    /**
     * Lexical `theme` object mapping node/format types to CSS class names. The styling hook for this deliberately-unstyled primitive (D-12) — bring your own design-system classes.
     */
    theme?: Record<string, any>;
  }>(),
  { nodes: () => [], namespace: '', ariaLabel: null, theme: () => ({}) }
);

defineSlots<{
  default(props: {  }): any;
}>();

const rootElRef = ref<HTMLElement>();

// D-05 / REQ-37: the namespace-import form is the ONLY cross-target-safe way to
// use Lexical's `$`-prefixed API. Every `$`-call below is `lexical.$…` (a property
// access), never a bare `$`-identifier — that is what keeps the emitted Svelte
// clean of `dollar_prefix_invalid`.
import * as lexical from 'lexical';
// Non-`$` helpers use ordinary named imports (unaffected by the Svelte reservation).
import { registerRichText, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { mergeRegister } from '@lexical/utils';
// The reference @mention DecoratorNode (D-07) + the per-target mount bridge
// (D-06/REQ-39). BOTH are VENDORED by codegen into every leaf: `./MentionNode`
// resolves to the shared neutral node, and `./mountDecorators` resolves to the
// leaf's target-matched hand-written bridge (one import specifier, 5 different
// vendored files). Only the non-`$` `MentionNode` CLASS + `mountDecorators` fn are
// imported here — never a `$`-prefixed named import (that would trip Svelte's
// dollar_prefix_invalid, D-05).
import { MentionNode } from './MentionNode';
import { mountDecorators } from './mountDecorators';
// The live editor instance — null before mount / after teardown. Declared at
// TOP-LEVEL script scope (NOT inside $onMount) so it is reachable from BOTH the
// $provide getter below AND the Solid-split onCleanup teardown, which the Solid
// emitter hoists OUTSIDE the mount-body IIFE (the ADDING-A-FAMILY cross-phase-scope
// gotcha — a mount-local `let` would be TS2304 in the teardown).
let editor: any = null;

// $provide the editor at INIT (top-level setup), NOT inside $onMount. Context
// tokens must be established during component init on Svelte (setContext is
// init-only — REQ-32) and Vue; providing inside $onMount would land setContext
// after init and fail. The value is a GETTER object so the identity is fixed at
// init while the live `editor` late-binds once $onMount assigns it — a plugin that
// mounts after the shell reads the current instance through the getter (the exact
// spike 010 `{ get color() {…} }` late-binding pattern). The token string is the
// stable cross-file identity the plugin/toolbar `$inject('rozie-lexical-editor')`
// reads (spike 010 cross-file token contract); plugins read the live editor via
// `.instance`.
//
// The getter key is `instance`, NOT `editor`: naming it `editor` collides with the
// top-level `let editor`, and the emitter's reactive-identifier rewrite pass then
// tries to rewrite the ObjectMethod KEY `editor` into a member expression and
// crashes (@babel/types ObjectMethod-key invariant). Renaming the key sidesteps
// that compile-path gap while the getter BODY `return editor` still late-binds to
// the live instance. (SCOPE FENCE: source workaround, no emitter edit.)

provide('rozie-lexical-editor', {
  get instance() {
    return editor;
  }
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  editor = lexical.createEditor({
    namespace: props.namespace || 'rozie-lexical',
    // The full v1.0 node CLASS set is declared here (Lexical requires all node
    // classes up front); consumer `nodes` are composed LAST so they win.
    nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, AutoLinkNode, MentionNode, ...props.nodes],
    // Fail-loud: rethrow rather than swallow editor-state corruption (T-76-01).
    onError: (e: any) => {
      throw e;
    },
    theme: props.theme
  });

  // Bind the editor to the authored contenteditable host.
  editor.setRootElement(rootElRef.value!);

  // Register the RichText baseline AND wire the per-target @mention decorator bridge
  // (D-06): mountDecorators returns an unregister fn, folded into the same
  // mergeRegister so the decorator listener tears down with everything else. Plugin
  // components (wave 2) add History/List/Link BEHAVIOR against the same $injected
  // editor. mountDecorators runs AFTER setRootElement so getElementByKey resolves.
  const cleanup = mergeRegister(registerRichText(editor), mountDecorators(editor));

  // Seed an empty paragraph so the caret has a block to land in when the document
  // is empty (the spike 015 seed pattern, in the `lexical.$…` namespace form).
  editor.update(() => {
    const root = lexical.$getRoot();
    if (root.getFirstChild() === null) {
      const paragraph = lexical.$createParagraphNode();
      root.append(paragraph);
    }
  });

  // Teardown colocated in the $onMount return (D-04): unregister everything, then
  // null the instance so a late teardown read sees a defined value.
  _cleanup_0 = () => {
    cleanup();
    editor = null;
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });
</script>

<style scoped>
.rozie-lexical {
  display: block;
}
.rozie-lexical-content {
  min-height: 6rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 6px;
  outline: none;
  font: inherit;
}
.rozie-lexical-content:focus {
  border-color: #4f46e5;
}
</style>

<style>
.rozie-lexical-content strong {
    font-weight: 700;
  }
.rozie-lexical-content em {
    font-style: italic;
  }
.rozie-lexical-content ul {
    margin: 0.25rem 0;
    padding-left: 1.5rem;
  }
.rozie-lexical-content ol {
    margin: 0.25rem 0;
    padding-left: 1.5rem;
  }
.rozie-lexical-content h1 {
    font-size: 1.5rem;
    margin: 0.5rem 0 0.375rem;
  }
.rozie-lexical-content h2 {
    font-size: 1.25rem;
    margin: 0.5rem 0 0.375rem;
  }
.rozie-lexical-content .rozie-mention {
    background: var(--rozie-lexical-mention-bg, #e0e7ff);
    border-radius: var(--rozie-lexical-mention-radius, 6px);
    padding: var(--rozie-lexical-mention-padding, 1px 6px);
    font-size: var(--rozie-lexical-mention-font-size, 0.875rem);
  }
</style>
