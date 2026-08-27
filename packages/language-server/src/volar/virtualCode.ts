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
        // loc spans `{{ ... }}`; rawExpr begins 2 chars in.
        gen('void (');
        mapped(node.rawExpr, node.loc.start + 2);
        gen(');\n');
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
