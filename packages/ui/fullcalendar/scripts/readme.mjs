/**
 * README rendering + docs-table validation for @rozie-ui/fullcalendar.
 *
 * Everything structural is derived from a SINGLE parse of FullCalendar.rozie
 * (`ir.props` / `ir.slots` / `ir.emitDecls` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. The events table (name, payload type,
 * prose) comes from the `<emits>` block (`ir.emitDecls`); only the handle prose
 * comes from the hand-kept handle manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/flatpickr/scripts/readme.mjs, retargeted to the
 * calendar/scheduler surface: events-bound usage snippets, a live `event`
 * portal-slot, no vendor-CSS import, and NO Angular forms-accessor (CVA)
 * section — a calendar `view` name is not a form value, see the gating note.)
 */

import { printTSType } from '@rozie/core';
import { litEventName, litEventNamesDiverge, LIT_EVENT_NOTE } from '../../lit-event-name.mjs';
import { typeCodeCell } from '../../readme-type-cell.mjs';
import { runtimeDepNote } from '../../runtime-dep-note.mjs';

// ---------------------------------------------------------------------------
// IR-derivation helpers (shared by README rendering AND the docs validator).
// ---------------------------------------------------------------------------

export function renderPropType(typeAnnotation) {
  if (!typeAnnotation) return 'unknown';
  if (typeAnnotation.kind === 'identifier') return typeAnnotation.name;
  // A `type: [String, Number]` array decl lowers to a union — render each member
  // and join with ` | ` (e.g. `String | Number` for `height`).
  if (typeAnnotation.kind === 'union' && Array.isArray(typeAnnotation.members)) {
    return typeAnnotation.members.map(renderPropType).join(' | ');
  }
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

// How a consumer binds a slot on each target (release-0.8.0 audit C2: the bare
// slot name is NOT the binding on React/Solid, and a wrong name is silently
// ignored, so the table spells out the real form per target).
const SLOT_BINDING = {
  react: (n) => `\`render${n[0].toUpperCase()}${n.slice(1)}={({ arg }) => …}\``,
  vue: (n) => `\`<template #${n}="{ arg }">\``,
  svelte: (n) => `\`{#snippet ${n}({ arg })}\``,
  angular: (n) => `\`<ng-template #${n} let-arg="arg">\``,
  solid: (n) => `\`${n}Slot={({ arg }) => …}\``,
  lit: (n) => '`` el.' + n + ' = ({ arg }) => html`…` ``',
};

// ---------------------------------------------------------------------------
// Per-framework consumer usage snippets (idiomatic; short + correct).
//
// The two-way model prop is `view` (the active view name STRING). Events are
// bound via `:events`; `@eventClick` surfaces the structured payload
// `{ event, jsEvent, el }` (there is NO `view` key — see `<emits>`). FullCalendar
// v6 AUTO-INJECTS its CSS — there is NO manual stylesheet import (the load-bearing
// divergence from flatpickr).
// ---------------------------------------------------------------------------

export const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { FullCalendar } from '@rozie-ui/fullcalendar-react';

export function Demo() {
  const [view, setView] = useState('dayGridMonth');
  const [events] = useState([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
  return (
    <FullCalendar
      view={view}
      onViewChange={setView}
      events={events}
      onEventClick={(e) => console.log(e.event, e.el)}
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import FullCalendar from '@rozie-ui/fullcalendar-vue';

const view = ref('dayGridMonth');
const events = ref([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
</script>

<template>
  <FullCalendar v-model:view="view" :events="events" @eventClick="(e) => console.log(e.event, e.el)" />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import FullCalendar from '@rozie-ui/fullcalendar-svelte';

  let view = $state('dayGridMonth');
  let events = $state([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
</script>

<FullCalendar bind:view {events} oneventclick={(e) => console.log(e.event, e.el)} />`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { FullCalendar } from '@rozie-ui/fullcalendar-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [FullCalendar],
  template: \`
    <FullCalendar [(view)]="view" [events]="events" (eventClick)="onEventClick($event)" />
  \`,
})
export class DemoComponent {
  view = 'dayGridMonth';
  events = [{ id: '1', title: 'Kickoff', start: '2026-06-04' }];
  onEventClick(e: { event: unknown; el: HTMLElement }) {
    console.log(e.event, e.el);
  }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { FullCalendar } from '@rozie-ui/fullcalendar-solid';

export function Demo() {
  const [view, setView] = createSignal('dayGridMonth');
  const [events] = createSignal([{ id: '1', title: 'Kickoff', start: '2026-06-04' }]);
  return (
    <FullCalendar
      view={view()}
      onViewChange={setView}
      events={events()}
      onEventClick={(e) => console.log(e.event, e.el)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/fullcalendar-lit';

// <rozie-full-calendar> is a custom element. Bind \`view\`/\`events\` as
// properties and listen for the \`event-click\` event.
const el = document.querySelector('rozie-full-calendar');
el.view = 'dayGridMonth';
el.events = [{ id: '1', title: 'Kickoff', start: '2026-06-04' }];
el.addEventListener('view-change', (e) => {
  el.view = e.detail;
});
el.addEventListener('event-click', (e) => {
  console.log(e.detail.event, e.detail.el);
});`,
  },
};

// Per-target idiomatic `options` binding for the Gotchas snippets. Each takes an
// object-literal string and yields the target's binding form.
export const OPTIONS_BINDING = {
  react: (obj) => `options={${obj}}`,
  solid: (obj) => `options={${obj}}`,
  svelte: (obj) => `options={${obj}}`,
  vue: (obj) => `:options="${obj}"`,
  angular: (obj) => `[options]="${obj}"`,
  lit: (obj) => `el.options = ${obj};`,
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

export const HANDLE_USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useRef } from 'react';
import { FullCalendar, type FullCalendarHandle } from '@rozie-ui/fullcalendar-react';

const cal = useRef<FullCalendarHandle>(null);
// <FullCalendar ref={cal} ... />
cal.current?.next();
const api = cal.current?.getApi();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const cal = ref();          // template ref
</script>

<template>
  <FullCalendar ref="cal" />
  <button @click="cal.next()">Next</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let cal;                  // component instance via bind:this
</script>

<FullCalendar bind:this={cal} />
<button onclick={() => cal.next()}>Next</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(FullCalendar) cal!: FullCalendar;  // or the viewChild() signal
  advance() { this.cal.next(); }
  api() { return this.cal.getApi(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { FullCalendar, type FullCalendarHandle } from '@rozie-ui/fullcalendar-solid';

let handle: FullCalendarHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<FullCalendar ref={(h) => (handle = h)} />;
handle?.next();
const api = handle?.getApi();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-full-calendar');
el.next();
const api = el.getApi();`,
  },
};

// ---------------------------------------------------------------------------
// README rendering.
// ---------------------------------------------------------------------------

export function renderReadme(target, ir, pkgName, handleManifest = {}) {
  if (ir.emitDecls === null) {
    throw new Error('renderReadme: FullCalendar.rozie has no <emits> block — the events table is generated from it');
  }
  const usage = USAGE[target];
  if (!usage) throw new Error(`renderReadme: no usage snippet for target "${target}"`);

  const lines = [];
  lines.push(`# ${pkgName}`);
  lines.push('');
  lines.push(
    `Idiomatic **${target}** \`FullCalendar\` — a cross-framework calendar/scheduler ` +
      `compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping ` +
      `[FullCalendar](https://fullcalendar.io/). This package is generated; do ` +
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
    `Peer dependencies: the four \`@fullcalendar/*\` engine packages ` +
      '(`@fullcalendar/core`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, ' +
      `\`@fullcalendar/interaction\`, all \`^6.1\`) + \`${FRAMEWORK_PEER_LABEL[target]}\`. ` +
      'Install them alongside this package. FullCalendar v6 auto-injects its own ' +
      'stylesheet — there is **no manual CSS import** to add.',
  );
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

  // NOTE: no Angular forms-accessor (CVA) section. flatpickr auto-renders one
  // for any single `model: true` prop, but FullCalendar's lone model prop is
  // `view` (the active view name) — a calendar view name is not a form value,
  // so the forms-accessor section is intentionally gated OUT for this component.

  // Props
  lines.push('## Props');
  lines.push('');
  lines.push('| Name | Type | Default | Two-way (model) | Required |');
  lines.push('| --- | --- | --- | :---: | :---: |');
  for (const p of ir.props) {
    // Escape pipes for the GFM table cell — a union type (`String | Number`)
    // carries a literal `|` that must be `\|` so it is not parsed as a column
    // delimiter (matches the docs/components/fullcalendar.md convention).
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
  if (target === 'lit' && litEventNamesDiverge(ir.emitDecls.map((d) => d.name))) {
    lines.push(LIT_EVENT_NOTE);
    lines.push('');
  }
  lines.push('| Event | Payload | Description |');
  lines.push('| --- | --- | --- |');
  for (const d of ir.emitDecls) {
    const eventCol = target === 'lit' ? litEventName(d.name) : d.name;
    const payload = d.payload ? typeCodeCell(printTSType(d.payload)) : '—';
    lines.push(`| \`${eventCol}\` | ${payload} | ${d.docs?.description ?? ''} |`);
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
      'Beyond props/events, the component exposes imperative methods (declared once in the ' +
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

  // Slots — FullCalendar exposes the `event` portal-slot (custom event content).
  // Emit the section only if the source declares any slots.
  if (ir.slots && ir.slots.length > 0) {
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
  }

  // Gotchas — three engine behaviors consumers trip over (260929-lya).
  const bind = OPTIONS_BINDING[target];
  if (!bind) throw new Error(`renderReadme: no options binding for target "${target}"`);
  lines.push('## Gotchas');
  lines.push('');
  lines.push(
    '**Events are keyboard-focusable.** Whenever an `eventClick` handler is registered, ' +
      'FullCalendar makes every event interactive (`tabindex="0"`, Enter/Space activation). ' +
      'This wrapper always registers one, because it powers the `eventClick` event. ' +
      'FullCalendar checks the `eventInteractive` option before it checks for handlers, so ' +
      'opt out with `' + bind('{ eventInteractive: false }') + '`. ' +
      'A per-event `interactive: false` also works when the global option is unset.',
  );
  lines.push('');
  lines.push(
    '**`loading` fires only for fetched sources.** It reflects event sources FullCalendar ' +
      'fetches itself (a URL/JSON feed or a function source). The `events` prop is always an ' +
      'in-memory array reconciled synchronously, so with `events` alone `loading` never fires; ' +
      'track your own fetch state instead. For FullCalendar-managed fetching, pass sources ' +
      "through `options` as `eventSources`: `" +
      bind("{ eventSources: [{ url: '/api/events' }] }") + '`.',
  );
  lines.push('');
  lines.push(
    '**`noEventsContent` needs a list view.** The slot renders only in list views, and the ' +
      'baked-in daygrid/timegrid/interaction plugins provide none. Recipe: `npm i @fullcalendar/list`, ' +
      "`import listPlugin from '@fullcalendar/list'`, pass `" +
      bind('{ plugins: [listPlugin] }') +
      '` (the `plugins` key merges with the baked-in defaults), and set `view` to `listWeek`, ' +
      '`listDay` or `listMonth`. The slot then renders when the list is empty.',
  );
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Docs props-table validator (VALIDATE-NOT-OVERWRITE).
//
// Identical contract to the sortable-list/flatpickr validator. codegen.mjs
// invokes this against docs/components/fullcalendar.md (REQ-27-6 ships a real
// "### Props" table) — ENFORCING: it throws on drift of the IR-derivable
// structural columns (name/type/default).
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
    // The IR type may itself be a union (`String | Number`) — every source member
    // must be present in the docs cell (subset check).
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
