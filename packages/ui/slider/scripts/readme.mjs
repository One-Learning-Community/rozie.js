/**
 * README rendering + docs-table validation for @rozie-ui/slider.
 *
 * Everything structural is derived from a SINGLE parse of Slider.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only the event + handle prose comes
 * from the hand-kept manifests.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
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
// ---------------------------------------------------------------------------

export const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { Slider } from '@rozie-ui/slider-react';

export function Demo() {
  const [value, setValue] = useState<number>(50);
  return (
    <Slider value={value} onValueChange={setValue} min={0} max={100} step={1} ariaLabel="Volume" showValue />
  );
}

// Range mode: bind a sorted [lo, hi] tuple.
export function RangeDemo() {
  const [range, setRange] = useState<[number, number]>([20, 80]);
  return <Slider value={range} onValueChange={setRange} range min={0} max={100} ariaLabel="Price range" />;
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Slider from '@rozie-ui/slider-vue';

const value = ref<number>(50);
const range = ref<[number, number]>([20, 80]);
</script>

<template>
  <Slider v-model:value="value" :min="0" :max="100" :step="1" aria-label="Volume" show-value />

  <!-- Range mode -->
  <Slider v-model:value="range" range :min="0" :max="100" aria-label="Price range" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Slider from '@rozie-ui/slider-svelte';

  let value = $state<number>(50);
  let range = $state<[number, number]>([20, 80]);
</script>

<Slider bind:value min={0} max={100} step={1} ariaLabel="Volume" showValue />

<!-- Range mode -->
<Slider bind:value={range} range min={0} max={100} ariaLabel="Price range" />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Slider } from '@rozie-ui/slider-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Slider],
  template: \`
    <Slider [(value)]="value" [min]="0" [max]="100" [step]="1" ariaLabel="Volume" [showValue]="true" />

    <!-- Range mode: value is a sorted [lo, hi] tuple -->
    <Slider [(value)]="range" [range]="true" [min]="0" [max]="100" ariaLabel="Price range" />
  \`,
})
export class DemoComponent {
  value = 50;
  range: [number, number] = [20, 80];
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Slider } from '@rozie-ui/slider-solid';

export function Demo() {
  const [value, setValue] = createSignal<number>(50);
  return <Slider value={value()} onValueChange={setValue} min={0} max={100} step={1} ariaLabel="Volume" showValue />;
}

// Range mode: bind a sorted [lo, hi] tuple.
export function RangeDemo() {
  const [range, setRange] = createSignal<[number, number]>([20, 80]);
  return <Slider value={range()} onValueChange={setRange} range min={0} max={100} ariaLabel="Price range" />;
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/slider-lit';

// <rozie-slider> is a custom element. Bind \`value\`/\`min\`/\`max\` as properties
// and listen for the \`value-change\` event to receive the new value (a number
// in single mode, a sorted [lo, hi] array in range mode).
const el = document.querySelector('rozie-slider');
el.min = 0;
el.max = 100;
el.value = 50;
el.addEventListener('value-change', (e) => {
  el.value = e.detail;
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
// `value` model prop is `unknown`-typed, so a scalar AND a range `[lo, hi]`
// array flow through `writeValue` identically.
const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Slider } from '@rozie-ui/slider-angular';

@Component({
  selector: 'app-volume-form',
  standalone: true,
  imports: [Slider, ReactiveFormsModule],
  template: \`
    <!-- The slider value IS the form control value -->
    <Slider [formControl]="volume" [min]="0" [max]="100" />
  \`,
})
export class VolumeFormComponent {
  volume = new FormControl<number>(50);
}

// Template-driven forms work the same way:
//   <Slider [(ngModel)]="volume" name="volume" [min]="0" [max]="100" />`,
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Slider, type SliderHandle } from '@rozie-ui/slider-react';

const sl = useRef<SliderHandle>(null);
// <Slider ref={sl} ... />
sl.current?.focus();
sl.current?.increment();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const sl = ref();          // template ref
</script>

<template>
  <Slider ref="sl" v-model:value="value" />
  <button @click="sl.increment()">+</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let sl;                  // component instance via bind:this
</script>

<Slider bind:this={sl} bind:value />
<button onclick={() => sl.increment()}>+</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Slider) sl!: Slider;   // or the viewChild() signal
  focusIt() { this.sl.focus(); }
  bumpIt() { this.sl.increment(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Slider, type SliderHandle } from '@rozie-ui/slider-solid';

let handle: SliderHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Slider ref={(h) => (handle = h)} value={value()} />;
handle?.increment();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element
// methods. \`focus()\` here DELIBERATELY overrides the inherited
// HTMLElement.focus (it focuses the native range thumb).
const el = document.querySelector('rozie-slider');
el.focus();
el.increment();`,
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
    `Idiomatic **${target}** \`Slider\` — a headless, fully-accessible (WAI-ARIA) ` +
      `slider / range (single + dual-thumb range, drag + full keyboard navigation, ` +
      `vertical orientation, marks) compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `The interaction engine IS the browser's native \`<input type="range">\`; ` +
      `every value is a CSS custom property, so it re-skins to any design system. ` +
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
    'Every visual value is a `--rozie-slider-*` CSS custom property — override any of them at ' +
      'any ancestor scope. Ready-made design-system bridges ship in the package:',
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
        'prop is the control value — so it binds to template-driven and reactive forms directives ' +
        'directly, with no wrapper directive (a scalar AND a range `[lo, hi]` array flow through ' +
        '`writeValue` identically):',
    );
    lines.push('');
    lines.push('```' + ANGULAR_FORMS_USAGE.lang);
    lines.push(ANGULAR_FORMS_USAGE.code);
    lines.push('```');
    lines.push('');
  }

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
        'via `$expose`). Grab a handle with the native ref mechanism and call them directly. ' +
        'Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the ' +
        'native range thumb) — on the Lit custom element this is an accepted ROZ137 warn-only ' +
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
