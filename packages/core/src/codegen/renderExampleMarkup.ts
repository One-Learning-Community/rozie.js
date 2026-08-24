/**
 * renderExampleMarkup — Phase 81 Plan 01 (SPEC decision D-01).
 *
 * The ONE parameterised mapping table that turns a prop's authoring-notation
 * `docs.example` string (e.g. `<Foo r-model:x="$data.x" />`) into
 * target-correct consumer markup for all six compile targets. Before this
 * module existed, `buildPropJsdoc` copied the authored example verbatim, so
 * a React consumer read Vue-flavored `r-model:` and `:prop=` syntax straight
 * out of the JSDoc block. Plan 02 wires this module into `buildPropJsdoc`;
 * Plan 03 wires `classifyExampleMarkup` into a pre-emit validator. Both
 * downstream plans depend on this module being correct and standing alone —
 * the same anti-drift posture `renderPropsInterface` and `buildPropJsdoc`
 * already carry: ONE parameterised table, not six hand-maintained copies.
 *
 * PURE and NEVER THROWS — mirrors `parseTemplate`'s D-08 collected-never-
 * thrown contract. `renderExampleMarkup` classifies its input first and
 * returns it verbatim, by identity, for anything that isn't renderable
 * markup; it never mutates its input.
 *
 * Seven planner rulings (grounded in the hand-authored per-target USAGE
 * snippets at `packages/ui/rete/scripts/readme.mjs`, the SPEC's own named
 * hand-check reference):
 *
 * 1. Tag rewriting applies only to component-shaped tags — a tag name
 *    starting with an uppercase ASCII letter. A lowercase tag (`<div>`) is
 *    plain HTML and is never rewritten on any target.
 * 2. Lit emits explicit open/close tags for a rewritten custom-element tag
 *    — HTML forbids self-closing custom elements, and `readme.mjs`'s Lit
 *    block writes `<rozie-port ...></rozie-port>` where its Angular block
 *    writes `<rozie-port ... />`. The other five targets preserve the
 *    authored self-closing form.
 * 3. The kebab→camelCase rewrite governs `:` binding names and model prop
 *    names, and also a hyphenated STATIC attribute name — except `data-*`
 *    and `aria-*`, which stay verbatim on every target. Vue keeps every
 *    authored name exactly as written, on every attribute kind.
 * 4. Sigil stripping (`$data.` / `$props.` / `$refs.`) applies to binding,
 *    event, and model attribute VALUES only — those are expression
 *    positions. A static attribute value is literal text and is never
 *    touched.
 * 5. Solid's `()` call suffix is a MODEL-VALUE rule, not a binding rule:
 *    `readme.mjs`'s Solid block writes `graph={graph()}` for the model and
 *    has no plain `:` binding with a call suffix — the SPEC table's Solid
 *    column for `:prop` is `prop={e}`, no call. `()` is appended only to a
 *    model value, and only when the expression is a bare identifier.
 * 6. Svelte uses the `bind:x` shorthand only when the (sigil-stripped)
 *    expression text equals the camelCased prop name (`readme.mjs` writes
 *    `bind:graph` for `r-model:graph="graph"`); otherwise it emits the long
 *    `bind:x={e}` form (Svelte 5 syntax).
 * 7. Anything the table doesn't cover is unsupported by default — a bare
 *    model directive with no prop name, a modifier chain on a model or
 *    event attribute, and every non-model `r-*` directive. SPEC decisions
 *    D-04 (hard error, always) and D-05 (nested children pass through the
 *    same rules; slot fills and interpolation are out) together make
 *    unsupported-by-default the correct posture — this module classifies
 *    honestly; Plan 03 turns the classification into a diagnostic.
 *
 * @experimental — shape may change before v1.0
 */
import { parseTemplate } from '../parsers/parseTemplate.js';
import type {
  TemplateAST,
  TemplateNode,
  TemplateElement,
  TemplateAttr,
} from '../ast/blocks/TemplateAST.js';
import type { CompileTarget } from '../compile.js';

/** The outcome of classifying a `docs.example` string. */
export type ExampleMarkupClass =
  | { kind: 'markup' }
  | { kind: 'non-markup' }
  | { kind: 'unsupported'; reason: string };

const HORIZONTAL_ELLIPSIS = '…';

/**
 * Walk `nodes` and every element's children, invoking `visit` on each node
 * in document order.
 */
function walkAllNodes(nodes: TemplateNode[], visit: (node: TemplateNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if (node.type === 'TemplateElement') {
      walkAllNodes(node.children, visit);
    }
  }
}

/**
 * Classify a `docs.example` string as renderable `markup`, honestly
 * unsupported markup (with a `reason`), or `non-markup` (prose, a code
 * snippet — anything with no `TemplateElement` in it at all).
 *
 * The `non-markup` check runs BEFORE inspecting `result.diagnostics` — this
 * ordering is load-bearing (planner ruling 7 / RESEARCH): it is what keeps
 * a prose string containing a stray `<` on today's verbatim path instead of
 * hard-failing an already-compiling repo.
 */
export function classifyExampleMarkup(example: string, filename?: string): ExampleMarkupClass {
  const result = parseTemplate(example, { start: 0, end: example.length }, example, filename);

  let hasElement = false;
  if (result.node) {
    walkAllNodes(result.node.children, (node) => {
      if (node.type === 'TemplateElement') hasElement = true;
    });
  }
  if (!hasElement) {
    return { kind: 'non-markup' };
  }

  const hasErrorDiagnostic = result.diagnostics.some((d) => d.severity === 'error');
  if (!result.node || hasErrorDiagnostic) {
    return { kind: 'unsupported', reason: 'malformed markup' };
  }

  let reason: string | null = null;
  const reject = (r: string): void => {
    if (!reason) reason = r;
  };

  walkAllNodes(result.node.children, (node) => {
    if (reason) return;
    if (node.type === 'TemplateInterpolation') {
      reject('mustache interpolation is not supported in a rendered example');
      return;
    }
    if (node.type !== 'TemplateElement') return;

    if (node.tagName === 'template' && node.attributes.some((a) => a.rawName.startsWith('#'))) {
      reject('a slot fill is not supported in a rendered example');
      return;
    }

    for (const attr of node.attributes) {
      if (reason) return;

      if (attr.value !== null && attr.value.includes('{{') && attr.value.includes('}}')) {
        reject('mustache interpolation is not supported in an attribute value');
        continue;
      }

      if (attr.kind === 'directive') {
        if (attr.name !== 'model' && !attr.name.startsWith('model:')) {
          reject(`the r-${attr.name} directive is not supported in a rendered example`);
          continue;
        }
        if (attr.name === 'model') {
          reject('a model directive must name its prop (r-model:propName) to render an example');
          continue;
        }
      }

      if ((attr.kind === 'directive' || attr.kind === 'event') && attr.modifierChainText !== '') {
        reject('a modifier chain is not supported in a rendered example');
        continue;
      }
    }
  });

  if (reason) {
    return { kind: 'unsupported', reason };
  }

  return { kind: 'markup' };
}

/** Mirrors `packages/targets/lit/src/emit/emitDecorator.ts`'s `toKebabCase`
 * — the alternation that ALSO matches an uppercase letter followed by an
 * uppercase-then-lowercase run, then lowercases the result. Angular's
 * simpler two-group regex (`packages/targets/angular/src/emit/
 * emitDecorator.ts`) mis-splits adjacent-uppercase component names — the
 * `ROnProbe` fixture name kebab-cases to `ron-probe` there, merging the
 * component's leading letter into the second segment instead of hyphenating
 * every word boundary — deliberately NOT mirrored here; that divergence is a
 * pre-existing Angular bug this phase does not propagate.
 */
function toKebabCase(name: string): string {
  const hyphenated = name.replace(/([a-z0-9]|[A-Z](?=[A-Z][a-z]))([A-Z])/g, '$1-$2');
  return hyphenated.toLowerCase();
}

/** `validate-types` -> `validateTypes`. A no-op on a hyphen-free name. */
function toCamelCase(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_match, ch: string) => ch.toUpperCase());
}

/** `node-moved` -> `NodeMoved`; `graph` -> `Graph`. */
function toPascalCase(name: string): string {
  const camel = toCamelCase(name);
  return camel.length === 0 ? camel : camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * A trimmed string matching a leading letter, underscore, or dollar,
 * followed by word characters or dollars, to end of string.
 */
function isBareIdentifier(value: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(value.trim());
}

/**
 * Replace every `$data.` / `$props.` / `$refs.` sigil with the bare
 * identifier that follows. Documented edge case (RESEARCH Assumption A1): a
 * sigil-shaped substring inside a nested string literal would also be
 * stripped by this regex; none of the 41 real corpus examples contains one,
 * and a full Babel expression parse per attribute value was judged
 * disproportionate for a comment-text rewrite.
 */
function stripSigils(value: string): string {
  return value.replace(/\$(?:data|props|refs)\.([A-Za-z_$][\w$]*)/g, '$1');
}

/** Renders a component tag name for `target`, per planner ruling 1/2. */
function renderTagName(originalTag: string, target: CompileTarget): string {
  if (target !== 'angular' && target !== 'lit') return originalTag;
  if (!/^[A-Z]/.test(originalTag)) return originalTag;
  if (/^rozie-[a-z0-9-]*$/.test(originalTag)) return originalTag; // already idempotent
  return `rozie-${toKebabCase(originalTag)}`;
}

/** `custom-attr` on the 5 non-Vue targets -> `customAttr`; `data-*`/`aria-*` and Vue stay verbatim. */
function renderStaticAttrName(rawName: string, target: CompileTarget): string {
  if (target === 'vue') return rawName;
  if (!rawName.includes('-')) return rawName;
  if (rawName.startsWith('data-') || rawName.startsWith('aria-')) return rawName;
  return toCamelCase(rawName);
}

function renderStaticAttr(attr: TemplateAttr, target: CompileTarget): string {
  const name = renderStaticAttrName(attr.rawName, target);
  if (attr.value === null) return name; // boolean shorthand — value literal is never sigil-stripped
  return `${name}="${attr.value}"`;
}

function renderBindingAttr(attr: TemplateAttr, target: CompileTarget): string {
  const value = stripSigils(attr.value ?? '');
  const rawName = attr.name; // e.g. 'validate-types' — the ':'-stripped identifier
  switch (target) {
    case 'vue':
      return `:${rawName}="${value}"`;
    case 'angular':
      return `[${toCamelCase(rawName)}]="${value}"`;
    case 'lit':
      return `.${toCamelCase(rawName)}=\${${value}}`;
    case 'react':
    case 'solid':
    case 'svelte':
      return `${toCamelCase(rawName)}={${value}}`;
  }
}

function renderEventAttr(attr: TemplateAttr, target: CompileTarget): string {
  const value = stripSigils(attr.value ?? '');
  const rawName = attr.name; // e.g. 'node-moved' — the '@'-stripped identifier, authored form
  switch (target) {
    case 'vue':
      return `@${rawName}="${value}"`;
    case 'angular':
      return `(${rawName})="${value}"`;
    case 'lit':
      return `@${rawName}=\${${value}}`;
    case 'react':
    case 'solid':
      return `on${toPascalCase(rawName)}={${value}}`;
    case 'svelte':
      return `on${rawName.replace(/-/g, '').toLowerCase()}={${value}}`;
  }
}

/** Renders an `r-model:x="e"` directive attribute into 1 (Vue/Svelte-shorthand/Angular) or 2 (React/Solid/Lit) attribute strings. */
function renderModelAttr(attr: TemplateAttr, target: CompileTarget): string[] {
  // classifyExampleMarkup already proved this attribute's name is exactly
  // prefixed 'model:' — the bare-'model' and non-model-directive cases are
  // rejected before renderExampleMarkup ever reaches a 'markup'-classified
  // tree, so the slice below is always well-formed here.
  const propNameRaw = attr.name.slice('model:'.length);
  const propName = toCamelCase(propNameRaw);
  const strippedValue = stripSigils(attr.value ?? '').trim();
  const bareIdentifier = isBareIdentifier(strippedValue);

  switch (target) {
    case 'vue':
      return [`v-model:${propNameRaw}="${strippedValue}"`];
    case 'angular':
      return [`[(${propName})]="${strippedValue}"`];
    case 'svelte':
      return strippedValue === propName
        ? [`bind:${propName}`]
        : [`bind:${propName}={${strippedValue}}`];
    case 'lit': {
      const changeEventName = `${toKebabCase(propNameRaw)}-change`;
      return [`.${propName}=\${${strippedValue}}`, `@${changeEventName}=\${${HORIZONTAL_ELLIPSIS}}`];
    }
    case 'react':
    case 'solid': {
      const callbackValue = bareIdentifier
        ? `set${toPascalCase(strippedValue)}`
        : HORIZONTAL_ELLIPSIS;
      const valueText = target === 'solid' && bareIdentifier ? `${strippedValue}()` : strippedValue;
      return [`${propName}={${valueText}}`, `on${toPascalCase(propName)}Change={${callbackValue}}`];
    }
  }
}

function renderAttr(attr: TemplateAttr, target: CompileTarget): string[] {
  switch (attr.kind) {
    case 'static':
      return [renderStaticAttr(attr, target)];
    case 'binding':
      return [renderBindingAttr(attr, target)];
    case 'event':
      return [renderEventAttr(attr, target)];
    case 'directive':
      return renderModelAttr(attr, target);
  }
}

function renderElement(el: TemplateElement, target: CompileTarget): string {
  const tagName = renderTagName(el.tagName, target);
  const wasRewritten = tagName !== el.tagName;

  // Iterate `attributes` in array order and push each rendered form
  // directly into the SAME output array at that iteration step (one push
  // for most kinds, two consecutive pushes for a model expansion) —
  // RESEARCH Pitfall 4: collecting expansions into a side array to
  // concatenate later breaks authored attribute order.
  const attrParts: string[] = [];
  for (const attr of el.attributes) {
    attrParts.push(...renderAttr(attr, target));
  }
  const attrsText = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';

  // Lit never self-closes a rewritten custom-element tag (planner ruling 2)
  // — HTML forbids self-closing custom elements.
  const forceOpenClose = target === 'lit' && wasRewritten;

  if (el.selfClosing && !forceOpenClose) {
    return `<${tagName}${attrsText} />`;
  }

  const childrenText = el.children.map((child) => renderNode(child, target)).join('');
  return `<${tagName}${attrsText}>${childrenText}</${tagName}>`;
}

function renderNode(node: TemplateNode, target: CompileTarget): string {
  switch (node.type) {
    case 'TemplateText':
      return node.text;
    case 'TemplateElement':
      return renderElement(node, target);
    case 'TemplateInterpolation':
      // Unreachable for a 'markup'-classified tree (classifyExampleMarkup
      // rejects any TemplateInterpolation) — kept for exhaustiveness so
      // this function stays total and never throws.
      return '';
  }
}

/**
 * Render a prop's `docs.example` string as target-correct consumer markup.
 * Classifies first; for `non-markup` or `unsupported` input, returns
 * `example` BY IDENTITY. This defensive fallback is what keeps a
 * standalone `buildPropJsdoc` caller — one that bypasses `compile()` and
 * therefore never ran Plan 03's validator — on today's verbatim behavior
 * instead of crashing. Inside `compile()` the unsupported branch is
 * unreachable because the validator already returned early.
 */
export function renderExampleMarkup(
  example: string,
  target: CompileTarget,
  filename?: string,
): string {
  const classification = classifyExampleMarkup(example, filename);
  if (classification.kind !== 'markup') {
    return example;
  }

  const result = parseTemplate(example, { start: 0, end: example.length }, example, filename);
  // classifyExampleMarkup already proved result.node is non-null and free
  // of error-severity diagnostics for a 'markup' classification.
  const ast = result.node as TemplateAST;
  return ast.children.map((node) => renderNode(node, target)).join('');
}
