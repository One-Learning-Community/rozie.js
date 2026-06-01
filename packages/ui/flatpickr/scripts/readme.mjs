/**
 * README rendering + docs-table validation for @rozie-ui/flatpickr.
 *
 * Everything structural is derived from a SINGLE parse of Flatpickr.rozie
 * (`ir.props` / `ir.slots` / `ir.emits`) so the per-leaf READMEs cannot drift
 * from the compiled output. Only event prose comes from the hand-kept
 * event-manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/sortable-list/scripts/readme.mjs, retargeted to the
 * date-picker surface: input-based usage snippets, no slots.)
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
// The two-way model prop is `date` (the formatted STRING). The `change` event
// also surfaces `selectedDates: Date[]` for consumers that need parsed objects.
// flatpickr's own stylesheet must be imported by the consuming app.
// ---------------------------------------------------------------------------

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { Flatpickr } from '@rozie-ui/flatpickr-react';
import 'flatpickr/dist/flatpickr.css';

export function Demo() {
  const [date, setDate] = useState('2026-05-17');
  return (
    <Flatpickr
      date={date}
      onDateChange={setDate}
      onChange={(e) => console.log(e.value, e.selectedDates)}
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Flatpickr from '@rozie-ui/flatpickr-vue';
import 'flatpickr/dist/flatpickr.css';

const date = ref('2026-05-17');
</script>

<template>
  <Flatpickr v-model:date="date" @change="(e) => console.log(e.value, e.selectedDates)" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Flatpickr from '@rozie-ui/flatpickr-svelte';
  import 'flatpickr/dist/flatpickr.css';

  let date = $state('2026-05-17');
</script>

<Flatpickr bind:date onchange={(e) => console.log(e.value, e.selectedDates)} />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Flatpickr } from '@rozie-ui/flatpickr-angular';
import 'flatpickr/dist/flatpickr.css';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Flatpickr],
  template: \`
    <Flatpickr [(date)]="date" (change)="onChange($event)" />
  \`,
})
export class DemoComponent {
  date = '2026-05-17';
  onChange(e: { value: string; selectedDates: Date[] }) {
    console.log(e.value, e.selectedDates);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Flatpickr } from '@rozie-ui/flatpickr-solid';
import 'flatpickr/dist/flatpickr.css';

export function Demo() {
  const [date, setDate] = createSignal('2026-05-17');
  return (
    <Flatpickr
      date={date()}
      onDateChange={setDate}
      onChange={(e) => console.log(e.value, e.selectedDates)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/flatpickr-lit';
import 'flatpickr/dist/flatpickr.css';

// <rozie-flatpickr> is a custom element. Bind \`date\` as a property and
// listen for the \`date-change\` event to receive the formatted string.
const el = document.querySelector('rozie-flatpickr');
el.date = '2026-05-17';
el.addEventListener('date-change', (e) => {
  el.date = e.detail;
});
el.addEventListener('change', (e) => {
  console.log(e.detail.value, e.detail.selectedDates);
});`,
  },
};

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom',
  vue: 'vue',
  svelte: 'svelte',
  angular: '@angular/core + @angular/common',
  solid: 'solid-js',
  lit: 'lit',
};

// ---------------------------------------------------------------------------
// README rendering.
// ---------------------------------------------------------------------------

export function renderReadme(target, ir, eventManifest, pkgName) {
  const usage = USAGE[target];
  if (!usage) throw new Error(`renderReadme: no usage snippet for target "${target}"`);

  const lines = [];
  lines.push(`# ${pkgName}`);
  lines.push('');
  lines.push(
    `Idiomatic **${target}** \`Flatpickr\` — a cross-framework date picker ` +
      `compiled from one [Rozie](https://github.com/) source wrapping ` +
      `[flatpickr](https://flatpickr.js.org/). This package is generated; do ` +
      `not edit \`src/\` by hand.`,
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
    `Peer dependencies: \`flatpickr ^4.6\` + \`${FRAMEWORK_PEER_LABEL[target]}\`. ` +
      "Install them alongside this package, and import flatpickr's stylesheet " +
      "(`import 'flatpickr/dist/flatpickr.css'`) once in your app.",
  );
  lines.push('');

  // Usage
  lines.push('## Usage');
  lines.push('');
  lines.push('```' + usage.lang);
  lines.push(usage.code);
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

  // Slots — Flatpickr has none; emit the section only if the source declares any.
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
// Identical contract to the sortable-list validator. codegen.mjs only invokes
// this when a guide page with a "### Props" table exists; Flatpickr currently
// has a live-compile showcase page (docs/examples/flatpickr.md) with no props
// table, so the validation step is skipped there (logged, not thrown).
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
