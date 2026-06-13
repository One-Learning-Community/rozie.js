/**
 * rozie-codegen — VitePress markdown-it plugin that keeps the example pages
 * LIVE against the actual compiler.
 *
 * Two custom fence kinds are recognized:
 *
 *   ```rozie-src <Name>
 *   ```
 *     → inlined verbatim from `examples/<Name>.rozie`, highlighted as `rozie`.
 *
 *   ```rozie-out <Name> <target>
 *   ```
 *     → `compile()`d from `examples/<Name>.rozie` for <target>, highlighted as
 *       that target's language. <target> ∈ vue|react|svelte|angular|solid|lit.
 *
 * The fence body in the .md source is ignored — it is regenerated on every
 * `vitepress build` / `vitepress dev` from the real `.rozie` source through
 * the real `@rozie/core` compiler. Docs cannot drift from the compiler.
 *
 * Implementation: a markdown-it `core` ruler mutates `fence` tokens (content +
 * info language) BEFORE VitePress's Shiki-based fence renderer runs, so the
 * generated code gets normal syntax highlighting for free.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile, type CompileTarget } from '@rozie/core';
import type MarkdownIt from 'markdown-it';

/** Map a compile target to the fenced-code language for syntax highlighting. */
const TARGET_LANG: Record<CompileTarget, string> = {
  vue: 'vue',
  react: 'tsx',
  svelte: 'svelte',
  angular: 'ts',
  solid: 'tsx',
  lit: 'ts',
};

/**
 * Human-readable tab label per target. Injected as the fence's `[label]` so a
 * `rozie-out` block carries its framework name into a VitePress `::: code-group`
 * (the label becomes the tab; outside a code-group it renders as the code-block
 * title). An explicit trailing `[Custom]` in the fence info overrides this.
 */
const TARGET_LABEL: Record<CompileTarget, string> = {
  vue: 'Vue',
  react: 'React',
  svelte: 'Svelte',
  angular: 'Angular',
  solid: 'Solid',
  lit: 'Lit',
};

const VALID_TARGETS = new Set<string>(Object.keys(TARGET_LANG));

export interface RozieCodegenOptions {
  /** Absolute path to the repo's `examples/` directory. */
  examplesDir: string;
}

export function rozieCodegen(
  md: MarkdownIt,
  opts: RozieCodegenOptions,
): void {
  // Resolution order: canonical producers (`examples/<Name>.rozie`), then
  // demo-wrapper consumers (`examples/demos/<Name>.rozie`, e.g. TableDemo),
  // then the typed-example corpus (`examples/typed/<Name>.rozie`). Order is
  // load-bearing: `SortableList` exists in BOTH `examples/` and
  // `examples/typed/` — the root branch wins, so docs pages get the
  // engine-wrapper producer rather than the typed-coverage fixture.
  // `TypedCard` lives only under `typed/`, so it falls through to the last
  // branch. This lets docs pages show producer, consumer, and typed sources.
  const resolveExample = (name: string): string => {
    // Package-source branch — must precede the examples/ root branch (root
    // wins). `@rozie-ui` products live under `packages/ui/<product>/src/`;
    // `SortableList` moved there in Phase 20-01 and `Flatpickr` in the
    // flatpickr port, so docs resolve their canonical producer from the
    // package source rather than the (now-removed) `examples/<Name>.rozie`.
    for (const product of ['sortable-list', 'flatpickr', 'fullcalendar', 'codemirror', 'chartjs', 'tiptap', 'maplibre', 'cropper', 'pdf']) {
      const pkgSrc = resolve(
        opts.examplesDir,
        '..',
        `packages/ui/${product}/src`,
        `${name}.rozie`,
      );
      if (existsSync(pkgSrc)) return pkgSrc;
    }
    const root = resolve(opts.examplesDir, `${name}.rozie`);
    if (existsSync(root)) return root;
    const demo = resolve(opts.examplesDir, 'demos', `${name}.rozie`);
    if (existsSync(demo)) return demo;
    const typed = resolve(opts.examplesDir, 'typed', `${name}.rozie`);
    if (existsSync(typed)) return typed;
    throw new Error(
      `[rozie-codegen] cannot read example source: ${root} (and not found under demos/ or typed/)`,
    );
  };
  const readExample = (name: string): string => {
    const path = resolveExample(name);
    try {
      return readFileSync(path, 'utf8');
    } catch {
      throw new Error(
        `[rozie-codegen] cannot read example source: ${path}`,
      );
    }
  };

  md.core.ruler.push('rozie-codegen', (state) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence') continue;
      const info = token.info.trim();

      if (info.startsWith('rozie-src')) {
        const name = info.slice('rozie-src'.length).trim();
        if (!name) {
          throw new Error('[rozie-codegen] `rozie-src` needs a component name');
        }
        token.content = readExample(name);
        token.info = 'rozie';
        continue;
      }

      if (info.startsWith('rozie-out')) {
        const rest = info.slice('rozie-out'.length).trim();
        // An optional trailing `[Custom Label]` overrides the derived tab label.
        const labelMatch = rest.match(/\[([^\]]*)\]\s*$/);
        const explicitLabel = labelMatch ? labelMatch[1].trim() : '';
        const spec = labelMatch ? rest.slice(0, labelMatch.index).trim() : rest;
        const [name, target] = spec.split(/\s+/);
        if (!name || !target) {
          throw new Error(
            '[rozie-codegen] `rozie-out` needs a component name and a target',
          );
        }
        if (!VALID_TARGETS.has(target)) {
          throw new Error(
            `[rozie-codegen] unknown target "${target}" — expected one of ${[...VALID_TARGETS].join(', ')}`,
          );
        }
        const source = readExample(name);
        const result = compile(source, {
          target: target as CompileTarget,
          filename: `${name}.rozie`,
        });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        if (errors.length > 0) {
          throw new Error(
            `[rozie-codegen] compile errors for ${name} → ${target}:\n` +
              errors.map((d) => `  ${d.code}: ${d.message}`).join('\n'),
          );
        }
        token.content = result.code;
        const label = explicitLabel || TARGET_LABEL[target as CompileTarget];
        // Language first, then `[label]` — VitePress reads the label to title the
        // block / name the code-group tab.
        token.info = `${TARGET_LANG[target as CompileTarget]} [${label}]`;
        continue;
      }
    }
  });
}
