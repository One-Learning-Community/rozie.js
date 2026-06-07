<script lang="ts">
import type { Snippet } from 'svelte';
import { mount, unmount } from 'svelte';
import PortalHost from '@rozie/runtime-svelte/PortalHost.svelte';
import { onMount, untrack } from 'svelte';

interface Props {
  value?: string;
  language?: string;
  theme?: unknown;
  readOnly?: boolean;
  height?: number;
  placeholder?: string;
  extensions?: any[];
  basicSetup?: boolean;
  panel?: Snippet<[{ view: any }]>;
  snippets?: Record<string, any>;
}

let __defaultExtensions = (() => [])();

let {
  value = $bindable(''),
  language = 'javascript',
  theme = 'light',
  readOnly = false,
  height = 240,
  placeholder = '',
  extensions = __defaultExtensions,
  basicSetup = false,
  panel: __panelProp,
  snippets
}: Props = $props();

const panel = $derived(__panelProp ?? snippets?.panel);

let hostEl = $state<HTMLElement | undefined>(undefined);

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
const langExt = () => language === 'javascript' ? javascript() : [];

// theme resolution (G3): the two built-in strings map to oneDark / [];
// anything else is treated as a CM Extension (or Extension[]) and passed
// straight through the themeCompartment. The $watch(theme) reconfigure below
// covers extension themes live, identical to the string forms.
// theme resolution (G3): the two built-in strings map to oneDark / [];
// anything else is treated as a CM Extension (or Extension[]) and passed
// straight through the themeCompartment. The $watch(theme) reconfigure below
// covers extension themes live, identical to the string forms.
const themeExt = () => {
  const t = theme;
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
const phExt = () => placeholder ? placeholderExt(placeholder) : [];

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
const baselineExt = () => basicSetup ? [basicSetupBundle] : [lineNumbers(), history(), keymap.of([...defaultKeymap, ...historyKeymap])];

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
export function getView() {
  return view;
}
export function focus() {
  view?.focus();
}
export function getValue() {
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
export function replaceValue(v: any) {
  writeDoc(v);
}
export function dispatch(tr: any) {
  view?.dispatch(tr);
}
export function insertText(text: any) {
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
export function getSelection() {
  return view ? view.state.selection.main : null;
}
export function setSelection(range: any) {
  if (!view) return;
  const sel = typeof range === 'number' ? EditorSelection.single(range) : EditorSelection.single(range.anchor, range.head);
  view.dispatch({
    selection: sel
  });
}

const portalInstances = new Set<Record<string, unknown>>();
const portals = {
  panel: (container: HTMLElement, scope: { view: unknown }): (() => void) => {
    if (!panel) return () => {};
    // Spike 004: portal-scope attribute injection.
    container.setAttribute('data-rozie-portal-panel', '34cfda5a');
    const inst = mount(PortalHost, {
      target: container,
      props: { snippet: panel, scope },
    });
    portalInstances.add(inst as Record<string, unknown>);
    return () => {
      unmount(inst);
      portalInstances.delete(inst as Record<string, unknown>);
    };
  },
};
$effect(() => () => {
  for (const inst of portalInstances) unmount(inst as Parameters<typeof unmount>[0]);
  portalInstances.clear();
});

onMount(() => {
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
    if (!panel) return [];
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
    extensions: [...baselineExt(), langCompartment.of(langExt()), themeCompartment.of(themeExt()), readOnlyCompartment.of(EditorState.readOnly.of(readOnly)), placeholderCompartment.of(phExt()), panelCompartment.of(panelExt()), EditorView.updateListener.of((update: any) => {
      if (!update.docChanged) return;
      if (suppressEmit) return;
      // Push the new doc out through the model:true emit path. Consumers
      // bound via `r-model:value="$data.x"` receive the change.
      value = update.state.doc.toString();
    }),
    // Consumer extensions LAST so they win CM6's last-registered-wins facets.
    extensionsCompartment.of(extensions)]
  });
  view = new EditorView({
    state: buildState(value),
    parent: hostEl!
  });
  return () => view?.destroy();
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => value)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => writeDoc(v))(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { (() => language)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } (() => {
  if (!view) return;
  view.dispatch({
    effects: langCompartment.reconfigure(langExt())
  });
})(); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { (() => theme)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } (() => {
  if (!view) return;
  view.dispatch({
    effects: themeCompartment.reconfigure(themeExt())
  });
})(); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { const __watchVal = (() => readOnly)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } ((v: any) => {
  if (!view) return;
  view.dispatch({
    effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(v))
  });
})(__watchVal); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { (() => placeholder)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } (() => {
  if (!view) return;
  view.dispatch({
    effects: placeholderCompartment.reconfigure(phExt())
  });
})(); }); });
let __rozieWatchInitial_5 = true;
$effect(() => { const __watchVal = (() => extensions)(); untrack(() => { if (__rozieWatchInitial_5) { __rozieWatchInitial_5 = false; return; } ((v: any) => {
  if (!view) return;
  view.dispatch({
    effects: extensionsCompartment.reconfigure(v)
  });
})(__watchVal); }); });
</script>

<div class="rozie-codemirror" style:height={height + 'px'} data-rozie-s-34cfda5a><div class="cm-mount" bind:this={hostEl} data-rozie-s-34cfda5a></div></div>

<style>
:global {
  .rozie-codemirror[data-rozie-s-34cfda5a] {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    overflow: hidden;
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
  }
  .cm-mount[data-rozie-s-34cfda5a] {
    height: 100%;
    width: 100%;
  }
}

:global {
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
}
</style>
