/**
 * README rendering + docs-table validation for @rozie-ui/dialog.
 *
 * Everything structural is derived from a SINGLE parse of Dialog.rozie
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
import { Dialog } from '@rozie-ui/dialog-react';

export function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        ariaLabelledby="confirm-title"
        onClose={(e) => console.log('closed:', e.reason)}
      >
        <h2 id="confirm-title">Delete file?</h2>
        <p>This cannot be undone.</p>
        <button onClick={() => setOpen(false)}>Cancel</button>
        <button onClick={() => setOpen(false)}>Delete</button>
      </Dialog>
    </>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Dialog from '@rozie-ui/dialog-vue';

const open = ref(false);
function onClose(e: { reason: 'backdrop' | 'escape' | 'programmatic' }) {
  console.log('closed:', e.reason);
}
</script>

<template>
  <button @click="open = true">Open dialog</button>

  <Dialog v-model:open="open" aria-labelledby="confirm-title" @close="onClose">
    <h2 id="confirm-title">Delete file?</h2>
    <p>This cannot be undone.</p>
    <button @click="open = false">Cancel</button>
    <button @click="open = false">Delete</button>
  </Dialog>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Dialog from '@rozie-ui/dialog-svelte';

  let open = $state(false);
</script>

<button onclick={() => (open = true)}>Open dialog</button>

<Dialog
  bind:open
  ariaLabelledby="confirm-title"
  onclose={(e) => console.log('closed:', e.reason)}
>
  <h2 id="confirm-title">Delete file?</h2>
  <p>This cannot be undone.</p>
  <button onclick={() => (open = false)}>Cancel</button>
  <button onclick={() => (open = false)}>Delete</button>
</Dialog>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Dialog } from '@rozie-ui/dialog-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Dialog],
  template: \`
    <button (click)="open = true">Open dialog</button>

    <Dialog [(open)]="open" ariaLabelledby="confirm-title" (close)="onClose($event)">
      <h2 id="confirm-title">Delete file?</h2>
      <p>This cannot be undone.</p>
      <button (click)="open = false">Cancel</button>
      <button (click)="open = false">Delete</button>
    </Dialog>
  \`,
})
export class DemoComponent {
  open = false;
  onClose(e: { reason: 'backdrop' | 'escape' | 'programmatic' }) {
    console.log('closed:', e.reason);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Dialog } from '@rozie-ui/dialog-solid';

export function Demo() {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Dialog
        open={open()}
        onOpenChange={setOpen}
        ariaLabelledby="confirm-title"
        onClose={(e) => console.log('closed:', e.reason)}
      >
        <h2 id="confirm-title">Delete file?</h2>
        <p>This cannot be undone.</p>
        <button onClick={() => setOpen(false)}>Cancel</button>
        <button onClick={() => setOpen(false)}>Delete</button>
      </Dialog>
    </>
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/dialog-lit';

// <rozie-dialog> is a custom element. Put the dialog content in its light DOM,
// bind \`open\` as a property (true → showModal()), listen for \`open-change\` to
// receive the two-way value, and \`close\` for the dismiss reason.
const el = document.querySelector('rozie-dialog');
el.setAttribute('aria-labelledby', 'confirm-title');
el.open = true;
el.addEventListener('open-change', (e) => {
  el.open = e.detail;
});
el.addEventListener('close', (e) => {
  console.log('closed:', e.detail.reason);
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

// Per-framework "obtain the imperative handle" snippets (`$expose`). The verbs
// are `show` / `hide` (NOT `open` / `close`) to avoid the `open` model + `@close`
// event collisions — see handle-manifest.mjs.
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Dialog, type DialogHandle } from '@rozie-ui/dialog-react';

const dialog = useRef<DialogHandle>(null);
// <Dialog ref={dialog} ...>…</Dialog>
dialog.current?.show();
dialog.current?.hide();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const dialog = ref();          // template ref
</script>

<template>
  <Dialog ref="dialog" v-model:open="open"><!-- … --></Dialog>
  <button @click="dialog.show()">Open</button>
  <button @click="dialog.hide()">Close</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let dialog;                  // component instance via bind:this
</script>

<Dialog bind:this={dialog} bind:open><!-- … --></Dialog>
<button onclick={() => dialog.show()}>Open</button>
<button onclick={() => dialog.hide()}>Close</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Dialog) dialog!: Dialog;   // or the viewChild() signal
  openIt() { this.dialog.show(); }
  closeIt() { this.dialog.hide(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Dialog, type DialogHandle } from '@rozie-ui/dialog-solid';

let handle: DialogHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Dialog ref={(h) => (handle = h)} open={open()}>…</Dialog>;
handle?.show();
handle?.hide();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element
// methods. show() opens via showModal(); hide() closes + emits \`close\`.
const el = document.querySelector('rozie-dialog');
el.show();
el.hide();`,
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
    `Idiomatic **${target}** \`Dialog\` — a headless, fully-accessible **modal dialog** ` +
      `built on the browser's native \`<dialog>\` element + \`showModal()\`, compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. The platform IS the ` +
      `engine: top-layer rendering that escapes \`z-index\` / \`overflow\` / \`transform\` ancestors ` +
      `with **no portal/teleport**, a native \`::backdrop\` scrim, a real focus trap, Esc-to-dismiss, ` +
      `and focus restoration on close — all for free. Rozie owns the author-side API: the two-way ` +
      `\`open\` binding, the open↔native reconcile, backdrop/escape close policy, optional scroll-lock, ` +
      `and a fully-tokenised skin. This package is generated; do not edit \`src/\` by hand.`,
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
    'Every cosmetic value is a `--rozie-dialog-*` CSS custom property — override any of them at ' +
      'any ancestor scope. The structural behaviour (top-layer, `::backdrop`, focus trap, centering) ' +
      'comes from the native `<dialog>` and is not tokenised. Ready-made design-system bridges ship ' +
      'in the package:',
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
        'via `$expose`). Grab a handle with the native ref mechanism and call them directly. The ' +
        'verbs are `show()` / `hide()` (not `open`/`close`) — `open` is the model prop and `close` is ' +
        'the dismiss event, so these names sidestep both collisions and are not inherited ' +
        '`HTMLElement` members:',
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
