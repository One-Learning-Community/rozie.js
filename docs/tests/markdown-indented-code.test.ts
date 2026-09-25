// Indented-code-block guard for every published docs page.
//
// markdown-it treats a line indented 4+ spaces after a blank line as an INDENTED CODE BLOCK,
// even inside a live Vue component on a VitePress page. On data-table-demo.md that silently
// turned every slot fill inside `<DataTable>` (`#groupBar`, `#filter`, `#editor`, `#detail`,
// `#cell`) into `<pre><code>` text: the demo rendered only its headless fallbacks, and the
// swallowed `{{ value }}` was interpolated at page level. Nothing failed — the page built, and
// the table still rendered.
//
// VitePress pages use fenced code (`fence` tokens) for samples, so ANY `code_block` token on a
// published page is this trap. Parsed with VitePress's own renderer so the tokenizer matches
// what `vitepress build` compiles.
import { describe, expect, it } from 'vitest';
import { createMarkdownRenderer } from 'vitepress';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('..', import.meta.url));
// Mirrors `srcExclude` in .vitepress/config.ts — these files are not published pages.
const EXCLUDED = (rel: string) => rel === 'ADDING-COMPONENT-DOCS.md' || rel.startsWith('superpowers/');

function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
    const p = join(dir, e.name);
    if (e.isDirectory()) return pages(p);
    return e.name.endsWith('.md') ? [p] : [];
  });
}

describe('published docs pages', () => {
  it('contain no indented code blocks (they swallow live-component content)', async () => {
    const md = await createMarkdownRenderer(DOCS);
    const offenders: string[] = [];
    for (const file of pages(DOCS)) {
      const rel = relative(DOCS, file);
      if (EXCLUDED(rel)) continue;
      const src = readFileSync(file, 'utf8');
      // VitePress strips YAML frontmatter before tokenizing, so token maps are relative to
      // the body — add the frontmatter's line count back to report real file lines.
      const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(src);
      const fmLines = fm ? fm[0].split('\n').length - 1 : 0;
      for (const tok of md.parse(src, { path: file, relativePath: rel, cleanUrls: false })) {
        if (tok.type === 'code_block') {
          const line = (tok.map?.[0] ?? -1) + 1 + fmLines;
          offenders.push(`${rel}:${line}  ${tok.content.split('\n')[0].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
