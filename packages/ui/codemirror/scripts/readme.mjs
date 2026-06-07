/**
 * README rendering + docs-table validation for @rozie-ui/codemirror.
 *
 * Everything structural is derived from a SINGLE parse of CodeMirror.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/fullcalendar/scripts/readme.mjs, retargeted to the
 * code-editor surface: a two-way `value` (String) model prop, an `:extensions`
 * passthrough, the live `panel` portal-slot, NO events (D-08 — the
 * `updateListener` → `value` model path IS the change channel; the Events
 * heading is gated OUT), and no auto-inject-CSS prose — CodeMirror has none.)
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
// The two-way model prop is `value` (the document text STRING). Editor behaviour
// beyond the curated props comes through the `:extensions` passthrough (CM6 has
// no large "options bag" — everything is an Extension). There are NO events
// (D-08): the two-way `value` binding IS the change channel.
// ---------------------------------------------------------------------------

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { CodeMirror } from '@rozie-ui/codemirror-react';

export function Demo() {
  const [value, setValue] = useState('const greeting = "hello";\\n');
  return (
    <CodeMirror
      value={value}
      onValueChange={setValue}
      language="javascript"
      theme="dark"
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import CodeMirror from '@rozie-ui/codemirror-vue';

const value = ref('const greeting = "hello";\\n');
</script>

<template>
  <CodeMirror v-model:value="value" language="javascript" theme="dark" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import CodeMirror from '@rozie-ui/codemirror-svelte';

  let value = $state('const greeting = "hello";\\n');
</script>

<CodeMirror bind:value language="javascript" theme="dark" />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { CodeMirror } from '@rozie-ui/codemirror-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [CodeMirror],
  template: \`
    <CodeMirror [(value)]="value" language="javascript" theme="dark" />
  \`,
})
export class DemoComponent {
  value = 'const greeting = "hello";\\n';
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { CodeMirror } from '@rozie-ui/codemirror-solid';

export function Demo() {
  const [value, setValue] = createSignal('const greeting = "hello";\\n');
  return (
    <CodeMirror
      value={value()}
      onValueChange={setValue}
      language="javascript"
      theme="dark"
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/codemirror-lit';

// <rozie-code-mirror> is a custom element. Bind \`value\` as a property and
// listen for the \`value-change\` event (the two-way change channel).
const el = document.querySelector('rozie-code-mirror');
el.value = 'const greeting = "hello";\\n';
el.language = 'javascript';
el.theme = 'dark';
el.addEventListener('value-change', (e) => {
  el.value = e.detail;
});`,
  },
};

// Angular reactive-forms snippet — emitted only on the Angular target, which
// auto-implements ControlValueAccessor for the single `model: true` prop (Phase 23).
const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { CodeMirror } from '@rozie-ui/codemirror-angular';

@Component({
  selector: 'app-code-form',
  standalone: true,
  imports: [CodeMirror, ReactiveFormsModule],
  template: \`
    <!-- Reactive forms — [formControl] / formControlName bind directly -->
    <CodeMirror [formControl]="source" />
  \`,
})
export class CodeFormComponent {
  source = new FormControl('');
}

// Template-driven forms work the same way:
//   <CodeMirror [(ngModel)]="source" name="source" />`,
};

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom',
  vue: 'vue',
  svelte: 'svelte',
  angular: '@angular/core + @angular/common',
  solid: 'solid-js',
  lit: 'lit',
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
import { CodeMirror, type CodeMirrorHandle } from '@rozie-ui/codemirror-react';

const cm = useRef<CodeMirrorHandle>(null);
// <CodeMirror ref={cm} ... />
cm.current?.focus();
const text = cm.current?.getValue();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const cm = ref();          // template ref
</script>

<template>
  <CodeMirror ref="cm" />
  <button @click="cm.focus()">Focus</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let cm;                  // component instance via bind:this
</script>

<CodeMirror bind:this={cm} />
<button onclick={() => cm.focus()}>Focus</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(CodeMirror) cm!: CodeMirror;  // or the viewChild() signal
  focusEditor() { this.cm.focus(); }
  read() { return this.cm.getValue(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { CodeMirror, type CodeMirrorHandle } from '@rozie-ui/codemirror-solid';

let handle: CodeMirrorHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<CodeMirror ref={(h) => (handle = h)} />;
handle?.focus();
const text = handle?.getValue();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-code-mirror');
el.focus();
const text = el.getValue();`,
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
    `Idiomatic **${target}** \`CodeMirror\` — a cross-framework code editor ` +
      `compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping ` +
      `[CodeMirror 6](https://codemirror.net/). This package is generated; do ` +
      `not edit \`src/\` by hand.`,
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
    `Peer dependencies: the five \`@codemirror/*\` engine packages ` +
      '(`@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, ' +
      '`@codemirror/lang-javascript`, `@codemirror/theme-one-dark`) plus the ' +
      '`codemirror` meta-package (for the `basicSetup` bundle), all `^6`, + ' +
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

  // Events — gated on ir.emits.length > 0 (D-08: CodeMirror emits no events, so
  // no empty "## Events" heading ships; mirrors the Slots-section gate).
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

  // Slots — CodeMirror exposes the `panel` portal-slot (a CM6 `showPanel`-mounted
  // status bar). Emit the section only if the source declares any slots.
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
// Identical contract to the fullcalendar validator. codegen.mjs invokes this
// against docs/guide/codemirror.md (which ships a real "### Props" table) —
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
