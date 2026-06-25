/**
 * README rendering + docs-table validation for @rozie-ui/date-picker.
 *
 * Everything structural is derived from a SINGLE parse of DatePicker.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only the event + handle prose comes
 * from the hand-kept manifests.
 *
 * Prop PROSE has a single source: the `.rozie` `<props>` `docs.description`,
 * rendered through the shared `renderPropDescription` helper from `@rozie/core`
 * (Phase 59) — the SAME generator the docs-site `rozie-props` fence uses, so the
 * README props table and the docs-site table cannot diverge.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 */

import { renderPropDescription } from '@rozie/core';

// ---------------------------------------------------------------------------
// IR-derivation helpers (shared by README rendering AND the docs validator).
// renderPropType / renderPropDefault stay LOCAL (display-syntax twins of the
// core helpers); only the Description cell is sourced from the shared helper.
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
import { DatePicker } from '@rozie-ui/date-picker-react';

export function Demo() {
  const [date, setDate] = useState(''); // ISO YYYY-MM-DD, '' = no selection
  return (
    <DatePicker
      value={date}
      onValueChange={setDate}
      min="2026-01-01"
      onChange={(e) => console.log('picked:', e.value)}
    />
  );
}

// Custom header via the scoped #header slot (render-prop on React).
export function CustomHeaderDemo() {
  const [date, setDate] = useState('');
  return (
    <DatePicker value={date} onValueChange={setDate}>
      {{
        header: ({ label, prev, next }) => (
          <div className="my-header">
            <button onClick={prev}>Prev</button>
            <strong>{label}</strong>
            <button onClick={next}>Next</button>
          </div>
        ),
      }}
    </DatePicker>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import DatePicker from '@rozie-ui/date-picker-vue';

const date = ref(''); // ISO YYYY-MM-DD, '' = no selection
function onChange(e: { value: string }) {
  console.log('picked:', e.value);
}
</script>

<template>
  <DatePicker v-model:value="date" min="2026-01-01" @change="onChange" />

  <!-- Custom header via the scoped #header slot -->
  <DatePicker v-model:value="date">
    <template #header="{ label, prev, next }">
      <div class="my-header">
        <button @click="prev">Prev</button>
        <strong>{{ label }}</strong>
        <button @click="next">Next</button>
      </div>
    </template>
  </DatePicker>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import DatePicker from '@rozie-ui/date-picker-svelte';

  let date = $state(''); // ISO YYYY-MM-DD, '' = no selection
</script>

<DatePicker
  bind:value={date}
  min="2026-01-01"
  onchange={(e) => console.log('picked:', e.value)}
/>

<!-- Custom header via the #header snippet -->
<DatePicker bind:value={date}>
  {#snippet header({ label, prev, next })}
    <div class="my-header">
      <button onclick={prev}>Prev</button>
      <strong>{label}</strong>
      <button onclick={next}>Next</button>
    </div>
  {/snippet}
</DatePicker>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { DatePicker } from '@rozie-ui/date-picker-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [DatePicker],
  template: \`
    <DatePicker [(value)]="date" min="2026-01-01" (change)="onChange($event)" />
  \`,
})
export class DemoComponent {
  date = ''; // ISO YYYY-MM-DD, '' = no selection
  onChange(e: { value: string }) {
    console.log('picked:', e.value);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { DatePicker } from '@rozie-ui/date-picker-solid';

export function Demo() {
  const [date, setDate] = createSignal('');
  return (
    <DatePicker
      value={date()}
      onValueChange={setDate}
      min="2026-01-01"
      onChange={(e) => console.log('picked:', e.value)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/date-picker-lit';

// <rozie-date-picker> is a custom element. Bind \`value\`/\`min\`/\`max\` as
// properties and listen for \`value-change\` (the two-way ISO date) + \`change\`.
const el = document.querySelector('rozie-date-picker');
el.min = '2026-01-01';
el.value = '';
el.addEventListener('value-change', (e) => {
  el.value = e.detail;
});
el.addEventListener('change', (e) => {
  console.log('picked:', e.detail.value);
});`,
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

// Angular forms-integration snippet (CVA). Rendered ONLY for angular when the
// source has exactly one `model: true` prop (the emitter's CVA gate). The single
// `value` model prop IS the control value — a date picker binds to forms.
const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { DatePicker } from '@rozie-ui/date-picker-angular';

@Component({
  selector: 'app-date-form',
  standalone: true,
  imports: [DatePicker, ReactiveFormsModule],
  template: \`
    <!-- The selected ISO date IS the form control value -->
    <DatePicker [formControl]="date" min="2026-01-01" />
  \`,
})
export class DateFormComponent {
  date = new FormControl<string>('');
}

// Template-driven forms work the same way:
//   <DatePicker [(ngModel)]="date" name="date" />`,
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { DatePicker, type DatePickerHandle } from '@rozie-ui/date-picker-react';

const picker = useRef<DatePickerHandle>(null);
// <DatePicker ref={picker} ... />
picker.current?.focus();
picker.current?.goToToday();
picker.current?.clear();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const picker = ref();          // template ref
</script>

<template>
  <DatePicker ref="picker" v-model:value="date" />
  <button @click="picker.goToToday()">Today</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let picker;                  // component instance via bind:this
</script>

<DatePicker bind:this={picker} bind:value={date} />
<button onclick={() => picker.goToToday()}>Today</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(DatePicker) picker!: DatePicker;   // or the viewChild() signal
  jumpToToday() { this.picker.goToToday(); }
  reset() { this.picker.clear(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { DatePicker, type DatePickerHandle } from '@rozie-ui/date-picker-solid';

let handle: DatePickerHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<DatePicker ref={(h) => (handle = h)} value={date()} />;
handle?.goToToday();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element methods.
const el = document.querySelector('rozie-date-picker');
el.focus();
el.goToToday();
el.clear();`,
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
    `Idiomatic **${target}** \`DatePicker\` — a headless, fully-accessible (WAI-ARIA) ` +
      `single-date calendar (a month grid with leading/trailing spill, prev/next month ` +
      `navigation, \`weekStartsOn\` rotation, \`min\`/\`max\`/\`disabledDates\` gating, roving ` +
      `keyboard focus, and localized \`Intl\` labels) compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `It is HEADLESS: accept the default token-themed calendar, or override the month-nav ` +
      `header via the scoped slot. ` +
      `Every visual value is a CSS custom property, so it re-skins to any design system. ` +
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
    'Every visual value is a `--rozie-datepicker-*` CSS custom property — override any of them ' +
      'at any ancestor scope. Ready-made design-system bridges ship in the package:',
  );
  lines.push('');
  lines.push('```' + (target === 'lit' ? 'ts' : usage.lang === 'vue' ? 'ts' : usage.lang));
  lines.push(`import '${pkgName}/themes/shadcn.css';    // or material.css, bootstrap.css, base.css`);
  lines.push('```');
  lines.push('');

  // Angular forms integration (CVA).
  const modelProps = ir.props.filter((p) => p.isModel);
  if (target === 'angular' && modelProps.length === 1) {
    const modelProp = modelProps[0];
    lines.push('## Angular forms');
    lines.push('');
    lines.push(
      `The generated class implements \`ControlValueAccessor\` — the \`${modelProp.name}\` model ` +
        'prop is the control value, so the date picker binds to template-driven and reactive forms ' +
        'directives directly, with no wrapper directive:',
    );
    lines.push('');
    lines.push('```' + ANGULAR_FORMS_USAGE.lang);
    lines.push(ANGULAR_FORMS_USAGE.code);
    lines.push('```');
    lines.push('');
  }

  // Props — Description column sourced from the shared single-source helper.
  lines.push('## Props');
  lines.push('');
  lines.push('| Name | Type | Default | Two-way (model) | Required | Description |');
  lines.push('| --- | --- | --- | :---: | :---: | --- |');
  for (const p of ir.props) {
    const type = renderPropType(p.typeAnnotation);
    const def = renderPropDefault(p.defaultValue);
    const model = p.isModel ? '✓' : '';
    const required = p.required ? '✓' : '';
    // Description is the LAST column on purpose: validateDocsPropsTable reads
    // only the first three columns (Name/Type/Default).
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
// Accepts a `## Props` (H2) or `### Props` (H3) heading. When the section is a
// build-time `rozie-props` fence (the single-source path), the docs table is
// regenerated from the SAME `ir` at the docs build, so the structural drift
// check is moot — short-circuit to a pass. The hand-authored-row throw-on-drift
// path stays available.
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
