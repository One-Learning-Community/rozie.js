/**
 * README rendering + docs-table validation for @rozie-ui/number-field.
 *
 * Everything structural is derived from a SINGLE parse of NumberField.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. The event + handle prose comes from the
 * hand-kept manifests; the PER-PROP prose comes from each prop's `<props>`
 * `docs.description` (Phase 59 single-source-of-truth), rendered through the
 * shared `renderPropDescription` helper from `@rozie/core` so the README + the
 * docs-site `rozie-props` table cannot diverge.
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
import { NumberField } from '@rozie-ui/number-field-react';

export function Demo() {
  const [qty, setQty] = useState<number | null>(1);
  return (
    <NumberField
      modelValue={qty}
      onModelValueChange={setQty}
      min={0}
      max={10}
      step={1}
      ariaLabel="Quantity"
      onChange={(e) => console.log('value:', e.value)}
    />
  );
}

// Locale-aware currency, with press-and-hold acceleration on the steppers.
export function PriceDemo() {
  const [price, setPrice] = useState<number | null>(9.99);
  return (
    <NumberField
      modelValue={price}
      onModelValueChange={setPrice}
      min={0}
      step={0.01}
      formatOptions={{ style: 'currency', currency: 'USD' }}
      ariaLabel="Price"
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import NumberField from '@rozie-ui/number-field-vue';

const qty = ref<number | null>(1);
function onChange(e: { value: number | null }) {
  console.log('value:', e.value);
}
</script>

<template>
  <NumberField v-model:modelValue="qty" :min="0" :max="10" :step="1" aria-label="Quantity" @change="onChange" />

  <!-- Locale-aware currency -->
  <NumberField v-model:modelValue="qty" :min="0" :step="0.01" :format-options="{ style: 'currency', currency: 'USD' }" aria-label="Price" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import NumberField from '@rozie-ui/number-field-svelte';

  let qty = $state<number | null>(1);
</script>

<NumberField
  bind:modelValue={qty}
  min={0}
  max={10}
  step={1}
  ariaLabel="Quantity"
  onchange={(e) => console.log('value:', e.value)}
/>

<!-- Locale-aware currency -->
<NumberField bind:modelValue={qty} min={0} step={0.01} formatOptions={{ style: 'currency', currency: 'USD' }} ariaLabel="Price" />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { NumberField } from '@rozie-ui/number-field-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [NumberField],
  template: \`
    <NumberField [(modelValue)]="qty" [min]="0" [max]="10" [step]="1" ariaLabel="Quantity" (change)="onChange($event)" />

    <!-- Locale-aware currency -->
    <NumberField [(modelValue)]="qty" [min]="0" [step]="0.01" [formatOptions]="currency" ariaLabel="Price" />
  \`,
})
export class DemoComponent {
  qty: number | null = 1;
  currency = { style: 'currency', currency: 'USD' };
  onChange(e: { value: number | null }) {
    console.log('value:', e.value);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { NumberField } from '@rozie-ui/number-field-solid';

export function Demo() {
  const [qty, setQty] = createSignal<number | null>(1);
  return (
    <NumberField
      modelValue={qty()}
      onModelValueChange={setQty}
      min={0}
      max={10}
      step={1}
      ariaLabel="Quantity"
      onChange={(e) => console.log('value:', e.value)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/number-field-lit';

// <rozie-number-field> is a custom element. Bind \`modelValue\`/\`min\`/\`max\`/\`step\`
// as properties, and listen for \`model-value-change\` to receive the new value as
// the two-way model, or \`change\` for every committed change.
const el = document.querySelector('rozie-number-field');
el.min = 0;
el.max = 10;
el.step = 1;
el.modelValue = 1;
el.addEventListener('model-value-change', (e) => {
  el.modelValue = e.detail;
});
el.addEventListener('change', (e) => {
  console.log('value:', e.detail.value);
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
// `modelValue` model prop IS the control value — a number field is a form control.
const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NumberField } from '@rozie-ui/number-field-angular';

@Component({
  selector: 'app-number-form',
  standalone: true,
  imports: [NumberField, ReactiveFormsModule],
  template: \`
    <!-- The number field value IS the form control value -->
    <NumberField [formControl]="qty" [min]="0" [max]="10" ariaLabel="Quantity" />
  \`,
})
export class NumberFormComponent {
  qty = new FormControl<number | null>(1);
}

// Template-driven forms work the same way:
//   <NumberField [(ngModel)]="qty" name="qty" [min]="0" [max]="10" />`,
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { NumberField, type NumberFieldHandle } from '@rozie-ui/number-field-react';

const field = useRef<NumberFieldHandle>(null);
// <NumberField ref={field} ... />
field.current?.focus();
field.current?.increment();
field.current?.decrement();
field.current?.clear();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const field = ref();          // template ref
</script>

<template>
  <NumberField ref="field" v-model:modelValue="qty" />
  <button @click="field.increment()">+</button>
  <button @click="field.clear()">Clear</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let field;                  // component instance via bind:this
</script>

<NumberField bind:this={field} bind:modelValue={qty} />
<button onclick={() => field.increment()}>+</button>
<button onclick={() => field.clear()}>Clear</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(NumberField) field!: NumberField;   // or the viewChild() signal
  bump() { this.field.increment(); }
  reset() { this.field.clear(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { NumberField, type NumberFieldHandle } from '@rozie-ui/number-field-solid';

let handle: NumberFieldHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<NumberField ref={(h) => (handle = h)} modelValue={qty()} />;
handle?.increment();
handle?.clear();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element
// methods. \`focus()\` here DELIBERATELY overrides the inherited
// HTMLElement.focus (it focuses + selects the input).
const el = document.querySelector('rozie-number-field');
el.focus();
el.increment();
el.decrement();
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
    `Idiomatic **${target}** \`NumberField\` — a headless, fully-accessible (WAI-ARIA ` +
      `\`role="spinbutton"\`) numeric stepper: clamp to \`[min, max]\`, step snapping, ` +
      `keyboard (Arrow / PageUp·Down / Home / End), press-and-hold acceleration on the ` +
      `+/- buttons, locale-aware \`Intl.NumberFormat\` display, optional scrub-on-drag, ` +
      `and a \`number | null\` two-way value — compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `The interaction engine IS the browser's native \`<input>\`; ` +
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
    'Every visual value is a `--rozie-number-field-*` CSS custom property — override any of ' +
      'them at any ancestor scope. Ready-made design-system bridges ship in the package:',
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
        'prop is the control value, so a number field **is** a form control. It binds to ' +
        'template-driven and reactive forms directives directly, with no wrapper directive:',
    );
    lines.push('');
    lines.push('```' + ANGULAR_FORMS_USAGE.lang);
    lines.push(ANGULAR_FORMS_USAGE.code);
    lines.push('```');
    lines.push('');
  }

  // Props — the Description cell is sourced from the single-source-of-truth
  // `docs.description` via the shared `renderPropDescription` helper.
  lines.push('## Props');
  lines.push('');
  lines.push('| Name | Type | Default | Two-way (model) | Required | Description |');
  lines.push('| --- | --- | --- | :---: | :---: | --- |');
  for (const p of ir.props) {
    const type = renderPropType(p.typeAnnotation);
    const def = renderPropDefault(p.defaultValue);
    const model = p.isModel ? '✓' : '';
    const required = p.required ? '✓' : '';
    const desc = renderPropDescription(p);
    lines.push(`| \`${p.name}\` | \`${type}\` | \`${def}\` | ${model} | ${required} | ${desc} |`);
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
        'Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses + ' +
        'selects the input) — on the Lit custom element this is an accepted ROZ137 warn-only ' +
        'override, the public `focus()` handle is intended:',
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
