import { computeLayout, assignCoordinates, measureTextWidth, PRIORITY_COLORS } from "../geometry/layout.js";
import { getAppleSquirclePath, getHandDrawnBoxPath } from "../geometry/squircle.js";
import { getLinePathData } from "../geometry/lines.js";
import { findNode, getAncestors, saveSnapshot, getActiveTab } from "../core/state.js";
import { camera, stopAllCameraAnimations } from "../core/camera.js";


// 🌟 计算世界坐标系下的视口视锥范围（带 Overscan 缓冲区）
export function getCullBounds(viewportEl, cam, overscan = 800) {
  if (!viewportEl) return null;
  const s = cam.scale || 1;
  const w = viewportEl.offsetWidth || window.innerWidth;
  const h = viewportEl.offsetHeight || window.innerHeight;
  const pad = overscan / s;
  return {
    left: (-cam.x) / s - pad,
    top: (-cam.y) / s - pad,
    right: (w - cam.x) / s + pad,
    bottom: (h - cam.y) / s + pad
  };
}

function isBoxOverlap(minX, minY, maxX, maxY, b) {
  if (!b) return true;
  return !(maxX < b.left || minX > b.right || maxY < b.top || minY > b.bottom);
}

const layerConnections = document.getElementById("layer-connections");
const layerNodes = document.getElementById("layer-nodes");
const breadcrumbBar = document.getElementById("breadcrumb-bar");
const breadcrumbLinks = document.getElementById("breadcrumb-links");
const inlineEditor = document.getElementById("inline-editor");
const viewport = document.getElementById("viewport");

let lastClickTime = 0;
let lastClickNodeId = null;

const DARK_THEME_CLASSES = [
  "theme-space-gray", "theme-midnight-abyss", "theme-blueprint-pro",
  "theme-slate-chalkboard", "theme-carbon-fiber", "theme-cyber-matrix",
  "theme-aurora-borealis", "theme-midnight", "theme-graphite",
  "theme-blueprint", "theme-chalkboard", "theme-carbon"
];

function createHaloElement(id, w, h, boxStyle, isRootOfView) {
  const r = isRootOfView ? 16 : 12;
  const halo = document.createElementNS("http://www.w3.org/2000/svg", "path");
  halo.setAttribute("class", "node-select-halo");
  let haloPath = "";
  if (boxStyle === "rect") {
    haloPath = `M -3 -3 L ${w + 3} -3 L ${w + 3} ${h + 3} L -3 ${h + 3} Z`;
  } else if (boxStyle === "hand-drawn") {
    haloPath = getHandDrawnBoxPath(w + 6, h + 6, id + "_halo");
    halo.setAttribute("transform", "translate(-3, -3)");
  } else {
    haloPath = getAppleSquirclePath(-3, -3, w + 6, h + 6, r + 2, 0.62);
  }
  halo.setAttribute("d", haloPath);
  halo.setAttribute("fill", "none");
  halo.setAttribute("stroke", "#0071e3");
  halo.setAttribute("stroke-width", "3");
  halo.setAttribute("stroke-opacity", "0.45");
  return halo;
}

export function updateSelectionStyles(state) {
  if (!state || !state.selectedIds) return;
  document.querySelectorAll(".svg-node").forEach(nodeEl => {
    const id = nodeEl.dataset.id;
    const isSelected = state.selectedIds.has(id);
    nodeEl.classList.toggle("selected", isSelected);
    
    let halo = nodeEl.querySelector(".node-select-halo");
    const boxStyle = state.boxStyle || "squircle";
    if (isSelected && !halo && boxStyle !== "underline") {
      const isRootOfView = id === state.focusedRootId;
      const w = parseFloat(nodeEl.dataset.w || 90);
      const h = parseFloat(nodeEl.dataset.h || 30);
      halo = createHaloElement(id, w, h, boxStyle, isRootOfView);
      nodeEl.insertBefore(halo, nodeEl.firstChild);
    } else if (!isSelected && halo) {
      halo.remove();
    }
  });
}

export function renderVectorTree(node, level = 0, state, callbacks, isDarkTheme = false, cullBounds = null) {
  // 🌟 分支级包围盒判定：如果整棵子树都在视口外部，直接 $O(1)$ 瞬时跳过！
  if (cullBounds && node.treeMinX !== undefined) {
    if (!isBoxOverlap(node.treeMinX, node.treeMinY, node.treeMaxX, node.treeMaxY, cullBounds)) {
      return;
    }
  }
  const isRootOfView = node.id === state.focusedRootId;
  const isSelected = state.selectedIds.has(node.id);
  const lineStyle = state.lineStyle || "curve";
  const boxStyle = state.boxStyle || "squircle";

  if (node.children && !node.collapsed) {
    const isFountainPen = lineStyle === "hand-drawn";
    const strokeWidth = isFountainPen ? (isRootOfView ? "3.2" : "2.4") : (isRootOfView ? "2.5" : "1.8");

    node.children.forEach(child => {
      // 🌟 原子级判定：子分支整体在视口安全范围内时，连线与节点一同渲染
      const childTreeInView = !cullBounds || (child.treeMinX === undefined) || isBoxOverlap(child.treeMinX, child.treeMinY, child.treeMaxX, child.treeMaxY, cullBounds);
      if (childTreeInView) {
        const strokeColor = child.colorTheme ? child.colorTheme.line : "#86868b";
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("class", `svg-link ${isFountainPen ? "fountain-pen-link" : ""}`);
        path.setAttribute("d", getLinePathData(node, child, isRootOfView, lineStyle));
        path.setAttribute("stroke", strokeColor);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("stroke-width", strokeWidth);
        layerConnections.appendChild(path);

        renderVectorTree(child, level + 1, state, callbacks, isDarkTheme, cullBounds);
      }
    });
  }

  // Node is rendered synchronously with parent link
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  const isRecallMasked = state.isRecallMode && node.id !== state.focusedRootId && !node._recallRevealed;
  const isFloating = (state.floatingNodes || []).some(f => f.id === node.id || findNode(node.id, f));
  g.setAttribute("class", `svg-node ${isFloating ? "is-floating" : ""} ${isRootOfView ? "root" : `level-${level}`} ${isSelected ? "selected" : ""} box-${boxStyle} ${isRecallMasked ? "recall-masked" : ""}`);
  g.setAttribute("transform", `translate(${node.x}, ${node.y})`);
  g.dataset.id = node.id;
  g.dataset.w = node.width;
  g.dataset.h = node.height;

  const r = isRootOfView ? 16 : 12;

  if (isSelected && boxStyle !== "underline") {
    const halo = createHaloElement(node.id, node.width, node.height, boxStyle, isRootOfView);
    g.appendChild(halo);
  }

  const bgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  bgPath.setAttribute("class", `node-bg ${boxStyle === "hand-drawn" ? "sketch-box" : ""}`);

  let pathData = "";
  if (boxStyle === "rect") {
    pathData = `M 0 0 L ${node.width} 0 L ${node.width} ${node.height} L 0 ${node.height} Z`;
  } else if (boxStyle === "underline") {
    pathData = `M 0 ${node.height} L ${node.width} ${node.height}`;
  } else if (boxStyle === "hand-drawn") {
    pathData = getHandDrawnBoxPath(node.width, node.height, node.id);
  } else {
    pathData = getAppleSquirclePath(0, 0, node.width, node.height, r, 0.62);
  }
  bgPath.setAttribute("d", pathData);

  if (isRootOfView) {
    const rootTheme = node.rootTheme || { bg: "#0071e3", border: "#0062c4", text: "#ffffff" };
    bgPath.setAttribute("fill", rootTheme.bg);
    bgPath.setAttribute("stroke", rootTheme.border);
    bgPath.setAttribute("stroke-width", boxStyle === "hand-drawn" ? "2.2" : "1.2");
  } else if (boxStyle === "solid") {
    const solidColor = node.colorTheme ? (node.colorTheme.solid || node.colorTheme.border) : "#0071e3";
    bgPath.setAttribute("fill", solidColor);
    bgPath.setAttribute("stroke", solidColor);
    bgPath.setAttribute("stroke-width", "1");
  } else if (boxStyle === "underline") {
    bgPath.setAttribute("fill", "none");
    bgPath.setAttribute("stroke", node.colorTheme ? node.colorTheme.line : "#86868b");
    bgPath.setAttribute("stroke-width", isSelected ? "3" : "2");
  } else {
    bgPath.setAttribute("fill", isDarkTheme ? "#1c1c1e" : "#ffffff");
    bgPath.setAttribute("stroke", node.colorTheme ? node.colorTheme.border : (isDarkTheme ? "#3f3f46" : "#cbd5e1"));
    bgPath.setAttribute("stroke-width", boxStyle === "hand-drawn" ? "2" : "1.5");
  }
  g.appendChild(bgPath);

  let currentOffset = isRootOfView ? 24 : 16;

  // 📝 渲染便签备注标识
  if (node.note) {
    const noteBadge = document.createElementNS("http://www.w3.org/2000/svg", "text");
    noteBadge.setAttribute("x", currentOffset + 9);
    noteBadge.setAttribute("y", node.height / 2);
    noteBadge.setAttribute("text-anchor", "middle");
    noteBadge.setAttribute("dominant-baseline", "central");
    noteBadge.setAttribute("font-size", "12");
    noteBadge.setAttribute("class", "node-note-badge");
    noteBadge.textContent = "📝";
    noteBadge.style.cursor = "pointer";
    noteBadge.onclick = (e) => {
      e.stopPropagation();
      window.__OPEN_NODE_NOTES__ ? window.__OPEN_NODE_NOTES__(node) : null;
    };
    g.appendChild(noteBadge);
    currentOffset += 20;
  }

  // 🌟 渲染 200+ 专属图标
  if (node.icon) {
    const iconText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    iconText.setAttribute("x", currentOffset + 9);
    iconText.setAttribute("y", node.height / 2);
    iconText.setAttribute("text-anchor", "middle");
    iconText.setAttribute("dominant-baseline", "central");
    iconText.setAttribute("font-size", isRootOfView ? "15" : "13");
    iconText.textContent = node.icon;
    g.appendChild(iconText);
    currentOffset += 22;
  }

  if (node.priority && PRIORITY_COLORS[node.priority]) {
    const pConf = PRIORITY_COLORS[node.priority];
    const pBadge = document.createElementNS("http://www.w3.org/2000/svg", "path");
    pBadge.setAttribute("d", getAppleSquirclePath(currentOffset, node.height / 2 - 8, 20, 16, 4.5, 0.6));
    pBadge.setAttribute("fill", pConf.bg);
    pBadge.setAttribute("stroke", "none");
    g.appendChild(pBadge);

    const pText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    pText.setAttribute("x", currentOffset + 10);
    pText.setAttribute("y", node.height / 2);
    pText.setAttribute("text-anchor", "middle");
    pText.setAttribute("dominant-baseline", "central");
    pText.setAttribute("fill", pConf.text);
    pText.setAttribute("font-size", "9.5");
    pText.setAttribute("font-weight", "800");
    pText.textContent = node.priority;
    g.appendChild(pText);

    currentOffset += 25;
  }

  if (node.progress) {
    const cx = currentOffset + 7;
    const cy = node.height / 2;
    const prgR = 6.5;

    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.setAttribute("cx", cx);
    bgCircle.setAttribute("cy", cy);
    bgCircle.setAttribute("r", prgR);
    bgCircle.setAttribute("fill", "none");
    bgCircle.setAttribute("stroke", isDarkTheme ? "#3a3a3c" : "#e2e8f0");
    bgCircle.setAttribute("stroke-width", "2.5");
    g.appendChild(bgCircle);

    const val = parseInt(node.progress, 10) || 0;
    const circ = 2 * Math.PI * prgR;
    const strokeDash = (val / 100) * circ;

    const fgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    fgCircle.setAttribute("cx", cx);
    fgCircle.setAttribute("cy", cy);
    fgCircle.setAttribute("r", prgR);
    fgCircle.setAttribute("fill", "none");
    fgCircle.setAttribute("stroke", val === 100 ? "#34c759" : "#0071e3");
    fgCircle.setAttribute("stroke-width", "2.5");
    fgCircle.setAttribute("stroke-dasharray", `${strokeDash} ${circ}`);
    fgCircle.setAttribute("transform", `rotate(-90 ${cx} ${cy})`);
    g.appendChild(fgCircle);

    currentOffset += 20;
  }

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("class", `node-text ${boxStyle === "hand-drawn" ? "hand-drawn-font" : ""}`);
  text.setAttribute("x", currentOffset + node.textWidth / 2);
  text.setAttribute("y", node.height / 2);
  text.setAttribute("text-anchor", "middle");

  let textColor = isDarkTheme ? "#f4f4f5" : "#1e293b";
  if (isRootOfView || boxStyle === "solid") textColor = "#ffffff";
  text.setAttribute("fill", textColor);
  text.textContent = node.text;
  g.appendChild(text);

  currentOffset += node.textWidth + 8;

  if (node.tags && node.tags.length > 0) {
    node.tags.forEach(tag => {
      const tagW = measureTextWidth(tag, 9.5, "600") + 16;
      const tagPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      tagPath.setAttribute("d", getAppleSquirclePath(currentOffset, node.height / 2 - 7.5, tagW, 15, 4.5, 0.6));
      tagPath.setAttribute("fill", (boxStyle === "solid" || isRootOfView) ? "rgba(255,255,255,0.2)" : (isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)"));
      tagPath.setAttribute("stroke", (boxStyle === "solid" || isRootOfView) ? "rgba(255,255,255,0.35)" : (isDarkTheme ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)"));
      tagPath.setAttribute("stroke-width", "0.5");
      g.appendChild(tagPath);

      const tagText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tagText.setAttribute("x", currentOffset + tagW / 2);
      tagText.setAttribute("y", node.height / 2);
      tagText.setAttribute("text-anchor", "middle");
      tagText.setAttribute("dominant-baseline", "central");
      tagText.setAttribute("fill", (boxStyle === "solid" || isRootOfView) ? "#ffffff" : (isDarkTheme ? "#a1a1aa" : "#64748b"));
      tagText.setAttribute("font-size", "9");
      tagText.setAttribute("font-weight", "600");
      tagText.textContent = tag;
      g.appendChild(tagText);

      currentOffset += tagW + 4;
    });
  }

  if (node.children && node.children.length > 0 && !isRootOfView) {
    const badgeG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    badgeG.setAttribute("class", "svg-badge");
    const badgePosX = (node.branchDirection === "left") ? 0 : node.width;
    badgeG.setAttribute("transform", `translate(${badgePosX}, ${node.height / 2})`);

    const badgeCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    badgeCircle.setAttribute("r", 8.5);
    badgeCircle.setAttribute("stroke", node.colorTheme ? node.colorTheme.badge : "#86868b");
    badgeG.appendChild(badgeCircle);

    const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    badgeText.setAttribute("fill", node.colorTheme ? node.colorTheme.badge : "#86868b");
    badgeText.textContent = node.collapsed ? node.children.length : "-";
    badgeG.appendChild(badgeText);

    badgeG.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      node.collapsed = !node.collapsed;
      saveSnapshot();
      callbacks.onRender();
    });

    g.appendChild(badgeG);
  }

  g.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    window.getSelection()?.removeAllRanges();

    if (state.isRecallMode && node.id !== state.focusedRootId) {
      node._recallRevealed = !node._recallRevealed;
      callbacks.onRender();
      return;
    }

    const floatingRoot = (state.floatingNodes || []).find(f => f.id === node.id || findNode(node.id, f));

    if (floatingRoot) {
      let isDragging = false;
      const startClient = { x: e.clientX, y: e.clientY };
      const origX = floatingRoot.customX || floatingRoot.x || 300;
      const origY = floatingRoot.customY || floatingRoot.y || -150;

      function onMove(me) {
        const dx = (me.clientX - startClient.x) / camera.transform.scale;
        const dy = (me.clientY - startClient.y) / camera.transform.scale;
        if (!isDragging && Math.hypot(me.clientX - startClient.x, me.clientY - startClient.y) > 4) {
          isDragging = true;
          document.body.style.cursor = "grabbing";
        }
        if (isDragging) {
          floatingRoot.customX = origX + dx;
          floatingRoot.customY = origY + dy;
          callbacks.onRender();
        }
      }

      function onUp(ue) {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        if (isDragging) {
          saveSnapshot();
          callbacks.onRender();
        } else {
          const now = Date.now();
          if (now - lastClickTime < 380 && lastClickNodeId === node.id) {
            lastClickTime = 0;
            lastClickNodeId = null;
            startEditNode(node, state, callbacks.onRender);
            return;
          }
          lastClickTime = now;
          lastClickNodeId = node.id;
          callbacks.onSelect(node.id, ue.shiftKey || ue.ctrlKey || ue.metaKey);
        }
      }

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return;
    }

    const isAlreadySoloSelected = state.selectedIds.size === 1 && state.selectedIds.has(node.id);
    const now = Date.now();
    if (now - lastClickTime < 380 && lastClickNodeId === node.id) {
      lastClickTime = 0;
      lastClickNodeId = null;
      startEditNode(node, state, callbacks.onRender);
      return;
    }
    lastClickTime = now;
    lastClickNodeId = node.id;

    if (!isAlreadySoloSelected || e.shiftKey || e.ctrlKey || e.metaKey) {
      callbacks.onSelect(node.id, e.shiftKey || e.ctrlKey || e.metaKey);
    }
  });

  layerNodes.appendChild(g);
}

export function startEditNode(node, state, onRender) {
  if (!node || !viewport || !inlineEditor) return;
  state.editingNodeId = node.id;
  stopAllCameraAnimations();

  const nodeEl = document.querySelector(`.svg-node[data-id="${node.id}"]`);
  if (!nodeEl) return;

  const vpRect = viewport.getBoundingClientRect();
  const nodeRect = nodeEl.getBoundingClientRect();

  inlineEditor.style.left = `${nodeRect.left - vpRect.left}px`;
  inlineEditor.style.top = `${nodeRect.top - vpRect.top}px`;
  inlineEditor.style.width = `${Math.max(nodeRect.width, 96)}px`;
  inlineEditor.style.height = `${nodeRect.height}px`;
  inlineEditor.style.fontSize = `${(node.id === state.focusedRootId ? 15.5 : 13.5) * camera.transform.scale}px`;
  inlineEditor.value = node.text;
  inlineEditor.classList.remove("hidden");

  setTimeout(() => {
    inlineEditor.focus();
    inlineEditor.select();
  }, 10);

  inlineEditor.onmousedown = (e) => e.stopPropagation();
  inlineEditor.onclick = (e) => e.stopPropagation();
  inlineEditor.ondblclick = (e) => e.stopPropagation();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    inlineEditor.classList.add("hidden");
    const val = inlineEditor.value.trim();
    if (val !== "") {
      node.text = val;
      if (node.id === state.mindData?.id) {
        const currentTab = getActiveTab();
        if (currentTab && !currentTab.filePath) currentTab.title = val;
      }
      saveSnapshot();
    }
    state.editingNodeId = null;
    onRender();
  };

  inlineEditor.onblur = finish;
  inlineEditor.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      inlineEditor.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      inlineEditor.value = node.text;
      inlineEditor.blur();
    }
  };
  inlineEditor.onkeyup = (e) => e.stopPropagation();
}

export function renderBreadcrumb(state, onSelectRoot) {
  const rootId = state.mindData?.id || "root";
  if (state.focusedRootId === rootId) {
    breadcrumbBar.classList.add("hidden");
    return;
  }
  breadcrumbBar.classList.remove("hidden");
  const path = getAncestors(state.focusedRootId, state.mindData);
  breadcrumbLinks.innerHTML = "";
  if (!path) return;

  path.forEach((item, index) => {
    const span = document.createElement("span");
    span.className = "breadcrumb-item";
    span.innerText = item.text;
    span.onclick = () => onSelectRoot(item.id);
    breadcrumbLinks.appendChild(span);

    if (index < path.length - 1) {
      const sep = document.createElement("span");
      sep.className = "breadcrumb-sep";
      sep.innerText = "›";
      breadcrumbLinks.appendChild(sep);
    }
  });
}

export function render(state, callbacks) {
  const currentRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
  layerConnections.innerHTML = "";
  layerNodes.innerHTML = "";

  const isDarkTheme = DARK_THEME_CLASSES.some(c => document.body.classList.contains(c));
  const cullBounds = getCullBounds(viewport, camera.transform);

  computeLayout(currentRoot, 0, state.focusedRootId, state.layoutStructure);
  assignCoordinates(currentRoot, 0, 0, state.focusedRootId, state.layoutStructure, "right", null, state.colorPalette || "apple-classic");
  renderVectorTree(currentRoot, 0, state, callbacks, isDarkTheme, cullBounds);

  if (state.floatingNodes && state.floatingNodes.length > 0) {
    state.floatingNodes.forEach(fNode => {
      computeLayout(fNode, 0, fNode.id, state.layoutStructure);
      assignCoordinates(fNode, fNode.customX || 350, fNode.customY || -120, fNode.id, state.layoutStructure, "right", null, state.colorPalette || "apple-classic");
      renderVectorTree(fNode, 0, state, callbacks, isDarkTheme, cullBounds);
    });
  }

  renderBreadcrumb(state, callbacks.onSelectRoot);
  callbacks.onRequestTransform();
}