// D-16 — per-block snapshot fixtures for all 5 reference examples.
// Implementation: Plan 01-03 Task 5. Anchors paths per RESEARCH.md Pitfall 8.
//
// Block-presence matrix (verified by Plan 02's blockmap snapshots):
//   Counter      → props, data, script, template, style          (5 snaps)
//   SearchInput  → props, data, script, template, style          (5 snaps)
//   Dropdown     → props,       script, template, style, listeners (5 snaps; NO data)
//   TodoList     → props, data, script, template, style          (5 snaps)
//   Modal        → props,       script, template, style, listeners (5 snaps; NO data)
// Total: 25 snapshot files at fixtures/blocks/{example}-{blockType}.snap
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { splitBlocks } from '../../src/splitter/splitBlocks.js';
import { parseProps } from '../../src/parsers/parseProps.js';
import { parseData } from '../../src/parsers/parseData.js';
import { parseScript } from '../../src/parsers/parseScript.js';
import { parseTemplate } from '../../src/parsers/parseTemplate.js';
import { parseListeners } from '../../src/parsers/parseListeners.js';
import { parseStyle } from '../../src/parsers/parseStyle.js';
import { stripCircular } from '../helpers/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');
const FIXTURES_DIR = resolve(__dirname, '../../fixtures/blocks');

type Example = 'Counter' | 'SearchInput' | 'Dropdown' | 'TodoList' | 'Modal';
type BlockType = 'props' | 'data' | 'script' | 'template' | 'listeners' | 'style';

const EXAMPLES: readonly Example[] = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;

function loadExample(name: Example) {
  const source = readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
  const blocks = splitBlocks(source, `${name}.rozie`);
  return { source, blocks };
}

function serialize(value: unknown): string {
  return JSON.stringify(stripCircular(value), null, 2);
}

function snapPath(example: Example, blockType: BlockType): string {
  return resolve(FIXTURES_DIR, `${example}-${blockType}.snap`);
}

// Helper: run a parser on a block (skips the test gracefully if the block is absent).
async function runBlockSnapshot<T>(
  example: Example,
  blockType: BlockType,
  parse: (
    content: string,
    contentLoc: { start: number; end: number },
    source: string,
    filename: string,
  ) => { node: T; diagnostics: unknown[] },
): Promise<void> {
  const { source, blocks } = loadExample(example);
  const block = blocks[blockType];
  if (!block) {
    throw new Error(
      `Expected ${example}.rozie to have a <${blockType}> block per the locked block-presence matrix.`,
    );
  }
  const result = parse(block.content, block.contentLoc, source, `${example}.rozie`);
  const out = serialize({ node: result.node, diagnostics: result.diagnostics });
  await expect(out).toMatchFileSnapshot(snapPath(example, blockType));
}

describe('per-block snapshots (D-16) — props', () => {
  for (const example of EXAMPLES) {
    it(`${example}.rozie <props>`, async () => {
      await runBlockSnapshot(example, 'props', parseProps);
    });
  }
});

describe('per-block snapshots (D-16) — data', () => {
  // Dropdown and Modal have NO <data> block — skip those.
  const examplesWithData: readonly Example[] = ['Counter', 'SearchInput', 'TodoList'];
  for (const example of examplesWithData) {
    it(`${example}.rozie <data>`, async () => {
      await runBlockSnapshot(example, 'data', parseData);
    });
  }
});

describe('per-block snapshots (D-16) — script', () => {
  for (const example of EXAMPLES) {
    it(`${example}.rozie <script>`, async () => {
      await runBlockSnapshot(example, 'script', parseScript);
    });
  }
});

describe('per-block snapshots (D-16) — template', () => {
  for (const example of EXAMPLES) {
    it(`${example}.rozie <template>`, async () => {
      await runBlockSnapshot(example, 'template', parseTemplate);
    });
  }
});

describe('per-block snapshots (D-16) — listeners', () => {
  // Only Dropdown and Modal have <listeners>.
  const examplesWithListeners: readonly Example[] = ['Dropdown', 'Modal'];
  for (const example of examplesWithListeners) {
    it(`${example}.rozie <listeners>`, async () => {
      await runBlockSnapshot(example, 'listeners', parseListeners);
    });
  }
});

describe('per-block snapshots (D-16) — style', () => {
  for (const example of EXAMPLES) {
    it(`${example}.rozie <style>`, async () => {
      await runBlockSnapshot(example, 'style', parseStyle);
    });
  }
});
