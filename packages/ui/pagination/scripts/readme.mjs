/**
 * README rendering + docs-table validation for @rozie-ui/pagination.
 *
 * Everything structural is derived from a SINGLE parse of Pagination.rozie
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
import { Pagination } from '@rozie-ui/pagination-react';

export function Demo() {
  const [page, setPage] = useState(1);
  return (
    <Pagination
      modelValue={page}
      onModelValueChange={setPage}
      total={195}
      pageSize={10}
      onChange={(e) => console.log('page:', e.page)}
    />
  );
}

// Headless: render your own page buttons via the scoped #item slot.
export function CustomDemo() {
  const [page, setPage] = useState(1);
  return (
    <Pagination
      modelValue={page}
      onModelValueChange={setPage}
      totalPages={20}
      siblingCount={2}
    >
      {{
        item: ({ page, selected, goto }) => (
          <button aria-current={selected ? 'page' : undefined} onClick={goto}>
            {page}
          </button>
        ),
      }}
    </Pagination>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Pagination from '@rozie-ui/pagination-vue';

const page = ref(1);
function onChange(e: { page: number }) {
  console.log('page:', e.page);
}
</script>

<template>
  <Pagination v-model:modelValue="page" :total="195" :pageSize="10" @change="onChange" />

  <!-- Headless: render your own controls via the scoped #item slot -->
  <Pagination v-model:modelValue="page" :totalPages="20" :siblingCount="2">
    <template #item="{ page, selected, goto }">
      <button :aria-current="selected ? 'page' : undefined" @click="goto">{{ page }}</button>
    </template>
  </Pagination>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Pagination from '@rozie-ui/pagination-svelte';

  let page = $state(1);
</script>

<Pagination
  bind:modelValue={page}
  total={195}
  pageSize={10}
  onchange={(e) => console.log('page:', e.page)}
/>

<!-- Headless: render your own controls via the #item snippet -->
<Pagination bind:modelValue={page} totalPages={20} siblingCount={2}>
  {#snippet item({ page, selected, goto })}
    <button aria-current={selected ? 'page' : undefined} onclick={goto}>{page}</button>
  {/snippet}
</Pagination>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Pagination } from '@rozie-ui/pagination-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Pagination],
  template: \`
    <Pagination [(modelValue)]="page" [total]="195" [pageSize]="10" (change)="onChange($event)" />
  \`,
})
export class DemoComponent {
  page = 1;
  onChange(e: { page: number }) {
    console.log('page:', e.page);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Pagination } from '@rozie-ui/pagination-solid';

export function Demo() {
  const [page, setPage] = createSignal(1);
  return (
    <Pagination
      modelValue={page()}
      onModelValueChange={setPage}
      total={195}
      pageSize={10}
      onChange={(e) => console.log('page:', e.page)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/pagination-lit';

// <rozie-pagination> is a custom element. Bind \`modelValue\`/\`total\`/\`pageSize\`
// as properties and listen for \`model-value-change\` (the two-way page) +
// \`change\` (the page-change event).
const el = document.querySelector('rozie-pagination');
el.total = 195;
el.pageSize = 10;
el.modelValue = 1;
el.addEventListener('model-value-change', (e) => {
  el.modelValue = e.detail;
});
el.addEventListener('change', (e) => {
  console.log('page:', e.detail.page);
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
// `modelValue` model prop IS the control value — a pager binds to forms.
const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Pagination } from '@rozie-ui/pagination-angular';

@Component({
  selector: 'app-pagination-form',
  standalone: true,
  imports: [Pagination, ReactiveFormsModule],
  template: \`
    <!-- The current page IS the form control value -->
    <Pagination [formControl]="page" [total]="195" [pageSize]="10" />
  \`,
})
export class PaginationFormComponent {
  page = new FormControl<number>(1);
}

// Template-driven forms work the same way:
//   <Pagination [(ngModel)]="page" name="page" [total]="195" [pageSize]="10" />`,
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Pagination, type PaginationHandle } from '@rozie-ui/pagination-react';

const pager = useRef<PaginationHandle>(null);
// <Pagination ref={pager} ... />
pager.current?.goto(5);
pager.current?.next();
pager.current?.first();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const pager = ref();          // template ref
</script>

<template>
  <Pagination ref="pager" v-model:modelValue="page" :total="195" :pageSize="10" />
  <button @click="pager.next()">Next</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let pager;                  // component instance via bind:this
</script>

<Pagination bind:this={pager} bind:modelValue={page} total={195} pageSize={10} />
<button onclick={() => pager.next()}>Next</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Pagination) pager!: Pagination;   // or the viewChild() signal
  goNext() { this.pager.next(); }
  jump() { this.pager.goto(5); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Pagination, type PaginationHandle } from '@rozie-ui/pagination-solid';

let handle: PaginationHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Pagination ref={(h) => (handle = h)} modelValue={page()} total={195} pageSize={10} />;
handle?.next();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element methods.
const el = document.querySelector('rozie-pagination');
el.goto(5);
el.next();
el.first();`,
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
    `Idiomatic **${target}** \`Pagination\` — a headless, fully-accessible (WAI-ARIA) ` +
      `pagination control (a windowed page-item model with ellipses, sibling/boundary ` +
      `windowing, prev/next bounds, roving keyboard navigation, and a \`<nav>\` landmark) ` +
      `compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `It is HEADLESS: expose the page-item model and render each control yourself via the ` +
      `scoped slots, or accept the default token-themed buttons. ` +
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
    'Every visual value is a `--rozie-pagination-*` CSS custom property — override any of them ' +
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
        'prop is the control value, so the pager binds to template-driven and reactive forms ' +
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
