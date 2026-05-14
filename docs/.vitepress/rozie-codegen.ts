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
import { readFileSync } from 'node:fs';
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

const VALID_TARGETS = new Set<string>(Object.keys(TARGET_LANG));

export interface RozieCodegenOptions {
  /** Absolute path to the repo's `examples/` directory. */
  examplesDir: string;
}

export function rozieCodegen(
  md: MarkdownIt,
  opts: RozieCodegenOptions,
): void {
  const readExample = (name: string): string => {
    const path = resolve(opts.examplesDir, `${name}.rozie`);
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
        const [name, target] = info.slice('rozie-out'.length).trim().split(/\s+/);
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
        token.info = TARGET_LANG[target as CompileTarget];
        continue;
      }
    }
  });
}
