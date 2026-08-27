/**
 * Phase 85 Task 1 — the virtual-TypeScript generator.
 *
 * Ported from the proven spike
 * (`.claude/skills/spike-findings-rozie/sources/018-volar-virtual-ts-rozie/rozie-virtual-code.mjs`,
 * 11/11 against a real `ts.LanguageService`). Behavior is kept identical; only
 * the ambient preamble now comes from `./sigils.js` (backed by `@rozie/core`'s
 * `RESERVED_SIGILS`, REQ-V8) instead of a hand-forked list.
 *
 * `@rozie/core`'s `parse()` already supplies everything needed for the
 * mapping data — no compiler change required:
 *   - block offsets:        ast.{props,data,script,template}.loc
 *   - per-prop key offsets: ast.props.expression is a Babel ObjectExpression
 *                            with absolute start/end on every node
 *   - interpolations:       TemplateInterpolation.loc + rawExpr (expression
 *                            begins at loc.start + 2)
 *   - attribute expressions: attributes[].valueLoc; kind is 'event' |
 *                            'binding' | 'directive' (never 'bind')
 *
 * REQ-V6 (`export {};` at the end) is what keeps each `.rozie` file's
 * `$props`/`$data`/`__RozieProps` file-scoped — without it, a second
 * `.rozie` file in the same project collides in global scope. Reproduces
 * only with >=2 files; see `virtualCode.prove.test.ts`.
 *
 * The generator body MUST NEVER throw — a malformed `.rozie` file degrades
 * to an empty module with empty mappings (T-85-01) rather than killing the
 * server.
 */
import { parse } from '@rozie/core';
import type { CodeMapping } from '@volar/language-core';
import type {
  ObjectExpression,
  ObjectProperty,
} from '@babel/types';
import type { TemplateAttr, TemplateElement, TemplateNode } from '@rozie/core';
import { buildAmbientPreamble } from './sigils.js';

export interface GenerateVirtualTsResult {
  code: string;
  mappings: CodeMapping[];
  diagnostics: unknown[];
  propNames: string[];
}

/** `type:` token in <props> -> TS type text. */
const TYPE_TOKENS: Record<string, string> = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Array: 'unknown[]',
  Object: 'Record<string, unknown>',
  Function: '(...args: unknown[]) => unknown',
  Date: 'Date',
};

interface PropEntry {
  name: string;
  nameStart: number;
  tsType: string;
  optional: boolean;
}

/** Read one <props> entry -> { name, nameStart, tsType, optional }, or null for a shape this reader doesn't recognize. */
function readPropEntry(prop: ObjectExpression['properties'][number]): PropEntry | null {
  if (prop.type !== 'ObjectProperty' || prop.key.type !== 'Identifier') return null;
  const p = prop as ObjectProperty;
  const key = p.key;
  if (key.type !== 'Identifier' || key.start == null) return null;
  const name = key.name;
  const nameStart = key.start;
  const v = p.value;

  // Shorthand: `label: String`
  if (v.type === 'Identifier') {
    return { name, nameStart, tsType: TYPE_TOKENS[v.name] ?? 'unknown', optional: true };
  }

  // Descriptor: `label: { type: String, default: 'hi', required: true }`
  if (v.type === 'ObjectExpression') {
    let tsType = 'unknown';
    let hasDefault = false;
    let required = false;
    for (const inner of v.properties) {
      if (inner.type !== 'ObjectProperty' || inner.key.type !== 'Identifier') continue;
      if (inner.key.name === 'type' && inner.value.type === 'Identifier') {
        tsType = TYPE_TOKENS[inner.value.name] ?? 'unknown';
      } else if (inner.key.name === 'default') {
        hasDefault = true;
      } else if (inner.key.name === 'required' && inner.value.type === 'BooleanLiteral') {
        required = inner.value.value;
      }
    }
    return { name, nameStart, tsType, optional: !required && !hasDefault };
  }
  return { name, nameStart, tsType: 'unknown', optional: true };
}

function findRForAttr(el: TemplateElement): TemplateAttr | undefined {
  return el.attributes.find((a) => a.kind === 'directive' && a.name === 'for');
}

const R_FOR_PATTERN =
  /^\s*\(?\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*)\s*)?\)?\s+(?:in|of)\s+([\s\S]+)$/;

/**
 * REQ-V11 — a `<template #name="{ a, b }">` (or `#default="{ a, b }"`) fill
 * carries a scoped-params destructure as a plain attribute: parseTemplate.ts
 * keeps every `#`-prefixed attribute at kind:'static', rawName verbatim
 * (see lowerSlotFillers.ts's own `findFillAttr`, the compiler's identical
 * check on the identical shape — read here, not re-derived).
 */
function findFillAttr(el: TemplateElement): TemplateAttr | undefined {
  return el.attributes.find((a) => a.rawName.startsWith('#'));
}

/** One destructured slot-fill param, mapped back to its OWN offset in source. */
interface SlotParamBinding {
  /** The local binding name used inside the scope body (post-rename, if renamed). */
  localName: string;
  /** Absolute source offset where `localName` itself appears in the fill's attribute value. */
  offset: number;
}

/**
 * Simple identifier bindings only — `{ key }` or the rename shape
 * `{ key: localName }`. Mirrors the compiler's own `parseScopedParams`
 * (`lowerSlotFillers.ts`): non-identifier entries (spreads, nested
 * destructures, computed keys, default expressions) are silently dropped
 * rather than causing a parse failure, matching the compiler's own
 * degrade-not-throw contract for this exact syntax.
 */
const SLOT_PARAM_ENTRY_PATTERN = /^([A-Za-z_$][\w$]*)(?:\s*:\s*([A-Za-z_$][\w$]*))?$/;

/**
 * Parse a fill's destructure text (`"{ a, b: c }"`, the raw attribute value
 * — braces included, per parseTemplate.ts's `value` shape) into per-binding
 * local names, each mapped back to its OWN offset inside that value rather
 * than the whole attribute — mapping the whole attribute would make hover
 * and navigation land on the braces instead of the name (T-85-19).
 *
 * Returns `[]` — the generator's "no scope block" degenerate path — for
 * anything not wrapped in `{ ... }`, for unbalanced braces, and for an
 * empty/whitespace-only destructure. Never throws.
 */
function parseSlotParamBindings(value: string, valueStart: number): SlotParamBinding[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return [];
  const openIdx = value.indexOf('{');
  const closeIdx = value.lastIndexOf('}');
  if (openIdx === -1 || closeIdx === -1 || closeIdx <= openIdx) return [];

  const inner = value.slice(openIdx + 1, closeIdx);
  const innerStart = valueStart + openIdx + 1;
  const bindings: SlotParamBinding[] = [];

  const pushSegment = (raw: string, rawStart: number): void => {
    const seg = raw.trim();
    if (seg.length === 0) return;
    const m = SLOT_PARAM_ENTRY_PATTERN.exec(seg);
    if (!m) return; // spread / nested destructure / default / computed key — drop
    const key = m[1] as string;
    const rename = m[2];
    const localName = rename ?? key;
    const leading = raw.length - raw.trimStart().length;
    const nameOffsetInSeg = rename ? seg.lastIndexOf(rename) : 0;
    bindings.push({ localName, offset: rawStart + leading + nameOffsetInSeg });
  };

  // Split on top-level commas only — `{ a: { b } }`'s nested braces (a
  // non-identifier value, dropped anyway) must not fracture the split.
  let depth = 0;
  let segStart = 0;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '{' || ch === '[' || ch === '(') depth++;
    else if (ch === '}' || ch === ']' || ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      pushSegment(inner.slice(segStart, i), innerStart + segStart);
      segStart = i + 1;
    }
  }
  pushSegment(inner.slice(segStart), innerStart + segStart);
  return bindings;
}

/**
 * Generate virtual TypeScript for one `.rozie` source. Never throws — a
 * generator failure degrades to an empty module with empty mappings (T-85-01).
 */
export function generateVirtualTs(source: string, filename = 'Probe.rozie'): GenerateVirtualTsResult {
  try {
    return generateVirtualTsUnsafe(source, filename);
  } catch (e) {
    return {
      code: 'export {};\n',
      mappings: [{ sourceOffsets: [], generatedOffsets: [], lengths: [], data: {} }],
      diagnostics: [
        {
          message: `[rozie] virtual-code generation failed: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
      propNames: [],
    };
  }
}

function generateVirtualTsUnsafe(source: string, filename: string): GenerateVirtualTsResult {
  const { ast, diagnostics } = parse(source, { filename });

  let code = '';
  const sourceOffsets: number[] = [];
  const generatedOffsets: number[] = [];
  const lengths: number[] = [];

  /** Emit generated-only text (no mapping back to source). */
  const gen = (text: string): void => {
    code += text;
  };

  /** Emit text that IS source text, mapped back to `srcStart`. */
  const mapped = (text: string, srcStart: number): void => {
    sourceOffsets.push(srcStart);
    generatedOffsets.push(code.length);
    lengths.push(text.length);
    code += text;
  };

  // ---- 1. $props interface, each key mapped back to its <props> key ----------
  const propNames: string[] = [];
  gen('interface __RozieProps {\n');
  if (ast?.props?.expression.properties) {
    for (const p of ast.props.expression.properties) {
      const e = readPropEntry(p);
      if (!e) continue;
      propNames.push(e.name);
      gen('  ');
      mapped(e.name, e.nameStart); // go-to-definition target
      gen(`${e.optional ? '?' : ''}: ${e.tsType};\n`);
    }
  }
  gen('}\n');

  // ---- 2. $data, inferred from the literal (mapped verbatim) ----------------
  if (ast?.data?.expression) {
    const d = ast.data.expression;
    gen('const __rozieDataInit = ');
    mapped(source.slice(d.start ?? 0, d.end ?? 0), d.start ?? 0);
    gen(';\ntype __RozieData = typeof __rozieDataInit;\n');
  } else {
    gen('type __RozieData = Record<string, never>;\n');
  }

  // ---- 3. the ambient magic identifiers ------------------------------------
  // Sourced from `@rozie/core`'s `RESERVED_SIGILS` via sigils.ts — REQ-V8.
  gen(buildAmbientPreamble());

  // ---- 4. <script> body, verbatim and fully mapped --------------------------
  if (ast?.script) {
    const s = ast.script.loc;
    gen('\n// --- <script> ---\n');
    mapped(source.slice(s.start, s.end), s.start);
    gen('\n');
  }

  // ---- 5. template expressions, each wrapped so TS checks it in scope -------
  gen('\n// --- <template> expressions ---\n');

  function emitElement(node: TemplateElement): void {
    for (const attr of node.attributes) {
      // Event handlers and :bound props both hold JS expressions.
      if ((attr.kind === 'event' || attr.kind === 'binding') && attr.valueLoc && attr.value !== null) {
        gen(attr.kind === 'event' ? '(($event: any) => { void $event; ' : 'void (');
        mapped(source.slice(attr.valueLoc.start, attr.valueLoc.end), attr.valueLoc.start);
        gen(attr.kind === 'event' ? ' });\n' : ');\n');
      }
    }
  }

  function walk(nodes: TemplateNode[] | undefined): void {
    if (!nodes) return;
    for (const node of nodes) {
      // REQ-V11 — `<template #name="{ a, b }">` introduces bindings visible
      // to every expression in the fill's own SUBTREE *and* to the fill
      // element's own attribute expressions (a fill can bind an attribute
      // off its own scoped params). Same shape as the r-for alias lowering
      // just below: a real scope, opened before the element's own attribute
      // expressions are emitted and closed after its children are walked.
      // Getting that ordering wrong is the one thing no coarse test would
      // catch — a param that resolves in the body but not on the fill
      // element's own bound attribute.
      if (node.type === 'TemplateElement') {
        const fillAttr = findFillAttr(node);
        if (fillAttr && fillAttr.value !== null && fillAttr.valueLoc) {
          const bindings = parseSlotParamBindings(fillAttr.value, fillAttr.valueLoc.start);
          if (bindings.length > 0) {
            gen('{\n');
            for (const b of bindings) {
              gen('  const ');
              mapped(b.localName, b.offset);
              gen(' = (undefined as any);\n');
              gen(`  void ${b.localName};\n`);
            }
            emitElement(node);
            walk(node.children);
            gen('}\n');
            continue;
          }
          // No simple bindings survived (all dropped, or malformed) — fall
          // through to normal handling. Never throws, never emits a scope
          // block, changes nothing about the generated body (T-85-17).
        }
      }

      // `r-for="item in coll"` / `r-for="(item, i) in coll"` introduces bindings
      // that every expression in this element's SUBTREE can see. Emitting a real
      // `for (const item of (coll))` gives those aliases their true element type
      // instead of "Cannot find name 'item'".
      if (node.type === 'TemplateElement') {
        const rFor = findRForAttr(node);
        if (rFor?.value && rFor.valueLoc) {
          const m = R_FOR_PATTERN.exec(rFor.value);
          if (m) {
            const [, alias, idx, coll] = m;
            if (alias && coll) {
              const collStart = rFor.valueLoc.start + rFor.value.lastIndexOf(coll);
              gen(`for (const ${alias} of (`);
              mapped(coll, collStart);
              gen(') as any[]) {\n');
              if (idx) gen(`  const ${idx} = 0;\n  void ${idx};\n`);
              gen(`  void ${alias};\n`);
              emitElement(node);
              walk(node.children);
              gen('}\n');
              continue;
            }
          }
        }
      }

      if (node.type === 'TemplateInterpolation') {
        // Phase 85 Plan 03 (REQ-V13) — `node.recovered` marks a parser
        // error-recovery node for an unterminated `{{`. loc spans `{{ ... }}`
        // for a well-formed node, or the opener through the end of the text
        // run for a recovered one — either way, the expression text begins
        // 2 chars past `loc.start` (right after the opening braces).
        if (node.recovered && node.rawExpr.trim() === '') {
          // The caret sits immediately after a freshly-typed `{{`, with
          // nothing typed yet — there is no expression to wrap. Emitting
          // `void ();` would be a syntax error that breaks type-checking
          // for the REST of the virtual module, so emit no code text at
          // all. Still register a ZERO-LENGTH mapping at this exact source
          // position (mapped('', ...) — pushes a mapping, appends nothing
          // to `code`) so Volar can translate a completion request at that
          // caret into a generated position. That generated position is
          // wherever the emission cursor already is — i.e. whatever
          // surrounding scope (an r-for loop body, or the top level) is
          // currently open — so completion there resolves exactly the
          // sigils/bindings in scope, same as a well-formed interpolation.
          mapped('', node.loc.start + 2);
        } else {
          gen('void (');
          mapped(node.rawExpr, node.loc.start + 2);
          gen(');\n');
        }
      }

      if (node.type === 'TemplateElement') {
        emitElement(node);
        walk(node.children);
      }
    }
  }
  walk(ast?.template?.children);

  // Each virtual file MUST be a module. Without this every .rozie file's
  // generated `$props` / `$data` / `__RozieProps` lands in the GLOBAL scope and
  // any second .rozie file in the project collides:
  //   "Cannot redeclare block-scoped variable '$props'"
  // REQ-V6 — see virtualCode.prove.test.ts for the standing guard.
  gen('\nexport {};\n');

  const mappings: CodeMapping[] = [
    {
      sourceOffsets,
      generatedOffsets,
      lengths,
      data: {
        completion: true,
        format: false,
        navigation: true,
        semantic: true,
        structure: true,
        verification: true,
      },
    },
  ];

  return { code, mappings, diagnostics, propNames };
}
