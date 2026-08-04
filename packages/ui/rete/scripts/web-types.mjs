/**
 * web-types.mjs — build a JetBrains `web-types.json` for a Vue leaf from the
 * once-parsed Rozie IR (`ir.props` / `ir.emits` / `ir.slots`).
 *
 * WHY: vue-tsc's generated `*.vue.d.ts` (the `__VLS_*` / positional-generic
 * `DefineComponent` soup) is consumed perfectly by VS Code / Volar but is NOT
 * reliably read by JetBrains IDEs (WEB-57769) — PhpStorm/WebStorm don't surface
 * props/events/slots from it. `web-types` is JetBrains' own native channel for
 * exactly this: a JSON sidecar linked via the package.json `web-types` field
 * that the IDE reads straight out of `node_modules`. It leaves the `.d.ts`
 * untouched, so the VS Code/Volar path carries ZERO risk.
 *
 * Shape follows the modern, well-supported element-plus dialect:
 * `contributions.html.vue-components[]` with `props` (kebab names, `type`
 * array), events under `js.events`, and scoped-slot props via a `type` string.
 * v-model is inferred by the IDE from the `items` prop + the `update:items`
 * event (both emitted below) — no separate `vue-model` object needed.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 */

const WEB_TYPES_SCHEMA =
  'https://raw.githubusercontent.com/JetBrains/web-types/master/schema/web-types.json';

/** camelCase / PascalCase prop name → kebab-case template attribute name. */
export function kebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Map a single Rozie constructor-identifier type name → a web-types type token. */
function identToken(name) {
  switch (name) {
    case 'Array':
      return 'array';
    case 'String':
      return 'string';
    case 'Number':
      return 'number';
    case 'Boolean':
      return 'boolean';
    case 'Object':
      return 'object';
    case 'Function':
      return 'function';
    default:
      return name ? name.toLowerCase() : 'any';
  }
}

/** Rozie typeAnnotation → web-types `type` array (unions flatten to members). */
export function webTypesType(typeAnnotation) {
  if (!typeAnnotation) return ['any'];
  if (typeAnnotation.kind === 'identifier') return [identToken(typeAnnotation.name)];
  if (typeAnnotation.kind === 'union' && Array.isArray(typeAnnotation.members)) {
    const tokens = typeAnnotation.members.flatMap((m) => webTypesType(m));
    return [...new Set(tokens)];
  }
  if (typeAnnotation.name) return [identToken(typeAnnotation.name)];
  return ['any'];
}

/**
 * Rozie Babel `defaultValue` node → a clean web-types `default` string, or
 * `undefined` when there is no useful literal to show (factory arrows, none).
 */
export function webTypesDefault(defaultValue) {
  if (defaultValue == null) return undefined;
  const node = defaultValue;
  switch (node.type) {
    case 'NullLiteral':
      return 'null';
    case 'BooleanLiteral':
      return String(node.value);
    case 'NumericLiteral':
      return String(node.value);
    case 'StringLiteral':
      return JSON.stringify(node.value);
    case 'ArrayExpression':
      return node.elements && node.elements.length ? undefined : '[]';
    case 'ObjectExpression':
      return node.properties && node.properties.length ? undefined : '{}';
    case 'ArrowFunctionExpression': {
      const body = node.body;
      if (body && body.type === 'ArrayExpression')
        return body.elements && body.elements.length ? undefined : '[]';
      if (body && body.type === 'ObjectExpression')
        return body.properties && body.properties.length ? undefined : '{}';
      return undefined;
    }
    case 'Identifier':
      return node.name;
    default:
      return undefined;
  }
}

/** Build the scoped-slot `type` string from a slot's params (`{ item: any; index: number }`). */
function slotScopeType(slot) {
  const params = slot.params || [];
  if (!params.length) return undefined;
  const known = { index: 'number' };
  const body = params.map((p) => `${p.name}: ${known[p.name] || 'any'}`).join('; ');
  return `{ ${body} }`;
}

/**
 * Build the web-types document object for a single Vue leaf.
 *
 * @param {object}  opts
 * @param {object}  opts.ir            once-parsed IR (props/emits/slots)
 * @param {string}  opts.pkgName       leaf package name (e.g. @rozie-ui/sortable-list-vue)
 * @param {string}  opts.version       leaf version (from its package.json)
 * @param {string}  opts.componentName imported symbol / tag (e.g. SortableList)
 * @param {string}  opts.description   one-line component description (markdown)
 * @param {string}  [opts.docUrl]      docs URL for the component
 * @param {object}  [opts.eventManifest] { [event]: description } prose for events
 * @returns {object} the web-types JSON document (ready to JSON.stringify)
 */
export function buildWebTypes({
  ir,
  pkgName,
  version,
  componentName,
  description,
  docUrl,
  eventManifest = {},
}) {
  // Props → web-types props (kebab attribute names, type array, optional default).
  const props = ir.props.map((p) => {
    const entry = {
      name: kebabCase(p.name),
      ...(p.docs?.description ? { description: p.docs.description } : {}),
      ...(docUrl ? { 'doc-url': docUrl } : {}),
      ...(p.required ? { required: true } : {}),
      type: webTypesType(p.typeAnnotation),
    };
    const def = webTypesDefault(p.defaultValue);
    if (def !== undefined) entry.default = def;
    return entry;
  });

  // Events: the source emits + the model writeback event (drives v-model:<model>).
  const modelProps = ir.props.filter((p) => p.isModel);
  const events = ir.emits.map((name) => ({
    name,
    ...(eventManifest[name] ? { description: eventManifest[name] } : {}),
    ...(docUrl ? { 'doc-url': docUrl } : {}),
  }));
  for (const mp of modelProps) {
    events.push({
      name: `update:${mp.name}`,
      description: `Emitted with the updated \`${mp.name}\` value; powers \`v-model:${mp.name}\`.`,
      ...(docUrl ? { 'doc-url': docUrl } : {}),
    });
  }

  // Slots: name (default '' → "default"), optional scoped-prop `type` string.
  const slots = ir.slots.map((s) => {
    const scope = slotScopeType(s);
    return {
      name: s.name === '' ? 'default' : s.name,
      ...(docUrl ? { 'doc-url': docUrl } : {}),
      ...(scope ? { type: scope } : {}),
    };
  });

  return {
    $schema: WEB_TYPES_SCHEMA,
    name: pkgName,
    version,
    'description-markup': 'markdown',
    framework: 'vue',
    contributions: {
      html: {
        'vue-components': [
          {
            name: componentName,
            source: { module: pkgName, symbol: componentName },
            ...(description ? { description } : {}),
            ...(docUrl ? { 'doc-url': docUrl } : {}),
            props,
            js: { events },
            slots,
          },
        ],
      },
    },
  };
}
