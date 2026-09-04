import { addChildNode, addSiblingNode } from "../interaction/node-actions.js";
let gDropIndicator = null;
export function setDropIndicator(ind) { gDropIndicator = ind; }

import { computeLayout, assignCoordinates, getActiveFontFamily } from "../geometry/layout.js";
import { state, findNode, getActiveTab, getAncestors, findParent } from "../core/state.js";
import { saveSnapshot } from "../core/history.js";
import { camera, locateFocusedNode, smartAdaptiveCenter } from "../core/camera.js";
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

// 统一的 padX 与几何定位基准计算，确保输入框无论缩放、拖拽绝不跳动
function getNodeEditorMetrics(node, s) {
  const isRoot = node.id === state.focusedRootId;
  const baseSize = node.fontSize ? parseFloat(node.fontSize) : (isRoot ? 15.5 : 13.5);
  const fontSizePx = baseSize * s;
  const lineHeightPx = (node.lineHeight || Math.round(baseSize * 1.35)) * s;

  const padX = Math.max(10, Math.round((node.width - (node.contentWidth || 0)) / 2));
  const currentOffset = padX + (node.extraLeftWidth || 0);
  // 与 node-drawer.js 的 textCenterX 严格保持同一条中心线
  const textCenterWorldX = node.x + currentOffset + (node.textWidth || 0) / 2;
  const textCenterScreenX = textCenterWorldX * s + camera.transform.x;

  const editorWidth = Math.max((node.textWidth || 60) * s + 24, 90);
  const textScreenX = textCenterScreenX - editorWidth / 2;

  const centerY = (node.y + node.height / 2) * s + camera.transform.y;
  const lines = node.lines || String(node.text ?? "").split(/\r?\n/);
  const totalTextH = (lines.length - 1) * lineHeightPx + fontSizePx;
  const textScreenY = centerY - totalTextH / 2 - 2;

  return { fontSizePx, lineHeightPx, textScreenX, textScreenY, editorWidth, totalTextH };
}

export function syncInlineEditorPosition() {
  if (!state.editingNodeId || !inlineEditor || inlineEditor.classList.contains("hidden")) return;
  const node = findNode(state.editingNodeId, state.mindData);
  if (!node || node.x === undefined) return;

  const s = camera.transform.scale;
  const m = getNodeEditorMetrics(node, s);

  inlineEditor.style.left = `${m.textScreenX - 4}px`;
  inlineEditor.style.top = `${m.textScreenY}px`;
  inlineEditor.style.width = `${m.editorWidth}px`;
  inlineEditor.style.minHeight = `${Math.max(m.totalTextH + 6, m.lineHeightPx + 4)}px`;
  inlineEditor.style.fontSize = `${m.fontSizePx}px`;
  inlineEditor.style.lineHeight = `${m.lineHeightPx}px`;
  inlineEditor.style.textAlign = "center";
}

function appendConnectionPath(path, node, child, lineStyle, isPrimary = false, boxStyle = "squircle", isUltraLOD = false) {
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

  if (isUltraLOD || lineStyle === "straight") {
    path.lineTo(x2, y2);
  } else if (lineStyle === "rounded-ortho") {
    const dirX = Math.sign(dx) || 1;
    const dirY = Math.sign(dy) || 1;
    if (isDown) {
      const midY = y1 + dy * 0.5;
      const r = Math.min(10, Math.abs(dx) / 2, Math.abs(dy) / 2);
      if (r < 1 || dx === 0) {
        path.lineTo(x1, midY); path.lineTo(x2, midY); path.lineTo(x2, y2);
      } else {
        path.lineTo(x1, midY - dirY * r);
        path.arcTo(x1, midY, x1 + dirX * r, midY, r);
        path.lineTo(x2 - dirX * r, midY);
        path.arcTo(x2, midY, x2, midY + dirY * r, r);
        path.lineTo(x2, y2);
      }
    } else {
      const midX = x1 + dx * 0.5;
      const r = Math.min(10, Math.abs(dx) / 2, Math.abs(dy) / 2);
      if (r < 1 || dy === 0) {
        path.lineTo(midX, y1); path.lineTo(midX, y2); path.lineTo(x2, y2);
      } else {
        path.lineTo(midX - dirX * r, y1);
        path.arcTo(midX, y1, midX, y1 + dirY * r, r);
        path.lineTo(midX, y2 - dirY * r);
        path.arcTo(midX, y2, midX + dirX * r, y2, r);
        path.lineTo(x2, y2);
      }
    }
  } else if (lineStyle === "sharp-ortho") {
    const mid = isDown ? (y1 + dy * 0.5) : (x1 + dx * 0.5);
    if (isDown) { path.lineTo(x1, mid); path.lineTo(x2, mid); path.lineTo(x2, y2); }
    else { path.lineTo(mid, y1); path.lineTo(mid, y2); path.lineTo(x2, y2); }
  } else if (lineStyle === "arc-corner") {
    if (isDown) {
      path.bezierCurveTo(x1, y1 + dy * 0.7, x2, y1 + dy * 0.3, x2, y2);
    } else {
      path.bezierCurveTo(x1 + dx * 0.7, y1, x2 - dx * 0.3, y2, x2, y2);
    }
  } else {
    if (isDown) {
      path.bezierCurveTo(x1, y1 + dy * 0.5, x2, y2 - dy * 0.5, x2, y2);
    } else {
      path.bezierCurveTo(x1 + dx * 0.5, y1, x2 - dx * 0.5, y2, x2, y2);
    }
  }
}

function isRectVisible(x, y, w, h, vp) {
  return !(x + w < vp.left || x > vp.right || y + h < vp.top || y > vp.bottom);
}

function collectRenderPasses(node, level, state, vpBounds, isRootOfView, primaryBatches, secondaryBatches, visibleNodes, isUltraLOD) {
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
      appendConnectionPath(path, node, child, lineStyle, isRootOfView, boxStyle, isUltraLOD);
      collectRenderPasses(child, level + 1, state, vpBounds, false, primaryBatches, secondaryBatches, visibleNodes, isUltraLOD);
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
  const isUltraLOD = s < 0.25;

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
  collectRenderPasses(currentRoot, 0, state, vpBounds, true, primaryBatches, secondaryBatches, visibleNodes, isUltraLOD);

  ctx.save();
  ctx.setTransform(s * dpr, 0, 0, s * dpr, camera.transform.x * dpr, camera.transform.y * dpr);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const primaryStrokeWidth = 3.0 / s;
  const secondaryStrokeWidth = 2.2 / s;
  const nodeBorderWidth = 2.0 / s;

  ctx.lineWidth = secondaryStrokeWidth;
  secondaryBatches.forEach((path, color) => { ctx.strokeStyle = color; ctx.stroke(path); });

  ctx.lineWidth = primaryStrokeWidth;
  primaryBatches.forEach((path, color) => { ctx.strokeStyle = color; ctx.stroke(path); });

  const boxStyle = state.boxStyle || "squircle";
  const isGlobalDark = document.documentElement.getAttribute("data-theme") === "dark";
  const isDarkCanvas = isGlobalDark || ["space-gray", "midnight-abyss", "prussian-navy", "slate-chalkboard", "cyber-violet", "obsidian-coffee"].includes(state.canvasBgColor);
  const enableShadows = !state.isInteracting && visibleNodes.length < 1500 && s >= 0.35;

  for (let i = 0; i < visibleNodes.length; i++) {
    const { node, isRootOfView } = visibleNodes[i];
    const isSelected = state.selectedIds.has(node.id);
    const r = isRootOfView ? 14 : 9.5;

    if (isUltraLOD && !isRootOfView) {
      ctx.fillStyle = node.colorTheme ? (node.colorTheme.solid || node.colorTheme.border) : "#94a3b8";
      ctx.fillRect(node.x, node.y, node.width, node.height);
      continue;
    }

    if (boxStyle !== "underline") {
      ctx.save();
      if (boxStyle === "rect" || s < 0.35) {
        ctx.beginPath();
        ctx.rect(node.x, node.y, node.width, node.height);
      } else {
        drawAppleSquircle(ctx, node.x, node.y, node.width, node.height, r);
      }

      if (isRootOfView) {
        if (enableShadows) {
          ctx.shadowColor = "rgba(0, 113, 227, 0.25)";
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 2;
        }

        const grad = ctx.createLinearGradient(node.x, node.y, node.x, node.y + node.height);
        grad.addColorStop(0, "#0077ed");
        grad.addColorStop(1, "#005bb5");
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.50)";
        ctx.lineWidth = 2.4 / s;
        ctx.stroke();
      } else if (boxStyle === "solid") {
        if (enableShadows) {
          ctx.shadowColor = "rgba(15, 23, 42, 0.08)";
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 1.5;
        }

        ctx.fillStyle = node.colorTheme ? (node.colorTheme.solid || node.colorTheme.border) : "#0071e3";
        ctx.fill();

        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.40)";
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
        ctx.strokeStyle = node.colorTheme ? node.colorTheme.border : (isDarkCanvas ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.18)");
        ctx.lineWidth = nodeBorderWidth;
        ctx.stroke();
      }
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(node.x, node.y + node.height);
      ctx.lineTo(node.x + node.width, node.y + node.height);
      ctx.strokeStyle = node.colorTheme ? node.colorTheme.line : (isDarkCanvas ? "#94a3b8" : "#86868b");
      const defaultUnderlineWidth = isRootOfView ? (2.8 / s) : (2.2 / s);
      ctx.lineWidth = isSelected ? (3.6 / s) : defaultUnderlineWidth;
      ctx.stroke();
    }

    if (isSelected && boxStyle !== "underline") {
      ctx.save();
      const offset = 2.5;
      if (boxStyle === "rect" || s < 0.35) {
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
      ctx.lineWidth = 2.6 / s;
      ctx.stroke();
      ctx.restore();
    }
  }

  for (let i = 0; i < visibleNodes.length; i++) {
    const { node, level, isRootOfView } = visibleNodes[i];
    drawNodeContent(ctx, node, level, isRootOfView, state, s);
  }

  // 🌟 绘制跨层级改父级（矩形光环）或兄弟插入指示线
  if (gDropIndicator) {
    ctx.save();
    if (gDropIndicator.type === "reparent") {
      // 目标父节点吸附高亮
      ctx.strokeStyle = "#0071e3";
      ctx.lineWidth = 2.5 / s;
      drawAppleSquircle(ctx, gDropIndicator.x - 3, gDropIndicator.y - 3, gDropIndicator.width + 6, gDropIndicator.height + 6, 12);
      ctx.fillStyle = "rgba(0, 113, 227, 0.12)";
      ctx.fill();
      ctx.stroke();
    } else {
      // 兄弟插入定位线
      ctx.strokeStyle = "#0071e3";
      ctx.lineWidth = Math.max(2.5, 3.2 / s);
      ctx.lineCap = "round";
      ctx.shadowColor = "rgba(0, 113, 227, 0.5)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(gDropIndicator.x1, gDropIndicator.y1);
      ctx.lineTo(gDropIndicator.x2, gDropIndicator.y2);
      ctx.stroke();

      ctx.fillStyle = "#0071e3";
      ctx.beginPath();
      ctx.arc(gDropIndicator.x1, gDropIndicator.y1, 4.5 / s, 0, Math.PI * 2);
      ctx.arc(gDropIndicator.x2, gDropIndicator.y2, 4.5 / s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();

  updateBreadcrumbs(state, (id) => {
    state.focusedRootId = id;
    state.isLayoutDirty = true;
    callbacks.onRender();
    smartAdaptiveCenter(null, true);
  });

  if (hadLayoutRecalc) {
    updateMinimap();
  } else {
    syncMinimapViewportBox();
  }

  syncInlineEditorPosition();
}

export function updateBreadcrumbs(state, onSelectRoot) {
  const bar = document.getElementById("breadcrumb-bar");
  const linksContainer = document.getElementById("breadcrumb-links");
  const homeIcon = document.getElementById("breadcrumb-home-icon");
  const exitBtn = document.getElementById("btn-exit-focus");
  
  const rootId = state.mindData?.id || "root";
  const isFocused = Boolean(state.focusedRootId && state.focusedRootId !== rootId);

  if (!bar || !linksContainer) return;
  
  if (!isFocused) {
    bar.classList.add("hidden");
    return;
  }

  const ancestors = getAncestors(state.focusedRootId, state.mindData) || [];
  
  linksContainer.innerHTML = ancestors.map((node, i) => {
    const isLast = i === ancestors.length - 1;
    const rawTitle = (node.icon ? node.icon + " " : "") + (node.text || "分支");
    const safeTitle = String(rawTitle).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
    return `
      <span class="breadcrumb-item ${isLast ? 'active' : ''}" data-id="${node.id}" title="${safeTitle}">${safeTitle}</span>
      ${!isLast ? '<span class="breadcrumb-sep">›</span>' : ''}
    `;
  }).join("");

  linksContainer.querySelectorAll(".breadcrumb-item:not(.active)").forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      onSelectRoot(item.dataset.id);
    };
  });

  if (homeIcon) {
    homeIcon.onclick = (e) => {
      e.stopPropagation();
      onSelectRoot(rootId);
    };
  }

  if (exitBtn) {
    exitBtn.onclick = (e) => {
      e.stopPropagation();
      onSelectRoot(rootId);
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
  const m = getNodeEditorMetrics(node, s);

  inlineEditor.style.left = `${m.textScreenX - 4}px`;
  inlineEditor.style.top = `${m.textScreenY}px`;
  inlineEditor.style.width = `${m.editorWidth}px`;
  inlineEditor.style.minHeight = `${Math.max(m.totalTextH + 6, m.lineHeightPx + 4)}px`;
  inlineEditor.style.fontSize = `${m.fontSizePx}px`;
  inlineEditor.style.lineHeight = `${m.lineHeightPx}px`;
  inlineEditor.style.fontFamily = getActiveFontFamily();
  inlineEditor.style.fontWeight = String(node.fontWeight || (isRoot ? "700" : "500"));
  inlineEditor.style.fontStyle = node.fontStyle || "normal";
  inlineEditor.style.textDecoration = node.textDecoration || "none";
  inlineEditor.maxLength = 500;
  inlineEditor.value = (node.text || "").slice(0, 500);
  inlineEditor.classList.remove("hidden");

  inlineEditor.focus();
  inlineEditor.select();

  const autoGrowHeight = () => {
    inlineEditor.style.height = "auto";
    inlineEditor.style.height = `${Math.max(m.lineHeightPx + 4, inlineEditor.scrollHeight)}px`;
  };
  autoGrowHeight();
  inlineEditor.oninput = autoGrowHeight;

  let finished = false;
  const finish = (nextAction = "none", isCancelled = false) => {
    if (finished) return;
    finished = true;
    inlineEditor.oninput = null;
    inlineEditor.classList.add("hidden");
    
    // 🌟 致命崩溃 Bug 修复：将 const 改为可重新赋值的 let，防止溢出截取时 TypeError
    let val = inlineEditor.value.trim();
    state.editingNodeId = null;

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

    if (val.length > 500) val = val.slice(0, 500);
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
      addSiblingNode(onRender);
    } else if (nextAction === "child" && val !== "") {
      addChildNode(onRender);
    }
  };

  inlineEditor.onblur = () => finish("none", false);
  inlineEditor.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      if (e.shiftKey) setTimeout(autoGrowHeight, 10);
      else { e.preventDefault(); finish("none", false); }
    } else if (e.key === "Tab") {
      e.preventDefault();
      finish("child", false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish("none", true);
    }
  };
}
