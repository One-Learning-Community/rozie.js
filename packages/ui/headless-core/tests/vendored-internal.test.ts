import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(import.meta.dirname, '..', '..');
const canonical = readFileSync(resolve(UI, 'headless-core/src/internal/groupOptions.ts'), 'utf8');

describe('vendored internal helpers stay byte-identical to headless-core', () => {
  for (const family of ['combobox', 'select']) {
    it(`${family}/src/internal/groupOptions.ts`, () => {
      const copy = readFileSync(resolve(UI, family, 'src/internal/groupOptions.ts'), 'utf8');
      expect(copy).toBe(canonical);
    });
  }
});
