import type { JSX } from 'react';
import TreeNode from '../TreeNode.rozie';

const root = {
  id: 'r',
  label: 'root',
  children: [
    {
      id: 'a',
      label: 'alpha',
      children: [
        { id: 'a1', label: 'alpha-1', children: [] as unknown[] },
        { id: 'a2', label: 'alpha-2', children: [] as unknown[] },
      ],
    },
    {
      id: 'b',
      label: 'beta',
      children: [{ id: 'b1', label: 'beta-1', children: [] as unknown[] }],
    },
  ],
};

export default function TreeNodePage(): JSX.Element {
  return (
    <div>
      <h2>TreeNode</h2>
      <p>Recursive component composition (D-119) — TreeNode renders itself for each child.</p>
      <TreeNode node={root} />
    </div>
  );
}
