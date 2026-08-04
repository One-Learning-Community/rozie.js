/**
 * cem.mjs — build a Custom Elements Manifest (`custom-elements.json`) for the LIT
 * leaf from the once-parsed Rozie IR.
 *
 * WHY (parallel to scripts/web-types.mjs, but for Lit): a Lit leaf publishes a
 * custom element (`<rozie-sortable-list>`). With no manifest, neither VS Code nor
 * JetBrains offer attribute/property/event completion for that tag in HTML/lit-html
 * templates. The Custom Elements Manifest is the web-components-native standard
 * (custom-elements-manifest schema) that BOTH editors read — linked via the
 * package.json `customElements` field. Unlike web-types (Vue/JetBrains-only), CEM
 * is cross-editor and also feeds Storybook / API-doc tooling.
 *
 * Everything here is derivable from the IR + the Lit emit conventions this repo's
 * emitter uses, verified against the emitted SortableList.ts:
 *   - tag name        = `rozie-` + kebab(componentName)   (@customElement)
 *   - model event     = `<modelProp>-change`              (createLitControllable…)
 *   - HTML attribute  = Lit default = propName.toLowerCase() (no explicit `attribute:`)
 *   - source events   = ir.emits, dispatched verbatim as CustomEvents
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 */

const SCHEMA_VERSION = '2.1.0';

/** camelCase / PascalCase → kebab-case (for the custom-element tag name). */
function kebab(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Rozie constructor-identifier type → a TS `type.text` string for CEM. */
function litTypeText(typeAnnotation) {
  if (!typeAnnotation) return 'any';
  if (typeAnnotation.kind === 'union' && Array.isArray(typeAnnotation.members)) {
    return [...new Set(typeAnnotation.members.map(litTypeText))].join(' | ');
  }
  if (typeAnnotation.kind === 'identifier') {
    switch (typeAnnotation.name) {
      case 'Array':
        return 'any[]';
      case 'String':
        return 'string';
      case 'Number':
        return 'number';
      case 'Boolean':
        return 'boolean';
      case 'Object':
        return 'Record<string, any>';
      case 'Function':
        // Parenthesized so it reads correctly inside a union (`string | ((…) => any)`).
        return '((...args: any[]) => any)';
      default:
        return typeAnnotation.name || 'any';
    }
  }
  return 'any';
}

/** Babel default node → a CEM `default` string, or undefined when not a clean literal. */
function defaultText(node) {
  if (node == null) return undefined;
  switch (node.type) {
    case 'NullLiteral':
      return 'null';
    case 'BooleanLiteral':
    case 'NumericLiteral':
      return String(node.value);
    case 'StringLiteral':
      return JSON.stringify(node.value);
    case 'ArrayExpression':
      return node.elements?.length ? undefined : '[]';
    case 'ObjectExpression':
      return node.properties?.length ? undefined : '{}';
    case 'ArrowFunctionExpression': {
      const b = node.body;
      if (b?.type === 'ArrayExpression') return b.elements?.length ? undefined : '[]';
      if (b?.type === 'ObjectExpression') return b.properties?.length ? undefined : '{}';
      return undefined;
    }
    case 'Identifier':
      return node.name;
    default:
      return undefined;
  }
}

/**
 * Build the Custom Elements Manifest document for a Lit leaf.
 *
 * @param {object}  opts
 * @param {object}  opts.ir            once-parsed IR (props/emits/slots/expose)
 * @param {string}  opts.componentName class / symbol name (e.g. SortableList)
 * @param {string}  [opts.description] component description (markdown)
 * @param {string}  [opts.modulePath]  published module path (default dist/index.mjs)
 * @param {object}  [opts.eventManifest]  { [event]: description }
 * @param {object}  [opts.handleManifest] { [method]: description } for exposed methods
 * @returns {object} the CEM JSON document
 */
export function buildCustomElementsManifest({
  ir,
  componentName,
  description,
  modulePath = 'dist/index.mjs',
  eventManifest = {},
  handleManifest = {},
}) {
  const tagName = `rozie-${kebab(componentName)}`;
  const modelProps = ir.props.filter((p) => p.isModel);

  // Fields (reactive properties) + exposed methods → CEM `members`.
  const fieldMembers = ir.props.map((p) => {
    const m = {
      kind: 'field',
      name: p.name,
      ...(p.docs?.description ? { description: p.docs.description } : {}),
      type: { text: litTypeText(p.typeAnnotation) },
      attribute: p.name.toLowerCase(),
    };
    const def = defaultText(p.defaultValue);
    if (def !== undefined) m.default = def;
    return m;
  });
  const methodMembers = (ir.expose || []).map((mth) => ({
    kind: 'method',
    name: mth.name,
    ...(handleManifest[mth.name] ? { description: handleManifest[mth.name] } : {}),
  }));

  // HTML attributes (Lit default = lowercased property name), linked to their field.
  const attributes = ir.props.map((p) => {
    const a = {
      name: p.name.toLowerCase(),
      ...(p.docs?.description ? { description: p.docs.description } : {}),
      type: { text: litTypeText(p.typeAnnotation) },
      fieldName: p.name,
    };
    const def = defaultText(p.defaultValue);
    if (def !== undefined) a.default = def;
    return a;
  });

  // Events: source emits (dispatched verbatim) + the model `<prop>-change` writeback.
  const events = ir.emits.map((name) => ({
    name,
    type: { text: 'CustomEvent' },
    ...(eventManifest[name] ? { description: eventManifest[name] } : {}),
  }));
  for (const mp of modelProps) {
    events.push({
      name: `${mp.name}-change`,
      type: { text: 'CustomEvent' },
      description: `Fired with the updated \`${mp.name}\` (\`event.detail\`) when it changes.`,
    });
  }

  // Slots (real light-DOM <slot>s the emitter renders): default '' + named.
  const slots = ir.slots.map((s) => ({
    name: s.name === '' ? '' : s.name,
    ...(s.params?.length
      ? { description: `Scoped slot — props: ${s.params.map((p) => p.name).join(', ')}.` }
      : {}),
  }));

  const declRef = { name: componentName, module: modulePath };

  return {
    schemaVersion: SCHEMA_VERSION,
    readme: '',
    modules: [
      {
        kind: 'javascript-module',
        path: modulePath,
        declarations: [
          {
            kind: 'class',
            ...(description ? { description } : {}),
            name: componentName,
            tagName,
            customElement: true,
            superclass: { name: 'LitElement', package: 'lit' },
            members: [...fieldMembers, ...methodMembers],
            attributes,
            events,
            slots,
          },
        ],
        exports: [
          { kind: 'js', name: componentName, declaration: declRef },
          { kind: 'js', name: 'default', declaration: declRef },
          { kind: 'custom-element-definition', name: tagName, declaration: declRef },
        ],
      },
    ],
  };
}
