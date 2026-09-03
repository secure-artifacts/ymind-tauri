import { state, saveSnapshot, findNode, findParent, getActiveTab } from "../core/state.js";
import { smartCenterOnSelectedNode, camera } from "../core/camera.js";
import { bus, EVENTS } from "../core/event-bus.js";

const menu = document.getElementById("apple-context-menu");
let targetNodeId = null;

export function initContextMenu(renderApp) {
  window.addEventListener("contextmenu", (e) => {
    const isInput = e.target && (e.target.closest("input, textarea, select, [contenteditable=true]") || e.target.isContentEditable);
    if (!isInput) {
      e.preventDefault();
    } else {
      return;
    }

    const vp = document.getElementById("viewport");
    if (!vp || !vp.contains(e.target)) {
      if (menu) menu.classList.add("hidden");
      return;
    }

    const rect = vp.getBoundingClientRect();
    const s = camera.transform.scale;
    const worldX = (e.clientX - rect.left - camera.transform.x) / s;
    const worldY = (e.clientY - rect.top - camera.transform.y) / s;

    const curTab = getActiveTab();
    let node = curTab?.spatialIndex?.pickNode(worldX, worldY, 8);
    if (!node) {
      const root = findNode(state.focusedRootId, state.mindData) || state.mindData;
      function walk(n) {
        if (n.x !== undefined && n.y !== undefined) {
          if (worldX >= n.x - 8 && worldX <= n.x + n.width + 8 &&
              worldY >= n.y - 8 && worldY <= n.y + n.height + 8) {
            node = n;
          }
        }
        if (n.children && !n.collapsed) {
          for (let i = 0; i < n.children.length; i++) walk(n.children[i]);
        }
      }
      walk(root);
    }

    if (!node) {
      if (menu) menu.classList.add("hidden");
      return;
    }

    targetNodeId = node.id;
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
      bus.emit(EVENTS.RENDER_APP);
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
      bus.emit(EVENTS.RENDER_APP);
    }
  } else if (action === "toggle-collapse") {
    if (node.children && node.children.length > 0) {
      node.collapsed = !node.collapsed;
      saveSnapshot();
      bus.emit(EVENTS.RENDER_APP);
    }
  } else if (action === "focus") {
    state.focusedRootId = (state.focusedRootId === node.id) ? (state.mindData?.id || "root") : node.id;
    state.isLayoutDirty = true;
    bus.emit(EVENTS.RENDER_APP);
    smartCenterOnSelectedNode(state, true);
  } else if (action === "delete") {
    if (node.id === state.focusedRootId) return;
    const parent = findParent(node.id, state.mindData);
    if (parent) {
      parent.children = parent.children.filter(c => c.id !== node.id);
      state.selectedIds = new Set([parent.id]);
      saveSnapshot();
      bus.emit(EVENTS.RENDER_APP);
    }
  }
}
