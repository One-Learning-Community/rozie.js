import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { clsx, rozieContext } from '@rozie/runtime-react';
import './Toolbar.css';
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

interface ToolbarProps {}

export default function Toolbar(props: ToolbarProps): JSX.Element {
  const editorCtx = useContext(rozieContext("rozie-lexical-editor"));
  const attrs = props as Record<string, unknown>;
  const teardown = useRef<any>(null);
  const disposed = useRef(false);
  const ctx = useRef<any>(null);
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    link: false,
    list: false
  });

  ctx.current = editorCtx;

  // The registerUpdateListener cleanup, captured once we register. null = not yet /
  // torn down. `disposed` guards the deferred activation against an unmount that races
  // ahead of the microtask below.
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
  const activate = useCallback(() => {
    if (teardown.current || disposed.current) return;
    const editor = ctx.current && ctx.current.instance;
    if (!editor) return;
    // READ side: on every editor update, read the current selection and reflect it into
    // $data.active so each button's active styling tracks the caret live. registerUpdateListener
    // returns its own cleanup.
    teardown.current = editor.registerUpdateListener(({
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
  }, [refreshActive]);
  const formatBold = useCallback(() => {
    const editor = ctx.current && ctx.current.instance;
    if (!editor) return;
    editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'bold');
  }, []);
  const formatItalic = useCallback(() => {
    const editor = ctx.current && ctx.current.instance;
    if (!editor) return;
    editor.dispatchCommand(lexical.FORMAT_TEXT_COMMAND, 'italic');
  }, []);
  const insertList = useCallback(() => {
    const editor = ctx.current && ctx.current.instance;
    if (!editor) return;
    editor.dispatchCommand(lexicalList.INSERT_UNORDERED_LIST_COMMAND, undefined);
  }, []);
  const toggleLink = useCallback(() => {
    const editor = ctx.current && ctx.current.instance;
    if (!editor) return;
    editor.dispatchCommand(lexicalLink.TOGGLE_LINK_COMMAND, active.link ? null : 'https://example.com');
  }, [active]);

  useEffect(() => {
    // Defer one microtask so the parent shell's $onMount has created the editor —
    // child mount hooks fire before the parent's on React/Vue/Solid (see header).
    queueMicrotask(activate);
    return () => {
      disposed.current = true;
      if (teardown.current) {
        teardown.current();
        teardown.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div role="toolbar" aria-label="Text formatting" {...attrs} className={clsx("rozie-lexical-toolbar", (attrs.className as string | undefined))} data-rozie-s-cf3602a2="">
      <button type="button" className={clsx("rozie-lexical-toolbar-btn", { active: active.bold })} aria-pressed={!!active.bold} aria-label="Bold" onMouseDown={($event) => { $event.preventDefault(); }} onClick={formatBold} data-rozie-s-cf3602a2=""><strong data-rozie-s-cf3602a2="">B</strong></button>
      <button type="button" className={clsx("rozie-lexical-toolbar-btn", { active: active.italic })} aria-pressed={!!active.italic} aria-label="Italic" onMouseDown={($event) => { $event.preventDefault(); }} onClick={formatItalic} data-rozie-s-cf3602a2=""><em data-rozie-s-cf3602a2="">I</em></button>
      <button type="button" className={clsx("rozie-lexical-toolbar-btn", { active: active.link })} aria-pressed={!!active.link} aria-label="Link" onMouseDown={($event) => { $event.preventDefault(); }} onClick={toggleLink} data-rozie-s-cf3602a2="">Link</button>
      <button type="button" className={clsx("rozie-lexical-toolbar-btn", { active: active.list })} aria-pressed={!!active.list} aria-label="Bullet list" onMouseDown={($event) => { $event.preventDefault(); }} onClick={insertList} data-rozie-s-cf3602a2="">&bull; List</button>
    </div>
    </>
  );
}
