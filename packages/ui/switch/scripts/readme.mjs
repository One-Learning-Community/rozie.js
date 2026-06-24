/**
 * README rendering + docs-table validation for @rozie-ui/switch.
 *
 * Everything structural is derived from a SINGLE parse of Switch.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Each prop's Description cell is sourced
 * from the SINGLE-SOURCE-OF-TRUTH `<props>` `docs.description` via the shared
 * `renderPropDescription` helper from `@rozie/core` — so the README + the
 * docs-site API table + the JSDoc hover all read the same prose, no re-authoring.
 * Only the event + handle prose comes from the hand-kept manifests.
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
// `modelValue` is the single model:true boolean; `change` fires the new state.
// ---------------------------------------------------------------------------

export const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { Switch } from '@rozie-ui/switch-react';

export function Demo() {
  const [on, setOn] = useState(false);
  return (
    <Switch
      modelValue={on}
      onModelValueChange={setOn}
      ariaLabel="Wi-Fi"
      onChange={(e) => console.log('switch:', e.checked)}
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Switch from '@rozie-ui/switch-vue';

const on = ref(false);
function onChange(e: { checked: boolean }) {
  console.log('switch:', e.checked);
}
</script>

<template>
  <Switch v-model:modelValue="on" aria-label="Wi-Fi" @change="onChange" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Switch from '@rozie-ui/switch-svelte';

  let on = $state(false);
</script>

<Switch
  bind:modelValue={on}
  ariaLabel="Wi-Fi"
  onchange={(e) => console.log('switch:', e.checked)}
/>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Switch } from '@rozie-ui/switch-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Switch],
  template: \`
    <Switch [(modelValue)]="on" ariaLabel="Wi-Fi" (change)="onChange($event)" />
  \`,
})
export class DemoComponent {
  on = false;
  onChange(e: { checked: boolean }) {
    console.log('switch:', e.checked);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Switch } from '@rozie-ui/switch-solid';

export function Demo() {
  const [on, setOn] = createSignal(false);
  return (
    <Switch
      modelValue={on()}
      onModelValueChange={setOn}
      ariaLabel="Wi-Fi"
      onChange={(e) => console.log('switch:', e.checked)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/switch-lit';

// <rozie-switch> is a custom element. Bind \`modelValue\` as a property, listen
// for \`model-value-change\` to receive the new boolean as the two-way value, and
// \`change\` for the committed state.
const el = document.querySelector('rozie-switch');
el.modelValue = false;
el.ariaLabel = 'Wi-Fi';
el.addEventListener('model-value-change', (e) => {
  el.modelValue = e.detail;
});
el.addEventListener('change', (e) => {
  console.log('switch:', e.detail.checked);
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

// Angular forms-integration snippet (CVA). Rendered ONLY for angular when the
// source has exactly one `model: true` prop (the emitter's CVA gate). The single
// `modelValue` model prop IS the control value — a switch is a form control.
const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Switch } from '@rozie-ui/switch-angular';

@Component({
  selector: 'app-switch-form',
  standalone: true,
  imports: [Switch, ReactiveFormsModule],
  template: \`
    <!-- The switch state IS the form control value -->
    <Switch [formControl]="enabled" ariaLabel="Notifications" />
  \`,
})
export class SwitchFormComponent {
  enabled = new FormControl<boolean>(false);
}

// Template-driven forms work the same way:
//   <Switch [(ngModel)]="enabled" name="enabled" />`,
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Switch, type SwitchHandle } from '@rozie-ui/switch-react';

const sw = useRef<SwitchHandle>(null);
// <Switch ref={sw} ... />
sw.current?.focus();
sw.current?.toggle();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const sw = ref();          // template ref
</script>

<template>
  <Switch ref="sw" v-model:modelValue="on" />
  <button @click="sw.toggle()">Toggle</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let sw;                  // component instance via bind:this
</script>

<Switch bind:this={sw} bind:modelValue={on} />
<button onclick={() => sw.toggle()}>Toggle</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Switch) sw!: Switch;   // or the viewChild() signal
  focusIt() { this.sw.focus(); }
  toggleIt() { this.sw.toggle(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Switch, type SwitchHandle } from '@rozie-ui/switch-solid';

let handle: SwitchHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Switch ref={(h) => (handle = h)} modelValue={on()} />;
handle?.toggle();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element
// methods. \`focus()\` here DELIBERATELY overrides the inherited
// HTMLElement.focus (it focuses the control).
const el = document.querySelector('rozie-switch');
el.focus();
el.toggle();`,
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
    `Idiomatic **${target}** \`Switch\` — a headless, fully-accessible (WAI-ARIA ` +
      `\`role="switch"\`) on/off toggle: a boolean two-way \`modelValue\`, toggle on click ` +
      `AND Space/Enter, \`aria-checked\`/\`aria-disabled\`/\`aria-readonly\` wiring, and an ` +
      `optional scoped slot for a fully custom thumb/track — compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `The interaction engine IS the browser's native focusable element; ` +
      `every visual value is a CSS custom property, so it re-skins to any design system. ` +
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
    'Every visual value is a `--rozie-switch-*` CSS custom property — override any of ' +
      'them at any ancestor scope. Ready-made design-system bridges ship in the package:',
  );
  lines.push('');
  lines.push('```' + (target === 'lit' ? 'ts' : usage.lang === 'vue' ? 'ts' : usage.lang));
  lines.push(`import '${pkgName}/themes/shadcn.css';    // or material.css, bootstrap.css, base.css`);
  lines.push('```');
  lines.push('');

  // Angular forms integration (CVA).
  const modelProps = ir.props.filter((p) => p.isModel);
  if (target === 'angular' && modelProps.length === 1) {
    const modelProp = modelProps[0];
    lines.push('## Angular forms');
    lines.push('');
    lines.push(
      `The generated class implements \`ControlValueAccessor\` — the \`${modelProp.name}\` model ` +
        'prop is the control value, so a switch **is** a form control. It binds to ' +
        'template-driven and reactive forms directives directly, with no wrapper directive:',
    );
    lines.push('');
    lines.push('```' + ANGULAR_FORMS_USAGE.lang);
    lines.push(ANGULAR_FORMS_USAGE.code);
    lines.push('```');
    lines.push('');
  }

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
        'via `$expose`). Grab a handle with the native ref mechanism and call them directly. ' +
        'Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the ' +
        'control) — on the Lit custom element this is an accepted ROZ137 warn-only override, the ' +
        'public `focus()` handle is intended:',
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
//
// Validates the hand-authored `### Props` table in docs/components/switch.md
// (the showcase page) against the IR's structural columns (name / type /
// default). The docs-site `switch-api.md` page uses the `rozie-props Switch`
// fence instead (generated), so it is NOT validated here.
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
