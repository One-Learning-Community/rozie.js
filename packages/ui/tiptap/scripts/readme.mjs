/**
 * README rendering + docs-table validation for @rozie-ui/tiptap.
 *
 * Everything structural is derived from a SINGLE parse of TipTap.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/codemirror/scripts/readme.mjs, retargeted to the
 * rich-text-editor surface: a two-way `html` content model, an `editorProps`/
 * `extensions` consumer-extensibility passthrough, the update/selectionUpdate/
 * focus/blur events — TipTap IS event-ful, so the Events heading SHIPS, unlike
 * CodeMirror's gated-out one — a `toolbar` portal slot, and the `@tiptap/core` +
 * `@tiptap/starter-kit` engine peers.)
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
// `html` is a two-way `model` prop — each target uses its native two-way idiom
// (React controlled value + onHtmlChange, Vue v-model:html, Svelte bind:html,
// Angular [(html)], Solid value+onHtmlChange, Lit property + html-change event).
// ---------------------------------------------------------------------------

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { TipTap } from '@rozie-ui/tiptap-react';

export function Demo() {
  const [html, setHtml] = useState('<p>Hello <strong>world</strong></p>');
  return <TipTap html={html} onHtmlChange={setHtml} placeholder="Start writing…" />;
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import TipTap from '@rozie-ui/tiptap-vue';

const html = ref('<p>Hello <strong>world</strong></p>');
</script>

<template>
  <TipTap v-model:html="html" placeholder="Start writing…" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import TipTap from '@rozie-ui/tiptap-svelte';

  let html = $state('<p>Hello <strong>world</strong></p>');
</script>

<TipTap bind:html placeholder="Start writing…" />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TipTap } from '@rozie-ui/tiptap-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [TipTap, FormsModule],
  template: \`<TipTap [(html)]="html" placeholder="Start writing…" />\`,
})
export class DemoComponent {
  html = '<p>Hello <strong>world</strong></p>';
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { TipTap } from '@rozie-ui/tiptap-solid';

export function Demo() {
  const [html, setHtml] = createSignal('<p>Hello <strong>world</strong></p>');
  return <TipTap html={html()} onHtmlChange={setHtml} placeholder="Start writing…" />;
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/tiptap-lit';

// <rozie-tip-tap> is a custom element. Bind \`html\` as a property and listen
// for the two-way \`html-change\` event.
const el = document.querySelector('rozie-tip-tap');
el.html = '<p>Hello <strong>world</strong></p>';
el.addEventListener('html-change', (e) => console.log(e.detail));`,
  },
};

// Angular reactive-forms snippet — emitted only on the Angular target, which
// auto-implements ControlValueAccessor for the single `model: true` prop (Phase 23).
const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TipTap } from '@rozie-ui/tiptap-angular';

@Component({
  selector: 'app-editor-form',
  standalone: true,
  imports: [TipTap, ReactiveFormsModule],
  template: \`
    <!-- Reactive forms — [formControl] / formControlName bind directly -->
    <TipTap [formControl]="body" />
  \`,
})
export class EditorFormComponent {
  body = new FormControl('<p>Start writing…</p>');
}

// Template-driven forms work the same way:
//   <TipTap [(ngModel)]="body" name="body" />`,
};

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom',
  vue: 'vue',
  svelte: 'svelte',
  angular: '@angular/core + @angular/common + @angular/forms',
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
import { TipTap, type TipTapHandle } from '@rozie-ui/tiptap-react';

const editor = useRef<TipTapHandle>(null);
// <TipTap ref={editor} ... />
editor.current?.toggleBold();
const html = editor.current?.getHTML();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const editor = ref();        // template ref
</script>

<template>
  <TipTap ref="editor" />
  <button @click="editor.toggleBold()">Bold</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let editor;                 // component instance via bind:this
</script>

<TipTap bind:this={editor} />
<button onclick={() => editor.toggleBold()}>Bold</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(TipTap) editor!: TipTap;  // or the viewChild() signal
  bold() { this.editor.toggleBold(); }
  html() { return this.editor.getHTML(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { TipTap, type TipTapHandle } from '@rozie-ui/tiptap-solid';

let handle: TipTapHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<TipTap ref={(h) => (handle = h)} />;
handle?.toggleBold();
const html = handle?.getHTML();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public element
// methods.
const el = document.querySelector('rozie-tip-tap');
el.toggleBold();
const html = el.getHTML();`,
  },
};

// Per-framework consumer shape for the `toolbar` portal slot (declared in the
// source as <slot name="toolbar" portal :params="['editor']" />).
const TOOLBAR_SLOT_USAGE = {
  react: 'renderToolbar={({ editor }) => <MyToolbar editor={editor} />}',
  vue: '<template #toolbar="{ editor }"> … </template>',
  svelte: "{#snippet toolbar({ editor })} … {/snippet}",
  angular: '<ng-template #toolbar let-editor="editor"> … </ng-template>',
  solid: 'renderToolbar={({ editor }) => <MyToolbar editor={editor} />}',
  lit: '.toolbar=${({ editor }) => html`…`}',
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
    `Idiomatic **${target}** \`TipTap\` — a cross-framework rich-text editor ` +
      `component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) ` +
      `source wrapping [TipTap](https://tiptap.dev/) (the ProseMirror-based headless ` +
      `editor). Two-way \`html\` content binding, a batteries-included toolbar (or bring ` +
      `your own via the \`toolbar\` slot), a 14-verb imperative command handle, and ` +
      `\`editorProps\`/\`extensions\` passthroughs. This package is generated; do not edit ` +
      `\`src/\` by hand.`,
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
    `Peer dependencies: the \`@tiptap/core\` + \`@tiptap/starter-kit\` engine (\`^3\`) + ` +
      `\`${FRAMEWORK_PEER_LABEL[target]}\`. Install them alongside this package.`,
  );
  lines.push('');

  // Usage
  lines.push('## Usage');
  lines.push('');
  lines.push('```' + usage.lang);
  lines.push(usage.code);
  lines.push('```');
  lines.push('');

  // Angular forms integration — the generated class implements
  // ControlValueAccessor when the source has exactly one `model: true` prop
  // (Phase 23; mirrors the emitter's CVA gate). Angular-only section.
  const modelProps = ir.props.filter((p) => p.isModel);
  if (target === 'angular' && modelProps.length === 1) {
    const modelProp = modelProps[0];
    const hasBooleanDisabled = ir.props.some((p) => p.name === 'disabled');
    lines.push('## Angular forms');
    lines.push('');
    lines.push(
      `The generated class implements \`ControlValueAccessor\` — the \`${modelProp.name}\` ` +
        'model prop is the control value — so it binds to template-driven and reactive ' +
        'forms directives directly, with no wrapper directive:',
    );
    lines.push('');
    lines.push('```' + ANGULAR_FORMS_USAGE.lang);
    lines.push(ANGULAR_FORMS_USAGE.code);
    lines.push('```');
    lines.push('');
    lines.push(
      'The accessor contract: only real user interaction dirties the control — programmatic ' +
        `writes (form \`setValue\` / \`reset\`, or the \`[(${modelProp.name})]\` two-way binding) ` +
        'update the view without echoing back into the form; `writeValue(null)` resets to the ' +
        `prop default (\`${renderPropDefault(modelProp.defaultValue)}\`); the control is marked ` +
        'touched on focusout' +
        (hasBooleanDisabled
          ? '; and `setDisabledState` OR-merges with the `disabled` prop, so either source disables the component.'
          : '.'),
    );
    lines.push('');
  }

  // Props
  lines.push('## Props');
  lines.push('');
  lines.push('| Name | Type | Default | Two-way (model) |');
  lines.push('| --- | --- | --- | :---: |');
  for (const p of ir.props) {
    const type = renderPropType(p.typeAnnotation);
    const def = renderPropDefault(p.defaultValue);
    const model = p.isModel ? '✓' : '';
    lines.push(`| \`${p.name}\` | \`${type}\` | \`${def}\` | ${model} |`);
  }
  lines.push('');

  // Events — gated on ir.emits.length > 0 (TipTap IS event-ful, so this section
  // SHIPS — unlike the CodeMirror analog).
  if (ir.emits && ir.emits.length > 0) {
    lines.push('## Events');
    lines.push('');
    lines.push('| Event | Description |');
    lines.push('| --- | --- |');
    const EVENT_DESC = {
      update: 'The document changed — payload is the new HTML string.',
      selectionUpdate: 'The selection (caret/range) moved.',
      focus: 'The editor gained focus.',
      blur: 'The editor lost focus.',
    };
    for (const ev of ir.emits) {
      lines.push(`| \`${ev}\` | ${EVENT_DESC[ev] || ''} |`);
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

  // Slots — the `toolbar` portal slot. Emit the section only if the source
  // declares any slots.
  if (ir.slots && ir.slots.length > 0) {
    lines.push('## Slots');
    lines.push('');
    lines.push(
      'When you fill the `toolbar` slot the internal toolbar is replaced by your own ' +
        'UI, which receives the live `editor` so its buttons can drive ' +
        '`editor.chain().focus()…run()`:',
    );
    lines.push('');
    lines.push('```' + (target === 'lit' ? 'ts' : usage.lang));
    lines.push(TOOLBAR_SLOT_USAGE[target]);
    lines.push('```');
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
// Docs props-table validator (VALIDATE-NOT-OVERWRITE). Identical contract to the
// codemirror/chartjs validators. codegen.mjs invokes this against
// docs/guide/tiptap.md (which ships a real "### Props" table) — ENFORCING: it
// throws on drift of the IR-derivable structural columns (name/type/default).
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
