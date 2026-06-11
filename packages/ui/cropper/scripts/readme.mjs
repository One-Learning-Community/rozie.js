/**
 * README rendering + docs-table validation for @rozie-ui/cropper.
 *
 * Everything structural is derived from a SINGLE parse of Cropper.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/maplibre/scripts/readme.mjs, retargeted to the image-
 * cropper surface: a single two-way `data` model prop, NO slots, and the
 * Cropper.js event surface (ready/crop/cropstart/cropmove/cropend/zoom) — so the
 * Events heading SHIPS — plus the `cropperjs` engine peer dependency.)
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
// The crop box is two-way bound through the single `data` model prop
// ({ x, y, width, height, rotate, scaleX, scaleY }). The image comes through
// `src`. Crop/zoom lifecycle fires as native framework events. Consumers must
// import the engine CSS once (`cropperjs/dist/cropper.css`) — the scoped `.rozie`
// <style> cannot reach the engine-rendered .cropper-* DOM. See the Install section.
// ---------------------------------------------------------------------------

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { Cropper } from '@rozie-ui/cropper-react';
import 'cropperjs/dist/cropper.css';

export function Demo() {
  const [data, setData] = useState();
  return (
    <Cropper
      src="/photo.jpg"
      data={data}
      onDataChange={setData}
      aspectRatio={16 / 9}
      viewMode={1}
      onCrop={(e) => console.log(e)}
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Cropper from '@rozie-ui/cropper-vue';
import 'cropperjs/dist/cropper.css';

const data = ref();
</script>

<template>
  <Cropper
    src="/photo.jpg"
    v-model:data="data"
    :aspect-ratio="16 / 9"
    :view-mode="1"
    @crop="(e) => console.log(e)"
  />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Cropper from '@rozie-ui/cropper-svelte';
  import 'cropperjs/dist/cropper.css';

  let data = $state();
</script>

<Cropper
  src="/photo.jpg"
  bind:data
  aspectRatio={16 / 9}
  viewMode={1}
  oncrop={(e) => console.log(e)}
/>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Cropper } from '@rozie-ui/cropper-angular';
// Add 'cropperjs/dist/cropper.css' to your global styles.

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Cropper],
  template: \`
    <Cropper
      src="/photo.jpg"
      [(data)]="data"
      [aspectRatio]="16 / 9"
      [viewMode]="1"
      (crop)="onCrop($event)"
    />
  \`,
})
export class DemoComponent {
  data: any;
  onCrop(e: any) { console.log(e); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Cropper } from '@rozie-ui/cropper-solid';
import 'cropperjs/dist/cropper.css';

export function Demo() {
  const [data, setData] = createSignal();
  return (
    <Cropper
      src="/photo.jpg"
      data={data()}
      onDataChange={setData}
      aspectRatio={16 / 9}
      viewMode={1}
      onCrop={(e) => console.log(e)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/cropper-lit';
import 'cropperjs/dist/cropper.css';

// <rozie-cropper> is a custom element. Bind \`src\`/\`data\` as properties and
// listen for \`data-change\` (the two-way change channel) + \`crop\`.
const el = document.querySelector('rozie-cropper');
el.src = '/photo.jpg';
el.aspectRatio = 16 / 9;
el.addEventListener('data-change', (e) => { el.data = e.detail; });
el.addEventListener('crop', (e) => console.log(e.detail));`,
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
import { Cropper, type CropperHandle } from '@rozie-ui/cropper-react';

const cropper = useRef<CropperHandle>(null);
// <Cropper ref={cropper} ... />
const url = cropper.current?.getCroppedDataURL();
cropper.current?.rotateBy(90);`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const cropper = ref();      // template ref
</script>

<template>
  <Cropper ref="cropper" ... />
  <button @click="cropper.rotateBy(90)">Rotate</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let cropper;              // component instance via bind:this
</script>

<Cropper bind:this={cropper} ... />
<button onclick={() => cropper.rotateBy(90)}>Rotate</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Cropper) cropper!: Cropper;  // or the viewChild() signal
  rotate() { this.cropper.rotateBy(90); }
  export() { return this.cropper.getCroppedDataURL(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Cropper, type CropperHandle } from '@rozie-ui/cropper-solid';

let handle: CropperHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Cropper ref={(h) => (handle = h)} ... />;
handle?.rotateBy(90);
const url = handle?.getCroppedDataURL();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-cropper');
el.rotateBy(90);
const url = el.getCroppedDataURL();`,
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
    `Idiomatic **${target}** \`Cropper\` — a cross-framework image cropper ` +
      `compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) ` +
      `source wrapping [Cropper.js](https://github.com/fengyuanchen/cropperjs) (v1). The crop box ` +
      `is two-way bound via \`data\` (\`{ x, y, width, height, rotate, scaleX, scaleY }\`). This ` +
      `package is generated; do not edit \`src/\` by hand.`,
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
    `Peer dependencies: the \`cropperjs\` engine (\`^1\`) + ` +
      `\`${FRAMEWORK_PEER_LABEL[target]}\`. Install them alongside this package.`,
  );
  lines.push('');
  lines.push(
    'Import the engine CSS once at your app entry (the scoped component `<style>` cannot reach the ' +
      'engine-rendered `.cropper-*` crop UI):',
  );
  lines.push('');
  lines.push('```ts');
  lines.push("import 'cropperjs/dist/cropper.css';");
  lines.push('```');
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

  // Events — gated on ir.emits.length > 0 (Cropper.js IS event-ful, so this
  // section SHIPS).
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

  // Slots — Cropper declares none, so this section is normally absent. Kept for
  // parity with the other @rozie-ui readmes (renders only if slots ever appear).
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
// Identical contract to the maplibre/codemirror/chartjs validators. codegen.mjs
// invokes this against docs/components/cropper.md (which ships a real "### Props"
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
