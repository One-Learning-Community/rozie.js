import { parse } from '@rozie/core';
import type { SourceLoc, TemplateElement, TemplateNode } from '@rozie/core';
import { extractSymbols, type RozieSymbol } from './symbols.js';

/**
 * The public, consumer-facing surface of a producer `.rozie` component: the
 * props a consumer may pass, the events it may listen to, and the slots it may
 * fill. Cross-file features (component-tag attribute completion, slot-fill
 * navigation) read this from the resolved producer document — the same
 * `@rozie/core` parse the producer's own editor uses, so the surface can never
 * drift from what the compiler actually accepts.
 */
export interface ProducerSurface {
  props: RozieSymbol[];
  events: ProducerEvent[];
  slots: ProducerSlot[];
}

export interface ProducerEvent {
  name: string;
}

export interface ProducerSlot {
  name: string;
  /** Byte span (in the PRODUCER source) of the slot name to navigate to. */
  loc: SourceLoc;
}

// `$emit('name'` / `$emit("name"` — the canonical event declaration. Scanned
// over the whole producer source (events surface from <script>, <listeners>,
// and template handlers alike); the leading sigil keeps it unambiguous.
const EMIT_CALL = /\$emit\(\s*['"]([^'"]+)['"]/g;

function collectEvents(source: string): ProducerEvent[] {
  const seen = new Set<string>();
  const out: ProducerEvent[] = [];
  EMIT_CALL.lastIndex = 0;
  for (let m = EMIT_CALL.exec(source); m !== null; m = EMIT_CALL.exec(source)) {
    const name = m[1]!;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name });
  }
  return out;
}

function collectSlots(children: TemplateNode[]): ProducerSlot[] {
  const out: ProducerSlot[] = [];
  const seen = new Set<string>();

  const visit = (node: TemplateNode): void => {
    if (node.type !== 'TemplateElement') return;
    const el = node as TemplateElement;
    if (el.tagName === 'slot') {
      const nameAttr = el.attributes.find((a) => a.name === 'name' && a.kind === 'static');
      const name = nameAttr?.value ?? 'default';
      // Navigate to the name attr value when present, else the `slot` tag name.
      const loc: SourceLoc =
        nameAttr?.valueLoc ?? { start: el.loc.start + 1, end: el.loc.start + 1 + el.tagName.length };
      if (!seen.has(name)) {
        seen.add(name);
        out.push({ name, loc });
      }
    }
    for (const child of el.children) visit(child);
  };
  for (const child of children) visit(child);
  return out;
}

/**
 * Parse a producer `.rozie` source and extract its consumer-facing surface.
 * Returns empty arrays (never null) when the source fails to parse, so callers
 * degrade to "no suggestions" rather than erroring.
 */
export function extractProducerSurface(source: string): ProducerSurface {
  const { ast } = parse(source);
  if (!ast) return { props: [], events: [], slots: [] };
  return {
    props: extractSymbols(ast, source).props,
    events: collectEvents(source),
    slots: ast.template ? collectSlots(ast.template.children) : [],
  };
}
