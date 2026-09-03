import { computeLayout, assignCoordinates, getActiveFontFamily } from "../geometry/layout.js";
import { state, findNode, getActiveTab, getAncestors, findParent } from "../core/state.js";
import { saveSnapshot } from "../core/history.js";
import { camera, locateFocusedNode } from "../core/camera.js";
import { updateMinimap, syncMinimapViewportBox } from "./minimap.js";
import { drawAppleSquircle } from "../geometry/squircle.js";
import { drawNodeContent } from "./node-drawer.js";

const canvas = document.getElementById("canvas-main");
const inlineEditor = document.getElementById("inline-editor");
const viewport = document.getElementById("viewport");

let cachedVpWidth = 0, cachedVpHeight = 0, cachedDpr = 0;

export function resizeCanvas(force = false) {
  if (!canvas || !viewport) return;
  const dpr = window.devicePixelRatio || 1;
  const w = viewport.clientWidth || window.innerWidth;
  const h = viewport.clientHeight || window.innerHeight;

  if (force || w !== cachedVpWidth || h !== cachedVpHeight || dpr !== cachedDpr) {
    cachedVpWidth = w;
    cachedVpHeight = h;
    cachedDpr = dpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
  }
}

export function syncInlineEditorPosition() {
  if (!state.editingNodeId || !inlineEditor || inlineEditor.classList.contains("hidden")) return;
  const node = findNode(state.editingNodeId, state.mindData);
  if (!node || node.x === undefined) return;

  const s = camera.transform.scale;
  const isRoot = node.id === state.focusedRootId;
  const baseSize = node.fontSize ? parseFloat(node.fontSize) : (isRoot ? 15.5 : 13.5);
  const fontSizePx = baseSize * s;
  const lineHeightPx = (node.lineHeight || Math.round(baseSize * 1.35)) * s;

  const padX = (isRoot ? 22 : 14) * s;
  const extraLeft = (node.extraLeftWidth || 0) * s;
  const textScreenX = node.x * s + camera.transform.x + padX + extraLeft;

  const centerY = (node.y + node.height / 2) * s + camera.transform.y;
  const lines = node.lines || String(node.text ?? "").split(/\r?\n/);
  const totalTextH = (lines.length - 1) * lineHeightPx + fontSizePx;
  const textScreenY = centerY - totalTextH / 2 - 2;

  const editorWidth = Math.max((node.textWidth || 60) * s + 16, 80);

  inlineEditor.style.left = `${textScreenX - 4}px`;
  inlineEditor.style.top = `${textScreenY}px`;
  inlineEditor.style.width = `${editorWidth}px`;
  inlineEditor.style.minHeight = `${Math.max(totalTextH + 6, lineHeightPx + 4)}px`;
  inlineEditor.style.fontSize = `${fontSizePx}px`;
  inlineEditor.style.lineHeight = `${lineHeightPx}px`;
}

function appendConnectionPath(path, node, child, lineStyle, isPrimary = false, boxStyle = "squircle") {
  const isDown = child.branchDirection === "down";
  const isLeft = child.branchDirection === "left";
  const isParentUnderline = boxStyle === "underline";
  const isChildUnderline = boxStyle === "underline";

  let x1, y1, x2, y2;
  if (isDown) {
    x1 = node.x + node.width / 2;
    y1 = node.y + node.height;
    x2 = child.x + child.width / 2;
    y2 = child.y;
  } else if (isLeft) {
    x1 = node.x;
    x2 = child.x + child.width;
    y2 = isChildUnderline ? (child.y + child.height) : (child.y + child.height / 2);
    y1 = isParentUnderline ? (node.y + node.height) : (node.y + node.height / 2);
  } else {
    x1 = node.x + node.width;
    x2 = child.x;
    y2 = isChildUnderline ? (child.y + child.height) : (child.y + child.height / 2);
    y1 = isParentUnderline ? (node.y + node.height) : (node.y + node.height / 2);
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  path.moveTo(x1, y1);

  if (lineStyle === "straight") {
    path.lineTo(x2, y2);
  } else if (lineStyle === "sharp-ortho") {
    const mid = isDown ? (y1 + dy * 0.5) : (x1 + dx * 0.5);
    if (isDown) { path.lineTo(x1, mid); path.lineTo(x2, mid); path.lineTo(x2, y2); }
    else { path.lineTo(mid, y1); path.lineTo(mid, y2); path.lineTo(x2, y2); }
  } else {
    if (isDown) {
      path.bezierCurveTo(x1, y1 + dy * 0.45, x2, y2 - dy * 0.45, x2, y2);
    } else {
      path.bezierCurveTo(x1 + dx * 0.45, y1, x2 - dx * 0.45, y2, x2, y2);
    }
  }
}

function isRectVisible(x, y, w, h, vp) {
  return !(x + w < vp.left || x > vp.right || y + h < vp.top || y > vp.bottom);
}

function collectRenderPasses(node, level, state, vpBounds, isRootOfView, primaryBatches, secondaryBatches, visibleNodes) {
  if (!isRootOfView && node.treeMinX !== undefined) {
    const tw = (node.treeMaxX || (node.x + node.width)) - node.treeMinX;
    const th = (node.treeMaxY || (node.y + node.height)) - node.treeMinY;
    if (!isRectVisible(node.treeMinX, node.treeMinY, tw, th, vpBounds)) return;
  }

  const lineStyle = state.lineStyle || "curve";
  const boxStyle = state.boxStyle || "squircle";

  if (node.children && !node.collapsed) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const color = child.colorTheme ? child.colorTheme.line : "#86868b";
      const targetBatches = isRootOfView ? primaryBatches : secondaryBatches;
      let path = targetBatches.get(color);
      if (!path) { path = new Path2D(); targetBatches.set(color, path); }
      appendConnectionPath(path, node, child, lineStyle, isRootOfView, boxStyle);
      collectRenderPasses(child, level + 1, state, vpBounds, false, primaryBatches, secondaryBatches, visibleNodes);
    }
  }

  if (isRootOfView || isRectVisible(node.x, node.y, node.width, node.height, vpBounds)) {
    visibleNodes.push({ node, level, isRootOfView });
  }
}

export function render(state, callbacks) {
  if (!canvas) return;
  resizeCanvas(false);

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const curTab = getActiveTab();
  const currentRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
  const hadLayoutRecalc = Boolean(state.isLayoutDirty !== false || !currentRoot.treeMinX);

  if (hadLayoutRecalc) {
    computeLayout(currentRoot, 0, state.focusedRootId, state.layoutStructure, state.nodeSpacing || "normal");
    assignCoordinates(currentRoot, 0, 0, state.focusedRootId, state.layoutStructure, null, null, state.colorPalette || "apple-classic", state.nodeSpacing || "normal", curTab?.spatialIndex);
    state.isLayoutDirty = false;
  }

  const dpr = window.devicePixelRatio || 1;
  const vpW = cachedVpWidth || window.innerWidth;
  const vpH = cachedVpHeight || window.innerHeight;
  const s = camera.transform.scale;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const vpBounds = {
    left: (-camera.transform.x) / s - 160,
    top: (-camera.transform.y) / s - 160,
    right: (-camera.transform.x + vpW) / s + 160,
    bottom: (-camera.transform.y + vpH) / s + 160
  };

  const primaryBatches = new Map();
  const secondaryBatches = new Map();
  const visibleNodes = [];
  collectRenderPasses(currentRoot, 0, state, vpBounds, true, primaryBatches, secondaryBatches, visibleNodes);

  ctx.save();
  ctx.setTransform(s * dpr, 0, 0, s * dpr, camera.transform.x * dpr, camera.transform.y * dpr);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const primaryStrokeWidth = 1.8 / s;
  const secondaryStrokeWidth = 1.8 / s;
  const nodeBorderWidth = 1.0 / s;

  ctx.lineWidth = secondaryStrokeWidth;
  secondaryBatches.forEach((path, color) => { ctx.strokeStyle = color; ctx.stroke(path); });

  ctx.lineWidth = primaryStrokeWidth;
  primaryBatches.forEach((path, color) => { ctx.strokeStyle = color; ctx.stroke(path); });

  const boxStyle = state.boxStyle || "squircle";
  const isDarkCanvas = ["space-gray", "midnight-abyss", "prussian-navy", "slate-chalkboard", "cyber-violet", "obsidian-coffee"].includes(state.canvasBgColor);
  const enableShadows = !state.isInteracting;

  for (let i = 0; i < visibleNodes.length; i++) {
    const { node, isRootOfView } = visibleNodes[i];
    const isSelected = state.selectedIds.has(node.id);
    const r = isRootOfView ? 14 : 9.5;

    if (boxStyle !== "underline") {
      ctx.save();
      if (boxStyle === "rect") {
        ctx.beginPath();
        ctx.rect(node.x, node.y, node.width, node.height);
      } else {
        drawAppleSquircle(ctx, node.x, node.y, node.width, node.height, r);
      }

      if (isRootOfView) {
        if (enableShadows) {
          ctx.shadowColor = "rgba(0, 113, 227, 0.25)";
          ctx.shadowBlur = 10;
          ctx.shadowOffsetY = 2;
        }

        const grad = ctx.createLinearGradient(node.x, node.y, node.x, node.y + node.height);
        grad.addColorStop(0, "#0077ed");
        grad.addColorStop(1, "#005bb5");
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = nodeBorderWidth;
        ctx.stroke();
      } else if (boxStyle === "solid") {
        if (enableShadows) {
          ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
          ctx.shadowBlur = 5;
          ctx.shadowOffsetY = 1.5;
        }

        ctx.fillStyle = node.colorTheme ? (node.colorTheme.solid || node.colorTheme.border) : "#0071e3";
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.30)";
        ctx.lineWidth = nodeBorderWidth;
        ctx.stroke();
      } else {
        if (!isDarkCanvas && enableShadows) {
          ctx.shadowColor = "rgba(15, 23, 42, 0.04)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 1;
        }

        ctx.fillStyle = isDarkCanvas ? "rgba(30, 36, 48, 0.96)" : "#ffffff";
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = node.colorTheme ? node.colorTheme.border : (isDarkCanvas ? "rgba(255, 255, 255, 0.18)" : "rgba(0, 0, 0, 0.11)");
        ctx.lineWidth = nodeBorderWidth;
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(node.x, node.y + node.height);
      ctx.lineTo(node.x + node.width, node.y + node.height);
      ctx.strokeStyle = node.colorTheme ? node.colorTheme.line : (isDarkCanvas ? "#94a3b8" : "#86868b");
      ctx.lineWidth = isSelected ? (nodeBorderWidth * 2.0) : (nodeBorderWidth * 1.5);
      ctx.stroke();
    }

    if (isSelected && boxStyle !== "underline") {
      ctx.save();
      const offset = 2.5;
      if (boxStyle === "rect") {
        ctx.beginPath();
        ctx.rect(node.x - offset, node.y - offset, node.width + offset * 2, node.height + offset * 2);
      } else {
        drawAppleSquircle(ctx, node.x - offset, node.y - offset, node.width + offset * 2, node.height + offset * 2, r + 2);
      }
      if (enableShadows) {
        ctx.shadowColor = "rgba(0, 113, 227, 0.35)";
        ctx.shadowBlur = 6;
      }
      ctx.strokeStyle = "#0071e3";
      ctx.lineWidth = 1.8 / s;
      ctx.stroke();
      ctx.restore();
    }
  }

  for (let i = 0; i < visibleNodes.length; i++) {
    const { node, level, isRootOfView } = visibleNodes[i];
    drawNodeContent(ctx, node, level, isRootOfView, state);
  }

  ctx.restore();

  if (hadLayoutRecalc) {
    updateMinimap();
    updateBreadcrumbs(state, (id) => {
      state.focusedRootId = id;
      state.isLayoutDirty = true;
      callbacks.onRender();
    });
  } else {
    syncMinimapViewportBox();
  }

  syncInlineEditorPosition();
}

export function updateBreadcrumbs(state, onSelectRoot) {
  const bar = document.getElementById("breadcrumb-bar");
  const linksContainer = document.getElementById("breadcrumb-links");
  const exitBtn = document.getElementById("btn-exit-focus");
  const isFocused = state.focusedRootId && state.focusedRootId !== state.mindData?.id && state.focusedRootId !== "root";

  if (!bar || !linksContainer) return;
  if (!isFocused) {
    bar.classList.add("hidden");
    return;
  }

  const ancestors = getAncestors(state.focusedRootId, state.mindData) || [];
  linksContainer.innerHTML = ancestors.map((node, i) => {
    const isLast = i === ancestors.length - 1;
    return `
      <span class="breadcrumb-item ${isLast ? 'active' : ''}" data-id="${node.id}">${node.text}</span>
      ${!isLast ? '<span class="breadcrumb-sep">/</span>' : ''}
    `;
  }).join("");

  linksContainer.querySelectorAll(".breadcrumb-item").forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      state.isLayoutDirty = true;
      onSelectRoot(item.dataset.id);
    };
  });

  if (exitBtn) {
    exitBtn.onclick = (e) => {
      e.stopPropagation();
      state.isLayoutDirty = true;
      onSelectRoot(state.mindData?.id || "root");
    };
  }

  bar.classList.remove("hidden");
}

export function startEditNode(node, state, onRender, isNewNode = false) {
  if (!node || !viewport || !inlineEditor) return;
  state.editingNodeId = node.id;

  const originalText = String(node.text ?? "");
  const s = camera.transform.scale;
  const isRoot = node.id === state.focusedRootId;
  const baseSize = node.fontSize ? parseFloat(node.fontSize) : (isRoot ? 15.5 : 13.5);
  const fontSizePx = baseSize * s;
  const lineHeightPx = (node.lineHeight || Math.round(baseSize * 1.35)) * s;

  const padX = (isRoot ? 22 : 14) * s;
  const extraLeft = (node.extraLeftWidth || 0) * s;
  const textScreenX = node.x * s + camera.transform.x + padX + extraLeft;
  const centerY = (node.y + node.height / 2) * s + camera.transform.y;
  const lines = node.lines || String(node.text ?? "").split(/\r?\n/);
  const totalTextH = (lines.length - 1) * lineHeightPx + fontSizePx;
  const textScreenY = centerY - totalTextH / 2 - 2;

  const editorWidth = Math.max((node.textWidth || 60) * s + 16, 80);

  inlineEditor.style.left = `${textScreenX - 4}px`;
  inlineEditor.style.top = `${textScreenY}px`;
  inlineEditor.style.width = `${editorWidth}px`;
  inlineEditor.style.minHeight = `${Math.max(totalTextH + 6, lineHeightPx + 4)}px`;
  inlineEditor.style.fontSize = `${fontSizePx}px`;
  inlineEditor.style.lineHeight = `${lineHeightPx}px`;
  inlineEditor.style.fontFamily = getActiveFontFamily();
  inlineEditor.style.fontWeight = String(node.fontWeight || (isRoot ? "700" : "500"));
  inlineEditor.value = node.text || "";
  inlineEditor.classList.remove("hidden");

  inlineEditor.focus();
  inlineEditor.select();

  const autoGrowHeight = () => {
    inlineEditor.style.height = "auto";
    inlineEditor.style.height = `${Math.max(lineHeightPx + 4, inlineEditor.scrollHeight)}px`;
  };
  autoGrowHeight();
  inlineEditor.oninput = autoGrowHeight;

  let finished = false;
  const finish = (nextAction = "none", isCancelled = false) => {
    if (finished) return;
    finished = true;
    inlineEditor.oninput = null;
    inlineEditor.classList.add("hidden");
    const val = inlineEditor.value.trim();
    state.editingNodeId = null;

    // 🌟 按 Esc 取消：完全放弃改动，决不标记脏文件
    if (isCancelled) {
      if (isNewNode) {
        const parent = findParent(node.id, state.mindData);
        if (parent) {
          parent.children = parent.children.filter(c => c.id !== node.id);
          if (state.selectedIds.has(node.id)) {
            state.selectedIds = new Set([parent.id]);
          }
          saveSnapshot();
        }
      }
      onRender();
      return;
    }

    if (val === "" && isNewNode) {
      const parent = findParent(node.id, state.mindData);
      if (parent) {
        parent.children = parent.children.filter(c => c.id !== node.id);
        if (state.selectedIds.has(node.id)) {
          state.selectedIds = new Set([parent.id]);
        }
        saveSnapshot();
        onRender();
        return;
      }
    }

    // 🌟 核心修复：只有文字发生实质性修改，才触发 saveSnapshot 与脏标记！
    if (val !== "" && val !== originalText) {
      node.text = val;
      if (node.id === state.mindData?.id) {
        const curTab = getActiveTab();
        if (curTab && !curTab.filePath) curTab.title = val;
      }
      saveSnapshot();
    }
    onRender();

    if (nextAction === "sibling" && val !== "") {
      const parent = findParent(node.id, state.mindData);
      if (parent) {
        const sib = { id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4), text: "新主题", collapsed: false, children: [] };
        const idx = parent.children.findIndex(c => c.id === node.id);
        parent.children.splice(idx + 1, 0, sib);
        state.selectedIds = new Set([sib.id]);
        saveSnapshot();
        onRender();
        locateFocusedNode(sib.id, false);
        startEditNode(sib, state, onRender, true);
      }
    } else if (nextAction === "child" && val !== "") {
      const child = { id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4), text: "新分支", collapsed: false, children: [] };
      if (!node.children) node.children = [];
      node.children.push(child);
      node.collapsed = false;
      state.selectedIds = new Set([child.id]);
      saveSnapshot();
      onRender();
      locateFocusedNode(child.id, false);
      startEditNode(child, state, onRender, true);
    }
  };

  inlineEditor.onblur = () => finish("none", false);
  inlineEditor.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      if (e.shiftKey) setTimeout(autoGrowHeight, 10);
      else { e.preventDefault(); finish("sibling", false); }
    } else if (e.key === "Tab") {
      e.preventDefault();
      finish("child", false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish("none", true);
    }
  };
}
