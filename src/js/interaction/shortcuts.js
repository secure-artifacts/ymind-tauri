import { state, getPrimarySelectedNode, findNode, findParent, getActiveTab } from "../core/state.js";
import { undo, redo } from "../core/history.js";
import { locateFocusedNode } from "../core/camera.js";
import { syncInspectorUi } from "../ui/inspector.js";
import { addChildNode, addSiblingNode, deleteSelectedNodes } from "./node-actions.js";
import { startEditNode } from "../render/render.js";
import { lockCurrentTab, openVaultSetModal } from "../ui/vault.js";
import { closeTabWithConfirm } from "../core/tab-manager.js";

// 🌟 现代化跨平台判定：优先采用 User-Agent Client Hints 标准，向下兼容 UserAgent 特征匹配
export function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgentData?.platform) {
    return /mac|ios/i.test(navigator.userAgentData.platform);
  }
  return /macintosh|mac os x|macintel|ipad|iphone|ipod/i.test(navigator.userAgent || navigator.platform || "");
}

export function handleArrowNavigation(key, renderApp) {
  let current = getPrimarySelectedNode();
  const root = findNode(state.focusedRootId, state.mindData) || state.mindData;
  if (!root) return;

  if (!current) {
    state.selectedIds = new Set([root.id]);
    renderApp();
    syncInspectorUi();
    locateFocusedNode(root.id, true);
    return;
  }

  const isRoot = current.id === (state.focusedRootId || root.id);
  const parent = findParent(current.id, root);
  const structure = state.layoutStructure || "mindmap";
  let target = null;

  function getSameSideSiblings() {
    if (!parent) return [];
    if (structure === "mindmap" && parent.id === (state.focusedRootId || root.id)) {
      return current.branchDirection === "left"
        ? (parent.leftChildren || parent.children.filter((_, i) => i % 2 === 1))
        : (parent.rightChildren || parent.children.filter((_, i) => i % 2 === 0));
    }
    return parent.children || [];
  }

  if (structure === "org-down") {
    if (isRoot) {
      if (key === "ArrowDown") target = current.children?.[0];
    } else {
      const siblings = parent?.children || [];
      const idx = siblings.findIndex(c => c.id === current.id);
      if (key === "ArrowUp") target = parent;
      else if (key === "ArrowDown") {
        if (current.children && current.children.length > 0 && !current.collapsed) target = current.children[0];
      } else if (key === "ArrowLeft") {
        if (idx > 0) target = siblings[idx - 1];
      } else if (key === "ArrowRight") {
        if (idx >= 0 && idx < siblings.length - 1) target = siblings[idx + 1];
      }
    }
  } else if (structure === "logic-left") {
    if (isRoot) {
      if (key === "ArrowLeft") target = current.children?.[0];
    } else {
      const siblings = parent?.children || [];
      const idx = siblings.findIndex(c => c.id === current.id);
      if (key === "ArrowRight") target = parent;
      else if (key === "ArrowLeft") {
        if (current.children && current.children.length > 0 && !current.collapsed) target = current.children[0];
      } else if (key === "ArrowDown") {
        if (idx >= 0 && idx < siblings.length - 1) target = siblings[idx + 1];
      } else if (key === "ArrowUp") {
        if (idx > 0) target = siblings[idx - 1];
      }
    }
  } else if (structure === "logic-right") {
    if (isRoot) {
      if (key === "ArrowRight") target = current.children?.[0];
    } else {
      const siblings = parent?.children || [];
      const idx = siblings.findIndex(c => c.id === current.id);
      if (key === "ArrowLeft") target = parent;
      else if (key === "ArrowRight") {
        if (current.children && current.children.length > 0 && !current.collapsed) target = current.children[0];
      } else if (key === "ArrowDown") {
        if (idx >= 0 && idx < siblings.length - 1) target = siblings[idx + 1];
      } else if (key === "ArrowUp") {
        if (idx > 0) target = siblings[idx - 1];
      }
    }
  } else {
    if (isRoot) {
      const rightList = current.rightChildren || current.children?.filter((_, i) => i % 2 === 0) || [];
      const leftList = current.leftChildren || current.children?.filter((_, i) => i % 2 === 1) || [];
      if (key === "ArrowRight") target = rightList[0] || current.children?.[0];
      else if (key === "ArrowLeft") target = leftList[0] || current.children?.[0];
      else if (key === "ArrowDown") target = rightList[0] || leftList[0];
      else if (key === "ArrowUp") target = rightList[rightList.length - 1] || leftList[leftList.length - 1];
    } else {
      const isLeft = current.branchDirection === "left";
      const siblings = getSameSideSiblings();
      const idx = siblings.findIndex(c => c.id === current.id);

      if (isLeft) {
        if (key === "ArrowLeft") {
          if (current.children && current.children.length > 0 && !current.collapsed) target = current.children[0];
        } else if (key === "ArrowRight") target = parent;
        else if (key === "ArrowDown") { if (idx >= 0 && idx < siblings.length - 1) target = siblings[idx + 1]; }
        else if (key === "ArrowUp") { if (idx > 0) target = siblings[idx - 1]; }
      } else {
        if (key === "ArrowRight") {
          if (current.children && current.children.length > 0 && !current.collapsed) target = current.children[0];
        } else if (key === "ArrowLeft") target = parent;
        else if (key === "ArrowDown") { if (idx >= 0 && idx < siblings.length - 1) target = siblings[idx + 1]; }
        else if (key === "ArrowUp") { if (idx > 0) target = siblings[idx - 1]; }
      }
    }
  }

  if (target) {
    state.selectedIds = new Set([target.id]);
    renderApp();
    syncInspectorUi();
    locateFocusedNode(target.id, true);
  }
}

export function bindGlobalShortcuts(renderApp, performSave, triggerOpenFile) {
  window.addEventListener("keydown", async (e) => {
    if (e.key === "Escape") {
      const activeWrapper = document.querySelector(".dropdown-wrapper.active");
      if (activeWrapper) {
        activeWrapper.classList.remove("active");
        return;
      }
    }

    if (e.target.closest("input, textarea, select, [contenteditable=true]") || e.target.isContentEditable || state.editingNodeId) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      handleArrowNavigation(e.key, renderApp);
      return;
    }

    const isMac = isApplePlatform();
    const cmd = isMac ? e.metaKey : e.ctrlKey;
    if (cmd && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(renderApp); else undo(renderApp); }
    else if (cmd && e.key.toLowerCase() === "y") { e.preventDefault(); redo(renderApp); }
    else if (cmd && e.key.toLowerCase() === "s") { e.preventDefault(); performSave(); }
    else if (cmd && e.key.toLowerCase() === "o") { e.preventDefault(); triggerOpenFile(); }
    else if (cmd && e.key.toLowerCase() === "w") {
      e.preventDefault();
      const curTab = getActiveTab();
      if (curTab) await closeTabWithConfirm(curTab.id, renderApp, () => {});
    }
    else if (e.altKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      const tab = getActiveTab();
      if (tab?.isEncrypted) lockCurrentTab();
      else openVaultSetModal();
    }
    else if (e.key === "Tab") { e.preventDefault(); addChildNode(renderApp); }
    else if (e.key === "Enter") { e.preventDefault(); addSiblingNode(renderApp); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelectedNodes(renderApp); }
    else if (e.key === "F2" || e.key === " ") {
      e.preventDefault();
      const p = getPrimarySelectedNode();
      if (p) startEditNode(p, state, renderApp, false);
    }
  });
}
