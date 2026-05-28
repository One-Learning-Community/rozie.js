import type { SourceLoc, TemplateElement, TemplateNode } from '@rozie/core';
import type { RozieComponentSymbol } from './symbols.js';

/**
 * Resolution of composed-component tags in `<template>` against the
 * `<components>` block. A `<Modal />` tag whose name matches a `<components>`
 * key navigates/hovers to that key's sibling `.rozie` file. Tag-name spans are
 * derived from the element's `<` offset (`loc.start`): the name immediately
 * follows the angle bracket.
 */

export interface ComponentTagHit {
  symbol: RozieComponentSymbol;
  /** Byte span of the opening tag NAME (`Modal` in `<Modal ...>`). */
  nameLoc: SourceLoc;
}

/** Span of an element's opening tag name, derived from its `<` offset. */
function tagNameLoc(el: TemplateElement): SourceLoc {
  const start = el.loc.start + 1; // skip '<'
  return { start, end: start + el.tagName.length };
}

function within(loc: SourceLoc, offset: number): boolean {
  return offset >= loc.start && offset <= loc.end;
}

/**
 * Find the composed-component tag whose opening name span covers [offset].
 * Returns null when the cursor is not on a registered component tag.
 */
export function componentTagAt(
  children: TemplateNode[],
  components: RozieComponentSymbol[],
  offset: number,
): ComponentTagHit | null {
  if (components.length === 0) return null;
  const byName = new Map(components.map((c) => [c.name, c]));

  let hit: ComponentTagHit | null = null;
  const visit = (node: TemplateNode): void => {
    if (hit || node.type !== 'TemplateElement') return;
    const el = node as TemplateElement;
    const symbol = byName.get(el.tagName);
    if (symbol) {
      const nameLoc = tagNameLoc(el);
      if (within(nameLoc, offset)) {
        hit = { symbol, nameLoc };
        return;
      }
    }
    for (const child of el.children) visit(child);
  };
  for (const child of children) visit(child);
  return hit;
}

/**
 * Resolve a `<components>` import path (e.g. `./Modal.rozie`) to an absolute
 * file URI, relative to the host document's URI. Returns null for paths the
 * WHATWG URL resolver can't handle (bare specifiers, malformed input).
 */
export function resolveComponentUri(path: string, baseUri: string): string | null {
  if (!/^\.{0,2}\//.test(path)) return null; // only relative ./ ../ or rooted /
  try {
    return new URL(path, baseUri).href;
  } catch {
    return null;
  }
}

export interface ComponentTagCompletionContext {
  /** Partial PascalCase name already typed after `<` (may be empty). */
  partial: string;
  /** Absolute byte offset where `partial` begins (where a replace edit starts). */
  partialStart: number;
}

const TAG_PREFIX_AT_END = /<([A-Za-z][A-Za-z0-9]*)?$/;

/**
 * Detect whether [offset] sits in an opening-tag-name position (`<` optionally
 * followed by a partial name) — the trigger for composed-component tag-name
 * completion. Closing tags (`</`) are excluded by the regex.
 */
export function componentTagCompletionContext(
  text: string,
  offset: number,
): ComponentTagCompletionContext | null {
  const before = text.slice(0, offset);
  const match = TAG_PREFIX_AT_END.exec(before);
  if (!match) return null;
  const partial = match[1] ?? '';
  return { partial, partialStart: offset - partial.length };
}
