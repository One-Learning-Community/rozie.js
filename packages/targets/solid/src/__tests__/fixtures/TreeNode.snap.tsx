import type { JSX } from 'solid-js';
import { For, Show, mergeProps, splitProps } from 'solid-js';

interface TreeNodeProps {
  node?: Record<string, any>;
}

export default function TreeNode(_props: TreeNodeProps): JSX.Element {
  const _merged = mergeProps({ node: (() => ({
  id: '',
  label: '',
  children: []
}))() }, _props);
  const [local, rest] = splitProps(_merged, ['node']);

  return (
    <>
    <style>{`.tree-node[data-rozie-s-a7176a6e] { font-family: system-ui; padding-left: 0.5rem; }
    .tree-node__label[data-rozie-s-a7176a6e] { display: inline-block; }
    .tree-node__children[data-rozie-s-a7176a6e] { list-style: none; margin: 0.25rem 0 0 0; padding-left: 1rem; border-left: 1px dashed currentColor; }`}</style>
    <>
    <div class={"tree-node"} data-rozie-s-a7176a6e="">
      <span class={"tree-node__label"} data-rozie-s-a7176a6e="">{local.node.label}</span>
      {<Show when={local.node.children && local.node.children.length > 0}><ul class={"tree-node__children"} data-rozie-s-a7176a6e="">
        <For each={local.node.children}>{(child) => <li data-rozie-s-a7176a6e="">
          <TreeNode node={child} />
        </li>}</For>
      </ul></Show>}</div>
    </>
    </>
  );
}
