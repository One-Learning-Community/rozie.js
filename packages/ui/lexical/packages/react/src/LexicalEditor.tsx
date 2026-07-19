import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieContext } from '@rozie/runtime-react';
import './LexicalEditor.css';
import './LexicalEditor.global.css';
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

interface LexicalEditorProps {
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
  ariaLabel?: (string) | null;
  /**
   * Lexical `theme` object mapping node/format types to CSS class names. The styling hook for this deliberately-unstyled primitive (D-12) — bring your own design-system classes.
   */
  theme?: Record<string, any>;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function LexicalEditor(_props: LexicalEditorProps): JSX.Element {
  const __ctx_rozie_lexical_editor = rozieContext("rozie-lexical-editor");
  const __defaultNodes = useState(() => (() => [])())[0];
  const __defaultTheme = useState(() => (() => ({}))())[0];
  const props: Omit<LexicalEditorProps, 'nodes' | 'namespace' | 'ariaLabel' | 'theme'> & { nodes: any[]; namespace: string; ariaLabel: (string) | null; theme: Record<string, any> } = {
    ..._props,
    nodes: _props.nodes ?? __defaultNodes,
    namespace: _props.namespace ?? '',
    ariaLabel: _props.ariaLabel ?? null,
    theme: _props.theme ?? __defaultTheme,
  };
  const attrs: Record<string, unknown> = (() => {
    const { nodes, namespace, ariaLabel, theme, ...rest } = _props as LexicalEditorProps & Record<string, unknown>;
    void nodes; void namespace; void ariaLabel; void theme;
    return rest;
  })();
  const editor = useRef<any>(null);
  const rootEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    editor.current = lexical.createEditor({
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
    editor.current.setRootElement(rootEl.current!);

    // Register the RichText baseline AND wire the per-target @mention decorator bridge
    // (D-06): mountDecorators returns an unregister fn, folded into the same
    // mergeRegister so the decorator listener tears down with everything else. Plugin
    // components (wave 2) add History/List/Link BEHAVIOR against the same $injected
    // editor. mountDecorators runs AFTER setRootElement so getElementByKey resolves.
    const cleanup = mergeRegister(registerRichText(editor.current), mountDecorators(editor.current));

    // Seed an empty paragraph so the caret has a block to land in when the document
    // is empty (the spike 015 seed pattern, in the `lexical.$…` namespace form).
    editor.current.update(() => {
      const root = lexical.$getRoot();
      if (root.getFirstChild() === null) {
        const paragraph = lexical.$createParagraphNode();
        root.append(paragraph);
      }
    });

    // Teardown colocated in the $onMount return (D-04): unregister everything, then
    // null the instance so a late teardown read sees a defined value.
    return () => {
      cleanup();
      editor.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <__ctx_rozie_lexical_editor.Provider value={{
  get instance() {
    return editor.current;
  }
}}>
    <>
    <div {...attrs} className={clsx("rozie-lexical", (attrs.className as string | undefined))} data-rozie-s-f679124a="">
      
      <div ref={rootEl} className={"rozie-lexical-content"} contentEditable={true} aria-label={rozieAttr(props.ariaLabel)} data-rozie-s-f679124a="" />
      
      {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
    </div>
    </>
    </__ctx_rozie_lexical_editor.Provider>
  );
}
