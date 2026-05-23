import { clsx } from '@rozie/runtime-react';
import styles from './TreeNode.module.css';

interface TreeNodeProps {
  node?: Record<string, any>;
}

export default function TreeNode(_props: TreeNodeProps): JSX.Element {
  const props: TreeNodeProps & { node: Record<string, any> } = {
    ..._props,
    node: _props.node ?? (() => ({
    id: '',
    label: '',
    children: []
  }))(),
  };
  const attrs: Record<string, unknown> = (() => {
    const { node, ...rest } = _props as TreeNodeProps & Record<string, unknown>;
    void node;
    return rest;
  })();

  return (
    <>
    <div {...attrs} className={clsx(styles["tree-node"], (attrs.className as string | undefined))} data-rozie-s-a7176a6e="">
      <span className={styles["tree-node__label"]} data-rozie-s-a7176a6e="">{props.node.label}</span>
      {(props.node.children && props.node.children.length > 0) && <ul className={styles["tree-node__children"]} data-rozie-s-a7176a6e="">
        {props.node.children.map((child, childIndex) => <li key={child.id} data-index={childIndex} data-rozie-s-a7176a6e="">
          <TreeNode node={child} data-rozie-s-a7176a6e="" />
        </li>)}
      </ul>}</div>
    </>
  );
}
