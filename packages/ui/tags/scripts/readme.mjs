/**
 * README rendering + docs-table validation for @rozie-ui/tags.
 *
 * Everything structural is derived from a SINGLE parse of Tags.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only the event + handle prose comes
 * from the hand-kept manifests; the per-prop prose comes from the `.rozie`
 * `<props>` `docs.description` via the shared `renderPropDescription` core helper
 * (Phase 59 single-source-of-truth — NO local renderer copy).
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
import { Tags } from '@rozie-ui/tags-react';

export function Demo() {
  const [skills, setSkills] = useState<string[]>(['rozie', 'react']);
  return (
    <Tags
      modelValue={skills}
      onValueChange={setSkills}
      placeholder="Add a skill…"
      ariaLabel="Skills"
      max={8}
      onAdd={(e) => console.log('added', e.value)}
    />
  );
}

// Custom chip rendering via the scoped #tag slot (React render-prop API).
export function PillsDemo() {
  const [tags, setTags] = useState<string[]>([]);
  return (
    <Tags value={tags} onValueChange={setTags} ariaLabel="Tags">
      {({ tag, remove }) => (
        <span className="pill">
          {tag}
          <button type="button" onClick={remove} aria-label={\`Remove \${tag}\`}>×</button>
        </span>
      )}
    </Tags>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Tags from '@rozie-ui/tags-vue';

const skills = ref<string[]>(['rozie', 'vue']);
function onAdd(e: { value: string; tokens: string[] }) {
  console.log('added', e.value);
}
</script>

<template>
  <Tags v-model:modelValue="skills" placeholder="Add a skill…" aria-label="Skills" :max="8" @add="onAdd" />

  <!-- Custom chip via the scoped #tag slot -->
  <Tags v-model:modelValue="skills" aria-label="Skills">
    <template #tag="{ tag, remove }">
      <span class="pill">{{ tag }} <button type="button" @click="remove">×</button></span>
    </template>
  </Tags>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Tags from '@rozie-ui/tags-svelte';

  let skills = $state<string[]>(['rozie', 'svelte']);
</script>

<Tags
  bind:modelValue={skills}
  placeholder="Add a skill…"
  ariaLabel="Skills"
  max={8}
  onadd={(e) => console.log('added', e.value)}
/>

<!-- Custom chip via the scoped #tag snippet -->
<Tags bind:modelValue={skills} ariaLabel="Skills">
  {#snippet tag({ tag, remove })}
    <span class="pill">{tag} <button type="button" onclick={remove}>×</button></span>
  {/snippet}
</Tags>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { Tags } from '@rozie-ui/tags-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Tags],
  template: \`
    <Tags
      [(modelValue)]="skills"
      placeholder="Add a skill…"
      ariaLabel="Skills"
      [max]="8"
      (add)="onAdd($event)"
    />
  \`,
})
export class DemoComponent {
  skills = ['rozie', 'angular'];
  onAdd(e: { value: string; tokens: string[] }) {
    console.log('added', e.value);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { Tags } from '@rozie-ui/tags-solid';

export function Demo() {
  const [skills, setSkills] = createSignal<string[]>(['rozie', 'solid']);
  return (
    <Tags
      modelValue={skills()}
      onValueChange={setSkills}
      placeholder="Add a skill…"
      ariaLabel="Skills"
      max={8}
      onAdd={(e) => console.log('added', e.value)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/tags-lit';

// <rozie-tags> is a custom element. Bind \`modelValue\` (the tokens array) and the
// config props as properties; listen for \`value-change\` to receive the new
// tokens array, and \`add\` / \`remove\` for individual mutations.
const el = document.querySelector('rozie-tags');
el.modelValue = ['rozie', 'lit'];
el.placeholder = 'Add a skill…';
el.max = 8;
el.addEventListener('value-change', (e) => {
  el.modelValue = e.detail;
});
el.addEventListener('add', (e) => {
  console.log('added', e.detail.value);
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
// `modelValue` model prop IS the control value — a tags input IS a form control.
const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Tags } from '@rozie-ui/tags-angular';

@Component({
  selector: 'app-tags-form',
  standalone: true,
  imports: [Tags, ReactiveFormsModule],
  template: \`
    <!-- The tokens array IS the form control value -->
    <Tags [formControl]="skills" ariaLabel="Skills" [max]="8" />
  \`,
})
export class TagsFormComponent {
  skills = new FormControl<string[]>(['rozie']);
}

// Template-driven forms work the same way:
//   <Tags [(ngModel)]="skills" name="skills" />`,
};

// Per-framework "obtain the imperative handle" snippets (`$expose`).
export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { Tags, type TagsHandle } from '@rozie-ui/tags-react';

const tags = useRef<TagsHandle>(null);
// <Tags ref={tags} ... />
tags.current?.focus();
tags.current?.clear();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const tags = ref();          // template ref
</script>

<template>
  <Tags ref="tags" v-model:modelValue="skills" />
  <button @click="tags.clear()">Clear</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let tags;                  // component instance via bind:this
</script>

<Tags bind:this={tags} bind:modelValue={skills} />
<button onclick={() => tags.clear()}>Clear</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Tags) tags!: Tags;   // or the viewChild() signal
  focusIt() { this.tags.focus(); }
  clearIt() { this.tags.clear(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { Tags, type TagsHandle } from '@rozie-ui/tags-solid';

let handle: TagsHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<Tags ref={(h) => (handle = h)} modelValue={skills()} />;
handle?.clear();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — exposed methods are public element
// methods. \`focus()\` here DELIBERATELY overrides the inherited HTMLElement.focus
// (it focuses the inline text input).
const el = document.querySelector('rozie-tags');
el.focus();
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
    `Idiomatic **${target}** \`Tags\` — a headless, fully-accessible (WAI-ARIA) ` +
      `tags / token input (removable chips, type-to-add with configurable delimiters, ` +
      `paste-to-bulk-add, dedup, per-token validation, a \`max\` cap, and a scoped ` +
      `\`#tag\` slot for custom chip rendering) compiled from one ` +
      `[Rozie](https://github.com/One-Learning-Community/rozie.js) source. ` +
      `The interaction engine IS the browser's native \`<input>\` plus the platform clipboard/keyboard; ` +
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
    'Every visual value is a `--rozie-tags-*` CSS custom property — override any of them at ' +
      'any ancestor scope. Ready-made design-system bridges ship in the package:',
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
        'prop is the control value, so a tags input **is** a form control. It binds to template-driven ' +
        'and reactive forms directives directly, with no wrapper directive:',
    );
    lines.push('');
    lines.push('```' + ANGULAR_FORMS_USAGE.lang);
    lines.push(ANGULAR_FORMS_USAGE.code);
    lines.push('```');
    lines.push('');
  }

  // Props
  lines.push('## Props');
  lines.push('');
  lines.push('| Name | Type | Default | Two-way (model) | Required | Description |');
  lines.push('| --- | --- | --- | :---: | :---: | --- |');
  for (const p of ir.props) {
    const type = renderPropType(p.typeAnnotation);
    const def = renderPropDefault(p.defaultValue);
    const model = p.isModel ? '✓' : '';
    const required = p.required ? '✓' : '';
    // Description is the LAST column on purpose: validateDocsPropsTable reads only
    // cells[0]/[1]/[2] (name/type/default). renderPropDescription (the shared core
    // helper) escapes pipes + collapses newlines so a `docs.description` cannot
    // break the table row. Phase 59 single source — no local renderer copy.
    lines.push(
      `| \`${p.name}\` | \`${type}\` | \`${def}\` | ${model} | ${required} | ${renderPropDescription(p)} |`,
    );
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
  lines.push(
    'The scoped `tag` slot lets you fully replace each chip; its params are ' +
      '`{ tag, index, remove }` (the token string, its index, and a zero-arg `remove()` for that token). ' +
      'On React the slot is a render-prop `children` callback (the documented cross-framework slot divergence).',
  );
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Docs props-table validator (VALIDATE-NOT-OVERWRITE).
// ---------------------------------------------------------------------------

export function validateDocsPropsTable(ir, docsMarkdown) {
  const errors = [];

  // Accept either a `## Props` (H2, API reference page) or `### Props` (H3) heading.
  const headingMatch = docsMarkdown.match(/(?:^|\n)#{2,3} Props(?=\s|$)/);
  if (!headingMatch) {
    return { ok: false, errors: ['docs: "## Props" heading not found'], checkedRows: 0 };
  }
  const afterHeading = docsMarkdown.slice(headingMatch.index + headingMatch[0].length);
  const nextHeadingIdx = afterHeading.search(/\n#{1,3}\s/);
  const section = nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  // Phase 59: when the `## Props` section is a build-time `rozie-props` fence, the
  // docs table IS regenerated from the SAME `ir` at the vitepress build, so the
  // IR-vs-docs structural drift check is moot — short-circuit to a pass. The
  // legacy hand-authored-row throw-on-drift path below is untouched.
  if (/\n```\s*rozie-props\b/.test(section)) {
    return { ok: true, errors: [], checkedRows: 0 };
  }

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
