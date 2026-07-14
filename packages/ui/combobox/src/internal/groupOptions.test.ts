/**
 * groupOptions.test.ts — red-first unit tests for the pure partition helper
 * (see groupOptions.ts for the full contract). Written BEFORE the
 * implementation exists (TDD RED), per the combobox-native-groups plan Task 1.
 */
import { describe, it, expect } from 'vitest';
import { groupOptions, type OptionGroup } from './groupOptions';

interface Opt {
  value: string;
  label: string;
  group?: string | null;
  disabled?: boolean;
  selected?: boolean;
}

const groupOf = (o: Opt) => (o && o.group != null ? String(o.group) : null);

describe('groupOptions (pure partition helper)', () => {
  it('1. stable partition — within-group order preserved from input', () => {
    const items: Opt[] = [
      { value: 'a', label: 'A', group: 'x' },
      { value: 'b', label: 'B', group: 'x' },
      { value: 'c', label: 'C', group: 'x' },
    ];
    const groups: OptionGroup[] = [{ id: 'x', label: 'X' }];
    const result = groupOptions(items, groups, groupOf);
    expect(result.grouped).toBe(true);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].items.map((i) => i.value)).toEqual(['a', 'b', 'c']);
  });

  it('2. explicit groups order honored; a group present on items but absent from `groups` falls back to first-appearance AFTER the listed ones', () => {
    const items: Opt[] = [
      { value: 'a', label: 'A', group: 'fallback1' },
      { value: 'b', label: 'B', group: 'veg' },
      { value: 'c', label: 'C', group: 'fruit' },
      { value: 'd', label: 'D', group: 'fallback2' },
    ];
    const groups: OptionGroup[] = [
      { id: 'fruit', label: 'Fruit' },
      { id: 'veg', label: 'Vegetable' },
    ];
    const result = groupOptions(items, groups, groupOf);
    expect(result.grouped).toBe(true);
    const ids = result.blocks.map((b) => (b.group ? b.group.id : null));
    expect(ids).toEqual(['fruit', 'veg', 'fallback1', 'fallback2']);
    const fruitBlock = result.blocks.find((b) => b.group && b.group.id === 'fruit');
    expect(fruitBlock?.group?.label).toBe('Fruit');
    const fallbackBlock = result.blocks.find((b) => b.group && b.group.id === 'fallback1');
    // fallback label defaults to the group id itself.
    expect(fallbackBlock?.group?.label).toBe('fallback1');
  });

  it('3. flat-index alignment — ordered equals the concatenation of blocks[].items', () => {
    const items: Opt[] = [
      { value: 'a', label: 'A', group: 'veg' },
      { value: 'b', label: 'B', group: 'fruit' },
      { value: 'c', label: 'C' },
      { value: 'd', label: 'D', group: 'fruit' },
    ];
    const groups: OptionGroup[] = [{ id: 'fruit', label: 'Fruit' }, { id: 'veg', label: 'Vegetable' }];
    const result = groupOptions(items, groups, groupOf);
    const flattened = ([] as Opt[]).concat(...result.blocks.map((b) => b.items));
    expect(result.ordered).toEqual(flattened);
  });

  it('4. empty groups AND no item.group ⇒ grouped === false, ordered === input order (byte-identical flat case)', () => {
    const items: Opt[] = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
      { value: 'c', label: 'C' },
    ];
    const result = groupOptions(items, [], groupOf);
    expect(result.grouped).toBe(false);
    expect(result.ordered).toEqual(items);
    expect(result.ordered.map((i) => i.value)).toEqual(['a', 'b', 'c']);
    expect(result.blocks).toEqual([]);
  });

  it('5. disabled/selected passthrough — a disabled item survives untouched in its block', () => {
    const items: Opt[] = [
      { value: 'a', label: 'A', group: 'x', disabled: true },
      { value: 'b', label: 'B', group: 'x', selected: true },
    ];
    const groups: OptionGroup[] = [{ id: 'x', label: 'X' }];
    const result = groupOptions(items, groups, groupOf);
    const a = result.blocks[0].items.find((i) => i.value === 'a');
    const b = result.blocks[0].items.find((i) => i.value === 'b');
    expect(a?.disabled).toBe(true);
    expect(b?.selected).toBe(true);
    // Same object references — untouched, not cloned.
    expect(a).toBe(items[0]);
    expect(b).toBe(items[1]);
  });

  it('6. ungrouped items while grouping active → a single leading `group: null` block, order preserved', () => {
    const items: Opt[] = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', group: 'x' },
      { value: 'c', label: 'C' },
      { value: 'd', label: 'D', group: 'x' },
    ];
    const groups: OptionGroup[] = [{ id: 'x', label: 'X' }];
    const result = groupOptions(items, groups, groupOf);
    expect(result.grouped).toBe(true);
    expect(result.blocks[0].group).toBeNull();
    expect(result.blocks[0].items.map((i) => i.value)).toEqual(['a', 'c']);
    expect(result.blocks[1].group?.id).toBe('x');
    expect(result.blocks[1].items.map((i) => i.value)).toEqual(['b', 'd']);
  });

  it('7. a listed group with no matching items is omitted (no empty block)', () => {
    const items: Opt[] = [{ value: 'a', label: 'A', group: 'fruit' }];
    const groups: OptionGroup[] = [
      { id: 'fruit', label: 'Fruit' },
      { id: 'veg', label: 'Vegetable' },
    ];
    const result = groupOptions(items, groups, groupOf);
    const ids = result.blocks.map((b) => (b.group ? b.group.id : null));
    expect(ids).toEqual(['fruit']);
  });

  it('8. non-array items and non-array groups tolerated', () => {
    // @ts-expect-error deliberately passing a non-array
    const r1 = groupOptions(null, [], groupOf);
    expect(r1).toEqual({ grouped: false, ordered: [], blocks: [] });

    const items: Opt[] = [{ value: 'a', label: 'A' }];
    // @ts-expect-error deliberately passing a non-array groups
    const r2 = groupOptions(items, null, groupOf);
    expect(r2.grouped).toBe(false);
    expect(r2.ordered).toEqual(items);
  });
});
