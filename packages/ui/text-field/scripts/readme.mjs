/**
 * README rendering + docs-table validation for @rozie-ui/text-field.
 *
 * Everything structural is derived from a SINGLE parse of TextField.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only the event + handle prose comes
 * from the hand-kept manifests.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 */

import { litEventName, litEventNamesDiverge, LIT_EVENT_NOTE } from '../../lit-event-name.mjs';
import { runtimeDepNote } from '../../runtime-dep-note.mjs';

// ---------------------------------------------------------------------------
// IR-derivation helpers (shared by README rendering AND the docs validator).
// ---------------------------------------------------------------------------

export function renderPropType(typeAnnotation) {
  if (!typeAnnotation) return 'any';
  if (typeAnnotation.kind === 'identifier') return typeAnnotation.name;
  // A `type: [String, Element]` array decl lowers to a union: render each member
  // joined with ` | ` (the docs table's `String \| Element` cell). Same case as
  // popover's and sortable-list's readme.mjs.
  if (typeAnnotation.kind === 'union' && Array.isArray(typeAnnotation.members)) {
    return typeAnnotation.members.map(renderPropType).join(' | ');
  }
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
import { TextField } from '@rozie-ui/text-field-react';

export function Demo() {
  const [email, setEmail] = useState('');
  const error = email && !email.includes('@') ? 'Enter a valid email address.' : '';
  return (
    <TextField
      modelValue={email}
      onModelValueChange={setEmail}
      label="Email"
      type="email"
      description="We never share it."
      error={error}
      required
    />
  );
}

// A textarea that grows with its content, with a character counter.
export function NotesDemo() {
  const [notes, setNotes] = useState('');
  return (
    <TextField
      modelValue={notes}
      onModelValueChange={setNotes}
      label="Notes"
      multiline
      autosize
      maxRows={8}
      maxLength={500}
      showCount
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { computed, ref } from 'vue';
import TextField from '@rozie-ui/text-field-vue';

const email = ref('');
const error = computed(() => (email.value && !email.value.includes('@') ? 'Enter a valid email address.' : ''));
const notes = ref('');
</script>

<template>
  <TextField v-model:modelValue="email" label="Email" type="email"
             description="We never share it." :error="error" required />

  <!-- A textarea that grows with its content, with a character counter -->
  <TextField v-model:modelValue="notes" label="Notes" multiline autosize
             :max-rows="8" :max-length="500" show-count />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import TextField from '@rozie-ui/text-field-svelte';

  let email = $state('');
  let notes = $state('');
  const error = $derived(email && !email.includes('@') ? 'Enter a valid email address.' : '');
</script>

<TextField bind:modelValue={email} label="Email" type="email"
           description="We never share it." {error} required />

<!-- A textarea that grows with its content, with a character counter -->
<TextField bind:modelValue={notes} label="Notes" multiline autosize maxRows={8} maxLength={500} showCount />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TextField } from '@rozie-ui/text-field-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [TextField, ReactiveFormsModule],
  template: \`
    <!-- TextField is a ControlValueAccessor: bind it like any form control. -->
    <TextField [formControl]="email" label="Email" type="email" description="We never share it."
               [error]="email.touched && email.invalid ? 'Enter a valid email address.' : ''" [required]="true" />

    <!-- Or two-way bind the model directly. -->
    <TextField [(modelValue)]="notes" label="Notes" [multiline]="true" [autosize]="true" [maxRows]="8" />
  \`,
})
export class DemoComponent {
  email = new FormControl('', [Validators.required, Validators.email]);
  notes = '';
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { TextField } from '@rozie-ui/text-field-solid';

export function Demo() {
  const [email, setEmail] = createSignal('');
  const error = () => (email() && !email().includes('@') ? 'Enter a valid email address.' : '');
  return (
    <TextField
      modelValue={email()}
      onModelValueChange={setEmail}
      label="Email"
      type="email"
      description="We never share it."
      error={error()}
      required
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/text-field-lit';

// <rozie-text-field> is a custom element. Set props as properties (or kebab-case
// attributes), and listen for \`model-value-change\` to receive each keystroke as
// the two-way model, or \`change\` for a committed edit.
const el = document.querySelector('rozie-text-field');
el.label = 'Email';
el.type = 'email';
el.required = true;
el.addEventListener('model-value-change', (e) => {
  el.modelValue = e.detail;
  el.error = e.detail && !e.detail.includes('@') ? 'Enter a valid email address.' : '';
});

// The control and its label live in the element's shadow root, so they label
// each other there. A native <form> does not see the inner input: read
// \`modelValue\` when you submit.`,
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

// Per-framework \"obtain the imperative handle\" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { TextField, type TextFieldHandle } from '@rozie-ui/text-field-react';

const field = useRef<TextFieldHandle>(null);
// <TextField ref={field} ... />
field.current?.focus();
field.current?.select();
field.current?.clear();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
const field = ref();          // template ref
</script>

<template>
  <TextField ref="field" v-model:modelValue="text" label="Search" />
  <button @click="field.clear()">Clear</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  let field;                  // component instance via bind:this
</script>

<TextField bind:this={field} bind:modelValue={text} label="Search" />
<button onclick={() => field.clear()}>Clear</button>`,
  },
  angular: {
    lang: 'ts',
    code: `export class DemoComponent {
  @ViewChild(TextField) field!: TextField;   // or the viewChild() signal
  reset() { this.field.clear(); this.field.focus(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { TextField, type TextFieldHandle } from '@rozie-ui/text-field-solid';

let handle: TextFieldHandle | undefined;

<TextField ref={(h) => (handle = h)} modelValue={text()} onModelValueChange={setText} label="Search" />;
handle?.clear();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle: exposed methods are public element methods.
const el = document.querySelector('rozie-text-field');
el.focus();   // moves focus into the inner control
el.select();
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
    `Idiomatic **${target}** \`TextField\` — an accessible **text field and textarea** with its ` +
      `own label, description, error message and character counter, compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. The control is a native ` +
      `\`<input>\` (or \`<textarea>\`); Rozie owns the field around it: the \`for\` / ` +
      `\`aria-describedby\` / \`aria-invalid\` wiring, a two-way \`modelValue\` binding (an Angular ` +
      `\`ControlValueAccessor\`), opt-in textarea autosize, and a fully-tokenised skin. This package ` +
      `is generated; do not edit \`src/\` by hand.`,
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

  // Disclose the @rozie/runtime-* dependency this leaf actually carries.
  // Derived from its package.json — null when the leaf imports none.
  const runtimeNote = runtimeDepNote(pkgName);
  if (runtimeNote) {
    lines.push(runtimeNote);
    lines.push('');
  }

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
    'Every cosmetic value is a `--rozie-text-field-*` CSS custom property — override any of them at ' +
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
    // A union renders as `A | B`; a bare pipe would split the table row, so escape it.
    const type = renderPropType(p.typeAnnotation).replace(/\|/g, '\\|');
    const def = renderPropDefault(p.defaultValue);
    const model = p.isModel ? '✓' : '';
    const required = p.required ? '✓' : '';
    lines.push(`| \`${p.name}\` | \`${type}\` | \`${def}\` | ${model} | ${required} |`);
  }
  lines.push('');

  // Events
  lines.push('## Events');
  lines.push('');
  if (target === 'lit' && litEventNamesDiverge(ir.emits)) {
    lines.push(LIT_EVENT_NOTE);
    lines.push('');
  }
  lines.push('| Event | Description |');
  lines.push('| --- | --- |');
  for (const ev of ir.emits) {
    const desc = eventManifest[ev];
    if (!desc) throw new Error(`renderReadme: event "${ev}" missing from event-manifest`);
    const eventCol = target === 'lit' ? litEventName(ev) : ev;
    lines.push(`| \`${eventCol}\` | ${desc} |`);
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
  const seenSlotNames = new Set();
  for (const s of ir.slots) {
    if (seenSlotNames.has(s.name)) continue;
    seenSlotNames.add(s.name);
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
    // The IR type may itself be a union (`String | Element`): every source member
    // must be present in the docs cell (same subset check as popover's).
    const irTypeTokens = irType.split('|').map((t) => t.trim());
    if (!irTypeTokens.every((t) => docTypeTokens.includes(t))) {
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
