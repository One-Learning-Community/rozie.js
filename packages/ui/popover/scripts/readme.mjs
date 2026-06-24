/**
 * README rendering + docs-table validation for @rozie-ui/popover.
 *
 * Everything structural is derived from a SINGLE parse of Popover.rozie
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
import { Popover } from '@rozie-ui/popover-react';
import '@floating-ui/dom'; // peer engine — installed alongside this package

export function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottom"
      offset={8}
      arrow
      onChange={(next) => console.log('open:', next)}
      anchor={({ toggle }) => <button onClick={toggle}>Menu</button>}
    >
      <div>Floating content</div>
    </Popover>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Popover from '@rozie-ui/popover-vue';

const open = ref(false);
</script>

<template>
  <Popover v-model:open="open" trigger="click" placement="bottom" :offset="8" arrow @change="(o) => console.log('open:', o)">
    <template #anchor="{ toggle }">
      <button @click="toggle">Menu</button>
    </template>
    <div>Floating content</div>
  </Popover>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Popover from '@rozie-ui/popover-svelte';

  let open = $state(false);
</script>

<Popover bind:open trigger="click" placement="bottom" offset={8} arrow onchange={(o) => console.log('open:', o)}>
  {#snippet anchor({ toggle })}
    <button onclick={toggle}>Menu</button>
  {/snippet}
  <div>Floating content</div>
</Popover>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Popover } from '@rozie-ui/popover-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Popover],
  template: \`
    <Popover [(open)]="open" trigger="click" placement="bottom" [offset]="8" [arrow]="true" (change)="onChange($event)">
      <ng-template #anchor let-toggle="toggle">
        <button (click)="toggle()">Menu</button>
      </ng-template>
      <div>Floating content</div>
    </Popover>
  \`,
})
export class DemoComponent {
  open = false;
  onChange(next: boolean) {
    console.log('open:', next);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Popover } from '@rozie-ui/popover-solid';

export function Demo() {
  const [open, setOpen] = createSignal(false);
  return (
    <Popover
      open={open()}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottom"
      offset={8}
      arrow
      onChange={(next) => console.log('open:', next)}
      anchor={({ toggle }) => <button onClick={toggle}>Menu</button>}
    >
      <div>Floating content</div>
    </Popover>
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/popover-lit';
import '@floating-ui/dom'; // peer engine

// <rozie-popover> is a custom element. Bind \`open\`/\`placement\`/\`trigger\`/\`offset\`/
// \`arrow\` as properties; listen for \`change\` for the new open boolean, or
// \`open-change\` to drive the two-way model. Project the anchor into the \`anchor\`
// slot and the content into the default slot.
const el = document.querySelector('rozie-popover');
el.trigger = 'click';
el.placement = 'bottom';
el.offset = 8;
el.arrow = true;
el.addEventListener('open-change', (e) => {
  el.open = e.detail;
});
el.addEventListener('change', (e) => {
  console.log('open:', e.detail);
});`,
  },
};

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom + @floating-ui/dom',
  vue: 'vue + @floating-ui/dom',
  svelte: 'svelte + @floating-ui/dom',
  angular: '@angular/core + @angular/common + @floating-ui/dom',
  solid: 'solid-js + @floating-ui/dom',
  lit: 'lit + @lit-labs/preact-signals + @preact/signals-core + @floating-ui/dom',
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Popover, type PopoverHandle } from '@rozie-ui/popover-react';

const pop = useRef<PopoverHandle>(null);
// <Popover ref={pop} ... />
pop.current?.show();
pop.current?.hide();
pop.current?.toggle();
pop.current?.reposition();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const pop = ref();          // template ref
</script>

<template>
  <Popover ref="pop" v-model:open="open"> ... </Popover>
  <button @click="pop.show()">Open</button>
  <button @click="pop.reposition()">Reposition</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let pop;                  // component instance via bind:this
</script>

<Popover bind:this={pop} bind:open> ... </Popover>
<button onclick={() => pop.show()}>Open</button>
<button onclick={() => pop.reposition()}>Reposition</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Popover) pop!: Popover;   // or the viewChild() signal
  open() { this.pop.show(); }
  reflow() { this.pop.reposition(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Popover, type PopoverHandle } from '@rozie-ui/popover-solid';

let handle: PopoverHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Popover ref={(h) => (handle = h)} open={open()}> ... </Popover>;
handle?.show();
handle?.reposition();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element methods.
const el = document.querySelector('rozie-popover');
el.show();
el.hide();
el.toggle();
el.reposition();`,
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
    `Idiomatic **${target}** \`Popover\` — a headless floating primitive for tooltips and ` +
      `popovers, wrapping [\`@floating-ui/dom\`](https://floating-ui.com) for collision-aware ` +
      `positioning (offset / flip / shift / arrow) with live \`autoUpdate\` tracking. You bring ` +
      `the anchor (the \`anchor\` slot) and the floating content (the default slot); Popover owns ` +
      `placement, the open/close gesture (\`trigger\`: click / hover / focus), dismissal ` +
      `(Escape + click-outside), the WAI-ARIA wiring (tooltip vs dialog), and a two-way \`open\` ` +
      `model — compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `Every visual value is a CSS custom property, so it re-skins to any design system. ` +
      `This package is generated; do not edit \`src/\` by hand.`,
  );
  lines.push('');

  // Install
  lines.push('## Install');
  lines.push('');
  lines.push('```bash');
  lines.push(`npm i ${pkgName} @floating-ui/dom`);
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
    'Every visual value is a `--rozie-popover-*` CSS custom property (background, border, ' +
      'radius, shadow, padding, z-index, max-width, arrow size) — override any of them at any ' +
      'ancestor scope to match your design system.',
  );
  lines.push('');

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
