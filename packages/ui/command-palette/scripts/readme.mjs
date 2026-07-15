/**
 * README rendering + docs-table validation for @rozie-ui/command-palette.
 *
 * Everything structural is derived from a SINGLE parse of CommandPalette.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Prop PROSE comes from the shared core
 * helper `renderPropDescription` (the single source of truth — the `.rozie`
 * `<props> docs.description`); only the event + handle prose come from the
 * hand-kept manifests.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 */
import { renderPropDescription } from '@rozie/core';

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
// ---------------------------------------------------------------------------

export const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { CommandPalette } from '@rozie-ui/command-palette-react';
import '@rozie-ui/command-palette-react/themes/base.css';

const commands = [
  { id: 'new', label: 'New File', group: 'File', keywords: ['create'] },
  { id: 'open', label: 'Open File', group: 'File' },
  { id: 'settings', label: 'Preferences', group: 'App' },
];

export function Demo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  return (
    <>
      <button onClick={() => setOpen(true)}>Open palette (⌘K)</button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        items={commands}
        onSelect={(e) => console.log('ran:', e.item.id)}
      />
    </>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import CommandPalette from '@rozie-ui/command-palette-vue';
import '@rozie-ui/command-palette-vue/themes/base.css';

const open = ref(false);
const query = ref('');
const commands = [
  { id: 'new', label: 'New File', group: 'File', keywords: ['create'] },
  { id: 'open', label: 'Open File', group: 'File' },
  { id: 'settings', label: 'Preferences', group: 'App' },
];
function onSelect(e: { item: { id: string }; path: string[] }) {
  console.log('ran:', e.item.id);
}
</script>

<template>
  <button @click="open = true">Open palette (⌘K)</button>
  <CommandPalette v-model:open="open" v-model:query="query" :items="commands" @select="onSelect" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import CommandPalette from '@rozie-ui/command-palette-svelte';
  import '@rozie-ui/command-palette-svelte/themes/base.css';

  let open = $state(false);
  let query = $state('');
  const commands = [
    { id: 'new', label: 'New File', group: 'File', keywords: ['create'] },
    { id: 'open', label: 'Open File', group: 'File' },
    { id: 'settings', label: 'Preferences', group: 'App' },
  ];
</script>

<button onclick={() => (open = true)}>Open palette (⌘K)</button>
<CommandPalette
  bind:open
  bind:query
  items={commands}
  onselect={(e) => console.log('ran:', e.item.id)}
/>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { CommandPalette } from '@rozie-ui/command-palette-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CommandPalette],
  template: \`
    <button (click)="open = true">Open palette (⌘K)</button>
    <CommandPalette [(open)]="open" [(query)]="query" [items]="commands" (select)="onSelect($event)" />
  \`,
})
export class DemoComponent {
  open = false;
  query = '';
  commands = [
    { id: 'new', label: 'New File', group: 'File', keywords: ['create'] },
    { id: 'open', label: 'Open File', group: 'File' },
    { id: 'settings', label: 'Preferences', group: 'App' },
  ];
  onSelect(e: { item: { id: string }; path: string[] }) {
    console.log('ran:', e.item.id);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { CommandPalette } from '@rozie-ui/command-palette-solid';
import '@rozie-ui/command-palette-solid/themes/base.css';

const commands = [
  { id: 'new', label: 'New File', group: 'File', keywords: ['create'] },
  { id: 'open', label: 'Open File', group: 'File' },
  { id: 'settings', label: 'Preferences', group: 'App' },
];

export function Demo() {
  const [open, setOpen] = createSignal(false);
  const [query, setQuery] = createSignal('');
  return (
    <>
      <button onClick={() => setOpen(true)}>Open palette (⌘K)</button>
      <CommandPalette
        open={open()}
        onOpenChange={setOpen}
        query={query()}
        onQueryChange={setQuery}
        items={commands}
        onSelect={(e) => console.log('ran:', e.item.id)}
      />
    </>
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/command-palette-lit';
import '@rozie-ui/command-palette-lit/themes/base.css';

// <rozie-command-palette> is a custom element. Bind \`items\` as a property,
// two-way \`open\`/\`query\` via the \`open-change\`/\`query-change\` events, and
// listen for \`select\` to run the chosen command.
const el = document.querySelector('rozie-command-palette');
el.items = [
  { id: 'new', label: 'New File', group: 'File', keywords: ['create'] },
  { id: 'open', label: 'Open File', group: 'File' },
];
el.addEventListener('open-change', (e) => { el.open = e.detail.open; });
el.addEventListener('query-change', (e) => { el.query = e.detail; });
el.addEventListener('select', (e) => { console.log('ran:', e.detail.item.id); });
el.open = true;`,
  },
};

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom',
  vue: 'vue',
  svelte: 'svelte',
  angular: '@angular/core + @angular/common + @angular/forms',
  solid: 'solid-js',
  lit: 'lit + @lit-labs/preact-signals + @preact/signals-core',
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { CommandPalette, type CommandPaletteHandle } from '@rozie-ui/command-palette-react';

const palette = useRef<CommandPaletteHandle>(null);
// <CommandPalette ref={palette} ... />
palette.current?.show();
palette.current?.toggle();
palette.current?.close();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const palette = ref();          // template ref
</script>

<template>
  <CommandPalette ref="palette" v-model:open="open" :items="commands" />
  <button @click="palette.toggle()">⌘K</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let palette;                  // component instance via bind:this
</script>

<CommandPalette bind:this={palette} bind:open :items={commands} />
<button onclick={() => palette.toggle()}>⌘K</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(CommandPalette) palette!: CommandPalette;   // or the viewChild() signal
  openIt() { this.palette.show(); }
  toggleIt() { this.palette.toggle(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { CommandPalette, type CommandPaletteHandle } from '@rozie-ui/command-palette-solid';

let handle: CommandPaletteHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<CommandPalette ref={(h) => (handle = h)} open={open()} items={commands} />;
handle?.toggle();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element
// methods. \`focus()\` here DELIBERATELY overrides the inherited HTMLElement.focus
// (it focuses the search input).
const el = document.querySelector('rozie-command-palette');
el.show();
el.toggle();
el.focus();`,
  },
};

// ---------------------------------------------------------------------------
// README rendering.
// ---------------------------------------------------------------------------

export function renderReadme(target, ir, eventManifest, pkgName, handleManifest = {}) {
  const usage = USAGE[target];
  if (!usage) throw new Error(`renderReadme: no usage snippet for target "${target}"`);

  const lines = [];
  lines.push(`# ${pkgName}`);
  lines.push('');
  lines.push(
    `Idiomatic **${target}** \`CommandPalette\` — a headless, accessible (WAI-ARIA) ` +
      `cmdk-style command menu (a centered modal overlay with a search box over a ` +
      `filtered, keyboard-navigable list — ⌘K palettes) compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `The interaction model is authored entirely in Rozie — no third-party engine; ` +
      `every visual value is a CSS custom property, so it re-skins to any design system. ` +
      `This package is generated; do not edit \`src/\` by hand.`,
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

  // Usage
  lines.push('## Usage');
  lines.push('');
  lines.push('```' + usage.lang);
  lines.push(usage.code);
  lines.push('```');
  lines.push('');

  // Theming
  lines.push('## Theming');
  lines.push('');
  lines.push(
    'Every visual value is a `--rozie-command-palette-*` CSS custom property — override any of ' +
      'them at any ancestor scope. Ready-made design-system bridges ship in the package:',
  );
  lines.push('');
  lines.push('```' + (target === 'lit' ? 'ts' : usage.lang === 'vue' ? 'ts' : usage.lang));
  lines.push(`import '${pkgName}/themes/shadcn.css';    // or material.css, bootstrap.css, base.css`);
  lines.push('```');
  lines.push('');

  // Props
  lines.push('## Props');
  lines.push('');
  lines.push('| Name | Type | Default | Two-way (model) | Required | Description |');
  lines.push('| --- | --- | --- | :---: | :---: | --- |');
  for (const p of ir.props) {
    const type = renderPropType(p.typeAnnotation);
    const def = renderPropDefault(p.defaultValue);
    const model = p.isModel ? '✓' : '';
    const required = p.required ? '✓' : '';
    lines.push(`| \`${p.name}\` | \`${type}\` | \`${def}\` | ${model} | ${required} | ${renderPropDescription(p)} |`);
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
        'via `$expose`). Grab a handle with the native ref mechanism and call them directly. ' +
        'Note: the open verb is `show()` (an `open()` verb would collide with the `open` model), and ' +
        '`focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the search ' +
        'input) — on the Lit custom element this is an accepted ROZ137 warn-only override:',
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
  lines.push('| Slot | Params |');
  lines.push('| --- | --- |');
  for (const s of ir.slots) {
    lines.push(`| ${renderSlotName(s.name)} | ${slotParams(s)} |`);
  }
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Docs props-table validator (VALIDATE-NOT-OVERWRITE).
//
// Accepts a `## Props` (or `### Props`) heading. When the section is a build-time
// `rozie-props` fence (the docs-site api page), the table is regenerated from the
// SAME ir at vitepress build, so the structural drift check is moot —
// short-circuit to a pass (the data-table D-05 relaxation, scoped to the fence).
// ---------------------------------------------------------------------------

export function validateDocsPropsTable(ir, docsMarkdown) {
  const errors = [];

  const headingMatch = docsMarkdown.match(/(?:^|\n)#{2,3} Props(?=\s|$)/);
  if (!headingMatch) {
    return { ok: false, errors: ['docs: "## Props" heading not found'], checkedRows: 0 };
  }
  const afterHeading = docsMarkdown.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingIdx = afterHeading.search(/\n#{1,3}\s/);
  const section = nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  if (/\n```\s*rozie-props\b/.test(section)) {
    return { ok: true, errors: [], checkedRows: 0 };
  }

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
