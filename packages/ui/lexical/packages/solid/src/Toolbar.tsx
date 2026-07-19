import type { JSX } from 'solid-js';
import { createSignal, onCleanup, onMount, splitProps, useContext } from 'solid-js';
import { __rozieInjectStyle, rozieClass, rozieContext } from '@rozie/runtime-solid';
// NAMESPACE imports (D-05): both the `$`-API selection reads AND the command
// constants come through namespace bindings, so no bare `$`-identifier ever reaches
// the Svelte compiler (spike 013 / compile-lexical-check.mjs).
import * as lexical from 'lexical';
import * as lexicalList from '@lexical/list';
import * as lexicalLink from '@lexical/link';
import * as lexicalUtils from '@lexical/utils';

// The shared editor context object provided by the shell ({ get instance() {…} },
// spike 010 late-binding getter). `$inject` binds to a `const` (ROZ132), then aliases
// through a null-`let` (typeNeutralize) so `.instance` type-checks on the strict
// bundled leaves; TOP-LEVEL scope so the hoisted Solid teardown can reach it (see
// RichTextPlugin header for the full rationale).

__rozieInjectStyle('Toolbar-cf3602a2', `.rozie-lexical-toolbar[data-rozie-s-cf3602a2] {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  margin-bottom: 0.375rem;
}
.rozie-lexical-toolbar-btn[data-rozie-s-cf3602a2] {
  padding: 0.25rem 0.5rem;
  min-width: 1.75rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.rozie-lexical-toolbar-btn[data-rozie-s-cf3602a2]:hover {
  background: rgba(0, 0, 0, 0.05);
}
.rozie-lexical-toolbar-btn.active[data-rozie-s-cf3602a2] {
  background: #1a1a1a;
  color: #ffffff;
  border-color: #1a1a1a;
}`);

interface ToolbarProps {}

export default function Toolbar(_props: ToolbarProps): JSX.Element {
  const [local, attrs] = splitProps(_props, [] as []);

  const editorCtx = useContext(rozieContext("rozie-lexical-editor"));
  const [active, setActive] = createSignal({
    bold: false,
    italic: false,
    link: false,
    list: false
  });
  onMount(() => {
    const _cleanup = (() => {
    // Defer one microtask so the parent shell's $onMount has created the editor —
    // child mount hooks fire before the parent's on React/Vue/Solid (see header).
    queueMicrotask(activate);
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    disposed = true;
    if (teardown) {
      teardown();
      teardown = null;
    }
  });
  });

  let ctx: any = null;
  ctx = editorCtx;

  // The registerUpdateListener cleanup, captured once we register. null = not yet /
  // torn down. `disposed` guards the deferred activation against an unmount that races
  // ahead of the microtask below.
  let teardown: any = null;
  let disposed = false;

  // Recompute the toolbar's active booleans from the CURRENT selection. MUST be called
  // inside an editorState.read() (the registerUpdateListener callback / getEditorState
  // read below) so the `$`-API resolves against the live editor state. Named
  // `refreshActive` — NOT `setActive`, which would collide with the React/Solid
  // generated `$data.active` setter (ROZ524, the TipTap toolbar precedent).
  function refreshActive() {
    const sel = lexical.$getSelection();
    if (!lexical.$isRangeSelection(sel)) {
      setActive({
        bold: false,
        italic: false,
        link: false,
        list: false
      });
      return;
    }
    const anchorNode = sel.anchor.getNode();
    // Ancestor-type reads via the namespace `$`-API: a ListNode / LinkNode anywhere
    // above the caret means the current selection is inside a list / link.
    const listNode = lexicalUtils.$getNearestNodeOfType(anchorNode, lexicalList.ListNode);
    const linkNode = lexicalUtils.$getNearestNodeOfType(anchorNode, lexicalLink.LinkNode);
    setActive({
      bold: sel.hasFormat('bold'),
      italic: sel.hasFormat('italic'),
      link: linkNode !== null,
      list: listNode !== null
    });
  }

  // Register the selection-reading update listener against the shared editor and seed
  // the initial active state. Deferred one microtask from $onMount (see header).
  function activate() {
    if (teardown || disposed) return;
    const editor = ctx && ctx.instance;
    if (!editor) return;
    // READ side: on every editor update, read the current selection and reflect it into
    // $data.active so each button's active styling tracks the caret live. registerUpdateListener
    // returns its own cleanup.
    teardown = editor.registerUpdateListener(({
      editorState
    }: any) => {
      editorState.read(() => {
        refreshActive();
      });
    });
    // Seed the initial state so the buttons render correct active styling before the
    // first user-driven update fires.
    editor.getEditorState().read(() => {
      refreshActive();
    });
  }

  // WRITE side — button command dispatchers. Each reads the LIVE editor instance fresh
  // through the getter (never a stale handle) and guards the pre-mount / torn-down null.
  function formatBold() {
    const editor = ctx && ctx.instance;
    if (!editor) return;
    editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'bold');
  }
  function formatItalic() {
    const editor = ctx && ctx.instance;
    if (!editor) return;
    editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'italic');
  }
  function insertList() {
    const editor = ctx && ctx.instance;
    if (!editor) return;
    editor.dispatchCommand(lexicalList.INSERT_UNORDERED_LIST_COMMAND, undefined);
  }
  // Unopinionated toggle: if the selection is already a link, unlink (dispatch null);
  // otherwise link it to a fixed sample href. A fixed href (over a prompt) keeps the
  // primitive dependency-free and SSR/test-safe — consumers wire their own URL UX
  // against the LinkPlugin's TOGGLE_LINK_COMMAND (D-12).
  function toggleLink() {
    const editor = ctx && ctx.instance;
    if (!editor) return;
    editor.dispatchCommand(lexicalLink.TOGGLE_LINK_COMMAND, active().link ? null : 'https://example.com');
  }

  return (
    <>
    <div role="toolbar" aria-label="Text formatting" {...attrs} class={"rozie-lexical-toolbar" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-cf3602a2="">
      <button type="button" aria-pressed={!!active().bold} aria-label="Bold" class={"rozie-lexical-toolbar-btn" + " " + rozieClass({ active: active().bold })} onMouseDown={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.preventDefault(); }} onClick={formatBold} data-rozie-s-cf3602a2=""><strong data-rozie-s-cf3602a2="">B</strong></button>
      <button type="button" aria-pressed={!!active().italic} aria-label="Italic" class={"rozie-lexical-toolbar-btn" + " " + rozieClass({ active: active().italic })} onMouseDown={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.preventDefault(); }} onClick={formatItalic} data-rozie-s-cf3602a2=""><em data-rozie-s-cf3602a2="">I</em></button>
      <button type="button" aria-pressed={!!active().link} aria-label="Link" class={"rozie-lexical-toolbar-btn" + " " + rozieClass({ active: active().link })} onMouseDown={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.preventDefault(); }} onClick={toggleLink} data-rozie-s-cf3602a2="">Link</button>
      <button type="button" aria-pressed={!!active().list} aria-label="Bullet list" class={"rozie-lexical-toolbar-btn" + " " + rozieClass({ active: active().list })} onMouseDown={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { $event.preventDefault(); }} onClick={insertList} data-rozie-s-cf3602a2="">&bull; List</button>
    </div>
    </>
  );
}
