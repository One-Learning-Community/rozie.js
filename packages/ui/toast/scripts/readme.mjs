/**
 * README rendering + docs-table validation for @rozie-ui/toast.
 *
 * Everything structural is derived from a SINGLE parse of Toaster.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only the handle prose comes from the
 * hand-kept manifest. Toaster emits NOTHING, so the Events section is skipped
 * entirely (rendered only when `ir.emits` is non-empty).
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
//
// The host renders nothing until you drive it through the imperative handle
// grabbed via `ref` — so the "usage" IS the ref + show()/dismiss()/clear()
// pattern. The #toast scoped slot ({ toast, dismiss }) customizes per-toast
// chrome; without it each toast renders message + a close button.
// ---------------------------------------------------------------------------

export const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Toaster, type ToasterHandle } from '@rozie-ui/toast-react';

export function Demo() {
  const toaster = useRef<ToasterHandle>(null);
  return (
    <>
      <button onClick={() => toaster.current?.show({ message: 'Saved!', type: 'success' })}>
        Save
      </button>
      <button onClick={() => toaster.current?.show({ message: 'Something failed', type: 'error' })}>
        Fail
      </button>

      {/* Mount the host once (typically near the app root). */}
      <Toaster ref={toaster} position="bottom-right" duration={4000} />
    </>
  );
}

// Custom per-toast chrome via the #toast scoped slot:
//   <Toaster ref={toaster}>
//     {({ toast, dismiss }) => (
//       <div className="my-toast">
//         <strong>{toast.type}</strong> {toast.message}
//         <button onClick={() => dismiss(toast.id)}>OK</button>
//       </div>
//     )}
//   </Toaster>`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Toaster from '@rozie-ui/toast-vue';

const toaster = ref();          // template ref → the imperative handle
</script>

<template>
  <button @click="toaster.show({ message: 'Saved!', type: 'success' })">Save</button>
  <button @click="toaster.show({ message: 'Something failed', type: 'error' })">Fail</button>

  <!-- Mount the host once (typically near the app root). -->
  <Toaster ref="toaster" position="bottom-right" :duration="4000" />

  <!-- Custom per-toast chrome via the #toast scoped slot:
  <Toaster ref="toaster">
    <template #toast="{ toast, dismiss }">
      <strong>{{ toast.type }}</strong> {{ toast.message }}
      <button @click="dismiss(toast.id)">OK</button>
    </template>
  </Toaster>
  -->
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Toaster from '@rozie-ui/toast-svelte';

  let toaster;                  // component instance via bind:this
</script>

<button onclick={() => toaster.show({ message: 'Saved!', type: 'success' })}>Save</button>
<button onclick={() => toaster.show({ message: 'Something failed', type: 'error' })}>Fail</button>

<!-- Mount the host once (typically near the app root). -->
<Toaster bind:this={toaster} position="bottom-right" duration={4000} />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component, ViewChild } from '@angular/core';
import { Toaster } from '@rozie-ui/toast-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Toaster],
  template: \`
    <button (click)="toaster.show({ message: 'Saved!', type: 'success' })">Save</button>
    <button (click)="toaster.show({ message: 'Something failed', type: 'error' })">Fail</button>

    <!-- Mount the host once (typically near the app root). -->
    <Toaster #toaster position="bottom-right" [duration]="4000" />
  \`,
})
export class DemoComponent {
  @ViewChild('toaster') toaster!: Toaster;
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Toaster, type ToasterHandle } from '@rozie-ui/toast-solid';

export function Demo() {
  let toaster: ToasterHandle | undefined;
  // The ref callback receives the HANDLE object (not the DOM node).
  return (
    <>
      <button onClick={() => toaster?.show({ message: 'Saved!', type: 'success' })}>Save</button>
      <button onClick={() => toaster?.show({ message: 'Something failed', type: 'error' })}>Fail</button>

      {/* Mount the host once (typically near the app root). */}
      <Toaster ref={(h) => (toaster = h)} position="bottom-right" duration={4000} />
    </>
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/toast-lit';

// <rozie-toaster> is a custom element. Bind \`position\`/\`duration\` as properties,
// then call the imperative \`show\` / \`dismiss\` / \`clear\` methods on the element.
const el = document.querySelector('rozie-toaster');
el.position = 'bottom-right';
el.duration = 4000;
const id = el.show({ message: 'Saved!', type: 'success' });
// el.dismiss(id);
// el.clear();`,
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

// Per-framework "obtain the imperative handle" snippets (`$expose`). For Toaster
// the handle IS the primary API (there are no events) — show enqueues, dismiss
// removes one toast by id, clear removes all.
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Toaster, type ToasterHandle } from '@rozie-ui/toast-react';

const toaster = useRef<ToasterHandle>(null);
// <Toaster ref={toaster} ... />
const id = toaster.current?.show({ message: 'Saved', type: 'success' });
toaster.current?.dismiss(id!);
toaster.current?.clear();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const toaster = ref();          // template ref
</script>

<template>
  <Toaster ref="toaster" />
  <button @click="toaster.show({ message: 'Saved', type: 'success' })">Notify</button>
  <button @click="toaster.clear()">Clear all</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let toaster;                  // component instance via bind:this
</script>

<Toaster bind:this={toaster} />
<button onclick={() => toaster.show({ message: 'Saved', type: 'success' })}>Notify</button>
<button onclick={() => toaster.clear()}>Clear all</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Toaster) toaster!: Toaster;   // or the viewChild() signal
  notify() { this.toaster.show({ message: 'Saved', type: 'success' }); }
  clearAll() { this.toaster.clear(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Toaster, type ToasterHandle } from '@rozie-ui/toast-solid';

let toaster: ToasterHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Toaster ref={(h) => (toaster = h)} />;
toaster?.show({ message: 'Saved', type: 'success' });
toaster?.clear();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — the exposed methods are public element
// methods (none overrides an inherited HTMLElement member, so there is no
// ROZ137 warning).
const el = document.querySelector('rozie-toaster');
const id = el.show({ message: 'Saved', type: 'success' });
el.dismiss(id);
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
    `Idiomatic **${target}** \`Toaster\` — a headless, accessible toast / ` +
      `notification host (a live-region queue with per-toast auto-dismiss timers, ` +
      `hover-to-pause, six corner positions, and a per-toast close button) compiled ` +
      `from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `It is **not** a global singleton + context system: the host owns the queue + ` +
      `timers as internal state and exposes an imperative \`show\` / \`dismiss\` / ` +
      `\`clear\` handle you drive via \`ref\` — "call from anywhere" is your app's ` +
      `wiring concern (stash the ref). ` +
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
    'Every visual value is a `--rozie-toast-*` CSS custom property — override any of them at ' +
      'any ancestor scope. Ready-made design-system bridges ship in the package:',
  );
  lines.push('');
  lines.push('```' + (target === 'lit' ? 'ts' : usage.lang === 'vue' ? 'ts' : usage.lang));
  lines.push(`import '${pkgName}/themes/shadcn.css';    // or material.css, bootstrap.css, base.css`);
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

  // Events (Toaster emits NOTHING — render only when there are emits).
  if (ir.emits && ir.emits.length > 0) {
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
  }

  // Imperative handle.
  if (ir.expose && ir.expose.length > 0) {
    const handleUsage = HANDLE_USAGE[target];
    if (!handleUsage) throw new Error(`renderReadme: no handle-usage snippet for target "${target}"`);
    lines.push('## Imperative handle');
    lines.push('');
    lines.push(
      'The component has no events — its primary API is an imperative handle (declared once in the ' +
        'Rozie source via `$expose`). Grab a handle with the native ref mechanism and call the methods ' +
        'directly. None of the verbs overrides an inherited host-element member, so the Lit custom ' +
        'element emits no ROZ137 warning:',
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
