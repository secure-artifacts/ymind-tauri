import { state, saveSnapshot, findNode, findParent } from '../core/state.js';
import { smartCenterOnSelectedNode } from '../core/camera.js';

const menu = document.getElementById("apple-context-menu");
let targetNodeId = null;

export function initContextMenu(renderApp) {
  window.addEventListener("contextmenu", (e) => {
    if (e.target && (e.target.closest("input, textarea, select, [contenteditable=true]") || e.target.isContentEditable)) return;
    e.preventDefault();

    const nodeDom = e.target.closest(".svg-node");
    if (!nodeDom) {
      if (menu) menu.classList.add("hidden");
      return;
    }

    targetNodeId = nodeDom.dataset.id;
    state.selectedIds = new Set([targetNodeId]);
    renderApp();

    if (!menu) return;

    const menuWidth = 190;
    const menuHeight = 220;
    let posX = e.clientX;
    let posY = e.clientY;

    if (posX + menuWidth > window.innerWidth) posX = window.innerWidth - menuWidth - 10;
    if (posY + menuHeight > window.innerHeight) posY = window.innerHeight - menuHeight - 10;

    menu.style.left = `${posX}px`;
    menu.style.top = `${posY}px`;
    menu.classList.remove("hidden");
  });

  window.addEventListener("mousedown", (e) => {
    if (menu && !menu.contains(e.target)) {
      menu.classList.add("hidden");
    }
  });

  if (menu) {
    menu.querySelectorAll(".context-menu-item").forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        menu.classList.add("hidden");
        const action = item.dataset.action;
        handleMenuAction(action, renderApp);
      };
    });
  }
}

function handleMenuAction(action, renderApp) {
  const node = findNode(targetNodeId, state.mindData);
  if (!node) return;

  if (action === "copy") {
    state.clipboardBranch = JSON.parse(JSON.stringify(node));
  } else if (action === "cut") {
    if (node.id === state.focusedRootId) return;
    state.clipboardBranch = JSON.parse(JSON.stringify(node));
    const parent = findParent(node.id, state.mindData);
    if (parent) {
      parent.children = parent.children.filter(c => c.id !== node.id);
      state.selectedIds = new Set([parent.id]);
      saveSnapshot();
      renderApp();
    }
  } else if (action === "paste") {
    if (state.clipboardBranch) {
      const cloned = JSON.parse(JSON.stringify(state.clipboardBranch));
      function refreshIds(n) {
        n.id = "node_" + Math.random().toString(36).substr(2, 9);
        if (n.children) n.children.forEach(refreshIds);
      }
      refreshIds(cloned);
      if (!node.children) node.children = [];
      node.children.push(cloned);
      node.collapsed = false;
      state.selectedIds = new Set([cloned.id]);
      saveSnapshot();
      renderApp();
    }
  } else if (action === "toggle-collapse") {
    if (node.children && node.children.length > 0) {
      node.collapsed = !node.collapsed;
      saveSnapshot();
      renderApp();
    }
  } else if (action === "focus") {
    state.focusedRootId = node.id;
    renderApp();
    smartCenterOnSelectedNode(state, true);
  } else if (action === "delete") {
    if (node.id === state.focusedRootId) return;
    if (state.floatingNodes && state.floatingNodes.some(f => f.id === node.id)) {
      state.floatingNodes = state.floatingNodes.filter(f => f.id !== node.id);
      state.selectedIds = new Set([state.focusedRootId]);
      saveSnapshot();
      renderApp();
      return;
    }
    const parent = findParent(node.id, state.mindData);
    if (parent) {
      parent.children = parent.children.filter(c => c.id !== node.id);
      state.selectedIds = new Set([parent.id]);
      saveSnapshot();
      renderApp();
    }
  }
}
