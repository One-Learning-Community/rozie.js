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

export interface SlotFillHit {
  /** The component whose slot is being filled (the enclosing component tag). */
  component: RozieComponentSymbol;
  /** Slot name (the `#name` without the hash; `default` for bare `#`). */
  slotName: string;
  /** Byte span of the `#name` token in the consumer source. */
  nameLoc: SourceLoc;
}

/**
 * Find a slot-fill (`#slotName`, as on `<template #header>` or `<Modal #x>`) at
 * [offset], paired with the component it fills — the nearest enclosing
 * registered component (the bearing element itself when that is the component).
 * Returns null when the cursor is not on a slot-fill of a known component.
 */
export function slotFillAt(
  children: TemplateNode[],
  components: RozieComponentSymbol[],
  offset: number,
): SlotFillHit | null {
  if (components.length === 0) return null;
  const byName = new Map(components.map((c) => [c.name, c]));

  let hit: SlotFillHit | null = null;
  const visit = (node: TemplateNode, enclosing: RozieComponentSymbol | null): void => {
    if (hit || node.type !== 'TemplateElement') return;
    const el = node as TemplateElement;
    const self = byName.get(el.tagName) ?? null;
    const owning = self ?? enclosing;

    if (owning) {
      for (const attr of el.attributes) {
        if (!attr.rawName.startsWith('#')) continue;
        const nameLoc: SourceLoc = { start: attr.loc.start, end: attr.loc.start + attr.rawName.length };
        if (offset >= nameLoc.start && offset <= nameLoc.end) {
          const slotName = attr.rawName.slice(1) || 'default';
          hit = { component: owning, slotName, nameLoc };
          return;
        }
      }
    }
    for (const child of el.children) visit(child, self ?? enclosing);
  };
  for (const child of children) visit(child, null);
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

export interface TagAttributeContext {
  /** The enclosing open tag's name (caller checks it against `<components>`). */
  tagName: string;
  /** Attribute prefix being typed: ':' prop, '@' event, '#' slot, '' plain. */
  prefix: '' | ':' | '@' | '#';
  /** The attribute-name chars typed after the prefix (may be empty). */
  partial: string;
  /** Absolute byte offset where `partial` begins (where a replace edit starts). */
  partialStart: number;
}

const ATTR_TOKEN_AT_END = /([:@#]?)([A-Za-z][\w-]*)?$/;

/**
 * Detect an attribute-name position inside an open tag: the cursor sits after
 * `<Tag ` (optionally mid-attribute), not inside an attribute value. Scans back
 * to the opening `<`, skipping fully-quoted prior attribute values as pairs (so
 * `<Modal :open="x" @cl|`* still resolves), and bails if the cursor is inside an
 * unterminated value or the tag is already closed — erring toward no completion
 * rather than a wrong one.
 */
export function tagAttributeContext(text: string, offset: number): TagAttributeContext | null {
  let i = offset - 1;
  while (i >= 0) {
    const ch = text[i]!;
    if (ch === '"' || ch === "'") {
      // Closing quote of a completed prior value — skip left to its opener.
      const quote = ch;
      i -= 1;
      while (i >= 0 && text[i] !== quote) i -= 1;
      if (i < 0) return null; // unbalanced ⇒ cursor was inside a value
      i -= 1; // step past the opening quote
      continue;
    }
    if (ch === '>') return null; // tag already closed before the cursor
    if (ch === '<') break;
    i -= 1;
  }
  if (i < 0) return null;

  const tagMatch = /^<([A-Za-z][\w.-]*)/.exec(text.slice(i, offset));
  if (!tagMatch) return null;
  const tagName = tagMatch[1]!;

  // Must be in attribute territory: whitespace immediately follows the tag name,
  // and the cursor is past it (rules out the still-typing-the-tag-name case).
  const afterName = i + 1 + tagName.length;
  if (offset <= afterName || !/\s/.test(text[afterName] ?? '')) return null;

  const attrMatch = ATTR_TOKEN_AT_END.exec(text.slice(0, offset));
  const prefix = (attrMatch?.[1] ?? '') as '' | ':' | '@' | '#';
  const partial = attrMatch?.[2] ?? '';
  return { tagName, prefix, partial, partialStart: offset - partial.length };
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
