/**
 * README rendering + docs-table validation for @rozie-ui/wavesurfer.
 *
 * Everything structural is derived from a SINGLE parse of Waveform.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/cropper/scripts/readme.mjs, retargeted to the audio-
 * waveform surface: a single two-way `currentTime` model prop, NO slots, the
 * wavesurfer event surface (ready/playing/paused/finished/timeupdate/seeking/
 * interaction/loading/error) — so the Events heading SHIPS — plus the
 * `wavesurfer.js` engine peer dependency. Unlike cropper, wavesurfer needs NO
 * external CSS, so there is no engine-CSS-import step.)
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
// The playback position is two-way bound through the single `currentTime` model
// prop (seconds). The audio comes through `src`. Playback lifecycle fires as
// native framework events. wavesurfer needs NO external CSS.
// ---------------------------------------------------------------------------

export const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { Waveform } from '@rozie-ui/wavesurfer-react';

export function Demo() {
  const [time, setTime] = useState(0);
  return (
    <Waveform
      src="/audio.mp3"
      currentTime={time}
      onCurrentTimeChange={setTime}
      timeline
      hover
      onReady={(d) => console.log('duration', d)}
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Waveform from '@rozie-ui/wavesurfer-vue';

const time = ref(0);
</script>

<template>
  <Waveform
    src="/audio.mp3"
    v-model:currentTime="time"
    :timeline="true"
    :hover="true"
    @ready="(d) => console.log('duration', d)"
  />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Waveform from '@rozie-ui/wavesurfer-svelte';

  let time = $state(0);
</script>

<Waveform
  src="/audio.mp3"
  bind:currentTime={time}
  timeline
  hover
  onready={(d) => console.log('duration', d)}
/>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Waveform } from '@rozie-ui/wavesurfer-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Waveform],
  template: \`
    <Waveform
      src="/audio.mp3"
      [(currentTime)]="time"
      [timeline]="true"
      [hover]="true"
      (ready)="onReady($event)"
    />
  \`,
})
export class DemoComponent {
  time = 0;
  onReady(d: any) { console.log('duration', d); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Waveform } from '@rozie-ui/wavesurfer-solid';

export function Demo() {
  const [time, setTime] = createSignal(0);
  return (
    <Waveform
      src="/audio.mp3"
      currentTime={time()}
      onCurrentTimeChange={setTime}
      timeline
      hover
      onReady={(d) => console.log('duration', d)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/wavesurfer-lit';

// <rozie-waveform> is a custom element. Bind \`src\`/\`currentTime\` as properties
// and listen for \`currentTime-change\` (the two-way channel) + \`ready\`.
const el = document.querySelector('rozie-waveform');
el.src = '/audio.mp3';
el.timeline = true;
el.addEventListener('currentTime-change', (e) => { el.currentTime = e.detail; });
el.addEventListener('ready', (e) => console.log('duration', e.detail));`,
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

export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Waveform, type WaveformHandle } from '@rozie-ui/wavesurfer-react';

const wave = useRef<WaveformHandle>(null);
// <Waveform ref={wave} ... />
wave.current?.playPause();
const dur = wave.current?.getDuration();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const wave = ref();      // template ref
</script>

<template>
  <Waveform ref="wave" ... />
  <button @click="wave.playPause()">Play / Pause</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let wave;              // component instance via bind:this
</script>

<Waveform bind:this={wave} ... />
<button onclick={() => wave.playPause()}>Play / Pause</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Waveform) wave!: Waveform;  // or the viewChild() signal
  toggle() { this.wave.playPause(); }
  duration() { return this.wave.getDuration(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Waveform, type WaveformHandle } from '@rozie-ui/wavesurfer-solid';

let handle: WaveformHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Waveform ref={(h) => (handle = h)} ... />;
handle?.playPause();
const dur = handle?.getDuration();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-waveform');
el.playPause();
const dur = el.getDuration();`,
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
    `Idiomatic **${target}** \`Waveform\` — a cross-framework audio waveform player ` +
      `compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) ` +
      `source wrapping [wavesurfer.js](https://wavesurfer.xyz) (v7). The playback ` +
      `position is two-way bound via \`currentTime\` (seconds). This ` +
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
    `Peer dependencies: the \`wavesurfer.js\` engine (\`^7\`) + ` +
      `\`${FRAMEWORK_PEER_LABEL[target]}\`. Install them alongside this package. ` +
      `wavesurfer renders a canvas — no external CSS import is required.`,
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

  // Events — gated on ir.emits.length > 0 (wavesurfer IS event-ful, so this ships).
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

  // Slots — Waveform declares none, so this section is normally absent. Kept for
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
// Identical contract to the cropper/maplibre validators. codegen.mjs invokes this
// against docs/components/wavesurfer.md (which ships a real "### Props" table) —
// ENFORCING: it throws on drift of the IR-derivable structural columns
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
