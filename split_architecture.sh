#!/usr/bin/env bash
set -e

echo "🚀 [1/5] 创建新目录结构..."
mkdir -p src/js/interaction

echo "⚡ [2/5] 抽离 history.js (撤销/重做与历史快照)..."
cat << 'FILE_EOF' > src/js/core/history.js
import { state, getActiveTab } from "./state.js";

function sanitizeTreeForHistory(node) {
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
    textColor: node.textColor || null,
    children: node.children ? node.children.map(sanitizeTreeForHistory).filter(Boolean) : []
  };
}

export function saveSnapshot() {
  const tab = getActiveTab();
  if (!tab || !tab.mindData) return;
  tab.isDirty = true;
  state.isLayoutDirty = true;

  if (!tab.history) { tab.history = []; tab.historyIndex = -1; }
  if (tab.historyIndex < tab.history.length - 1) {
    tab.history.splice(tab.historyIndex + 1);
  }
  tab.history.push(sanitizeTreeForHistory(tab.mindData));
  if (tab.history.length > 50) {
    tab.history.shift();
    tab.historyIndex = tab.history.length - 1;
  } else {
    tab.historyIndex++;
  }
}

export function undo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.history || tab.historyIndex <= 0) return;
  tab.historyIndex--;
  tab.mindData = sanitizeTreeForHistory(tab.history[tab.historyIndex]);
  tab.isDirty = true;
  state.isLayoutDirty = true;
  if (renderCallback) renderCallback();
}

export function redo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.history || tab.historyIndex >= tab.history.length - 1) return;
  tab.historyIndex++;
  tab.mindData = sanitizeTreeForHistory(tab.history[tab.historyIndex]);
  tab.isDirty = true;
  state.isLayoutDirty = true;
  if (renderCallback) renderCallback();
}

export { sanitizeTreeForHistory };
FILE_EOF

echo "🎨 [3/5] 抽离 node-drawer.js (节点视觉元素渲染)..."
cat << 'FILE_EOF' > src/js/render/node-drawer.js
import { drawAppleSquircle } from "../geometry/squircle.js";
import { measureTextWidth, PRIORITY_COLORS, getActiveFontFamily } from "../geometry/layout.js";

export function drawNodeContent(ctx, node, level, isRootOfView, state) {
  const fontFam = getActiveFontFamily();
  let currentOffset = isRootOfView ? 22 : 14;
  const centerY = node.y + node.height / 2;

  // 1. 图标
  if (node.icon) {
    ctx.font = `14px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.icon, node.x + currentOffset + 7, centerY + 1.2);
    currentOffset += 22;
  }

  // 2. 优先级 P1 ~ P4
  if (node.priority && PRIORITY_COLORS[node.priority]) {
    const pColor = PRIORITY_COLORS[node.priority].bg;
    ctx.beginPath();
    drawAppleSquircle(ctx, node.x + currentOffset, centerY - 8, 22, 16, 4);
    ctx.fillStyle = pColor;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 9.5px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.priority, node.x + currentOffset + 11, centerY);
    currentOffset += 26;
  }

  // 3. 进度环
  if (node.progress) {
    const prgVal = parseInt(node.progress, 10) || 0;
    const angle = (prgVal / 100) * (Math.PI * 2);
    const prgX = node.x + currentOffset + 8;

    ctx.beginPath();
    ctx.arc(prgX, centerY, 5.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 113, 227, 0.18)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (angle > 0) {
      ctx.beginPath();
      ctx.arc(prgX, centerY, 5.5, -Math.PI / 2, -Math.PI / 2 + angle);
      ctx.strokeStyle = prgVal === 100 ? "#34c759" : "#0071e3";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    currentOffset += 20;
  }

  // 4. 备注指示符
  if (node.note) {
    ctx.font = `12px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📝", node.x + currentOffset + 7, centerY + 1);
    currentOffset += 22;
  }

  // 5. 核心文字（支持多行与主动回忆遮罩）
  const boxStyle = state.boxStyle || "squircle";
  const isDarkCanvas = ["space-gray", "midnight-abyss", "prussian-navy", "slate-chalkboard", "cyber-violet", "obsidian-coffee"].includes(state.canvasBgColor);
  const defaultFill = (isRootOfView || boxStyle === "solid" || isDarkCanvas) ? "#ffffff" : "#1d1d1f";
  const finalFill = node.textColor && node.textColor !== "default" ? node.textColor : defaultFill;
  const fontSize = node.fontSize ? parseFloat(node.fontSize) : (isRootOfView ? 15.5 : 13.5);
  const fontWeight = node.fontWeight || (isRootOfView ? "700" : (level === 1 ? "600" : "500"));

  ctx.fillStyle = finalFill;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = node.lines || String(node.text ?? "").split(/\r?\n/);
  const lineHeight = node.lineHeight || Math.round(fontSize * 1.35);
  const totalH = (lines.length - 1) * lineHeight;
  const textStartY = centerY - totalH / 2;

  const isRecall = Boolean(state.isRecallMode && !isRootOfView && !node._unmasked);
  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const lineText = lines[lIdx];
    const curLineY = textStartY + lIdx * lineHeight;
    if (isRecall) {
      ctx.save();
      ctx.filter = "blur(4.5px)";
      ctx.globalAlpha = 0.28;
      ctx.fillText(lineText, node.x + currentOffset + node.textWidth / 2, curLineY);
      ctx.restore();
    } else {
      ctx.fillText(lineText, node.x + currentOffset + node.textWidth / 2, curLineY);
    }
  }

  currentOffset += node.textWidth + 8;

  // 6. 节点标签
  if (node.tags && Array.isArray(node.tags) && node.tags.length > 0) {
    for (let tIdx = 0; tIdx < node.tags.length; tIdx++) {
      const tagText = String(node.tags[tIdx]);
      const tagW = measureTextWidth(tagText, 9.5, "600") + 12;
      ctx.beginPath();
      drawAppleSquircle(ctx, node.x + currentOffset, centerY - 7, tagW, 14, 4);
      ctx.fillStyle = boxStyle === "solid" ? "rgba(255,255,255,0.2)" : (isDarkCanvas ? "rgba(255,255,255,0.1)" : "#f1f5f9");
      ctx.fill();
      ctx.strokeStyle = boxStyle === "solid" ? "rgba(255,255,255,0.3)" : (isDarkCanvas ? "rgba(255,255,255,0.15)" : "#e2e8f0");
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = (boxStyle === "solid" || isDarkCanvas) ? "#ffffff" : "#475569";
      ctx.font = `600 9.5px ${fontFam}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tagText, node.x + currentOffset + tagW / 2, centerY);
      currentOffset += tagW + 4;
    }
  }

  // 7. 折叠徽章
  if (node.children && node.children.length > 0 && !isRootOfView) {
    const badgeX = (node.branchDirection === "left") ? node.x : (node.x + node.width);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.06)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;

    ctx.beginPath();
    ctx.arc(badgeX, centerY, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = isDarkCanvas ? "#1e293b" : "#ffffff";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = node.colorTheme ? node.colorTheme.badge : "#86868b";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = node.colorTheme ? node.colorTheme.badge : "#86868b";
    ctx.font = `bold 9.5px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.collapsed ? String(node.children.length) : "−", badgeX, centerY + 0.4);
    ctx.restore();
  }
}
FILE_EOF

echo "📐 [4/5] 抽离 node-actions.js (结构化节点操作命令)..."
cat << 'FILE_EOF' > src/js/interaction/node-actions.js
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
FILE_EOF

echo "⌨️ [5/5] 抽离 shortcuts.js (键盘导航与快捷键中心)..."
cat << 'FILE_EOF' > src/js/interaction/shortcuts.js
import { state, getPrimarySelectedNode, findNode, findParent, getActiveTab } from "../core/state.js";
import { undo, redo } from "../core/history.js";
import { locateFocusedNode } from "../core/camera.js";
import { syncInspectorUi } from "../ui/inspector.js";
import { addChildNode, addSiblingNode, deleteSelectedNodes } from "./node-actions.js";
import { startEditNode } from "../render/render.js";
import { lockCurrentTab, openVaultSetModal } from "../ui/vault.js";
import { closeTabWithConfirm } from "../core/tab-manager.js";

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

    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const cmd = isMac ? e.metaKey : e.ctrlKey;
    if (cmd && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(renderApp); else undo(renderApp); }
    else if (cmd && e.key.toLowerCase() === "y") { e.preventDefault(); redo(renderApp); }
    else if (cmd && e.key.toLowerCase() === "s") { e.preventDefault(); performSave(); }
    else if (cmd && e.key.toLowerCase() === "o") { e.preventDefault(); triggerOpenFile(); }
    else if (cmd && e.key.toLowerCase() === "w") {
      e.preventDefault();
      const curTab = getActiveTab();
      if (curTab) await closeTabWithConfirm(curTab.id, renderApp, window.__SHOW_HOME__ || (() => {}));
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
FILE_EOF

chmod +x split_architecture.sh
./split_architecture.sh
rm split_architecture.sh
echo "✨ 重构模块已生成完成！"
