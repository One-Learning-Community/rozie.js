<template>

<div class="rozie-codemirror" :style="{ height: props.height + 'px' }">
  <div class="cm-mount" ref="hostElRef"></div>
</div>



</template>

<script setup lang="ts">
import { Fragment, h, onBeforeUnmount, onMounted, ref, render, useSlots, watch } from 'vue';

const props = withDefaults(
  defineProps<{ language?: string; theme?: unknown; readOnly?: boolean; height?: number; placeholder?: string; extensions?: any[]; basicSetup?: boolean }>(),
  { language: 'javascript', theme: 'light', readOnly: false, height: 240, placeholder: '', extensions: () => [], basicSetup: false }
);

const value = defineModel<string>('value', { default: '' });

defineSlots<{
  panel(props: { view: any }): any;
}>();

const slots = useSlots();

const hostElRef = ref<HTMLElement>();

import { EditorState, Compartment, EditorSelection } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, showPanel, placeholder as placeholderExt } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
// Imported under an alias: the `basicSetup` PROP (G1) would otherwise collide
// with this binding on targets that lower props into same-scope locals (Svelte
// `let basicSetup`, Solid/React destructured `props.basicSetup`).
// Imported under an alias: the `basicSetup` PROP (G1) would otherwise collide
// with this binding on targets that lower props into same-scope locals (Svelte
// `let basicSetup`, Solid/React destructured `props.basicSetup`).
import { basicSetup as basicSetupBundle } from 'codemirror';
let view: any = null;

// CodeMirror's updateListener fires on EVERY transaction, including our own
// $watch-driven dispatch when the consumer changes `value`. Without a guard
// the wrapper would emit its own dispatch back through the model path on
// the next tick — a slow ping-pong loop that doesn't crash but eats RAFs.
// CodeMirror's updateListener fires on EVERY transaction, including our own
// $watch-driven dispatch when the consumer changes `value`. Without a guard
// the wrapper would emit its own dispatch back through the model path on
// the next tick — a slow ping-pong loop that doesn't crash but eats RAFs.
let suppressEmit = false;

// Compartments let us swap individual extensions at runtime via
// `view.dispatch({ effects: compartment.reconfigure(newExt) })` without
// rebuilding the entire EditorState. Each runtime-updatable prop gets one so
// prop changes don't lose cursor/history/scroll position.
// Compartments let us swap individual extensions at runtime via
// `view.dispatch({ effects: compartment.reconfigure(newExt) })` without
// rebuilding the entire EditorState. Each runtime-updatable prop gets one so
// prop changes don't lose cursor/history/scroll position.
const langCompartment = new Compartment();
const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();
const placeholderCompartment = new Compartment();
const extensionsCompartment = new Compartment();
const panelCompartment = new Compartment();

// language is a convenience prop mapping to the ONE bundled language
// (@codemirror/lang-javascript). Any other value → [] (plain text, no syntax
// highlighting); consumers add other languages via :extensions (D-03). This
// FIXES the prior declared-but-ignored bug where buildState hard-coded
// javascript() regardless of $props.language.
// language is a convenience prop mapping to the ONE bundled language
// (@codemirror/lang-javascript). Any other value → [] (plain text, no syntax
// highlighting); consumers add other languages via :extensions (D-03). This
// FIXES the prior declared-but-ignored bug where buildState hard-coded
// javascript() regardless of $props.language.
const langExt = () => props.language === 'javascript' ? javascript() : [];

// theme resolution (G3): the two built-in strings map to oneDark / [];
// anything else is treated as a CM Extension (or Extension[]) and passed
// straight through the themeCompartment. The $watch(theme) reconfigure below
// covers extension themes live, identical to the string forms.
// theme resolution (G3): the two built-in strings map to oneDark / [];
// anything else is treated as a CM Extension (or Extension[]) and passed
// straight through the themeCompartment. The $watch(theme) reconfigure below
// covers extension themes live, identical to the string forms.
const themeExt = () => {
  const t = props.theme;
  if (t === 'dark') return oneDark;
  if (t === 'light' || t === '' || t == null) return [];
  // t is a CM Extension / Extension[] passthrough by this branch (the widened
  // `theme` prop accepts a string OR an Extension). The strict-tsc leaves get a
  // codegen return-type aid (`themeExt(): any`) so `Compartment.of`/`reconfigure`
  // accept it; the type-neutral targets strip types entirely.
  return t;
};

// placeholder ext only when a non-empty placeholder string is supplied.
// placeholder ext only when a non-empty placeholder string is supplied.
const phExt = () => props.placeholder ? placeholderExt(props.placeholder) : [];

// baseline keymap/gutter set (G1). When `basicSetup` is on, use CM6's
// `basicSetup` bundle (autocomplete, search, bracket matching, code folding,
// lint gutter, richer keymaps — it ALREADY includes line numbers + history, so
// the manual trio would double those up). When off, keep the exact thin
// baseline the wrapper shipped before G1 (line numbers + history + default/
// history keymaps) → existing consumers stay byte-stable. Read at buildState
// time only — no compartment (see the basicSetup prop note).
// baseline keymap/gutter set (G1). When `basicSetup` is on, use CM6's
// `basicSetup` bundle (autocomplete, search, bracket matching, code folding,
// lint gutter, richer keymaps — it ALREADY includes line numbers + history, so
// the manual trio would double those up). When off, keep the exact thin
// baseline the wrapper shipped before G1 (line numbers + history + default/
// history keymaps) → existing consumers stay byte-stable. Read at buildState
// time only — no compartment (see the basicSetup prop note).
const baselineExt = () => props.basicSetup ? [basicSetupBundle] : [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap])];

// buildState + the panel-slot wiring live INSIDE $onMount so the $portals.panel
// reference is bound in the mount scope. The per-target emitters scope the
// concrete portal helper inside the mount lifecycle (React useEffect / Lit
// firstUpdated / etc.); a top-level `panelExt` that references $portals would
// land out-of-scope of that helper and fail the bundled-leaf strict typecheck
// (TS2304 'portals' / TS2742). Keeping the $portals.panel use inside $onMount
// mirrors FullCalendar's portal pattern (its eventContent callbacks reference
// $portals only inside $onMount). buildState is only ever called here, so this
// is a behavior-preserving relocation. Compartments + langExt/themeExt/phExt
// stay top-level — the $watch reconfigures still reference them.
// Shared suppress-echo write helper. Both the $watch(value) consumer-driven
// reflect AND the $expose setValue verb route through this so a programmatic
// or prop-driven set doesn't ping-pong back through the model path. When the
// editor itself was the source of the change, the doc already matches `v`, so
// dispatching another transaction would mint a duplicate undo-history entry
// for no UI change.
const writeDoc = (v: any) => {
  if (!view) return;
  const current = view.state.doc.toString();
  const next = v ?? '';
  if (current === next) return;
  suppressEmit = true;
  try {
    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: next
      }
    });
  } finally {
    suppressEmit = false;
  }
};

// Consumer-driven value writes: reflect into the live editor (echo-guarded).
// Imperative handle (Phase 21 $expose). The 8 editor verbs a consumer can't
// drive through props alone — exposed uniformly to all 6 targets. Each guards
// the pre-mount/destroyed `view = null`. Collision-clear: none of the 8 names
// collide with the 8 props (value/language/theme/readOnly/height/placeholder/
// extensions/basicSetup) and there are no events (D-08).
function getView() {
  return view;
}
function focus() {
  view?.focus();
}
function getValue() {
  return view ? view.state.doc.toString() : '';
}
// replaceValue routes through the SAME suppress-echo guard as $watch(value).
// NOTE: named `replaceValue` (not `setValue`) — a `value` model prop makes
// React auto-generate a `setValue` state setter, so a `setValue` $expose verb
// collides on the React target (ROZ524: "already declared" + recursive rewrite).
// Renamed to preserve the value-setter semantics collision-free across all 6
// targets. (Deviation from the locked D-06 name `setValue`.)
// replaceValue routes through the SAME suppress-echo guard as $watch(value).
// NOTE: named `replaceValue` (not `setValue`) — a `value` model prop makes
// React auto-generate a `setValue` state setter, so a `setValue` $expose verb
// collides on the React target (ROZ524: "already declared" + recursive rewrite).
// Renamed to preserve the value-setter semantics collision-free across all 6
// targets. (Deviation from the locked D-06 name `setValue`.)
function replaceValue(v: any) {
  writeDoc(v);
}
function dispatch(tr: any) {
  view?.dispatch(tr);
}
function insertText(text: any) {
  if (!view) return;
  const {
    from,
    to
  } = view.state.selection.main;
  view.dispatch({
    changes: {
      from,
      to,
      insert: text
    },
    userEvent: 'input.type'
  });
}
function getSelection() {
  return view ? view.state.selection.main : null;
}
function setSelection(range: any) {
  if (!view) return;
  const sel = typeof range === 'number' ? EditorSelection.single(range) : EditorSelection.single(range.anchor, range.head);
  view.dispatch({
    selection: sel
  });
}

const portalContainers = new Set<HTMLElement>();
const portals = {
  panel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
    const slotFn = slots.panel;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // panel { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-panel', '34cfda5a');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
};
onBeforeUnmount(() => {
  for (const container of portalContainers) render(null, container);
  portalContainers.clear();
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  // One `panel` portal slot — mounted through CM6's `showPanel` facet. The
  // Panel's `dom` is the portal host node; $portals.panel(dom, scope) mounts the
  // consumer's framework-native fragment on Panel.mount() and the returned
  // dispose runs in Panel.destroy(). Empty extension ([]) when the consumer
  // doesn't fill the slot.
  // NOTE: the Panel's mount/destroy are ARROW-FUNCTION properties (not object
  // `mount() {}` methods) and the panel host element + view are captured in
  // plain `const`s. The object-method form gives each method its own `this`
  // scope, and the Lit emitter's component-field rewrite walks INTO that method
  // body and rewrites a closure-captured `view` reference to `this.view`
  // (TS2339 "Property 'view' does not exist on type 'Panel'"). Arrow-function
  // properties share the enclosing lexical scope, so the captured `panelView`
  // const resolves correctly on every target. CM6 calls `panel.mount()` /
  // `panel.destroy()` either way.
  const panelExt = () => {
    if (!slots.panel) return [];
    return showPanel.of((panelView: any) => {
      const dom = document.createElement('div');
      dom.className = 'rozie-cm-panel';
      const scope = {
        view: panelView
      };
      let dispose: any = null;
      return {
        dom,
        top: false,
        mount: () => {
          dispose = portals.panel(dom, scope);
        },
        destroy: () => {
          dispose?.();
          dispose = null;
        }
      };
    });
  };
  const buildState = (doc: any) => EditorState.create({
    doc,
    extensions: [...baselineExt(), langCompartment.of(langExt()), themeCompartment.of(themeExt()), readOnlyCompartment.of(EditorState.readOnly.of(props.readOnly)), placeholderCompartment.of(phExt()), panelCompartment.of(panelExt()), EditorView.updateListener.of((update: any) => {
      if (!update.docChanged) return;
      if (suppressEmit) return;
      // Push the new doc out through the model:true emit path. Consumers
      // bound via `r-model:value="$data.x"` receive the change.
      value.value = update.state.doc.toString();
    }),
    // Consumer extensions LAST so they win CM6's last-registered-wins facets.
    extensionsCompartment.of(props.extensions)]
  });
  view = new EditorView({
    state: buildState(value.value),
    parent: hostElRef.value!
  });
  _cleanup_0 = () => view?.destroy();
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => value.value, (v: any) => writeDoc(v));
watch(() => props.language, () => {
  if (!view) return;
  view.dispatch({
    effects: langCompartment.reconfigure(langExt())
  });
});
watch(() => props.theme, () => {
  if (!view) return;
  view.dispatch({
    effects: themeCompartment.reconfigure(themeExt())
  });
});
watch(() => props.readOnly, (v: any) => {
  if (!view) return;
  view.dispatch({
    effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(v))
  });
});
watch(() => props.placeholder, () => {
  if (!view) return;
  view.dispatch({
    effects: placeholderCompartment.reconfigure(phExt())
  });
});
watch(() => props.extensions, (v: any) => {
  if (!view) return;
  view.dispatch({
    effects: extensionsCompartment.reconfigure(v)
  });
});

defineExpose({ getView, focus, getValue, replaceValue, dispatch, insertText, getSelection, setSelection });
</script>

<style scoped>
.rozie-codemirror {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
}
.cm-mount {
  height: 100%;
  width: 100%;
}
</style>

<style>
.rozie-codemirror .cm-editor {
    height: 100%;
    font-size: 13px;
  }
.rozie-codemirror .cm-scroller {
    height: 100%;
  }
.rozie-codemirror .rozie-cm-panel {
    padding: 2px 8px;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
    font-size: 12px;
  }
</style>
