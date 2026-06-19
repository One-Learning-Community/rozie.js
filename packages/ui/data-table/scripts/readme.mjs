/**
 * README rendering + docs-table validation for @rozie-ui/data-table.
 *
 * Everything structural is derived from a SINGLE parse of DataTable.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only the event + handle prose comes
 * from the hand-kept manifests.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/slider/scripts/readme.mjs, retargeted to the
 * headless data-table surface: the nine-slice multi-model state, the eight
 * change events, the `<Column>` declarative child + its `#cell`/`#header`
 * templates, and the single `@tanstack/table-core` engine peer dependency.)
 */

// ---------------------------------------------------------------------------
// IR-derivation helpers (shared by README rendering AND the docs validator).
// ---------------------------------------------------------------------------

export function renderPropType(typeAnnotation) {
  if (!typeAnnotation) return 'any';
  if (typeAnnotation.kind === 'identifier') return typeAnnotation.name;
  if (typeAnnotation.kind === 'literal') {
    return typeAnnotation.value === null ? 'any' : String(typeAnnotation.value);
  }
  if (typeAnnotation.name) return typeAnnotation.name;
  if (typeAnnotation.value !== undefined) {
    return typeAnnotation.value === null ? 'any' : String(typeAnnotation.value);
  }
  return 'any';
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
      return node.value === '' ? "''" : JSON.stringify(node.value);
    case 'ArrayExpression':
      return node.elements && node.elements.length ? '[…]' : '[]';
    case 'ObjectExpression':
      return node.properties && node.properties.length ? '{…}' : '{}';
    case 'ArrowFunctionExpression': {
      const body = node.body;
      if (body && body.type === 'ArrayExpression') return body.elements && body.elements.length ? '[…]' : '[]';
      if (body && body.type === 'ObjectExpression') return body.properties && body.properties.length ? '{…}' : '{}';
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
// data is a config-array column declaration via `:columns`; `sorting` is one of
// the nine two-way slices; the eight change events fire as native framework
// events.
// ---------------------------------------------------------------------------

const ROWS = `[
    { id: 1, name: 'Ada Lovelace',   email: 'ada@analytical.engine',  status: 'active' },
    { id: 2, name: 'Alan Turing',    email: 'alan@bletchley.park',    status: 'active' },
    { id: 3, name: 'Grace Hopper',   email: 'grace@navy.mil',         status: 'away'   },
  ]`;
const COLS = `[
    { field: 'name',   header: 'Name',   sortable: true, filterable: true },
    { field: 'email',  header: 'Email' },
    { field: 'status', header: 'Status', sortable: true },
  ]`;

// Each target carries an ALIGNED list of example sets (same titles, same order)
// so the README and the docs page can render one set per heading / code-group.
const SET_A_TITLE = 'Columns as a config array';
const SET_B_TITLE = 'Declarative `<Column>` children + a custom cell';

export const USAGE = {
  react: [
    {
      title: SET_A_TITLE,
      lang: 'tsx',
      code: `import { useState } from 'react';
import { DataTable } from '@rozie-ui/data-table-react';

export function Demo() {
  const rows = ${ROWS};
  const columns = ${COLS};
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([]);
  return (
    <DataTable
      data={rows}
      columns={columns}
      sorting={sorting}
      onSortChange={setSorting}
      selectionMode="multiple"
      stickyHeader
    />
  );
}`,
    },
    {
      title: SET_B_TITLE,
      lang: 'tsx',
      code: `import { DataTable, Column } from '@rozie-ui/data-table-react';

export function Demo() {
  const rows = ${ROWS};
  // One cell renderer on <DataTable>, dispatched by columnId — it works the same
  // whether columns are declared as <Column> children or via :columns.
  return (
    <DataTable
      data={rows}
      selectionMode="multiple"
      stickyHeader
      renderCell={({ columnId, value }) =>
        columnId === 'status' ? <StatusBadge status={value} /> : value
      }
    >
      <Column field="name" header="Name" sortable filterable />
      <Column field="email" header="Email" />
      <Column field="status" header="Status" sortable />
    </DataTable>
  );
}`,
    },
  ],
  vue: [
    {
      title: SET_A_TITLE,
      lang: 'vue',
      code: `<script setup lang="ts">
import { ref } from 'vue';
import DataTable from '@rozie-ui/data-table-vue';

const rows = ${ROWS};
const columns = ${COLS};
const sorting = ref<{ id: string; desc: boolean }[]>([]);
</script>

<template>
  <DataTable :data="rows" :columns="columns" v-model:sorting="sorting" selection-mode="multiple" sticky-header />
</template>`,
    },
    {
      title: SET_B_TITLE,
      lang: 'vue',
      code: `<script setup lang="ts">
import { ref } from 'vue';
import DataTable, { Column } from '@rozie-ui/data-table-vue';

const rows = ${ROWS};
const sorting = ref<{ id: string; desc: boolean }[]>([]);
</script>

<template>
  <DataTable :data="rows" v-model:sorting="sorting" selection-mode="multiple" sticky-header>
    <Column field="name" header="Name" :sortable="true" :filterable="true" />
    <Column field="email" header="Email" />
    <Column field="status" header="Status" :sortable="true" />

    <!-- One #cell slot on <DataTable>, dispatched by columnId (works with :columns too) -->
    <template #cell="{ columnId, value }">
      <span v-if="columnId === 'status'" class="badge">{{ value }}</span>
      <template v-else>{{ value }}</template>
    </template>
  </DataTable>
</template>`,
    },
  ],
  svelte: [
    {
      title: SET_A_TITLE,
      lang: 'svelte',
      code: `<script lang="ts">
  import DataTable from '@rozie-ui/data-table-svelte';

  const rows = ${ROWS};
  const columns = ${COLS};
  let sorting = $state<{ id: string; desc: boolean }[]>([]);
</script>

<DataTable data={rows} {columns} bind:sorting selectionMode="multiple" stickyHeader />`,
    },
    {
      title: SET_B_TITLE,
      lang: 'svelte',
      code: `<script lang="ts">
  import DataTable, { Column } from '@rozie-ui/data-table-svelte';

  const rows = ${ROWS};
  let sorting = $state<{ id: string; desc: boolean }[]>([]);
</script>

<DataTable data={rows} bind:sorting selectionMode="multiple" stickyHeader>
  <Column field="name" header="Name" sortable filterable />
  <Column field="email" header="Email" />
  <Column field="status" header="Status" sortable />

  <!-- One cell snippet on <DataTable>, dispatched by columnId -->
  {#snippet cell({ columnId, value })}
    {#if columnId === 'status'}<span class="badge">{value}</span>{:else}{value}{/if}
  {/snippet}
</DataTable>`,
    },
  ],
  angular: [
    {
      title: SET_A_TITLE,
      lang: 'ts',
      code: `import { Component } from '@angular/core';
import { DataTable } from '@rozie-ui/data-table-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [DataTable],
  template: \`
    <DataTable [data]="rows" [columns]="columns" [(sorting)]="sorting" selectionMode="multiple" [stickyHeader]="true" />
  \`,
})
export class DemoComponent {
  rows = ${ROWS};
  columns = ${COLS};
  sorting: { id: string; desc: boolean }[] = [];
}`,
    },
    {
      title: SET_B_TITLE,
      lang: 'ts',
      code: `import { Component } from '@angular/core';
import { DataTable, Column } from '@rozie-ui/data-table-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [DataTable, Column],
  template: \`
    <DataTable [data]="rows" [(sorting)]="sorting" selectionMode="multiple" [stickyHeader]="true">
      <Column field="name" header="Name" [sortable]="true" [filterable]="true" />
      <Column field="email" header="Email" />
      <Column field="status" header="Status" [sortable]="true" />

      <!-- One #cell template on <DataTable>, dispatched by columnId -->
      <ng-template #cell let-columnId="columnId" let-value="value">
        @if (columnId === 'status') {
          <span class="badge">{{ value }}</span>
        } @else {
          {{ value }}
        }
      </ng-template>
    </DataTable>
  \`,
})
export class DemoComponent {
  rows = ${ROWS};
  sorting: { id: string; desc: boolean }[] = [];
}`,
    },
  ],
  solid: [
    {
      title: SET_A_TITLE,
      lang: 'tsx',
      code: `import { createSignal } from 'solid-js';
import { DataTable } from '@rozie-ui/data-table-solid';

export function Demo() {
  const rows = ${ROWS};
  const columns = ${COLS};
  const [sorting, setSorting] = createSignal<{ id: string; desc: boolean }[]>([]);
  return (
    <DataTable data={rows} columns={columns} sorting={sorting()} onSortChange={setSorting} selectionMode="multiple" stickyHeader />
  );
}`,
    },
    {
      title: SET_B_TITLE,
      lang: 'tsx',
      code: `import { createSignal } from 'solid-js';
import { DataTable, Column } from '@rozie-ui/data-table-solid';

export function Demo() {
  const rows = ${ROWS};
  const [sorting, setSorting] = createSignal<{ id: string; desc: boolean }[]>([]);
  return (
    <DataTable
      data={rows}
      sorting={sorting()}
      onSortChange={setSorting}
      selectionMode="multiple"
      stickyHeader
      cellSlot={({ columnId, value }) =>
        columnId === 'status' ? <StatusBadge status={value} /> : value
      }
    >
      <Column field="name" header="Name" sortable filterable />
      <Column field="email" header="Email" />
      <Column field="status" header="Status" sortable />
    </DataTable>
  );
}`,
    },
  ],
  lit: [
    {
      title: SET_A_TITLE,
      lang: 'ts',
      code: `import '@rozie-ui/data-table-lit';

// <rozie-data-table> is a custom element. Set \`data\`/\`columns\` as properties
// and listen for the change events (\`sort-change\`, \`filter-change\`, …).
const el = document.querySelector('rozie-data-table');
el.data = ${ROWS};
el.columns = ${COLS};
el.addEventListener('sort-change', (e) => {
  console.log('sorting', e.detail);
});`,
    },
    {
      title: SET_B_TITLE,
      lang: 'ts',
      code: `import { html, render } from 'lit';
import '@rozie-ui/data-table-lit';

const rows = ${ROWS};

// Declare columns as <rozie-column> children and supply ONE cell renderer —
// a function returning a Lit template, dispatched by columnId.
render(html\`
  <rozie-data-table
    .data=\${rows}
    selection-mode="multiple"
    sticky-header
    .cell=\${({ columnId, value }) =>
      columnId === 'status' ? html\`<span class="badge">\${value}</span>\` : value}
  >
    <rozie-column field="name" header="Name" sortable filterable></rozie-column>
    <rozie-column field="email" header="Email"></rozie-column>
    <rozie-column field="status" header="Status" sortable></rozie-column>
  </rozie-data-table>
\`, document.body);`,
    },
  ],
};

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom + @tanstack/table-core',
  vue: 'vue + @tanstack/table-core',
  svelte: 'svelte + @tanstack/table-core',
  angular: '@angular/core + @angular/common + @angular/forms + @tanstack/table-core',
  solid: 'solid-js + @tanstack/table-core',
  lit: 'lit + @lit-labs/preact-signals + @preact/signals-core + @tanstack/table-core',
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { DataTable, type DataTableHandle } from '@rozie-ui/data-table-react';

const tbl = useRef<DataTableHandle>(null);
// <DataTable ref={tbl} ... />
tbl.current?.toggleAllRows(true);
const selected = tbl.current?.getSelectedRows();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const tbl = ref();          // template ref
</script>

<template>
  <DataTable ref="tbl" :data="rows" />
  <button @click="tbl.clearSelection()">Clear</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let tbl;                  // component instance via bind:this
</script>

<DataTable bind:this={tbl} data={rows} />
<button onclick={() => tbl.clearSelection()}>Clear</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(DataTable) tbl!: DataTable;   // or the viewChild() signal
  selectAll() { this.tbl.toggleAllRows(true); }
  read() { return this.tbl.getSelectedRows(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { DataTable, type DataTableHandle } from '@rozie-ui/data-table-solid';

let handle: DataTableHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<DataTable ref={(h) => (handle = h)} data={rows} />;
handle?.toggleAllRows(true);`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element
// methods.
const el = document.querySelector('rozie-data-table');
el.toggleAllRows(true);
const selected = el.getSelectedRows();`,
  },
};

// ---------------------------------------------------------------------------
// README rendering.
// ---------------------------------------------------------------------------

export function renderReadme(target, ir, eventManifest, pkgName, handleManifest = {}) {
  const usageSets = USAGE[target];
  if (!usageSets || usageSets.length === 0) {
    throw new Error(`renderReadme: no usage snippet for target "${target}"`);
  }
  const primaryLang = usageSets[0].lang;

  const lines = [];
  lines.push(`# ${pkgName}`);
  lines.push('');
  lines.push(
    `Idiomatic **${target}** \`DataTable\` — a headless, fully-accessible (WAI-ARIA) ` +
      `data table (sorting, global + per-column filtering, pagination, row selection, ` +
      `column visibility / resize / reorder / pinning, sticky header) compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `The state engine is \`@tanstack/table-core\` — the SAME framework-agnostic core ` +
      `behind TanStack Table, wired to this framework's reactivity with NO per-framework ` +
      `adapter. Every visual value is a CSS custom property, so it re-skins to any design ` +
      `system. This package is generated; do not edit \`src/\` by hand.`,
  );
  lines.push('');

  // Install
  lines.push('## Install');
  lines.push('');
  lines.push('```bash');
  lines.push(`npm i ${pkgName}`);
  lines.push('```');
  lines.push('');
  lines.push(`Peer dependencies: \`${FRAMEWORK_PEER_LABEL[target]}\`. Install them alongside this package.`);
  lines.push('');

  // Usage — one heading per aligned example set.
  lines.push('## Usage');
  lines.push('');
  lines.push(
    'Columns may be declared as a `:columns` config array **or** as `<Column>` children ' +
      '(or both — an id-keyed last-write-wins union). Per-cell rendering is one parent ' +
      '`#cell` / `#colHeader` renderer on `<DataTable>`, dispatched by `columnId`, so it ' +
      'works the same with either column form.',
  );
  lines.push('');
  for (const set of usageSets) {
    lines.push(`### ${set.title}`);
    lines.push('');
    lines.push('```' + set.lang);
    lines.push(set.code);
    lines.push('```');
    lines.push('');
  }

  // Theming
  lines.push('## Theming');
  lines.push('');
  lines.push(
    'Every visual value is a `--rozie-data-table-*` CSS custom property — override any of ' +
      'them at any ancestor scope. Ready-made design-system bridges ship in the package ' +
      '(import `base.css` first, then a bridge):',
  );
  lines.push('');
  lines.push('```' + (target === 'lit' ? 'ts' : primaryLang === 'vue' ? 'ts' : primaryLang));
  lines.push(`import '${pkgName}/themes/base.css';`);
  lines.push(`import '${pkgName}/themes/shadcn.css';    // or material.css, bootstrap.css`);
  lines.push('```');
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

  // Events
  lines.push('## Events');
  lines.push('');
  lines.push('| Event | Description |');
  lines.push('| --- | --- |');
  for (const ev of ir.emits) {
    const desc = eventManifest[ev];
    if (!desc) throw new Error(`renderReadme: event "${ev}" missing from event-manifest`);
    lines.push(`| \`${ev}\` | ${desc} |`);
  }
  lines.push('');

  // Imperative handle.
  if (ir.expose && ir.expose.length > 0) {
    const handleUsage = HANDLE_USAGE[target];
    if (!handleUsage) throw new Error(`renderReadme: no handle-usage snippet for target "${target}"`);
    lines.push('## Imperative handle');
    lines.push('');
    lines.push(
      'Beyond props, the component exposes imperative methods (declared once in the Rozie source ' +
        'via `$expose`). Grab a handle with the native ref mechanism and call them directly:',
    );
    lines.push('');
    lines.push('| Method | Description |');
    lines.push('| --- | --- |');
    for (const m of ir.expose) {
      const desc = handleManifest[m.name];
      if (!desc) throw new Error(`renderReadme: exposed method "${m.name}" missing from handle-manifest`);
      lines.push(`| \`${m.name}\` | ${desc} |`);
    }
    lines.push('');
    lines.push('```' + handleUsage.lang);
    lines.push(handleUsage.code);
    lines.push('```');
    lines.push('');
  }

  // Slots
  lines.push('## Slots');
  lines.push('');
  lines.push(
    'All rendering slots live on the parent `<DataTable>` (a `<Column>` carries metadata ' +
      'only). The `cell` / `colHeader` slots are single renderers dispatched by `columnId` ' +
      '— switch on it to vary the render per column; a column the slot does not render shows ' +
      'the plain accessor value. (On React/Solid these are render-prop props — `renderCell` / ' +
      '`renderColHeader` / `cellSlot` / `colHeaderSlot`; on Lit they are the `.cell` / ' +
      '`.colHeader` properties — the documented cross-framework divergence.)',
  );
  lines.push('');
  lines.push('| Slot | Params |');
  lines.push('| --- | --- |');
  // De-duplicate by name: the same logical slot can be DECLARED more than once in the source
  // when a template branch is duplicated for an r-if/r-else structural guard (phase 53 windowing
  // duplicates the <table> — and thus its #cell/#colHeader/#selectAll/#selectCell slots — across
  // the virtual and non-virtual branches). The README should list each slot once.
  const seenSlots = new Set();
  for (const s of ir.slots) {
    if (seenSlots.has(s.name)) continue;
    seenSlots.add(s.name);
    lines.push(`| ${renderSlotName(s.name)} | ${slotParams(s)} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Docs props-table validator (VALIDATE-NOT-OVERWRITE).
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
    docRows.set(nameMatch[1], { type: cells[1], def: cells[2] });
  }

  const irNames = new Set(ir.props.map((p) => p.name));
  const docNames = new Set(docRows.keys());
  for (const n of irNames) if (!docNames.has(n)) errors.push(`docs missing prop row: "${n}" (present in source)`);
  for (const n of docNames) if (!irNames.has(n)) errors.push(`docs has stale prop row: "${n}" (absent from source)`);

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
