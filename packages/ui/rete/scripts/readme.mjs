/**
 * README rendering + docs-table validation for @rozie-ui/rete.
 *
 * Everything structural is derived from a SINGLE parse of FlowCanvas.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest. Pure glue over the `@rozie/core` public IR — NO
 * compiler/emitter surface. (Mirror of packages/ui/maplibre/scripts/readme.mjs,
 * retargeted to the node-flow-editor surface: a two-way `zoom` model, config-
 * array `nodes`/`connections` driving props, a `node` REACTIVE MULTI-INSTANCE
 * portal slot, the graph event surface, and the Rete engine peer dependencies.)
 */

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
      const body = node.body;
      if (body && body.type === 'ArrayExpression') {
        return body.elements && body.elements.length ? '[…]' : '[]';
      }
      if (body && body.type === 'ObjectExpression') {
        return body.properties && body.properties.length ? '{…}' : '{}';
      }
      return '() => …';
    }
    case 'Identifier':
      return node.name;
    default:
      return String(node.type);
  }
}

function renderSlotName(name) {
  return name === '' ? '(default)' : name;
}

function slotParams(slot) {
  return (slot.params || []).map((p) => p.name).join(', ');
}

// ---------------------------------------------------------------------------
// Per-framework consumer usage snippets (idiomatic; short + correct).
// nodes/connections are config arrays; `zoom` is two-way; graph events fire as
// native framework events; the `node` slot renders each node body.
// ---------------------------------------------------------------------------

const NODES = `[
    { id: 'a', label: 'Source', x: 0,   y: 0,   outputs: [{ key: 'out' }] },
    { id: 'b', label: 'Sink',   x: 280, y: 60,  inputs:  [{ key: 'in' }] },
  ]`;
const EDGES = `[{ source: 'a', sourceOutput: 'out', target: 'b', targetInput: 'in' }]`;

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { FlowCanvas } from '@rozie-ui/rete-react';

export function Demo() {
  const [zoom, setZoom] = useState(1);
  const nodes = ${NODES};
  const connections = ${EDGES};
  return (
    <div style={{ height: 400 }}>
      <FlowCanvas
        nodes={nodes}
        connections={connections}
        zoom={zoom}
        onZoomChange={setZoom}
        onConnectionCreated={(c) => console.log('connected', c)}
        onNodeMoved={(e) => console.log('moved', e)}
      />
    </div>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import FlowCanvas from '@rozie-ui/rete-vue';

const zoom = ref(1);
const nodes = ${NODES};
const connections = ${EDGES};
</script>

<template>
  <div style="height: 400px">
    <FlowCanvas
      :nodes="nodes"
      :connections="connections"
      v-model:zoom="zoom"
      @connection-created="(c) => console.log('connected', c)"
      @node-moved="(e) => console.log('moved', e)"
    />
  </div>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import FlowCanvas from '@rozie-ui/rete-svelte';

  let zoom = $state(1);
  const nodes = ${NODES};
  const connections = ${EDGES};
</script>

<div style="height: 400px">
  <FlowCanvas
    {nodes}
    {connections}
    bind:zoom
    onconnectioncreated={(c) => console.log('connected', c)}
    onnodemoved={(e) => console.log('moved', e)}
  />
</div>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { FlowCanvas } from '@rozie-ui/rete-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [FlowCanvas],
  template: \`
    <div style="height: 400px">
      <FlowCanvas
        [nodes]="nodes"
        [connections]="connections"
        [(zoom)]="zoom"
        (connection-created)="onConnect($event)"
        (node-moved)="onMoved($event)"
      />
    </div>
  \`,
})
export class DemoComponent {
  zoom = 1;
  nodes = ${NODES};
  connections = ${EDGES};
  onConnect(c: any) { console.log('connected', c); }
  onMoved(e: any) { console.log('moved', e); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { FlowCanvas } from '@rozie-ui/rete-solid';

export function Demo() {
  const [zoom, setZoom] = createSignal(1);
  const nodes = ${NODES};
  const connections = ${EDGES};
  return (
    <div style={{ height: '400px' }}>
      <FlowCanvas
        nodes={nodes}
        connections={connections}
        zoom={zoom()}
        onZoomChange={setZoom}
        onConnectionCreated={(c) => console.log('connected', c)}
        onNodeMoved={(e) => console.log('moved', e)}
      />
    </div>
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/rete-lit';

// <rozie-flow-canvas> is a custom element. Set \`nodes\`/\`connections\` as
// properties, bind \`zoom\`, and listen for graph events.
const el = document.querySelector('rozie-flow-canvas');
el.nodes = ${NODES};
el.connections = ${EDGES};
el.zoom = 1;
el.addEventListener('zoom-change', (e) => { el.zoom = e.detail; });
el.addEventListener('connection-created', (e) => console.log('connected', e.detail));`,
  },
};

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom',
  vue: 'vue',
  svelte: 'svelte',
  angular: '@angular/core + @angular/common',
  solid: 'solid-js',
  lit: 'lit + @lit-labs/preact-signals + @preact/signals-core',
};

// ---------------------------------------------------------------------------
// Per-framework "how to obtain the imperative handle" snippets (Phase 21
// `$expose`). Each shows the framework's NATIVE ref mechanism.
// ---------------------------------------------------------------------------

const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { FlowCanvas, type FlowCanvasHandle } from '@rozie-ui/rete-react';

const flow = useRef<FlowCanvasHandle>(null);
// <FlowCanvas ref={flow} ... />
flow.current?.addNode({ id: 'c', label: 'New', x: 100, y: 200, inputs: [{ key: 'in' }] });
flow.current?.zoomToFit();
const editor = flow.current?.getEditor();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const flow = ref();         // template ref
</script>

<template>
  <FlowCanvas ref="flow" />
  <button @click="flow.zoomToFit()">Fit</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let flow;                 // component instance via bind:this
</script>

<FlowCanvas bind:this={flow} />
<button onclick={() => flow.zoomToFit()}>Fit</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(FlowCanvas) flow!: FlowCanvas;  // or the viewChild() signal
  fit() { this.flow.zoomToFit(); }
  editor() { return this.flow.getEditor(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { FlowCanvas, type FlowCanvasHandle } from '@rozie-ui/rete-solid';

let handle: FlowCanvasHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<FlowCanvas ref={(h) => (handle = h)} />;
handle?.zoomToFit();
const editor = handle?.getEditor();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-flow-canvas');
el.zoomToFit();
const editor = el.getEditor();`,
  },
};

// ---------------------------------------------------------------------------
// README rendering.
// ---------------------------------------------------------------------------

export function renderReadme(target, ir, pkgName, handleManifest = {}) {
  const usage = USAGE[target];
  if (!usage) throw new Error(`renderReadme: no usage snippet for target "${target}"`);

  const lines = [];
  lines.push(`# ${pkgName}`);
  lines.push('');
  lines.push(
    `Idiomatic **${target}** \`FlowCanvas\` — a cross-framework node-based ` +
      `flow / graph editor compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping ` +
      `[Rete.js v2](https://retejs.org/). The graph is driven by the \`nodes\` / ` +
      `\`connections\` config-array props; the engine owns pan / zoom / drag / ` +
      `drag-to-connect. This package is generated; do not edit \`src/\` by hand.`,
  );
  lines.push('');

  lines.push('## Install');
  lines.push('');
  lines.push('```bash');
  lines.push(`npm i ${pkgName}`);
  lines.push('```');
  lines.push('');
  lines.push(
    `Peer dependencies: the Rete engine ` +
      `(\`rete\` + \`rete-area-plugin\` + \`rete-connection-plugin\` + ` +
      `\`rete-render-utils\`, all \`^2\`) + \`${FRAMEWORK_PEER_LABEL[target]}\`. ` +
      `Install them alongside this package.`,
  );
  lines.push('');
  lines.push(
    'Rete ships no stylesheet — all node / socket / connection chrome is styled by ' +
      'this component, so there is no engine CSS to import.',
  );
  lines.push('');

  lines.push('## Usage');
  lines.push('');
  lines.push('```' + usage.lang);
  lines.push(usage.code);
  lines.push('```');
  lines.push('');

  lines.push('## Props');
  lines.push('');
  lines.push('| Name | Type | Default | Two-way (model) | Required |');
  lines.push('| --- | --- | --- | :---: | :---: |');
  for (const p of ir.props) {
    const type = renderPropType(p.typeAnnotation);
    const def = renderPropDefault(p.defaultValue);
    const model = p.isModel ? '✓' : '';
    const required = p.required ? '✓' : '';
    lines.push(`| \`${p.name}\` | \`${type}\` | \`${def}\` | ${model} | ${required} |`);
  }
  lines.push('');

  if (ir.emits && ir.emits.length > 0) {
    lines.push('## Events');
    lines.push('');
    lines.push('| Event | Description |');
    lines.push('| --- | --- |');
    for (const ev of ir.emits) {
      lines.push(`| \`${ev}\` | |`);
    }
    lines.push('');
  }

  if (ir.expose && ir.expose.length > 0) {
    const handleUsage = HANDLE_USAGE[target];
    if (!handleUsage) {
      throw new Error(`renderReadme: no handle-usage snippet for target "${target}"`);
    }
    lines.push('## Imperative handle');
    lines.push('');
    lines.push(
      'Beyond props, the component exposes imperative methods (declared once in the ' +
        'Rozie source via `$expose`). Grab a handle with the native ref mechanism and call ' +
        'them directly:',
    );
    lines.push('');
    lines.push('```' + handleUsage.lang);
    lines.push(handleUsage.code);
    lines.push('```');
    lines.push('');
    lines.push('| Method | Description |');
    lines.push('| --- | --- |');
    for (const m of ir.expose) {
      const desc = handleManifest[m.name];
      if (!desc) {
        throw new Error(`renderReadme: exposed method "${m.name}" missing from handle-manifest`);
      }
      lines.push(`| \`${m.name}\` | ${desc} |`);
    }
    lines.push('');
  }

  if (ir.slots && ir.slots.length > 0) {
    lines.push('## Slots');
    lines.push('');
    lines.push('| Slot | Params |');
    lines.push('| --- | --- |');
    for (const s of ir.slots) {
      lines.push(`| ${renderSlotName(s.name)} | ${slotParams(s)} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Docs props-table validator (VALIDATE-NOT-OVERWRITE). Identical contract to the
// maplibre/codemirror/chartjs validators. codegen.mjs invokes this against
// docs/components/rete.md (which ships a real "### Props" table) — ENFORCING.
// ---------------------------------------------------------------------------

export function validateDocsPropsTable(ir, docsMarkdown) {
  const errors = [];

  const propsHeadingIdx = docsMarkdown.indexOf('### Props');
  if (propsHeadingIdx === -1) {
    return { ok: false, errors: ['docs: "### Props" heading not found'], checkedRows: 0 };
  }
  const afterHeading = docsMarkdown.slice(propsHeadingIdx + '### Props'.length);
  const nextHeadingIdx = afterHeading.search(/\n#{1,3}\s/);
  const section = nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  const docRows = new Map();
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((c) => c.replace(/\\\|/g, '|').trim());
    if (cells.length < 3) continue;
    const nameMatch = cells[0].match(/^`([^`]+)`$/);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    docRows.set(name, { type: cells[1], def: cells[2] });
  }

  const irNames = new Set(ir.props.map((p) => p.name));
  const docNames = new Set(docRows.keys());
  for (const n of irNames) {
    if (!docNames.has(n)) errors.push(`docs missing prop row: "${n}" (present in source)`);
  }
  for (const n of docNames) {
    if (!irNames.has(n)) errors.push(`docs has stale prop row: "${n}" (absent from source)`);
  }

  const stripCode = (s) => s.replace(/`/g, '').trim();
  for (const p of ir.props) {
    const doc = docRows.get(p.name);
    if (!doc) continue;
    const irType = renderPropType(p.typeAnnotation);
    const docType = stripCode(doc.type);
    const docTypeTokens = docType.split('|').map((t) => t.trim());
    if (!docTypeTokens.includes(irType)) {
      errors.push(`prop "${p.name}": type drift — source \`${irType}\`, docs \`${docType}\``);
    }
    const irDef = renderPropDefault(p.defaultValue);
    const docDef = stripCode(doc.def);
    if (irDef !== '—' && docDef !== irDef) {
      errors.push(`prop "${p.name}": default drift — source \`${irDef}\`, docs \`${docDef}\``);
    }
  }

  return { ok: errors.length === 0, errors, checkedRows: docRows.size };
}
