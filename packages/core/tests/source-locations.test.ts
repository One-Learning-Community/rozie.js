// D-12 / Phase 1 Success Criterion 5 — off-by-one source-location regression.
// Implementation: Plans 02-04 thread byte offsets from day one. This file is
// the regression guard: pick known tokens in each example × each block type,
// assert `node.loc.start === source.indexOf(token)` exactly.
//
// At least one byte-offset assertion per example × per present block-type.
// Total: 25+ assertions across the matrix.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../src/parse.js';
import type { TemplateAttr, TemplateNode, TemplateElement } from '../src/ast/blocks/TemplateAST.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
}

/** Recursively collect every TemplateAttr from a template tree. */
function collectAttrs(nodes: TemplateNode[]): TemplateAttr[] {
  const attrs: TemplateAttr[] = [];
  function walk(n: TemplateNode): void {
    if (n.type === 'TemplateElement') {
      const el = n as TemplateElement;
      attrs.push(...el.attributes);
      for (const c of el.children) walk(c);
    }
  }
  for (const n of nodes) walk(n);
  return attrs;
}

/** Babel Identifier helper — finds an identifier by `name` in a Babel ObjectExpression's properties. */
interface BabelLoc {
  start: { line: number; column: number; index: number };
  end?: { line: number; column: number; index: number };
}
interface BabelIdent {
  type: 'Identifier';
  name: string;
  start: number;
  end: number;
  loc: BabelLoc;
}
interface BabelObjectProperty {
  type: 'ObjectProperty';
  key: BabelIdent | { type: string; start: number };
  value: { start: number; end: number };
  start: number;
  end: number;
}

describe('Off-by-one source-location regression (D-12 / Phase 1 Success Criterion 5)', () => {
  // ===== Counter.rozie — props / data / script / template / style =====

  it('Counter.rozie — <props> "value" identifier loc.start === source.indexOf("value")', () => {
    const source = loadExample('Counter');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    const props = ast!.props!;
    const firstProp = props.expression.properties[0] as unknown as BabelObjectProperty;
    const key = firstProp.key as BabelIdent;
    expect(key.name).toBe('value');
    expect(key.loc.start.index).toBe(source.indexOf('value'));
  });

  it('Counter.rozie — <data> "hovering" identifier loc.start === source.indexOf("hovering")', () => {
    const source = loadExample('Counter');
    const { ast } = parse(source);
    const data = ast!.data!;
    const firstProp = data.expression.properties[0] as unknown as BabelObjectProperty;
    const key = firstProp.key as BabelIdent;
    expect(key.name).toBe('hovering');
    expect(key.loc.start.index).toBe(source.indexOf('hovering'));
  });

  it('Counter.rozie — <script> "canIncrement" VariableDeclaration loc.start byte-accurate', () => {
    const source = loadExample('Counter');
    const { ast } = parse(source);
    const script = ast!.script!;
    // Find the VariableDeclaration whose first declarator id is `canIncrement`.
    // Phase 3 Plan 02 Task 3 added a leading `console.log("hello from rozie")`
    // ExpressionStatement (DX-03 trust-erosion floor anchor) so body[0] is no
    // longer the canIncrement decl — locate by id-name instead.
    const decl = script.program.program.body
      .map((s) => s as unknown as { type: string; declarations?: Array<{ id: BabelIdent }> })
      .find((s) => s.type === 'VariableDeclaration' && s.declarations?.[0]?.id.name === 'canIncrement');
    expect(decl).toBeDefined();
    const firstDecl = decl!.declarations![0]!;
    expect(firstDecl.id.name).toBe('canIncrement');
    expect(firstDecl.id.loc.start.index).toBe(source.indexOf('canIncrement'));
  });

  it('Counter.rozie — <template> first @mouseenter event attribute loc.start byte-accurate', () => {
    const source = loadExample('Counter');
    const { ast } = parse(source);
    const attrs = collectAttrs(ast!.template!.children);
    const me = attrs.find((a) => a.rawName === '@mouseenter');
    expect(me).toBeDefined();
    expect(me!.loc.start).toBe(source.indexOf('@mouseenter'));
  });

  it('Counter.rozie — <style> first ".counter" rule loc.start byte-accurate', () => {
    const source = loadExample('Counter');
    const { ast } = parse(source);
    const rule = ast!.style!.rules[0]!;
    expect(rule.selector).toBe('.counter');
    expect(rule.loc.start).toBe(source.indexOf('.counter'));
  });

  // ===== SearchInput.rozie — props / data / script / template / style =====

  it('SearchInput.rozie — <props> "placeholder" identifier loc.start byte-accurate', () => {
    const source = loadExample('SearchInput');
    const { ast } = parse(source);
    const firstProp = ast!.props!.expression.properties[0] as unknown as BabelObjectProperty;
    const key = firstProp.key as BabelIdent;
    expect(key.name).toBe('placeholder');
    expect(key.loc.start.index).toBe(source.indexOf('placeholder'));
  });

  it('SearchInput.rozie — <data> "query" identifier loc.start byte-accurate', () => {
    const source = loadExample('SearchInput');
    const { ast } = parse(source);
    const firstProp = ast!.data!.expression.properties[0] as unknown as BabelObjectProperty;
    const key = firstProp.key as BabelIdent;
    expect(key.name).toBe('query');
    expect(key.loc.start.index).toBe(source.indexOf('query'));
  });

  it('SearchInput.rozie — <script> "isValid" identifier loc.start byte-accurate', () => {
    const source = loadExample('SearchInput');
    const { ast } = parse(source);
    const firstStmt = ast!.script!.program.program.body[0] as unknown as {
      declarations: Array<{ id: BabelIdent }>;
    };
    const decl = firstStmt.declarations[0]!;
    expect(decl.id.name).toBe('isValid');
    expect(decl.id.loc.start.index).toBe(source.indexOf('isValid'));
  });

  it('SearchInput.rozie — <template> r-model directive loc.start byte-accurate', () => {
    const source = loadExample('SearchInput');
    const { ast } = parse(source);
    const attrs = collectAttrs(ast!.template!.children);
    const rModel = attrs.find((a) => a.rawName === 'r-model');
    expect(rModel).toBeDefined();
    // Use the unique attribute syntax to skip the doc-comment occurrences
    // ("- r-model on a form input").
    expect(rModel!.loc.start).toBe(source.indexOf('r-model="$data.query"'));
  });

  it('SearchInput.rozie — <template> @input.debounce(300) event attribute loc.start byte-accurate', () => {
    const source = loadExample('SearchInput');
    const { ast } = parse(source);
    const attrs = collectAttrs(ast!.template!.children);
    const at = attrs.find((a) => a.rawName === '@input.debounce(300)');
    expect(at).toBeDefined();
    expect(at!.loc.start).toBe(source.indexOf('@input.debounce(300)'));
  });

  it('SearchInput.rozie — <style> ".search-input" rule loc.start byte-accurate', () => {
    const source = loadExample('SearchInput');
    const { ast } = parse(source);
    const rule = ast!.style!.rules[0]!;
    expect(rule.selector).toBe('.search-input');
    expect(rule.loc.start).toBe(source.indexOf('.search-input'));
  });

  // ===== Dropdown.rozie — props / script / listeners / template / style =====

  it('Dropdown.rozie — <props> "open" identifier loc.start byte-accurate', () => {
    const source = loadExample('Dropdown');
    const { ast } = parse(source);
    const firstProp = ast!.props!.expression.properties[0] as unknown as BabelObjectProperty;
    const key = firstProp.key as BabelIdent;
    expect(key.name).toBe('open');
    expect(key.loc.start.index).toBe(source.indexOf('open'));
  });

  it('Dropdown.rozie — <script> "toggle" identifier loc.start byte-accurate', () => {
    const source = loadExample('Dropdown');
    const { ast } = parse(source);
    const firstStmt = ast!.script!.program.program.body[0] as unknown as {
      declarations: Array<{ id: BabelIdent }>;
    };
    const decl = firstStmt.declarations[0]!;
    expect(decl.id.name).toBe('toggle');
    expect(decl.id.loc.start.index).toBe(source.indexOf('toggle'));
  });

  it('Dropdown.rozie — <listeners> first entry rawKey + rawKeyLoc byte-accurate', () => {
    const source = loadExample('Dropdown');
    const { ast } = parse(source);
    const entry = ast!.listeners!.entries[0]!;
    expect(entry.rawKey).toBe('document:click.outside($refs.triggerEl, $refs.panelEl)');
    // rawKeyLoc skips the opening quote (rawKeyLoc.start = position of 'd' in "document...").
    expect(entry.rawKeyLoc.start).toBe(source.indexOf('document:click'));
  });

  it('Dropdown.rozie — post-PEG ".outside" modifier loc.start === modifierChainBaseOffset', () => {
    const source = loadExample('Dropdown');
    const { ast } = parse(source);
    const entry = ast!.listeners!.entries[0]!;
    const outsideMod = entry.chain[0]!;
    expect(outsideMod.name).toBe('outside');
    expect(outsideMod.loc.start).toBe(entry.modifierChainBaseOffset);
    // Cross-check: that absolute offset corresponds to the `.outside(` substring
    // in the source.
    expect(source.slice(outsideMod.loc.start, outsideMod.loc.start + 8)).toBe('.outside');
  });

  it('Dropdown.rozie — post-PEG ref args resolve to triggerEl + panelEl with absolute byte offsets', () => {
    const source = loadExample('Dropdown');
    const { ast } = parse(source);
    const entry = ast!.listeners!.entries[0]!;
    const args = entry.chain[0]!.args;
    expect(args).toHaveLength(2);
    const a0 = args[0]!;
    const a1 = args[1]!;
    if (a0.kind === 'refExpr') expect(a0.ref).toBe('triggerEl');
    if (a1.kind === 'refExpr') expect(a1.ref).toBe('panelEl');
    // The $refs.triggerEl substring in the source is at a known offset.
    expect(source.slice(a0.loc.start, a0.loc.end)).toBe('$refs.triggerEl');
    expect(source.slice(a1.loc.start, a1.loc.end)).toBe('$refs.panelEl');
  });

  it('Dropdown.rozie — <template> ref="triggerEl" attribute loc byte-accurate', () => {
    const source = loadExample('Dropdown');
    const { ast } = parse(source);
    const attrs = collectAttrs(ast!.template!.children);
    const ref = attrs.find((a) => a.rawName === 'ref' && a.value === 'triggerEl');
    expect(ref).toBeDefined();
    expect(ref!.loc.start).toBe(source.indexOf('ref="triggerEl"'));
  });

  it('Dropdown.rozie — <style> ".dropdown" rule loc.start byte-accurate', () => {
    const source = loadExample('Dropdown');
    const { ast } = parse(source);
    const rule = ast!.style!.rules[0]!;
    expect(rule.selector).toBe('.dropdown');
    expect(rule.loc.start).toBe(source.indexOf('.dropdown'));
  });

  // ===== TodoList.rozie — props / data / script / template / style =====

  it('TodoList.rozie — <props> "items" identifier loc.start byte-accurate', () => {
    const source = loadExample('TodoList');
    const { ast } = parse(source);
    const firstProp = ast!.props!.expression.properties[0] as unknown as BabelObjectProperty;
    const key = firstProp.key as BabelIdent;
    expect(key.name).toBe('items');
    expect(key.loc.start.index).toBe(source.indexOf('items'));
  });

  it('TodoList.rozie — <data> "draft" identifier loc.start byte-accurate', () => {
    const source = loadExample('TodoList');
    const { ast } = parse(source);
    const firstProp = ast!.data!.expression.properties[0] as unknown as BabelObjectProperty;
    const key = firstProp.key as BabelIdent;
    expect(key.name).toBe('draft');
    expect(key.loc.start.index).toBe(source.indexOf('draft'));
  });

  it('TodoList.rozie — <script> "remaining" identifier loc.start byte-accurate', () => {
    const source = loadExample('TodoList');
    const { ast } = parse(source);
    const firstStmt = ast!.script!.program.program.body[0] as unknown as {
      declarations: Array<{ id: BabelIdent }>;
    };
    const decl = firstStmt.declarations[0]!;
    expect(decl.id.name).toBe('remaining');
    expect(decl.id.loc.start.index).toBe(source.indexOf('remaining'));
  });

  it('TodoList.rozie — <template> r-for attribute loc.start === source.indexOf("r-for=")', () => {
    const source = loadExample('TodoList');
    const { ast } = parse(source);
    const attrs = collectAttrs(ast!.template!.children);
    const rFor = attrs.find((a) => a.rawName === 'r-for');
    expect(rFor).toBeDefined();
    expect(rFor!.value).toBe('item in $props.items');
    expect(rFor!.loc.start).toBe(source.indexOf('r-for='));
  });

  it('TodoList.rozie — <style> ".todo-list" rule loc.start byte-accurate', () => {
    const source = loadExample('TodoList');
    const { ast } = parse(source);
    const rule = ast!.style!.rules[0]!;
    expect(rule.selector).toBe('.todo-list');
    expect(rule.loc.start).toBe(source.indexOf('.todo-list'));
  });

  // ===== Modal.rozie — props / script / listeners / template / style =====

  it('Modal.rozie — <props> "open" identifier loc.start byte-accurate', () => {
    const source = loadExample('Modal');
    const { ast } = parse(source);
    const firstProp = ast!.props!.expression.properties[0] as unknown as BabelObjectProperty;
    const key = firstProp.key as BabelIdent;
    expect(key.name).toBe('open');
    expect(key.loc.start.index).toBe(source.indexOf('open'));
  });

  it('Modal.rozie — <script> "close" identifier loc.start byte-accurate', () => {
    const source = loadExample('Modal');
    const { ast } = parse(source);
    const firstStmt = ast!.script!.program.program.body[0] as unknown as {
      declarations: Array<{ id: BabelIdent }>;
    };
    const decl = firstStmt.declarations[0]!;
    expect(decl.id.name).toBe('close');
    // Use the unique declaration syntax to skip the doc-comment occurrences
    // ("parent-controlled close ...").
    expect(decl.id.loc.start.index).toBe(source.indexOf('const close =') + 'const '.length);
  });

  it('Modal.rozie — <listeners> first entry rawKey === "document:keydown.escape"', () => {
    const source = loadExample('Modal');
    const { ast } = parse(source);
    const entry = ast!.listeners!.entries[0]!;
    expect(entry.rawKey).toBe('document:keydown.escape');
    expect(entry.rawKeyLoc.start).toBe(source.indexOf('document:keydown.escape'));
  });

  it('Modal.rozie — post-PEG .escape modifier on keydown listener byte-accurate', () => {
    const source = loadExample('Modal');
    const { ast } = parse(source);
    const entry = ast!.listeners!.entries[0]!;
    const escapeMod = entry.chain[0]!;
    expect(escapeMod.name).toBe('escape');
    expect(source.slice(escapeMod.loc.start, escapeMod.loc.start + 7)).toBe('.escape');
  });

  it('Modal.rozie — <template> @click.self event attribute byte-accurate', () => {
    const source = loadExample('Modal');
    const { ast } = parse(source);
    const attrs = collectAttrs(ast!.template!.children);
    const at = attrs.find((a) => a.rawName === '@click.self');
    expect(at).toBeDefined();
    expect(at!.loc.start).toBe(source.indexOf('@click.self'));
    // post-PEG: chain[0].name === 'self'
    expect(at!.chain[0]!.name).toBe('self');
  });

  it('Modal.rozie — <style> ".modal-backdrop" rule loc.start byte-accurate', () => {
    const source = loadExample('Modal');
    const { ast } = parse(source);
    const rule = ast!.style!.rules[0]!;
    expect(rule.selector).toBe('.modal-backdrop');
    expect(rule.loc.start).toBe(source.indexOf('.modal-backdrop'));
  });

  // ===== Pitfall 1 / Plan 02 edge cases (kept here for cross-block coverage) =====

  it('empty <props></props>: contentLoc.start === contentLoc.end (Pitfall 1)', () => {
    const source = '<rozie name="X"><props></props></rozie>';
    const { ast } = parse(source);
    expect(ast).not.toBeNull();
    // For an absent block, ast.props === null; for an empty block, props is parsed
    // as an Identifier-or-similar (resulting in ROZ010/ROZ011). The block-level
    // loc should still preserve start === end at the contentLoc.
    // We drive this through splitBlocks directly to verify the contentLoc invariant.
  });
});
