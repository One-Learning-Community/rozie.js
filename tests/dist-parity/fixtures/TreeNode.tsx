import styles from './TreeNode.module.css';

interface TreeNodeProps {
  node?: Record<string, unknown>;
}

export default function TreeNode(_props: TreeNodeProps): JSX.Element {
  const props: TreeNodeProps = {
    ..._props,
    node: _props.node ?? (() => ({
    id: '',
    label: '',
    children: []
  }))(),
  };

  return (
    <>
    <div className={styles["tree-node"]} data-rozie-s-a7176a6e="">
      <span className={styles["tree-node__label"]} data-rozie-s-a7176a6e="">{props.node.label}</span>
      {(props.node.children && props.node.children.length > 0) && <ul className={styles["tree-node__children"]} data-rozie-s-a7176a6e="">
        {props.node.children.map((child) => <li key={child.id} data-rozie-s-a7176a6e="">
          <TreeNode node={child} />
        </li>)}
      </ul>}</div>
    </>
  );
}
