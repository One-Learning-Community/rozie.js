/**
 * README rendering + docs-table validation for @rozie-ui/maplibre.
 *
 * Everything structural is derived from a SINGLE parse of MapLibre.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/codemirror/scripts/readme.mjs, retargeted to the
 * interactive-map surface: four two-way camera model props
 * (`center`/`zoom`/`bearing`/`pitch`), a `markers`/`popups`-driven pair of
 * REACTIVE MULTI-INSTANCE portal slots + a mount-once `control` portal slot, and
 * the rich map-event surface — MapLibre IS event-ful, so the Events heading SHIPS
 * (the chartjs analog, unlike CodeMirror's gated-out one), and the `maplibre-gl`
 * engine peer dependency.)
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
// The two-way camera state is split across four model props
// (`center`/`zoom`/`bearing`/`pitch`). `center` is `[lng, lat]` — lng FIRST (NOT
// Leaflet's `[lat, lng]`). The map style comes through `:map-style` (the prop is
// `mapStyle`, NOT `style` — a reserved attribute across the targets). Markers and
// popups are declarative (driven by the `markers`/`popups` props that feed the
// REACTIVE MULTI-INSTANCE portal slots); map events fire as native framework
// events.
//
// Consumers must import the engine CSS once (`maplibre-gl/dist/maplibre-gl.css`)
// — the scoped `.rozie` <style> cannot reach the engine-rendered control/popup
// DOM. See the Install section.
// ---------------------------------------------------------------------------

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { MapLibre } from '@rozie-ui/maplibre-react';
import 'maplibre-gl/dist/maplibre-gl.css';

export function Demo() {
  const [center, setCenter] = useState<[number, number]>([0, 0]);
  const [zoom, setZoom] = useState(2);
  return (
    <div style={{ height: 400 }}>
      <MapLibre
        center={center}
        onCenterChange={setCenter}
        zoom={zoom}
        onZoomChange={setZoom}
        controls={['navigation', 'scale']}
        onClick={(e) => console.log(e.lngLat)}
      />
    </div>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import MapLibre from '@rozie-ui/maplibre-vue';
import 'maplibre-gl/dist/maplibre-gl.css';

const center = ref<[number, number]>([0, 0]);
const zoom = ref(2);
</script>

<template>
  <div style="height: 400px">
    <MapLibre
      v-model:center="center"
      v-model:zoom="zoom"
      :controls="['navigation', 'scale']"
      @click="(e) => console.log(e.lngLat)"
    />
  </div>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import MapLibre from '@rozie-ui/maplibre-svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let center = $state<[number, number]>([0, 0]);
  let zoom = $state(2);
</script>

<div style="height: 400px">
  <MapLibre
    bind:center
    bind:zoom
    controls={['navigation', 'scale']}
    onclick={(e) => console.log(e.lngLat)}
  />
</div>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { MapLibre } from '@rozie-ui/maplibre-angular';
// Add 'maplibre-gl/dist/maplibre-gl.css' to your global styles.

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [MapLibre],
  template: \`
    <div style="height: 400px">
      <MapLibre
        [(center)]="center"
        [(zoom)]="zoom"
        [controls]="['navigation', 'scale']"
        (click)="onClick($event)"
      />
    </div>
  \`,
})
export class DemoComponent {
  center: [number, number] = [0, 0];
  zoom = 2;
  onClick(e: any) { console.log(e.lngLat); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { MapLibre } from '@rozie-ui/maplibre-solid';
import 'maplibre-gl/dist/maplibre-gl.css';

export function Demo() {
  const [center, setCenter] = createSignal<[number, number]>([0, 0]);
  const [zoom, setZoom] = createSignal(2);
  return (
    <div style={{ height: '400px' }}>
      <MapLibre
        center={center()}
        onCenterChange={setCenter}
        zoom={zoom()}
        onZoomChange={setZoom}
        controls={['navigation', 'scale']}
        onClick={(e) => console.log(e.lngLat)}
      />
    </div>
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/maplibre-lit';
import 'maplibre-gl/dist/maplibre-gl.css';

// <rozie-map-libre> is a custom element. Bind \`center\`/\`zoom\` as properties
// and listen for \`center-change\`/\`zoom-change\` (the two-way change channels).
const el = document.querySelector('rozie-map-libre');
el.center = [0, 0];
el.zoom = 2;
el.controls = ['navigation', 'scale'];
el.addEventListener('center-change', (e) => { el.center = e.detail; });
el.addEventListener('click', (e) => console.log(e.detail.lngLat));`,
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
import { MapLibre, type MapLibreHandle } from '@rozie-ui/maplibre-react';

const map = useRef<MapLibreHandle>(null);
// <MapLibre ref={map} ... />
map.current?.flyTo({ center: [-74.5, 40], zoom: 9 });
const raw = map.current?.getMap();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const map = ref();         // template ref
</script>

<template>
  <MapLibre ref="map" />
  <button @click="map.flyTo({ center: [-74.5, 40], zoom: 9 })">Fly</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let map;                 // component instance via bind:this
</script>

<MapLibre bind:this={map} />
<button onclick={() => map.flyTo({ center: [-74.5, 40], zoom: 9 })}>Fly</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(MapLibre) map!: MapLibre;  // or the viewChild() signal
  fly() { this.map.flyTo({ center: [-74.5, 40], zoom: 9 }); }
  raw() { return this.map.getMap(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { MapLibre, type MapLibreHandle } from '@rozie-ui/maplibre-solid';

let handle: MapLibreHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<MapLibre ref={(h) => (handle = h)} />;
handle?.flyTo({ center: [-74.5, 40], zoom: 9 });
const raw = handle?.getMap();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-map-libre');
el.flyTo({ center: [-74.5, 40], zoom: 9 });
const raw = el.getMap();`,
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
    `Idiomatic **${target}** \`MapLibre\` — a cross-framework interactive map ` +
      `component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) ` +
      `source wrapping [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/). The camera is ` +
      `two-way bound across \`center\`/\`zoom\`/\`bearing\`/\`pitch\`; \`center\` is \`[lng, lat]\` ` +
      `(lng FIRST). This package is generated; do not edit \`src/\` by hand.`,
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
    `Peer dependencies: the \`maplibre-gl\` engine (\`^5\`) + ` +
      `\`${FRAMEWORK_PEER_LABEL[target]}\`. Install them alongside this package.`,
  );
  lines.push('');
  lines.push(
    'Import the engine CSS once at your app entry (the scoped component `<style>` cannot reach the ' +
      'engine-rendered control/popup/marker DOM):',
  );
  lines.push('');
  lines.push('```ts');
  lines.push("import 'maplibre-gl/dist/maplibre-gl.css';");
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

  // Events — gated on ir.emits.length > 0 (MapLibre IS event-ful, so this
  // section SHIPS — the chartjs analog, unlike the CodeMirror gated-out one).
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

  // Imperative handle — driven by ir.expose (Phase 21 `$expose`); emit the
  // section only if the source exposes methods.
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

  // Slots — MapLibre exposes the reactive multi-instance `marker`/`popup` portal
  // slots + the mount-once `control` portal slot. Emit the section only if the
  // source declares any slots.
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
// Identical contract to the codemirror/chartjs/fullcalendar validators.
// codegen.mjs invokes this against docs/guide/maplibre.md (which ships a real
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
