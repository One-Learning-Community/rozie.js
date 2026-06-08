/**
 * README rendering + docs-table validation for @rozie-ui/pdf.
 *
 * Everything structural is derived from a SINGLE parse of PdfViewer.rozie
 * (`ir.props` / `ir.slots` / `ir.emits` / `ir.expose`) so the per-leaf READMEs
 * cannot drift from the compiled output. Only handle prose comes from the
 * hand-kept manifest.
 *
 * Pure glue over the `@rozie/core` public IR — NO compiler/emitter surface.
 * (Mirror of packages/ui/cropper/scripts/readme.mjs, retargeted to the PDF-viewer
 * surface: a single two-way `page` model prop, NO slots, and the PDF.js event
 * surface (load/error/pagechange/pagesrendered/passwordrequest) — so the Events
 * heading SHIPS — plus the `pdfjs-dist` engine peer dependency. UNLIKE cropper
 * there is NO separate engine-CSS import: PdfViewer ships the text-layer CSS
 * itself (the `:root {}` engine-DOM escape hatch), and the PDF.js worker is
 * auto-configured from a version-matched CDN.)
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
// The current page is two-way bound through the single `page` model prop
// (1-based). The PDF source comes through `src`. Load/page/render lifecycle fires
// as native framework events. NO engine-CSS import is required (PdfViewer ships
// the selectable-text-layer CSS itself), and the PDF.js worker is auto-configured
// from a version-matched CDN — override `workerSrc` for offline / CSP. See the
// Install section.
// ---------------------------------------------------------------------------

const USAGE = {
  react: {
    lang: 'tsx',
    code: `import { useState } from 'react';
import { PdfViewer } from '@rozie-ui/pdf-react';

export function Demo() {
  const [page, setPage] = useState(1);
  return (
    <PdfViewer
      src="/document.pdf"
      page={page}
      onPageChange={(e) => setPage(e.page)}
      scale={1.2}
      render-all-pages
      onLoad={(e) => console.log(e.numPages)}
    />
  );
}`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup lang="ts">
import { ref } from 'vue';
import PdfViewer from '@rozie-ui/pdf-vue';

const page = ref(1);
</script>

<template>
  <PdfViewer
    src="/document.pdf"
    v-model:page="page"
    :scale="1.2"
    render-all-pages
    @load="(e) => console.log(e.numPages)"
  />
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script lang="ts">
  import PdfViewer from '@rozie-ui/pdf-svelte';

  let page = $state(1);
</script>

<PdfViewer
  src="/document.pdf"
  bind:page
  scale={1.2}
  render-all-pages
  onload={(e) => console.log(e.numPages)}
/>`,
  },
  angular: {
    lang: 'ts',
    code: `import { Component } from '@angular/core';
import { PdfViewer } from '@rozie-ui/pdf-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [PdfViewer],
  template: \`
    <PdfViewer
      src="/document.pdf"
      [(page)]="page"
      [scale]="1.2"
      render-all-pages
      (load)="onLoad($event)"
    />
  \`,
})
export class DemoComponent {
  page = 1;
  onLoad(e: any) { console.log(e.numPages); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { createSignal } from 'solid-js';
import { PdfViewer } from '@rozie-ui/pdf-solid';

export function Demo() {
  const [page, setPage] = createSignal(1);
  return (
    <PdfViewer
      src="/document.pdf"
      page={page()}
      onPageChange={(e) => setPage(e.page)}
      scale={1.2}
      render-all-pages
      onLoad={(e) => console.log(e.numPages)}
    />
  );
}`,
  },
  lit: {
    lang: 'ts',
    code: `import '@rozie-ui/pdf-lit';

// <rozie-pdf-viewer> is a custom element. Bind \`src\`/\`page\` as properties and
// listen for \`page-change\` (the two-way change channel) + \`load\`.
const el = document.querySelector('rozie-pdf-viewer');
el.src = '/document.pdf';
el.scale = 1.2;
el.addEventListener('page-change', (e) => { el.page = e.detail.page; });
el.addEventListener('load', (e) => console.log(e.detail.numPages));`,
  },
};

const FRAMEWORK_PEER_LABEL = {
  react: 'react + react-dom',
  vue: 'vue',
  svelte: 'svelte',
  angular: '@angular/core + @angular/common',
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
import { PdfViewer, type PdfViewerHandle } from '@rozie-ui/pdf-react';

const viewer = useRef<PdfViewerHandle>(null);
// <PdfViewer ref={viewer} ... />
viewer.current?.nextPage();
const total = viewer.current?.getPageCount();`,
  },
  vue: {
    lang: 'vue',
    code: `<script setup>
import { ref } from 'vue';
const viewer = ref();      // template ref
</script>

<template>
  <PdfViewer ref="viewer" ... />
  <button @click="viewer.nextPage()">Next</button>
</template>`,
  },
  svelte: {
    lang: 'svelte',
    code: `<script>
  let viewer;              // component instance via bind:this
</script>

<PdfViewer bind:this={viewer} ... />
<button onclick={() => viewer.nextPage()}>Next</button>`,
  },
  angular: {
    lang: 'ts',
    code: `@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(PdfViewer) viewer!: PdfViewer;  // or the viewChild() signal
  next() { this.viewer.nextPage(); }
  count() { return this.viewer.getPageCount(); }
}`,
  },
  solid: {
    lang: 'tsx',
    code: `import { PdfViewer, type PdfViewerHandle } from '@rozie-ui/pdf-solid';

let handle: PdfViewerHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<PdfViewer ref={(h) => (handle = h)} ... />;
handle?.nextPage();
const total = handle?.getPageCount();`,
  },
  lit: {
    lang: 'ts',
    code: `// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-pdf-viewer');
el.nextPage();
const total = el.getPageCount();`,
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
    `Idiomatic **${target}** \`PdfViewer\` — a cross-framework PDF viewer ` +
      `compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) ` +
      `source wrapping [PDF.js](https://github.com/mozilla/pdf.js) (\`pdfjs-dist\`). The current ` +
      `page is two-way bound via \`page\` (1-based), with selectable text, zoom and rotation. This ` +
      `package is generated; do not edit \`src/\` by hand.`,
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
    `Peer dependencies: the \`pdfjs-dist\` engine (\`^6\`) + ` +
      `\`${FRAMEWORK_PEER_LABEL[target]}\`. Install them alongside this package.`,
  );
  lines.push('');
  lines.push(
    'No separate engine-CSS import is needed — `PdfViewer` ships the selectable text-layer CSS ' +
      'itself. The PDF.js worker is auto-configured from a version-matched CDN, so the component ' +
      'works with zero config; override the `workerSrc` prop for offline / CSP / bundled-worker ' +
      'setups.',
  );
  lines.push('');

  // Usage
  lines.push('## Usage');
  lines.push('');
  lines.push('```' + usage.lang);
  lines.push(usage.code);
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

  // Events — gated on ir.emits.length > 0 (PDF.js IS event-ful, so this
  // section SHIPS).
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

  // Slots — PdfViewer declares none, so this section is normally absent. Kept for
  // parity with the other @rozie-ui readmes (renders only if slots ever appear).
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
// Identical contract to the maplibre/codemirror/chartjs/cropper validators.
// codegen.mjs invokes this against docs/guide/pdf.md (which ships a real
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
