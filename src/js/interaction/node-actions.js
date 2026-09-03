import { state, getActiveTab, getPrimarySelectedNode, findParent, findNode } from "../core/state.js";
import { saveSnapshot } from "../core/history.js";
import { locateFocusedNode } from "../core/camera.js";
import { startEditNode } from "../render/render.js";

export function markDirtyAndRefresh(renderApp) {
  const tab = getActiveTab();
  if (tab) tab.isDirty = true;
  state.isLayoutDirty = true;
  saveSnapshot();
  if (renderApp) renderApp();
}

export function addChildNode(renderApp) {
  let p = getPrimarySelectedNode();
  if (!p) p = findNode(state.focusedRootId, state.mindData) || state.mindData;
  if (!p) return;
  const child = { id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4), text: "新分支", collapsed: false, children: [] };
  if (!p.children) p.children = [];
  p.children.push(child);
  p.collapsed = false;
  state.selectedIds = new Set([child.id]);
  markDirtyAndRefresh(renderApp);
  locateFocusedNode(child.id, false);
  startEditNode(child, state, renderApp, true);
}

export function addSiblingNode(renderApp) {
  const p = getPrimarySelectedNode();
  if (!p || p.id === state.focusedRootId) return addChildNode(renderApp);
  const parent = findParent(p.id, state.mindData); 
  if (!parent) return;
  const sib = { id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4), text: "新主题", collapsed: false, children: [] };
  const idx = parent.children.findIndex(c => c.id === p.id);
  parent.children.splice(idx + 1, 0, sib);
  state.selectedIds = new Set([sib.id]);
  markDirtyAndRefresh(renderApp);
  locateFocusedNode(sib.id, false);
  startEditNode(sib, state, renderApp, true);
}

export function deleteSelectedNodes(renderApp) {
  if (!state.selectedIds || state.selectedIds.size === 0) return;
  let fallbackId = state.focusedRootId;
  state.selectedIds.forEach(id => {
    if (id === state.focusedRootId) return;
    const parent = findParent(id, state.mindData);
    if (parent) { parent.children = parent.children.filter(c => c.id !== id); fallbackId = parent.id; }
  });
  state.selectedIds = new Set([fallbackId]);
  markDirtyAndRefresh(renderApp);
  locateFocusedNode(fallbackId, true);
}
