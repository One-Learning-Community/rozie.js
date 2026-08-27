// Spike 018 — generate a virtual TypeScript module from a .rozie source,
// with Volar CodeMappings back to the original .rozie offsets.
//
// Everything the compiler already knows is reused: @rozie/core's parse() hands
// back absolute byte offsets for every block, a Babel ObjectExpression for
// <props> (with start/end on every key), and loc/valueLoc for every template
// interpolation and attribute expression.

import { parse } from '/Users/serpentblade/work/olc/rozie/packages/core/dist/index.mjs';

/**
 * Ambient declarations for Rozie's magic identifiers.
 *
 * Mirrors `RESERVED_SIGILS` (16 entries) + the lifecycle/callable sigils that
 * are not in that Set because they are call-forms rather than value sigils.
 */
const AMBIENT_PREAMBLE = [
  'declare const $props: __RozieProps;',
  'declare const $data: __RozieData;',
  'declare const $el: HTMLElement;',
  'declare const $refs: Record<string, any>;',
  'declare const $slots: Record<string, unknown>;',
  'declare const $attrs: Record<string, unknown>;',
  'declare const $listeners: Record<string, (...a: any[]) => void>;',
  'declare const $event: any;',
  'declare const $portals: Record<string, any>;',
  'declare const $model: any;',
  'declare const $slotted: any;',
  // call-forms
  'declare function $emit(event: string, ...args: any[]): void;',
  'declare function $expose(obj: Record<string, unknown>): void;',
  'declare function $provide(key: string, value: unknown): void;',
  'declare function $inject<T = unknown>(key: string, fallback?: T): T;',
  'declare function $clone<T>(v: T): T;',
  'declare function $restoreFocus(): void;',
  'declare function $computed<T>(fn: () => T): T;',
  'declare function $watch(...args: any[]): void;',
  'declare function $onMount(fn: () => void | (() => void)): void;',
  'declare function $onUnmount(fn: () => void): void;',
  'declare function $onUpdate(fn: () => void): void;',
  'declare function $reconcileAfterDomMutation(fn: () => void): void;',
  '',
].join('\n');

/** `type:` token in <props> -> TS type text. */
const TYPE_TOKENS = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Array: 'unknown[]',
  Object: 'Record<string, unknown>',
  Function: '(...args: unknown[]) => unknown',
  Date: 'Date',
};

/** Read one <props> entry -> { name, nameStart, tsType, optional }. */
function readPropEntry(prop) {
  if (prop.type !== 'ObjectProperty' || !prop.key || prop.key.type !== 'Identifier') return null;
  const name = prop.key.name;
  const nameStart = prop.key.start;
  const v = prop.value;

  // Shorthand: `label: String`
  if (v.type === 'Identifier') {
    return { name, nameStart, tsType: TYPE_TOKENS[v.name] ?? 'unknown', optional: true };
  }

  // Descriptor: `label: { type: String, default: 'hi', required: true }`
  if (v.type === 'ObjectExpression') {
    let tsType = 'unknown';
    let hasDefault = false;
    let required = false;
    for (const p of v.properties) {
      if (p.type !== 'ObjectProperty' || p.key?.type !== 'Identifier') continue;
      if (p.key.name === 'type' && p.value.type === 'Identifier') {
        tsType = TYPE_TOKENS[p.value.name] ?? 'unknown';
      } else if (p.key.name === 'default') {
        hasDefault = true;
      } else if (p.key.name === 'required' && p.value.type === 'BooleanLiteral') {
        required = p.value.value;
      }
    }
    return { name, nameStart, tsType, optional: !required && !hasDefault };
  }
  return { name, nameStart, tsType: 'unknown', optional: true };
}

/**
 * @param {string} source  raw .rozie text
 * @returns {{ code: string, mappings: import('@volar/language-core').CodeMapping[],
 *            diagnostics: unknown[], propNames: string[] }}
 */
export function generateVirtualTs(source, filename = 'Probe.rozie') {
  const { ast, diagnostics } = parse(source, { filename });

  let code = '';
  const sourceOffsets = [];
  const generatedOffsets = [];
  const lengths = [];

  /** Emit generated-only text (no mapping back to source). */
  const gen = (text) => { code += text; };

  /** Emit text that IS source text, mapped back to `srcStart`. */
  const mapped = (text, srcStart) => {
    sourceOffsets.push(srcStart);
    generatedOffsets.push(code.length);
    lengths.push(text.length);
    code += text;
  };

  // ---- 1. $props interface, each key mapped back to its <props> key ----------
  const propNames = [];
  gen('interface __RozieProps {\n');
  if (ast.props?.expression?.properties) {
    for (const p of ast.props.expression.properties) {
      const e = readPropEntry(p);
      if (!e) continue;
      propNames.push(e.name);
      gen('  ');
      mapped(e.name, e.nameStart);          // go-to-definition target
      gen(`${e.optional ? '?' : ''}: ${e.tsType};\n`);
    }
  }
  gen('}\n');

  // ---- 2. $data, inferred from the literal (mapped verbatim) ----------------
  if (ast.data?.expression) {
    const d = ast.data.expression;
    gen('const __rozieDataInit = ');
    mapped(source.slice(d.start, d.end), d.start);
    gen(';\ntype __RozieData = typeof __rozieDataInit;\n');
  } else {
    gen('type __RozieData = Record<string, never>;\n');
  }

  // ---- 3. the ambient magic identifiers ------------------------------------
  // NOTE: this list duplicates `RESERVED_SIGILS` in
  // packages/core/src/semantic/validators/reservedIdentifierValidator.ts plus the
  // lifecycle/callable sigils. It is hand-copied ONLY because RESERVED_SIGILS is
  // not exported from the @rozie/core barrel — see REQ-V8. The real server must
  // import it, not fork it.
  gen(AMBIENT_PREAMBLE);

  // ---- 4. <script> body, verbatim and fully mapped --------------------------
  if (ast.script) {
    const s = ast.script.loc;
    gen('\n// --- <script> ---\n');
    mapped(source.slice(s.start, s.end), s.start);
    gen('\n');
  }

  // ---- 5. template expressions, each wrapped so TS checks it in scope -------
  gen('\n// --- <template> expressions ---\n');
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);

    // `r-for="item in coll"` / `r-for="(item, i) in coll"` introduces bindings
    // that every expression in this element's SUBTREE can see. Emitting a real
    // `for (const item of (coll))` gives those aliases their true element type
    // instead of "Cannot find name 'item'".
    if (node.type === 'TemplateElement') {
      const rFor = (node.attributes ?? []).find(a => a.kind === 'directive' && a.name === 'for');
      if (rFor?.value) {
        const m = /^\s*\(?\s*([A-Za-z_$][\w$]*)\s*(?:,\s*([A-Za-z_$][\w$]*)\s*)?\)?\s+(?:in|of)\s+([\s\S]+)$/.exec(rFor.value);
        if (m) {
          const [, alias, idx, coll] = m;
          const collStart = rFor.valueLoc.start + rFor.value.lastIndexOf(coll);
          gen(`for (const ${alias} of (`);
          mapped(coll, collStart);
          gen(') as any[]) {\n');
          if (idx) gen(`  const ${idx} = 0;\n  void ${idx};\n`);
          gen(`  void ${alias};\n`);
          emitElement(node);
          walk(node.children);
          gen('}\n');
          return;
        }
      }
    }

    if (node.type === 'TemplateInterpolation') {
      // loc spans `{{ ... }}`; rawExpr begins 2 chars in.
      gen('void (');
      mapped(node.rawExpr, node.loc.start + 2);
      gen(');\n');
    }

    if (node.type === 'TemplateElement') emitElement(node);

    if (node.children) walk(node.children);
  };

  function emitElement(node) {
    for (const attr of node.attributes ?? []) {
      // Event handlers and :bound props both hold JS expressions.
      if ((attr.kind === 'event' || attr.kind === 'binding') && attr.valueLoc) {
        gen(attr.kind === 'event' ? '(($event: any) => { void $event; ' : 'void (');
        mapped(source.slice(attr.valueLoc.start, attr.valueLoc.end), attr.valueLoc.start);
        gen(attr.kind === 'event' ? ' });\n' : ');\n');
      }
    }
  }
  walk(ast.template?.children);

  // Each virtual file MUST be a module. Without this every .rozie file's
  // generated `$props` / `$data` / `__RozieProps` lands in the GLOBAL scope and
  // any second .rozie file in the project collides:
  //   "Cannot redeclare block-scoped variable '$props'"
  // Discovered in the Spike 018 proof — see Investigation Trail.
  gen('\nexport {};\n');

  /** @type {import('@volar/language-core').CodeMapping[]} */
  const mappings = [{
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
  }];

  return { code, mappings, diagnostics, propNames };
}
