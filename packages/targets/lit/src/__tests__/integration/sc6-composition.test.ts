/**
 * SC6 integration test — composition + self-reference (Phase 06.4 SC6).
 *
 * Asserts via the Card.lit.ts.snap + CardHeader.lit.ts.snap + TreeNode.lit.ts.snap
 * + Modal.lit.ts.snap fixtures that:
 *
 *   - Cross-component composition emits a side-effect `import './Foo.rozie';`
 *     (no symbol bind — the imported module's @customElement decorator
 *     self-registers the tag at module load).
 *   - Composition references in templates emit `<rozie-foo>` tags verbatim.
 *   - Self-reference does NOT emit an extra import — the class self-registers
 *     via its own @customElement decorator.
 *
 * This is the static/snapshot side of SC6; live browser mounting + 3-level
 * recursive render assertion is a later phase deliverable.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CARD = resolve(HERE, '../fixtures/Card.lit.ts.snap');
const CARD_HEADER = resolve(HERE, '../fixtures/CardHeader.lit.ts.snap');
const TREE_NODE = resolve(HERE, '../fixtures/TreeNode.lit.ts.snap');
const MODAL = resolve(HERE, '../fixtures/Modal.lit.ts.snap');

describe('SC6 — composition + self-reference emit', () => {
  describe('cross-component composition (Card → CardHeader)', () => {
    it("Card emits `import './CardHeader.rozie';` side-effect import", () => {
      const code = readFileSync(CARD, 'utf8');
      expect(code).toContain("import './CardHeader.rozie';");
      // Verify it is a BARE import with no `from` binding.
      expect(code).not.toMatch(/import\s+CardHeader\s+from/);
    });

    it('Card emits <rozie-card-header> tag in render()', () => {
      const code = readFileSync(CARD, 'utf8');
      expect(code).toContain('<rozie-card-header');
    });

    it('CardHeader registers itself via @customElement decorator', () => {
      const code = readFileSync(CARD_HEADER, 'utf8');
      expect(code).toContain("@customElement('rozie-card-header')");
    });
  });

  describe('cross-component composition (Modal → Counter)', () => {
    it("Modal emits `import './Counter.rozie';` side-effect import", () => {
      const code = readFileSync(MODAL, 'utf8');
      expect(code).toContain("import './Counter.rozie';");
    });

    it('Modal emits <rozie-counter> tag in render()', () => {
      const code = readFileSync(MODAL, 'utf8');
      expect(code).toContain('<rozie-counter');
    });
  });

  describe('self-reference (TreeNode → TreeNode)', () => {
    it('TreeNode emits <rozie-tree-node> tag inside its own render', () => {
      const code = readFileSync(TREE_NODE, 'utf8');
      expect(code).toContain('<rozie-tree-node');
    });

    it('TreeNode does NOT emit a self side-effect import (class self-registers)', () => {
      const code = readFileSync(TREE_NODE, 'utf8');
      expect(code).not.toContain("import './TreeNode.rozie';");
    });

    it("TreeNode's @customElement decorator registers 'rozie-tree-node' tag", () => {
      const code = readFileSync(TREE_NODE, 'utf8');
      expect(code).toContain("@customElement('rozie-tree-node')");
    });
  });

  describe('composition tags use rozie- kebab prefix per D-LIT-01', () => {
    it('Card emits @customElement(\'rozie-card\')', () => {
      const code = readFileSync(CARD, 'utf8');
      expect(code).toContain("@customElement('rozie-card')");
    });

    it('CardHeader emits @customElement(\'rozie-card-header\')', () => {
      const code = readFileSync(CARD_HEADER, 'utf8');
      expect(code).toContain("@customElement('rozie-card-header')");
    });

    it('TreeNode emits @customElement(\'rozie-tree-node\')', () => {
      const code = readFileSync(TREE_NODE, 'utf8');
      expect(code).toContain("@customElement('rozie-tree-node')");
    });
  });
});
