export function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) count += countNodes(node.children[i]);
  }
  return count;
}

export function findNode(id, node) {
  if (!node) return null;
  if (node.id === id) return node;
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const res = findNode(id, node.children[i]);
      if (res) return res;
    }
  }
  return null;
}

export function findParent(id, node) {
  if (!node || !node.children) return null;
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (child.id === id) return node;
    const res = findParent(id, child);
    if (res) return res;
  }
  return null;
}

export function getAncestors(targetId, node, path = []) {
  if (!node) return null;
  if (node.id === targetId) return [...path, node];
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      const found = getAncestors(targetId, node.children[i], [...path, node]);
      if (found) return found;
    }
  }
  return null;
}

export function isNodeVisibleInTree(nodeId, root) {
  if (!nodeId || !root) return false;
  if (root.id === nodeId) return true;
  const path = getAncestors(nodeId, root);
  if (!path || path.length === 0) return false;
  for (let i = 0; i < path.length - 1; i++) {
    if (path[i].collapsed) return false;
  }
  return true;
}

export function sanitizeTreeForHistory(node) {
  if (!node) return null;
  return {
    id: node.id,
    text: String(node.text ?? ""),
    icon: node.icon || null,
    priority: node.priority || null,
    progress: node.progress || null,
    tags: Array.isArray(node.tags) ? [...node.tags] : [],
    note: node.note || "",
    collapsed: Boolean(node.collapsed),
    fontSize: node.fontSize || null,
    fontWeight: node.fontWeight || null,
    fontStyle: node.fontStyle || null,
    textDecoration: node.textDecoration || null,
    textColor: node.textColor || null,
    children: node.children ? node.children.map(sanitizeTreeForHistory).filter(Boolean) : []
  };
}
