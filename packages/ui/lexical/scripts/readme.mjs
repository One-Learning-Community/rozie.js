/**
 * README rendering + docs-table validation for @rozie-ui/lexical. Pure glue over
 * the @rozie/core IR.
 *
 * Structural content (props/events/handle/slots tables) derives from a SINGLE
 * parse of each source's .rozie. Only the USAGE / HANDLE_USAGE snippets below are
 * hand-authored, per component. Prop PROSE has a single source of truth — the
 * `.rozie` `<props>` `docs.description` — rendered here via the shared
 * `renderPropDescription` from @rozie/core (the ADDING-A-FAMILY prop-docs rule):
 * no README re-authors prop prose.
 */
import { renderPropDescription } from '@rozie/core';

const BT = String.fromCharCode(96);
const SLUG = 'lexical';
const SCOPE = '@rozie-ui';
const SUMMARY =
  'Cross-framework rich-text editor wrapping Meta’s Lexical — one Rozie source, idiomatic React / Vue / Svelte / Angular / Solid packages.';
const ENGINE_PEER = 'lexical';
const STYLESHEET_IMPORT = '';

export function renderPropType(typeAnnotation) {
  if (!typeAnnotation) return 'unknown';
  if (typeAnnotation.kind === 'identifier') return typeAnnotation.name;
  if (typeAnnotation.kind === 'literal') return String(typeAnnotation.value);
  if (typeAnnotation.name) return typeAnnotation.name;
  if (typeAnnotation.value !== undefined) return String(typeAnnotation.value);
  return 'unknown';
}

export function renderPropDefault(defaultValue) {
  if (defaultValue == null) return '—';
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
      return node.elements && node.elements.length ? '[…]' : '[]';
    case 'ObjectExpression':
      return node.properties && node.properties.length ? '{…}' : '{}';
    case 'ArrowFunctionExpression': {
      const b = node.body;
      if (b && b.type === 'ArrayExpression') return b.elements && b.elements.length ? '[…]' : '[]';
      if (b && b.type === 'ObjectExpression') return b.properties && b.properties.length ? '{…}' : '{}';
      return '() => …';
    }
    case 'Identifier':
      return node.name;
    default:
      return String(node.type);
  }
}

function renderSlotName(n) {
  return n === '' ? '(default)' : n;
}

function slotParams(slot) {
  return (slot.params || []).map((p) => p.name).join(', ');
}

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom',
  vue: 'vue',
  svelte: 'svelte',
  angular: '@angular/core + @angular/common',
  solid: 'solid-js',
};

// Per-framework usage snippets for the editor shell. The shell $provides the live
// editor; plugin/toolbar children (later waves) $inject it. v1.0 ships 5 targets
// (NO Lit — deferred to v1.1 per D-10).
export const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { LexicalEditor } from '@rozie-ui/lexical-react';

export function Editor() {
  return <LexicalEditor ariaLabel="Post body" />;
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import LexicalEditor from '@rozie-ui/lexical-vue';
</script>

<template>
  <LexicalEditor aria-label="Post body" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import LexicalEditor from '@rozie-ui/lexical-svelte';
</script>

<LexicalEditor ariaLabel="Post body" />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { LexicalEditor } from '@rozie-ui/lexical-angular';

@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [LexicalEditor],
  template: \`<LexicalEditor ariaLabel="Post body" />\`,
})
export class EditorComponent {}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { LexicalEditor } from '@rozie-ui/lexical-solid';

export function Editor() {
  return <LexicalEditor ariaLabel="Post body" />;
}`,
  },
};

const USAGE_BY_COMPONENT = { LexicalEditor: USAGE };
const HANDLE_USAGE_BY_COMPONENT = {};

/**
 * Render one leaf README documenting EVERY component in `components`
 * (`[{ name, ir }, ...]`, primary first). Intro + Install are rendered once; then
 * one `## <Name>` section per component. `eventManifest` / `handleManifest` are
 * the per-component-KEYED maps, indexed here by component name. Called ONCE PER
 * TARGET. Tolerant of components without a usage/handle snippet (future
 * auto-discovered sources render a "see docs" placeholder rather than throwing).
 */
export function renderReadme(target, components, eventManifest, pkgName, handleManifest = {}) {
  const c = (s) => BT + s + BT;
  const fence = (lang) => BT + BT + BT + lang;
  const close = BT + BT + BT;
  const lines = [];

  const primary = components[0];

  lines.push('# ' + pkgName);
  lines.push('');
  lines.push(
    'Idiomatic **' +
      target +
      '** ' +
      c(primary.name) +
      ' — ' +
      SUMMARY +
      ' Compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. ' +
      'This package is generated; do not edit ' +
      c('src/') +
      ' by hand.',
  );
  if (components.length > 1) {
    const others = components.slice(1).map((co) => c(co.name)).join(', ');
    lines.push('');
    lines.push(
      'This package ships ' +
        c(primary.name) +
        ' (the default export) alongside ' +
        others +
        ' (named export' +
        (components.length > 2 ? 's' : '') +
        ').',
    );
  }
  lines.push('');

  lines.push('## Install');
  lines.push('');
  lines.push(fence('bash'));
  lines.push('npm i ' + pkgName);
  lines.push(close);
  lines.push('');
  const peerLabel = ENGINE_PEER
    ? c(ENGINE_PEER) + ' + ' + c(FRAMEWORK_PEER_LABEL[target])
    : c(FRAMEWORK_PEER_LABEL[target]);
  lines.push(
    'Peer dependencies: ' +
      peerLabel +
      '.' +
      (STYLESHEET_IMPORT ? ' Also import ' + c(STYLESHEET_IMPORT) + ' once in your app.' : ''),
  );
  lines.push('');
  lines.push(
    `All Lexical ${c('$')}-API is authored in the **namespace-import form** ` +
      `(${c("import * as lexical from 'lexical'; lexical.$getRoot()")}) — the one ` +
      `cross-target-safe convention (named ${c('$')}-imports break the Svelte compiler).`,
  );
  lines.push('');

  for (const comp of components) {
    const ir = comp.ir;
    lines.push('## ' + comp.name);
    lines.push('');

    const usage = (USAGE_BY_COMPONENT[comp.name] ?? {})[target];
    lines.push('### Usage');
    lines.push('');
    if (usage) {
      lines.push(fence(usage.lang));
      lines.push(usage.code);
      lines.push(close);
    } else {
      lines.push('See the [component docs](https://github.com/One-Learning-Community/rozie.js) for usage.');
    }
    lines.push('');

    if (ir.props.length > 0) {
      lines.push('### Props');
      lines.push('');
      lines.push('| Name | Type | Default | Two-way (model) | Required | Description |');
      lines.push('| --- | --- | --- | :---: | :---: | --- |');
      for (const p of ir.props) {
        const type = renderPropType(p.typeAnnotation);
        const def = renderPropDefault(p.defaultValue);
        lines.push(
          '| ' +
            c(p.name) +
            ' | ' +
            c(type) +
            ' | ' +
            c(def) +
            ' | ' +
            (p.isModel ? '✓' : '') +
            ' | ' +
            (p.required ? '✓' : '') +
            ' | ' +
            renderPropDescription(p) +
            ' |',
        );
      }
      lines.push('');
    }

    if (ir.emits && ir.emits.length > 0) {
      const evManifest = eventManifest[comp.name] ?? {};
      lines.push('### Events');
      lines.push('');
      lines.push('| Event | Description |');
      lines.push('| --- | --- |');
      for (const ev of ir.emits) {
        const desc = evManifest[ev];
        if (!desc) {
          throw new Error(
            'renderReadme: event "' + ev + '" of ' + comp.name + ' missing from event-manifest',
          );
        }
        lines.push('| ' + c(ev) + ' | ' + desc + ' |');
      }
      lines.push('');
    }

    if (ir.expose && ir.expose.length > 0) {
      const hManifest = handleManifest[comp.name] ?? {};
      const handleUsage = (HANDLE_USAGE_BY_COMPONENT[comp.name] ?? {})[target];
      lines.push('### Imperative handle');
      lines.push('');
      lines.push(
        'This component exposes imperative methods (declared once in the Rozie source via ' +
          c('$expose') +
          '). Grab a handle with the native ref mechanism and call them directly:',
      );
      lines.push('');
      if (handleUsage) {
        lines.push(fence(handleUsage.lang));
        lines.push(handleUsage.code);
        lines.push(close);
        lines.push('');
      }
      lines.push('| Method | Description |');
      lines.push('| --- | --- |');
      for (const m of ir.expose) {
        const desc = hManifest[m.name];
        if (!desc) {
          throw new Error(
            'renderReadme: exposed method "' + m.name + '" of ' + comp.name + ' missing from handle-manifest',
          );
        }
        lines.push('| ' + c(m.name) + ' | ' + desc + ' |');
      }
      lines.push('');
    }

    if (ir.slots && ir.slots.length > 0) {
      lines.push('### Slots');
      lines.push('');
      lines.push('| Slot | Params |');
      lines.push('| --- | --- |');
      for (const s of ir.slots) lines.push('| ' + renderSlotName(s.name) + ' | ' + slotParams(s) + ' |');
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function validateDocsPropsTable(ir, docsMarkdown, opts = {}) {
  const heading = opts.heading ?? '### Props';
  const errors = [];
  const propsHeadingIdx = docsMarkdown.indexOf(heading);
  if (propsHeadingIdx === -1) {
    return { ok: false, errors: ['docs: "' + heading + '" heading not found'], checkedRows: 0 };
  }
  const afterHeading = docsMarkdown.slice(propsHeadingIdx + heading.length);
  const nextHeadingIdx = afterHeading.search(/\n#{1,3}\s/);
  const section = nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  const docRows = new Map();
  const nameRe = new RegExp('^' + BT + '([^' + BT + ']+)' + BT + '$');
  const btRe = new RegExp(BT, 'g');
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((cc) => cc.replace(/\\\|/g, '|').trim());
    if (cells.length < 3) continue;
    const nameMatch = cells[0].match(nameRe);
    if (!nameMatch) continue;
    docRows.set(nameMatch[1], { type: cells[1], def: cells[2] });
  }

  const irNames = new Set(ir.props.map((p) => p.name));
  const docNames = new Set(docRows.keys());
  for (const n of irNames) {
    if (!docNames.has(n)) errors.push('docs missing prop row: "' + n + '" (present in source)');
  }
  for (const n of docNames) {
    if (!irNames.has(n)) errors.push('docs has stale prop row: "' + n + '" (absent from source)');
  }

  const stripCode = (s) => s.replace(btRe, '').trim();
  for (const p of ir.props) {
    const doc = docRows.get(p.name);
    if (!doc) continue;
    const irType = renderPropType(p.typeAnnotation);
    const docType = stripCode(doc.type);
    const docTypeTokens = docType.split('|').map((t) => t.trim());
    if (!docTypeTokens.includes(irType)) {
      errors.push('prop "' + p.name + '": type drift — source ' + irType + ', docs ' + docType);
    }
    const irDef = renderPropDefault(p.defaultValue);
    const docDef = stripCode(doc.def);
    if (irDef !== '—' && docDef !== irDef) {
      errors.push('prop "' + p.name + '": default drift — source ' + irDef + ', docs ' + docDef);
    }
  }

  return { ok: errors.length === 0, errors, checkedRows: docRows.size };
}
