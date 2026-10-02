/**
 * README rendering + docs-table validation for @rozie-ui/popover.
 *
 * Everything structural is derived from a SINGLE parse of Popover.rozie
 * (`ir.props` / `ir.slots` / `ir.emitDecls` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. The events table (name, payload type,
 * prose) comes from the `<emits>` block (`ir.emitDecls`); the handle prose from
 * the hand-kept handle manifest; the PER-PROP prose comes from each prop's `<props>`
 * `docs.description` (Phase 59 single-source-of-truth), rendered through the
 * shared `renderPropDescription` helper from `@rozie/core` so the README + the
 * docs-site `rozie-props` table cannot diverge.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 */

import { printTSType, renderPropDescription } from '@rozie/core';
import { litEventName, litEventNamesDiverge, LIT_EVENT_NOTE } from '../../lit-event-name.mjs';
import { typeCodeCell } from '../../readme-type-cell.mjs';
import { runtimeDepNote } from '../../runtime-dep-note.mjs';
import { requiredPeerNote } from '../../required-peer-note.mjs';

// ---------------------------------------------------------------------------
// IR-derivation helpers (shared by README rendering AND the docs validator).
// ---------------------------------------------------------------------------

export function renderPropType(typeAnnotation) {
  if (!typeAnnotation) return 'any';
  if (typeAnnotation.kind === 'identifier') return typeAnnotation.name;
  // A `type: [Element, Object]` array decl lowers to a union — render each member
  // and join with ` | ` (e.g. `Element | Object`, matching the docs table's
  // `Element \| Object` union cell). Ported from sortable-list (260929-lyc).
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
      renderAnchor={({ open, toggle, panelId }) => (
        <button onClick={toggle} aria-expanded={open} aria-controls={panelId}>Menu</button>
      )}
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
  <Popover v-model:open="open" trigger="click" placement="bottom" :offset="8" arrow>
    <template #anchor="{ open, toggle, panelId }">
      <button @click="toggle" :aria-expanded="open" :aria-controls="panelId">Menu</button>
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

<Popover bind:open trigger="click" placement="bottom" offset={8} arrow>
  {#snippet anchor({ open, toggle, panelId })}
    <button onclick={toggle} aria-expanded={open} aria-controls={panelId}>Menu</button>
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
    <rozie-popover [(open)]="open" trigger="click" placement="bottom" [offset]="8" [arrow]="true">
      <ng-template #anchor let-open="open" let-toggle="toggle" let-panelId="panelId">
        <button (click)="toggle()" [attr.aria-expanded]="open" [attr.aria-controls]="panelId">Menu</button>
      </ng-template>
      <ng-template #defaultSlot>
        <div>Floating content</div>
      </ng-template>
    </rozie-popover>
  \`,
})
export class DemoComponent {
  open = false;
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
      anchorSlot={({ open, toggle, panelId }) => (
        <button onClick={toggle} aria-expanded={open} aria-controls={panelId}>Menu</button>
      )}
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
// \`arrow\` as properties; \`open-change\` carries the new open boolean (in
// \`event.detail\`) and drives the two-way model. Project the anchor into the
// \`anchor\` slot and the content into the default slot.
const el = document.querySelector('rozie-popover');
el.trigger = 'click';
el.placement = 'bottom';
el.offset = 8;
el.arrow = true;
el.addEventListener('open-change', (e) => {
  el.open = e.detail;
  console.log('open:', e.detail);
});`,
  },
};

// Per-framework `reference` usage (release-0.8.0 audit B8): position the panel
// against an element the consumer owns, with the consumer's own trigger ARIA.
const REFERENCE_USAGE = {
  react: {
    lang: 'tsx',
    code: `const [open, setOpen] = useState(false);
const [target, setTarget] = useState<HTMLElement | null>(null);

const onClick = (e: React.MouseEvent<HTMLButtonElement>) => { setTarget(e.currentTarget); setOpen(!open); };

<button aria-expanded={open} aria-controls="details-popover-panel" onClick={onClick}>Details</button>
<Popover open={open} onOpenChange={setOpen} trigger="manual" reference={target} idBase="details-popover">
  <div>About this item</div>
</Popover>`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import Popover from '@rozie-ui/popover-vue';

const open = ref(false);
const target = ref<HTMLElement | null>(null);
const onClick = (e: MouseEvent) => {
  target.value = e.currentTarget as HTMLElement;
  open.value = !open.value;
};
</script>

<template>
  <button :aria-expanded="open" aria-controls="details-popover-panel" @click="onClick">Details</button>
  <Popover v-model:open="open" trigger="manual" :reference="target" id-base="details-popover">
    <div>About this item</div>
  </Popover>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import Popover from '@rozie-ui/popover-svelte';

  let open = $state(false);
  let target: HTMLElement | null = $state(null);
</script>

<button aria-expanded={open} aria-controls="details-popover-panel" onclick={(e) => { target = e.currentTarget; open = !open; }}>Details</button>
<Popover bind:open trigger="manual" reference={target} idBase="details-popover">
  <div>About this item</div>
</Popover>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({
  selector: 'app-details',
  standalone: true,
  imports: [Popover],
  template: \`
    <button #btn [attr.aria-expanded]="open" aria-controls="details-popover-panel" (click)="target = btn; open = !open">Details</button>
    <rozie-popover [(open)]="open" trigger="manual" [reference]="target" idBase="details-popover">
      <ng-template #defaultSlot><div>About this item</div></ng-template>
    </rozie-popover>
  \`,
})
export class DetailsComponent {
  open = false;
  target: HTMLElement | null = null;
}`,
  },
  solid: {
    lang: 'tsx',
    code: `const [open, setOpen] = createSignal(false);
const [target, setTarget] = createSignal<HTMLElement | null>(null);

const onClick = (e: MouseEvent & { currentTarget: HTMLButtonElement }) => { setTarget(e.currentTarget); setOpen(!open()); };

<button aria-expanded={open()} aria-controls="details-popover-panel" onClick={onClick}>Details</button>
<Popover open={open()} onOpenChange={setOpen} trigger="manual" reference={target()} idBase="details-popover">
  <div>About this item</div>
</Popover>`,
  },
  lit: {
    lang: 'ts',
    code: `// The panel lives in the element's shadow root, so an \`aria-controls\` id
// reference from light DOM cannot resolve to it; set \`aria-expanded\` only.
const el = document.querySelector('rozie-popover');
const btn = document.querySelector('#details');
el.trigger = 'manual';
btn.addEventListener('click', () => {
  el.reference = btn;
  el.open = !el.open;
  btn.setAttribute('aria-expanded', String(el.open));
});
el.addEventListener('open-change', (e) => {
  el.open = e.detail;
  btn.setAttribute('aria-expanded', String(e.detail));
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

// The `open` model's change event per target — Popover's only change signal
// since the separate `change` emit was removed in 0.3.0 (release-0.8.0 audit
// B6: it collided with the native `change` bubbling out of inputs in the panel
// on Angular and Lit).
const OPEN_CHANGE = {
  react: { event: '`onOpenChange`', how: 'Pass `open` + `onOpenChange` for a controlled popover (or `defaultOpen` for an uncontrolled one).' },
  vue: { event: '`update:open`', how: 'Bind it with `v-model:open`.' },
  svelte: { event: '`bind:open`', how: 'Svelte 5 two-way binding; there is no separate event.' },
  angular: { event: '`openChange`', how: 'Bind it with `[(open)]`, or listen with `(openChange)`.' },
  solid: { event: '`onOpenChange`', how: 'Pass `open` + `onOpenChange` for a controlled popover (or `defaultOpen` for an uncontrolled one).' },
  lit: { event: '`open-change`', how: 'A `CustomEvent<boolean>` (the state is in `event.detail`); the `open` property reflects it.' },
};

// How a consumer binds a slot on each target (the bare slot name is NOT the
// binding on React/Solid, and a wrong name is silently ignored).
const SLOT_BINDING = {
  react: (n) => (n === '' ? '`children`' : `\`render${n[0].toUpperCase()}${n.slice(1)}={(params) => …}\``),
  vue: (n) => (n === '' ? 'default slot' : `\`<template #${n}="params">\``),
  svelte: (n) => (n === '' ? '`children`' : `\`{#snippet ${n}(params)}\``),
  angular: (n) => (n === '' ? 'projected content' : `\`<ng-template #${n} let-open="open">\``),
  solid: (n) => (n === '' ? '`children`' : `\`${n}Slot={(params) => …}\``),
  lit: (n) => (n === '' ? 'default `<slot>`' : '`` el.' + n + ' = (params) => html`…` ``'),
};

export function renderReadme(target, ir, pkgName, handleManifest = {}) {
  if (ir.emitDecls === null) {
    throw new Error('renderReadme: Popover.rozie has no <emits> block — the events table is generated from it');
  }
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

  // Disclose non-optional peers beyond the framework — derived from this
  // leaf's own package.json, walking any @rozie-ui/* peer's own required
  // peers transitively. Null for the (most common) leaf that requires
  // nothing beyond its framework.
  const peerNote = requiredPeerNote(pkgName);
  if (peerNote) {
    lines.push(peerNote);
    lines.push('');
  }

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

  // Positioning against an external element (`reference`).
  const refUsage = REFERENCE_USAGE[target];
  if (!refUsage) throw new Error(`renderReadme: no reference snippet for target "${target}"`);
  lines.push('## Positioning against an external element');
  lines.push('');
  lines.push(
    'Pass `reference` to position the panel against an element you own (or a Floating UI ' +
      'virtual element, e.g. a pointer position) instead of the built-in anchor. Use ' +
      "`trigger=\"manual\"`, drive `open` yourself, and put the trigger ARIA on your own " +
      "element. `aria-controls` points at `idBase + '-panel'`. A click on the referenced " +
      'element is not an outside click, so your toggle closes the panel. The outside-click ' +
      'dismissal is decided after your own handlers run, so a handler that repoints ' +
      '`reference` at another element it was clicked on (keeping `open` true) moves the ' +
      'panel there. If the referenced element leaves the document while open, the panel closes.',
  );
  lines.push('');
  lines.push('```' + refUsage.lang);
  lines.push(refUsage.code);
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
    // Escape pipes for the GFM table cell — a union type (`Element | Object`)
    // carries literal `|` that must be `\|` so it is not parsed as a column
    // delimiter (matches the docs/components/popover.md convention).
    const type = renderPropType(p.typeAnnotation).replace(/\|/g, '\\|');
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
  if (target === 'lit' && litEventNamesDiverge(ir.emitDecls.map((d) => d.name))) {
    lines.push(LIT_EVENT_NOTE);
    lines.push('');
  }
  lines.push('| Event | Payload | Description |');
  lines.push('| --- | --- | --- |');
  const openChange = OPEN_CHANGE[target];
  if (!openChange) throw new Error(`renderReadme: no open-change binding for target "${target}"`);
  lines.push(
    `| ${openChange.event} | \`boolean\` | The \`open\` model's change event, and the only change signal: fired whenever the open state changes — a click/hover/focus trigger gesture, an Escape or click-outside dismissal, or a programmatic \`show\`/\`hide\`/\`toggle\`. ${openChange.how} |`,
  );
  for (const d of ir.emitDecls) {
    const eventCol = target === 'lit' ? litEventName(d.name) : d.name;
    const payload = d.payload ? typeCodeCell(printTSType(d.payload)) : '—';
    lines.push(`| \`${eventCol}\` | ${payload} | ${d.docs?.description ?? ''} |`);
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
  const bindSlot = SLOT_BINDING[target];
  if (!bindSlot) throw new Error(`renderReadme: no slot binding for target "${target}"`);
  lines.push('| Slot | Params | Bind as |');
  lines.push('| --- | --- | --- |');
  const seenSlotNames = new Set();
  for (const s of ir.slots) {
    if (seenSlotNames.has(s.name)) continue;
    seenSlotNames.add(s.name);
    lines.push(`| ${renderSlotName(s.name)} | ${slotParams(s)} | ${bindSlot(s.name)} |`);
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
    // The IR type may itself be a union (`Element | Object`) — every source
    // member must be present in the docs cell (subset check). The docs may also
    // WIDEN a single-token IR type; a single irType is accepted when it appears as
    // one of the docs union members.
    const irTypeTokens = irType.split('|').map((t) => t.trim());
    const everyMemberDocumented = irTypeTokens.every((t) => docTypeTokens.includes(t));
    if (!everyMemberDocumented) {
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
