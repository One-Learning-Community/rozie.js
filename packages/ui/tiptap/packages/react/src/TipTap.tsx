import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './TipTap.css';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// The live editor instance — null before mount / after destroy. Named `editor`
// (distinct from any template `ref="X"` name) so no capture-var-vs-ref double
// declaration trap (the Chart.js canvasEl/canvasNode lesson).

interface ToolbarCtx { editor: any; }

interface TipTapProps {
  html?: string;
  defaultHtml?: string;
  onHtmlChange?: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  autofocus?: boolean;
  editorClass?: string;
  ariaLabel?: string;
  editorProps?: Record<string, any>;
  extensions?: any[];
  onUpdate?: (...args: any[]) => void;
  onSelectionUpdate?: (...args: any[]) => void;
  onFocus?: (...args: any[]) => void;
  onBlur?: (...args: any[]) => void;
  renderToolbar?: (ctx: ToolbarCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface TipTapHandle {
  getEditor: (...args: any[]) => any;
  focusEditor: (...args: any[]) => any;
  blurEditor: (...args: any[]) => any;
  getHTML: (...args: any[]) => any;
  getJSON: (...args: any[]) => any;
  setContent: (...args: any[]) => any;
  clearContent: (...args: any[]) => any;
  toggleBold: (...args: any[]) => any;
  toggleItalic: (...args: any[]) => any;
  toggleHeading: (...args: any[]) => any;
  toggleBulletList: (...args: any[]) => any;
  undo: (...args: any[]) => any;
  redo: (...args: any[]) => any;
  chain: (...args: any[]) => any;
}

const TipTap = forwardRef<TipTapHandle, TipTapProps>(function TipTap(_props: TipTapProps, ref): JSX.Element {
  const portalRoots = useRef<Set<Root>>(new Set());
  const __defaultEditorProps = useState(() => (() => ({}))())[0];
  const __defaultExtensions = useState(() => (() => [])())[0];
  const props: Omit<TipTapProps, 'editable' | 'placeholder' | 'autofocus' | 'editorClass' | 'ariaLabel' | 'editorProps' | 'extensions'> & { editable: boolean; placeholder: string; autofocus: boolean; editorClass: string; ariaLabel: string; editorProps: Record<string, any>; extensions: any[] } = {
    ..._props,
    editable: _props.editable ?? true,
    placeholder: _props.placeholder ?? '',
    autofocus: _props.autofocus ?? false,
    editorClass: _props.editorClass ?? '',
    ariaLabel: _props.ariaLabel ?? 'Rich text editor',
    editorProps: _props.editorProps ?? __defaultEditorProps,
    extensions: _props.extensions ?? __defaultExtensions,
  };
  const _renderToolbarRef = useRef(props.renderToolbar);
  _renderToolbarRef.current = props.renderToolbar;
  const lastHtml = useRef<any>(null);
  const editor = useRef<any>(null);
  const toolbarDispose = useRef<any>(null);
  const [html, setHtml] = useControllableState({
    value: props.html,
    defaultValue: props.defaultHtml ?? '<p>Start writing…</p>',
    onValueChange: props.onHtmlChange,
  });
  const _editableRef = useRef(props.editable);
  _editableRef.current = props.editable;
  const _htmlRef = useRef(html);
  _htmlRef.current = html;
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    h1: false,
    h2: false,
    bulletList: false
  });
  const toolbarEl = useRef<HTMLDivElement | null>(null);
  const editorEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);

  const refreshActive = useCallback(() => {
    if (!editor.current) return;
    setActive({
      bold: editor.current.isActive('bold'),
      italic: editor.current.isActive('italic'),
      h1: editor.current.isActive('heading', {
        level: 1
      }),
      h2: editor.current.isActive('heading', {
        level: 2
      }),
      bulletList: editor.current.isActive('bulletList')
    });
  }, []);
  // ── Imperative handle (Phase 21 $expose) — TipTap is command-rich, so this is
  // the marquee surface: 14 verbs over the live Editor, uniform across all 6
  // targets. Each guards the pre-mount / destroyed `editor = null`.
  //
  // Collision discipline:
  //   - The content setter is named `setContent`, NOT `setHtml` — an `html` model
  //     prop makes React auto-generate a `setHtml` state setter, so a `setHtml`
  //     $expose verb would collide on the React target (ROZ524). (CodeMirror's
  //     setValue→replaceValue lesson, html edition.)
  //   - None of the 14 names collide with LitElement reserved lifecycle methods
  //     (update/render/firstUpdated/updated/willUpdate/requestUpdate).
  //   - The focus/blur COMMANDS are named `focusEditor`/`blurEditor`, NOT
  //     `focus`/`blur` — the component emits `focus`/`blur` EVENTS, and on
  //     class-based targets (Angular) an output field and a method cannot share a
  //     name (ROZ121). The diagnostic's own guidance: rename the method, keep the
  //     event's public name. (The expose-verb-vs-event-name collision lesson.)
  //   - None equals a prop name (html/editable/placeholder/autofocus/editorClass/
  //     ariaLabel/editorProps/extensions).
  function getEditor() {
    return editor.current;
  }
  function focusEditor() {
    editor.current?.commands.focus();
  }
  function blurEditor() {
    editor.current?.commands.blur();
  }
  function getHTML() {
    return editor.current ? editor.current.getHTML() : '';
  }
  function getJSON() {
    return editor.current ? editor.current.getJSON() : null;
  }
  // setContent routes through the SAME suppress-echo bookkeeping as $watch(html):
  // update lastHtml first, set with emitUpdate:false (no onUpdate bounce), then
  // reflect into the model so a programmatic set keeps the bound state in sync.
  // setContent routes through the SAME suppress-echo bookkeeping as $watch(html):
  // update lastHtml first, set with emitUpdate:false (no onUpdate bounce), then
  // reflect into the model so a programmatic set keeps the bound state in sync.
  function setContent(next: any) {
    if (!editor.current) return;
    const v = next ?? '';
    if (v === lastHtml.current) return;
    lastHtml.current = v;
    editor.current.commands.setContent(v, {
      emitUpdate: false
    });
    setHtml(v);
    refreshActive();
  }
  function clearContent() {
    if (!editor.current) return;
    editor.current.commands.clearContent();
    lastHtml.current = editor.current.getHTML();
    setHtml(lastHtml.current);
    refreshActive();
  }
  function toggleBold() {
    editor.current?.chain().focus().toggleBold().run();
    refreshActive();
  }
  function toggleItalic() {
    editor.current?.chain().focus().toggleItalic().run();
    refreshActive();
  }
  function toggleHeading(level: any) {
    editor.current?.chain().focus().toggleHeading({
      level: level ?? 1
    }).run();
    refreshActive();
  }
  function toggleBulletList() {
    editor.current?.chain().focus().toggleBulletList().run();
    refreshActive();
  }
  function undo() {
    editor.current?.chain().focus().undo().run();
    refreshActive();
  }
  function redo() {
    editor.current?.chain().focus().redo().run();
    refreshActive();
  }
  // Power-user escape hatch — returns a pre-focused command chain (TipTap idiom:
  // chain().focus().toggleBold().setColor('#f00').run()). null before mount.
  // Power-user escape hatch — returns a pre-focused command chain (TipTap idiom:
  // chain().focus().toggleBold().setColor('#f00').run()). null before mount.
  function chain() {
    return editor.current ? editor.current.chain().focus() : null;
  }

  useEffect(() => {
    const portals = {
    toolbar: (container: HTMLElement, scope: { editor: unknown }): (() => void) => {
      const slot = _renderToolbarRef.current ?? props.slots?.['toolbar'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal toolbar { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-toolbar', '2aeee876');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
  };
    lastHtml.current = _htmlRef.current;
    editor.current = new Editor({
      element: editorEl.current!,
      content: _htmlRef.current,
      editable: _editableRef.current,
      autofocus: props.autofocus,
      // StarterKit first; consumer extensions LAST so they win (TipTap applies
      // later-registered extensions over earlier ones for the same node/mark).
      extensions: [StarterKit, ...props.extensions],
      editorProps: {
        attributes: {
          'aria-label': props.ariaLabel,
          ...(props.editorClass ? {
            class: props.editorClass
          } : {}),
          ...(props.placeholder ? {
            'data-placeholder': props.placeholder,
            'aria-placeholder': props.placeholder
          } : {})
        },
        // Consumer editorProps spread LAST — full ProseMirror editorProps control
        // (handleKeyDown, handlePaste, a custom `attributes`, …) wins.
        ...props.editorProps
      },
      onUpdate: ({
        editor
      }: any) => {
        const next = editor.getHTML();
        lastHtml.current = next;
        // Round-trip guard — see CodeMirror/Flatpickr for the same shape.
        if (next !== _htmlRef.current) setHtml(next);
        props.onUpdate && props.onUpdate(next);
      },
      onSelectionUpdate: () => {
        refreshActive();
        props.onSelectionUpdate && props.onSelectionUpdate();
      },
      onFocus: () => props.onFocus && props.onFocus(),
      onBlur: () => props.onBlur && props.onBlur()
    });
    refreshActive();

    // `toolbar` portal slot — when the consumer fills it, mount their toolbar
    // fragment into the engine-adjacent host node, handing them the live editor
    // (their buttons call editor.chain().focus()…run()). $portals.toolbar is
    // referenced ONLY here inside $onMount (the per-target portal helper is scoped
    // to the mount lifecycle — a top-level reference would fail the bundled-leaf
    // strict typecheck, the FullCalendar/CodeMirror pattern). The host div is
    // r-if-gated on $slots.toolbar so $refs.toolbarEl exists exactly when filled.
    if ((props.renderToolbar ?? props.slots?.["toolbar"]) && toolbarEl.current) {
      toolbarDispose.current = portals.toolbar(toolbarEl.current!, {
        editor: editor.current
      });
    }
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      toolbarDispose.current?.();
      toolbarDispose.current = null;
      editor.current?.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = html;
    if (!editor.current) return;
    if (v === lastHtml.current) return;
    lastHtml.current = v;
    editor.current.commands.setContent(v, {
      emitUpdate: false
    });
    refreshActive();
  }, [html]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    const v = props.editable;
    editor.current?.setEditable(v, false);
  }, [props.editable]);

  useImperativeHandle(ref, () => ({ getEditor, focusEditor, blurEditor, getHTML, getJSON, setContent, clearContent, toggleBold, toggleItalic, toggleHeading, toggleBulletList, undo, redo, chain }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className={clsx("rozie-tiptap", { "is-readonly": !props.editable })} data-rozie-s-2aeee876="">
      
      {(props.editable && !(props.renderToolbar ?? props.slots?.['toolbar'])) && <div className={"rozie-tiptap-toolbar"} data-rozie-s-2aeee876="">
        <button type="button" className={clsx({ active: active.bold })} aria-label="Bold" onClick={toggleBold} data-rozie-s-2aeee876=""><strong data-rozie-s-2aeee876="">B</strong></button>
        <button type="button" className={clsx({ active: active.italic })} aria-label="Italic" onClick={toggleItalic} data-rozie-s-2aeee876=""><em data-rozie-s-2aeee876="">I</em></button>
        <span className={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" className={clsx({ active: active.h1 })} aria-label="Heading 1" onClick={($event) => { toggleHeading(1); }} data-rozie-s-2aeee876="">H1</button>
        <button type="button" className={clsx({ active: active.h2 })} aria-label="Heading 2" onClick={($event) => { toggleHeading(2); }} data-rozie-s-2aeee876="">H2</button>
        <span className={"sep"} data-rozie-s-2aeee876="" />
        <button type="button" className={clsx({ active: active.bulletList })} aria-label="Bullet list" onClick={toggleBulletList} data-rozie-s-2aeee876="">• List</button>
      </div>}{(props.editable && (props.renderToolbar ?? props.slots?.['toolbar'])) && <div className={"rozie-tiptap-toolbar rozie-tiptap-toolbar--slot"} ref={toolbarEl} data-rozie-s-2aeee876="" />}<div ref={editorEl} className={"rozie-tiptap-content"} data-placeholder={props.placeholder} data-rozie-s-2aeee876="" />
    </div>


    </>
  );
});
export default TipTap;
