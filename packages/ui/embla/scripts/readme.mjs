/**
 * README rendering + docs-table validation for @rozie-ui/embla.
 *
 * Everything structural is derived from a SINGLE parse of Carousel.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/cropper/scripts/readme.mjs, retargeted to the carousel
 * surface: a single two-way `selectedIndex` model prop, default + `slide` slots,
 * the Embla event surface (select/settle/reInit/pointer-down) — so the Events
 * heading SHIPS — plus the `embla-carousel` + `embla-carousel-autoplay` engine
 * peer dependencies. NOTE: Embla ships its CSS skeleton scoped IN the component,
 * so there is NO engine-CSS import section.)
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
// The current snap is two-way bound through the single `selectedIndex` model
// prop. Slides come either as a `:slides` config array OR as default-slot DOM
// (`<div class="rozie-embla__slide">`). Embla snap/settle/reInit/pointer fire as
// native framework events. NO engine CSS import — the carousel skeleton CSS ships
// scoped in the component.
// ---------------------------------------------------------------------------

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { Carousel } from '@rozie-ui/embla-react';

export function Demo() {
  const [index, setIndex] = useState(0);
  return (
    <Carousel
      slides={['A', 'B', 'C']}
      selectedIndex={index}
      onSelectedIndexChange={setIndex}
      loop
      onSelect={(i) => console.log('snap', i)}
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Carousel from '@rozie-ui/embla-vue';

const index = ref(0);
</script>

<template>
  <Carousel
    :slides="['A', 'B', 'C']"
    v-model:selectedIndex="index"
    :loop="true"
    @select="(i) => console.log('snap', i)"
  />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Carousel from '@rozie-ui/embla-svelte';

  let index = $state(0);
</script>

<Carousel
  slides={['A', 'B', 'C']}
  bind:selectedIndex={index}
  loop
  onselect={(i) => console.log('snap', i)}
/>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Carousel } from '@rozie-ui/embla-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Carousel],
  template: \`
    <Carousel
      [slides]="['A', 'B', 'C']"
      [(selectedIndex)]="index"
      [loop]="true"
      (select)="onSelect($event)"
    />
  \`,
})
export class DemoComponent {
  index = 0;
  onSelect(i: number) { console.log('snap', i); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Carousel } from '@rozie-ui/embla-solid';

export function Demo() {
  const [index, setIndex] = createSignal(0);
  return (
    <Carousel
      slides={['A', 'B', 'C']}
      selectedIndex={index()}
      onSelectedIndexChange={setIndex}
      loop
      onSelect={(i) => console.log('snap', i)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/embla-lit';

// <rozie-carousel> is a custom element. Bind \`slides\`/\`selectedIndex\` as
// properties and listen for \`selected-index-change\` (the two-way change channel)
// + \`select\`.
const el = document.querySelector('rozie-carousel');
el.slides = ['A', 'B', 'C'];
el.loop = true;
el.addEventListener('selected-index-change', (e) => { el.selectedIndex = e.detail; });
el.addEventListener('select', (e) => console.log('snap', e.detail));`,
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
import { Carousel, type CarouselHandle } from '@rozie-ui/embla-react';

const carousel = useRef<CarouselHandle>(null);
// <Carousel ref={carousel} ... />
carousel.current?.scrollNext();
const i = carousel.current?.getSelectedIndex();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const carousel = ref();      // template ref
</script>

<template>
  <Carousel ref="carousel" ... />
  <button @click="carousel.scrollNext()">Next</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let carousel;              // component instance via bind:this
</script>

<Carousel bind:this={carousel} ... />
<button onclick={() => carousel.scrollNext()}>Next</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Carousel) carousel!: Carousel;  // or the viewChild() signal
  next() { this.carousel.scrollNext(); }
  current() { return this.carousel.getSelectedIndex(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Carousel, type CarouselHandle } from '@rozie-ui/embla-solid';

let handle: CarouselHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Carousel ref={(h) => (handle = h)} ... />;
handle?.scrollNext();
const i = handle?.getSelectedIndex();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-carousel');
el.scrollNext();
const i = el.getSelectedIndex();`,
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
    `Idiomatic **${target}** \`Carousel\` — a cross-framework carousel ` +
      `compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) ` +
      `source wrapping [Embla Carousel](https://www.embla-carousel.com) (v8). The current ` +
      `snap is two-way bound via \`selectedIndex\`; slides come as a \`slides\` config array or ` +
      `as default-slot DOM. This package is generated; do not edit \`src/\` by hand.`,
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
    `Peer dependencies: the \`embla-carousel\` (\`^8.6\`) + \`embla-carousel-autoplay\` (\`^8.6\`) ` +
      `engine packages + \`${FRAMEWORK_PEER_LABEL[target]}\`. Install them alongside this package.`,
  );
  lines.push('');
  lines.push(
    'No engine CSS to import — the carousel skeleton styles (`overflow: hidden` viewport, ' +
      'flex container, slide sizing) ship scoped inside the component.',
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

  // Events — gated on ir.emits.length > 0 (Embla IS event-ful, so this section
  // SHIPS).
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

  // Slots — Carousel declares a default slot (slides) + a scoped `slide` slot
  // (config-array mode).
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
// Identical contract to the cropper/maplibre/codemirror/chartjs validators.
// codegen.mjs invokes this against docs/guide/embla.md (which ships a real
// "### Props" table) — ENFORCING: it throws on drift of the IR-derivable
// structural columns (name/type/default).
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
