/**
 * `<template>` block parser (PARSE-04).
 *
 * Drives a fresh htmlparser2 `Tokenizer` instance (separate from the SFC
 * splitter's instance — different consumer, different state machine) to build
 * a typed `TemplateAST`.
 *
 * Attribute classification by prefix:
 *   - 'r-*'    → kind: 'directive'  (Rozie directives — r-if, r-for, r-model, etc.)
 *   - ':*'     → kind: 'binding'    (`:prop="expr"` — JS expression bound to attribute)
 *   - '@*'     → kind: 'event'      (`@event.modifier(args)` — event handler with modifier chain)
 *   - else     → kind: 'static'     (literal attribute)
 *
 * Modifier chain on event attributes:
 *   `@click.outside($refs.x).stop` → name='click', modifierChainText='.outside($refs.x).stop'.
 *   The chain text is preserved VERBATIM (with leading dot) for Plan 04's PEG runner.
 *
 * Mustache `{{ ... }}` interpolation:
 *   - In TEXT children: split into alternating TemplateText / TemplateInterpolation nodes.
 *   - In ATTRIBUTE values: preserved verbatim in `value` (Phase 2 lowers them).
 *   PROJECT.md "Specific Ideas": mustache in attribute values is permitted in Rozie
 *   (Vue forbids it).
 *
 * Source-location threading: the Tokenizer reports offsets relative to the
 * input we feed it (the block content). We add `contentLoc.start` to every
 * offset before recording it in AST nodes — every `loc` is an ABSOLUTE byte
 * offset in the original .rozie source (D-11/D-12).
 *
 * D-08 contract: NEVER throws. Tokenizer errors and unbalanced constructs
 * surface as ROZ050/ROZ051 diagnostics; the partial AST is returned.
 *
 * ROZxxx codes owned here:
 *  - ROZ050  Unclosed template element (open tag without matching close)
 *  - ROZ051  Malformed mustache `{{ }}` (unmatched `{{` in a text run)
 *
 * Threat model T-1-03-03: mustache regex uses `[^}]` (non-greedy, character-
 * class-anchored) — linear, no exponential backtracking.
 *
 * @experimental — shape may change before v1.0
 */
import { Tokenizer } from 'htmlparser2';
import type { SourceLoc } from '../ast/types.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
  TemplateText,
  TemplateInterpolation,
} from '../ast/blocks/TemplateAST.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

export interface ParseTemplateResult {
  node: TemplateAST | null;
  diagnostics: Diagnostic[];
}

interface PendingAttr {
  rawName: string;
  nameStart: number; // absolute offset of first byte of attribute name
  nameEnd: number; // absolute offset of byte AFTER last byte of name
  valueChunks: string[];
  valueStart: number | null;
  valueEnd: number | null;
}

interface PendingElement {
  tagName: string;
  tagOpenStart: number; // absolute offset of '<'
  attributes: TemplateAttr[];
  children: TemplateNode[];
  selfClosing: boolean;
}

const MUSTACHE_RE = /\{\{([^}]*?)\}\}/g;

export function parseTemplate(
  content: string,
  contentLoc: SourceLoc,
  source: string,
  filename?: string,
): ParseTemplateResult {
  const diagnostics: Diagnostic[] = [];
  const baseOffset = contentLoc.start;

  const rootChildren: TemplateNode[] = [];
  const stack: PendingElement[] = [];
  const topChildrenSink = (): TemplateNode[] =>
    stack.length === 0 ? rootChildren : (stack[stack.length - 1] as PendingElement).children;

  // Per-tag scratch state.
  let pendingTagName = '';
  let pendingTagOpenStart = 0;
  let pendingAttrs: TemplateAttr[] = [];
  let currentAttr: PendingAttr | null = null;

  const finalizeCurrentAttr = (quoteEndIndex: number): void => {
    if (!currentAttr) return;
    const a = currentAttr;
    const rawName = a.rawName;
    let kind: TemplateAttr['kind'];
    let name: string;
    let modifierChainText = '';
    let modifierChainBaseOffset = a.nameEnd; // default: end of name
    if (rawName.startsWith(':')) {
      kind = 'binding';
      name = rawName.slice(1);
    } else if (rawName.startsWith('@')) {
      kind = 'event';
      const dotIdx = rawName.indexOf('.');
      if (dotIdx >= 0) {
        name = rawName.slice(1, dotIdx);
        modifierChainText = rawName.slice(dotIdx);
        // The leading '.' lives at `a.nameStart + dotIdx`.
        modifierChainBaseOffset = a.nameStart + dotIdx;
      } else {
        name = rawName.slice(1);
      }
    } else if (rawName.startsWith('r-')) {
      kind = 'directive';
      name = rawName.slice(2);
    } else {
      kind = 'static';
      name = rawName;
    }
    const value = a.valueStart === null ? null : a.valueChunks.join('');
    const valueLoc =
      a.valueStart === null || a.valueEnd === null
        ? null
        : { start: a.valueStart, end: a.valueEnd };
    pendingAttrs.push({
      kind,
      rawName,
      name,
      modifierChainText,
      modifierChainBaseOffset,
      value,
      valueLoc,
      loc: { start: a.nameStart, end: quoteEndIndex },
    });
    currentAttr = null;
  };

  // Convert a text run into alternating TemplateText / TemplateInterpolation
  // nodes. `start`/`end` are ABSOLUTE byte offsets into the .rozie source.
  const splitTextWithMustache = (text: string, start: number, end: number): TemplateNode[] => {
    const out: TemplateNode[] = [];
    let cursor = 0;
    MUSTACHE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MUSTACHE_RE.exec(text)) !== null) {
      if (m.index > cursor) {
        const t: TemplateText = {
          type: 'TemplateText',
          text: text.slice(cursor, m.index),
          loc: { start: start + cursor, end: start + m.index },
        };
        out.push(t);
      }
      const interp: TemplateInterpolation = {
        type: 'TemplateInterpolation',
        rawExpr: m[1] ?? '',
        loc: { start: start + m.index, end: start + m.index + m[0].length },
      };
      out.push(interp);
      cursor = m.index + m[0].length;
    }
    if (cursor < text.length) {
      // Detect unmatched mustache opener in the trailing tail.
      const tail = text.slice(cursor);
      const unmatched = tail.indexOf('{{');
      if (unmatched >= 0) {
        diagnostics.push({
          code: RozieErrorCode.TEMPLATE_MALFORMED_MUSTACHE,
          severity: 'error',
          message: 'Unmatched `{{` in template — expected a closing `}}` in the same text run.',
          loc: { start: start + cursor + unmatched, end: start + cursor + unmatched + 2 },
          ...(filename !== undefined ? { filename } : {}),
        });
      }
      const t: TemplateText = {
        type: 'TemplateText',
        text: tail,
        loc: { start: start + cursor, end },
      };
      out.push(t);
    }
    return out;
  };

  const tokenizer = new Tokenizer(
    { xmlMode: false, decodeEntities: false },
    {
      onopentagname(start, endIndex) {
        pendingTagName = content.slice(start, endIndex).toLowerCase();
        pendingTagOpenStart = baseOffset + start - 1; // '<' is one byte before name start
        pendingAttrs = [];
        currentAttr = null;
      },

      onattribname(start, endIndex) {
        currentAttr = {
          rawName: content.slice(start, endIndex),
          nameStart: baseOffset + start,
          nameEnd: baseOffset + endIndex,
          valueChunks: [],
          valueStart: null,
          valueEnd: null,
        };
      },

      onattribdata(start, endIndex) {
        if (!currentAttr) return;
        if (currentAttr.valueStart === null) {
          currentAttr.valueStart = baseOffset + start;
        }
        currentAttr.valueEnd = baseOffset + endIndex;
        currentAttr.valueChunks.push(content.slice(start, endIndex));
      },

      onattribend(_quote, endIndex) {
        finalizeCurrentAttr(baseOffset + endIndex);
      },

      onopentagend(endIndex) {
        const elem: PendingElement = {
          tagName: pendingTagName,
          tagOpenStart: pendingTagOpenStart,
          attributes: pendingAttrs,
          children: [],
          selfClosing: false,
        };
        // The element's start span is recorded; loc.end is patched on close.
        // We register it as a child of the parent (or root) NOW so source
        // order is preserved; final loc is mutated in place on close.
        const built: TemplateElement = {
          type: 'TemplateElement',
          tagName: elem.tagName,
          attributes: elem.attributes,
          children: elem.children,
          selfClosing: false,
          loc: { start: elem.tagOpenStart, end: baseOffset + endIndex + 1 },
        };
        topChildrenSink().push(built);
        // Track in stack with pointer to the live `built` node so we can patch loc on close.
        stack.push({
          ...elem,
          // store a reference to the built node via a property assignment hack:
          // we re-use the `selfClosing` slot? No — keep separate. Use Symbol-like
          // by stashing the node directly on the pending entry.
        });
        // Stash the built node on the top stack entry under a marker key.
        (stack[stack.length - 1] as PendingElement & { _node: TemplateElement })._node = built;
        pendingTagName = '';
        pendingAttrs = [];
        currentAttr = null;
      },

      onselfclosingtag(endIndex) {
        const built: TemplateElement = {
          type: 'TemplateElement',
          tagName: pendingTagName,
          attributes: pendingAttrs,
          children: [],
          selfClosing: true,
          loc: { start: pendingTagOpenStart, end: baseOffset + endIndex + 1 },
        };
        topChildrenSink().push(built);
        // Self-closing tags do NOT push onto stack.
        pendingTagName = '';
        pendingAttrs = [];
        currentAttr = null;
      },

      onclosetag(start, endIndex) {
        // Find matching element on stack; if not found, ignore (orphan close tag).
        const closeName = content.slice(start, endIndex).toLowerCase();
        // Pop until we find a matching tagName, emitting ROZ050 for each
        // unmatched element popped (they were never properly closed).
        let popped: (PendingElement & { _node?: TemplateElement }) | undefined;
        while (stack.length > 0) {
          popped = stack.pop() as PendingElement & { _node?: TemplateElement };
          if (popped.tagName === closeName) {
            // Patch loc.end on the live built node.
            if (popped._node) {
              popped._node.loc = {
                start: popped._node.loc.start,
                end: baseOffset + endIndex + 1,
              };
            }
            return;
          }
          // Mismatched — emit ROZ050 for the unclosed element.
          diagnostics.push({
            code: RozieErrorCode.TEMPLATE_UNCLOSED_ELEMENT,
            severity: 'error',
            message: `Unclosed template element <${popped.tagName}>.`,
            loc: { start: popped.tagOpenStart, end: popped.tagOpenStart + popped.tagName.length + 1 },
            ...(filename !== undefined ? { filename } : {}),
          });
        }
      },

      ontext(start, endIndex) {
        const text = content.slice(start, endIndex);
        if (text.length === 0) return;
        const absStart = baseOffset + start;
        const absEnd = baseOffset + endIndex;
        const nodes = splitTextWithMustache(text, absStart, absEnd);
        const sink = topChildrenSink();
        for (const n of nodes) sink.push(n);
      },

      onattribentity() {},
      oncomment() {},
      oncdata() {},
      ondeclaration() {},
      onprocessinginstruction() {},
      ontextentity() {},
      onend() {
        // Unclosed elements remaining on stack — emit ROZ050 for each.
        while (stack.length > 0) {
          const popped = stack.pop() as PendingElement & { _node?: TemplateElement };
          diagnostics.push({
            code: RozieErrorCode.TEMPLATE_UNCLOSED_ELEMENT,
            severity: 'error',
            message: `Unclosed template element <${popped.tagName}>.`,
            loc: { start: popped.tagOpenStart, end: popped.tagOpenStart + popped.tagName.length + 1 },
            ...(filename !== undefined ? { filename } : {}),
          });
        }
      },
    },
  );

  tokenizer.write(content);
  tokenizer.end();

  return {
    node: {
      type: 'TemplateAST',
      loc: contentLoc,
      children: rootChildren,
    },
    diagnostics,
  };
}
