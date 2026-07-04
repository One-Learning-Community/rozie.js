import { useState } from 'react';
import { clsx, rozieAttr, rozieDisplay } from '@rozie/runtime-react';
import './TreeNode.css';

interface TreeNodeProps {
  node?: Record<string, any>;
}

export default function TreeNode(_props: TreeNodeProps): JSX.Element {
  const __defaultNode = useState(() => (() => ({
    id: '',
    label: '',
    children: []
  }))())[0];
  const props: Omit<TreeNodeProps, 'node'> & { node: Record<string, any> } = {
    ..._props,
    node: _props.node ?? __defaultNode,
  };
  const attrs: Record<string, unknown> = (() => {
    const { node, ...rest } = _props as TreeNodeProps & Record<string, unknown>;
    void node;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx("tree-node", (attrs.className as string | undefined))} data-rozie-s-a7176a6e="">
      <span className={"tree-node__label"} data-rozie-s-a7176a6e="">{rozieDisplay(props.node.label)}</span>
      {!!(props.node.children && props.node.children.length > 0) && <ul className={"tree-node__children"} data-rozie-s-a7176a6e="">
        {props.node.children.map((child, childIndex) => <li key={child.id} data-index={rozieAttr(childIndex)} data-rozie-s-a7176a6e="">
          <TreeNode node={child} data-rozie-s-a7176a6e="" />
        </li>)}
      </ul>}</div>
    </>
  );
}
