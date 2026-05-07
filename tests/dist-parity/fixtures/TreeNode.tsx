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
    <div className={styles["tree-node"]}>
      <span className={styles["tree-node__label"]}>{props.node.label}</span>
      {(props.node.children && props.node.children.length > 0) && <ul className={styles["tree-node__children"]}>
        {props.node.children.map((child) => <li key={child.id}>
          <TreeNode node={child} />
        </li>)}
      </ul>}</div>
    </>
  );
}
