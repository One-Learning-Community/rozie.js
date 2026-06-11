/**
 * README rendering + docs-table validation for @rozie-ui/chartjs.
 *
 * Everything structural is derived from a SINGLE parse of Chart.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/codemirror/scripts/readme.mjs, retargeted to the
 * data-visualization surface: one-way `data`/`options`/`type`/… props, a
 * `:plugins` consumer-extensibility passthrough, the `@click`/`@hover`/
 * `@datasetClick` events — Chart.js IS event-ful, so the Events heading SHIPS,
 * unlike CodeMirror's gated-out one — an external-HTML `tooltip` portal slot,
 * and the `chart.js` engine peer dependency.)
 */

// ---------------------------------------------------------------------------
// IR-derivation helpers (shared by README rendering AND the docs validator).
// ---------------------------------------------------------------------------

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
//
// `Chart` is the generic component — the `type` prop switches the chart kind
// across the whole Chart.js controller set (line/bar/pie/doughnut/radar/
// polarArea/scatter/bubble). `data`/`options` match Chart.js's own shapes;
// `:plugins` is the per-instance plugin passthrough.
// ---------------------------------------------------------------------------

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { Chart } from '@rozie-ui/chartjs-react';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};

export function Demo() {
  return <Chart type="bar" data={data} height={280} />;
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import Chart from '@rozie-ui/chartjs-vue';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};
</script>

<template>
  <Chart type="bar" :data="data" :height="280" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Chart from '@rozie-ui/chartjs-svelte';

  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
  };
</script>

<Chart type="bar" {data} height={280} />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Chart } from '@rozie-ui/chartjs-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Chart],
  template: \`<Chart type="bar" [data]="data" [height]="280" />\`,
})
export class DemoComponent {
  data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
  };
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Chart } from '@rozie-ui/chartjs-solid';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};

export function Demo() {
  return <Chart type="bar" data={data} height={280} />;
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/chartjs-lit';

// <rozie-chart> is a custom element. Bind \`data\`/\`type\` as properties.
const el = document.querySelector('rozie-chart');
el.type = 'bar';
el.data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};
el.addEventListener('click', (e) => console.log(e.detail.elements));`,
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
// `$expose`). Each shows the framework's NATIVE ref mechanism — there is no
// Rozie-level consumer directive for calling a child's method.
// ---------------------------------------------------------------------------

const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Chart, type ChartHandle } from '@rozie-ui/chartjs-react';

const chart = useRef<ChartHandle>(null);
// <Chart ref={chart} ... />
chart.current?.updateChart();
const png = chart.current?.toBase64Image();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const chart = ref();        // template ref
</script>

<template>
  <Chart ref="chart" />
  <button @click="chart.updateChart()">Update</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let chart;                 // component instance via bind:this
</script>

<Chart bind:this={chart} />
<button onclick={() => chart.updateChart()}>Update</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Chart) chart!: Chart;  // or the viewChild() signal
  refresh() { this.chart.updateChart(); }
  png() { return this.chart.toBase64Image(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Chart, type ChartHandle } from '@rozie-ui/chartjs-solid';

let handle: ChartHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Chart ref={(h) => (handle = h)} />;
handle?.updateChart();
const png = handle?.toBase64Image();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-chart');
el.updateChart();
const png = el.toBase64Image();`,
  },
};

// ---------------------------------------------------------------------------
// README rendering.
// ---------------------------------------------------------------------------

export function renderReadme(target, ir, pkgName, handleManifest = {}, variantNames = []) {
  const usage = USAGE[target];
  if (!usage) throw new Error(`renderReadme: no usage snippet for target "${target}"`);

  const lines = [];
  lines.push(`# ${pkgName}`);
  lines.push('');
  lines.push(
    `Idiomatic **${target}** \`Chart\` — a cross-framework data-visualization ` +
      `component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) ` +
      `source wrapping [Chart.js](https://www.chartjs.org/). The \`type\` prop switches ` +
      `the chart kind across the whole Chart.js controller set (line/bar/pie/doughnut/` +
      `radar/polarArea/scatter/bubble). This package is generated; do not edit \`src/\` by hand.`,
  );
  lines.push('');

  // Install
  lines.push('## Install');
  lines.push('');
  lines.push('```bash');
  lines.push(`npm i ${pkgName}`);
  lines.push('```');
  lines.push('');
  lines.push(
    `Peer dependencies: the \`chart.js\` engine (\`^4\`) + ` +
      `\`${FRAMEWORK_PEER_LABEL[target]}\`. Install them alongside this package.`,
  );
  lines.push('');

  // Usage
  lines.push('## Usage');
  lines.push('');
  lines.push('```' + usage.lang);
  lines.push(usage.code);
  lines.push('```');
  lines.push('');

  // Registration model + per-type components.
  lines.push('## Registration & per-type components');
  lines.push('');
  lines.push(
    'Chart.js v3+ is tree-shakable: the generic `Chart` does **not** auto-register ' +
      'controllers, so register what you use —',
  );
  lines.push('');
  lines.push('```ts');
  lines.push("import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';");
  lines.push('Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale);');
  lines.push('```');
  lines.push('');
  lines.push(
    '— or import the kitchen-sink `/auto` entry (`' + pkgName + "/auto`, or `import 'chart.js/auto'`) " +
      'which registers everything.',
  );
  if (variantNames && variantNames.length > 0) {
    lines.push('');
    lines.push(
      'Or use a **per-type component** — each pins its `type` and registers only its own ' +
        'controller set (so importing one is tree-shakable), with the same props/events/handle ' +
        'as the generic `Chart` (minus `type`): ' +
        variantNames.map((n) => `\`${n}\``).join(', ') + '.',
    );
  }
  lines.push('');

  // Props
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

  // Events — gated on ir.emits.length > 0 (Chart.js IS event-ful, so this
  // section SHIPS — unlike the CodeMirror analog).
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

  // Imperative handle — driven by ir.expose (Phase 21 `$expose`).
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

  // Slots — Chart exposes the external-HTML `tooltip` portal-slot. Emit the
  // section only if the source declares any slots.
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
// Docs props-table validator (VALIDATE-NOT-OVERWRITE).
//
// Identical contract to the codemirror/fullcalendar validators. codegen.mjs
// invokes this against docs/components/chartjs.md (which ships a real "### Props"
// table) — ENFORCING: it throws on drift of the IR-derivable structural columns
// (name/type/default).
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
