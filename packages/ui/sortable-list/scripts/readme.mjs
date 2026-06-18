/**
 * README rendering + docs-table validation for @rozie-ui/sortable-list.
 *
 * Everything structural is derived from a SINGLE parse of SortableList.rozie
 * (`ir.props` / `ir.slots` / `ir.emits`) so the per-leaf READMEs cannot drift
 * from the compiled output. Only event prose comes from the hand-kept
 * event-manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 */

// ---------------------------------------------------------------------------
// IR-derivation helpers (shared by README rendering AND the docs validator).
// ---------------------------------------------------------------------------

/**
 * Render a prop's declared type from its `typeAnnotation`.
 * For SortableList every prop is a constructor identifier
 * (`Array`/`String`/`Number`/`Boolean`/`Object`/`Function`), matching the
 * Type column in docs/components/sortable-list.md.
 */
export function renderPropType(typeAnnotation) {
  if (!typeAnnotation) return 'unknown';
  if (typeAnnotation.kind === 'identifier') return typeAnnotation.name;
  // Defensive: support a 'literal' kind too (other components may use it).
  if (typeAnnotation.kind === 'literal') return String(typeAnnotation.value);
  if (typeAnnotation.name) return typeAnnotation.name;
  if (typeAnnotation.value !== undefined) return String(typeAnnotation.value);
  return 'unknown';
}

/**
 * Render a prop's default value from its Babel `defaultValue` AST node into
 * the canonical surface form the docs table uses (`[]`, `{}`, `null`, `150`,
 * `false`, `1`, ...). Factory arrows (`() => []`, `() => ({})`) collapse to
 * their produced value.
 */
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
      // Factory default: collapse to the produced value (() => [] → []).
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

/** Default-slot name '' renders as `(default)`. */
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
import { SortableList } from '@rozie-ui/sortable-list-react';

export function Demo() {
  const [items, setItems] = useState([
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ]);
  return (
    <SortableList items={items} onItemsChange={setItems} itemKey="id">
      {({ item }) => <span>{item.label}</span>}
    </SortableList>
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import SortableList from '@rozie-ui/sortable-list-vue';

const items = ref([
  { id: '1', label: 'Apple' },
  { id: '2', label: 'Banana' },
]);
</script>

<template>
  <SortableList v-model:items="items" item-key="id">
    <template #default="{ item }">
      <span>{{ item.label }}</span>
    </template>
  </SortableList>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import SortableList from '@rozie-ui/sortable-list-svelte';

  let items = $state([
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ]);
</script>

<SortableList bind:items itemKey="id">
  {#snippet default({ item })}
    <span>{item.label}</span>
  {/snippet}
</SortableList>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { SortableList } from '@rozie-ui/sortable-list-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [SortableList],
  template: \`
    <SortableList [items]="items" (itemsChange)="items = $event" itemKey="id">
      <ng-template #default let-item="item">
        <span>{{ item.label }}</span>
      </ng-template>
    </SortableList>
  \`,
})
export class DemoComponent {
  items = [
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ];
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { SortableList } from '@rozie-ui/sortable-list-solid';

export function Demo() {
  const [items, setItems] = createSignal([
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ]);
  return (
    <SortableList items={items()} onItemsChange={setItems} itemKey="id">
      {({ item }) => <span>{item().label}</span>}
    </SortableList>
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/sortable-list-lit';

// <sortable-list> is a custom element. Bind \`items\` as a property and
// listen for the \`items-change\` event to receive the reordered array.
const el = document.querySelector('sortable-list');
el.items = [
  { id: '1', label: 'Apple' },
  { id: '2', label: 'Banana' },
];
el.itemKey = 'id';
el.addEventListener('items-change', (e) => {
  el.items = e.detail;
});`,
  },
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
// Angular forms-integration snippet (Phase 23 CVA). Rendered ONLY for the
// angular target when the source has exactly one `model: true` prop — the
// same condition the emitter's CVA gate uses. The generated class implements
// ControlValueAccessor, so forms directives bind to it directly.
// ---------------------------------------------------------------------------

const ANGULAR_FORMS_USAGE = {
  lang: 'ts',
  code: `import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { SortableList } from '@rozie-ui/sortable-list-angular';

@Component({
  selector: 'app-ranking-form',
  standalone: true,
  imports: [SortableList, ReactiveFormsModule],
  template: \`
    <!-- The user's drag-ordering IS the form value -->
    <SortableList [formControl]="ranking" itemKey="id">
      <ng-template #default let-item="item">
        <span>{{ item.label }}</span>
      </ng-template>
    </SortableList>
  \`,
})
export class RankingFormComponent {
  ranking = new FormControl([
    { id: '1', label: 'Apple' },
    { id: '2', label: 'Banana' },
  ]);
}

// Template-driven forms work the same way:
//   <SortableList [(ngModel)]="ranking" name="ranking" itemKey="id">...</SortableList>`,
};

// ---------------------------------------------------------------------------
// Per-framework "how to obtain the imperative handle" snippets (Phase 21
// `$expose`). Each shows the framework's NATIVE ref mechanism — there is no
// Rozie-level consumer directive for calling a child's method.
// ---------------------------------------------------------------------------

export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { SortableList, type SortableListHandle } from '@rozie-ui/sortable-list-react';

const sl = useRef<SortableListHandle>(null);
// <SortableList ref={sl} ... />
const order = sl.current?.toArray();
sl.current?.option('disabled', true);`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const sl = ref();          // template ref
</script>

<template>
  <SortableList ref="sl" />
  <button @click="console.log(sl.toArray())">Log order</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let sl;                  // component instance via bind:this
</script>

<SortableList bind:this={sl} />
<button onclick={() => console.log(sl.toArray())}>Log order</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(SortableList) sl!: SortableList;  // or the viewChild() signal
  logOrder() { console.log(this.sl.toArray()); }
  disable() { this.sl.option('disabled', true); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { SortableList, type SortableListHandle } from '@rozie-ui/sortable-list-solid';

let handle: SortableListHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<SortableList ref={(h) => (handle = h)} />;
const order = handle?.toArray();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-sortable-list');
const order = el.toArray();
el.option('disabled', true);`,
  },
};

// ---------------------------------------------------------------------------
// README rendering.
// ---------------------------------------------------------------------------

/**
 * Render a leaf package's README from the shared IR + the manifests.
 *
 * @param {string} target  one of react|vue|svelte|angular|solid|lit
 * @param {object} ir      the once-parsed IR (props/slots/emits/expose)
 * @param {object} eventManifest  { [eventName]: description }
 * @param {string} pkgName the leaf's own package name (from its package.json)
 * @param {object} handleManifest  { [methodName]: description } for `$expose`
 * @returns {string} markdown
 */
export function renderReadme(target, ir, eventManifest, pkgName, handleManifest = {}) {
  const usage = USAGE[target];
  if (!usage) throw new Error(`renderReadme: no usage snippet for target "${target}"`);

  const lines = [];
  lines.push(`# ${pkgName}`);
  lines.push('');
  lines.push(
    `Idiomatic **${target}** \`SortableList\` — a cross-framework drag-and-drop list ` +
      `compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source via SortableJS. ` +
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
  lines.push(
    `Peer dependencies: \`sortablejs ^1.15\` + \`${FRAMEWORK_PEER_LABEL[target]}\`. ` +
      'Install them alongside this package.',
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
// Docs props-table validator (OQ2 VALIDATE-NOT-OVERWRITE).
//
// Parses the IR-derivable structural columns (prop name + type + default) out
// of the hand-authored props table in docs/components/sortable-list.md and ASSERTS
// they match `ir.props`. It NEVER rewrites the docs prose. Returns a result
// object describing any drift; the caller decides whether to throw.
// ---------------------------------------------------------------------------

/**
 * @param {object} ir            once-parsed IR
 * @param {string} docsMarkdown  raw contents of docs/components/sortable-list.md
 * @returns {{ ok: boolean, errors: string[], checkedRows: number }}
 */
export function validateDocsPropsTable(ir, docsMarkdown) {
  const errors = [];

  // Locate the "### Props" section and read its markdown table rows.
  const propsHeadingIdx = docsMarkdown.indexOf('### Props');
  if (propsHeadingIdx === -1) {
    return { ok: false, errors: ['docs: "### Props" heading not found'], checkedRows: 0 };
  }
  // Slice to the next heading after the Props section.
  const afterHeading = docsMarkdown.slice(propsHeadingIdx + '### Props'.length);
  const nextHeadingIdx = afterHeading.search(/\n#{1,3}\s/);
  const section = nextHeadingIdx === -1 ? afterHeading : afterHeading.slice(0, nextHeadingIdx);

  // Parse pipe-table rows whose first cell is a `code`-wrapped prop name.
  // Row shape: | `name` | `Type` | `default` | ... | ... |
  const docRows = new Map(); // name -> { type, def }
  for (const rawLine of section.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('|')) continue;
    // Split on unescaped pipes only: a markdown `\|` is a literal pipe inside a
    // cell (e.g. the `String \| Object` union type), not a column delimiter.
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((c) => c.replace(/\\\|/g, '|').trim());
    if (cells.length < 3) continue;
    const nameMatch = cells[0].match(/^`([^`]+)`$/);
    if (!nameMatch) continue; // header / separator / non-prop row
    const name = nameMatch[1];
    docRows.set(name, { type: cells[1], def: cells[2] });
  }

  // 1. Set equality: every IR prop appears in docs and vice-versa.
  const irNames = new Set(ir.props.map((p) => p.name));
  const docNames = new Set(docRows.keys());
  for (const n of irNames) {
    if (!docNames.has(n)) errors.push(`docs missing prop row: "${n}" (present in source)`);
  }
  for (const n of docNames) {
    if (!irNames.has(n)) errors.push(`docs has stale prop row: "${n}" (absent from source)`);
  }

  // 2. Per-prop derivable-column comparison (type + default), tolerant of the
  //    docs' code-fence wrapping and richer union types.
  const stripCode = (s) => s.replace(/`/g, '').trim();
  for (const p of ir.props) {
    const doc = docRows.get(p.name);
    if (!doc) continue;
    const irType = renderPropType(p.typeAnnotation);
    const docType = stripCode(doc.type);
    // Docs may widen a type (e.g. `String | Object`); accept if the IR type
    // token appears as one of the union members.
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
