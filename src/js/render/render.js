import { computeLayout, assignCoordinates, measureTextWidth, PRIORITY_COLORS } from "../geometry/layout.js";
import { getAppleSquirclePath } from "../geometry/squircle.js";
import { getLinePathData } from "../geometry/lines.js";
import { state, findNode, saveSnapshot, getActiveTab, getAncestors } from "../core/state.js";
import { camera } from "../core/camera.js";
import { updateMinimap } from "./minimap.js";
import { openNotesDrawer } from "../ui/notes.js";

const layerConnections = document.getElementById("layer-connections");
const layerNodes = document.getElementById("layer-nodes");
const inlineEditor = document.getElementById("inline-editor");
const viewport = document.getElementById("viewport");

let lastClickTime = 0;
let lastClickNodeId = null;

export function updateBreadcrumbs(state, onSelectRoot) {
  const bar = document.getElementById("breadcrumb-bar");
  const linksContainer = document.getElementById("breadcrumb-links");
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
      onSelectRoot(item.dataset.id);
    };
  });

  bar.classList.remove("hidden");
}

export function renderVectorTree(node, level = 0, state, callbacks) {
  const isRootOfView = node.id === state.focusedRootId;
  const isSelected = state.selectedIds.has(node.id);
  const lineStyle = state.lineStyle || "curve";
  const boxStyle = state.boxStyle || "squircle";
  const isRecall = Boolean(state.isRecallMode && !isRootOfView && !node._unmasked);

  if (node.children && !node.collapsed) {
    node.children.forEach(child => {
      const strokeColor = child.colorTheme ? child.colorTheme.line : "#86868b";
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("class", "svg-link");
      path.setAttribute("d", getLinePathData(node, child, isRootOfView, lineStyle));
      path.setAttribute("stroke", strokeColor);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-width", "1.8");
      layerConnections.appendChild(path);
      renderVectorTree(child, level + 1, state, callbacks);
    });
  }

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("class", `svg-node ${isRootOfView ? "root" : `level-${level}`} ${isSelected ? "selected" : ""} ${isRecall ? "recall-masked" : ""}`);
  g.setAttribute("transform", `translate(${node.x}, ${node.y})`);
  g.dataset.id = node.id;

  const r = isRootOfView ? 16 : 12;

  if (isSelected && boxStyle !== "underline") {
    const halo = document.createElementNS("http://www.w3.org/2000/svg", "path");
    halo.setAttribute("d", getAppleSquirclePath(-3, -3, node.width + 6, node.height + 6, r + 2, 0.62));
    halo.setAttribute("fill", "none");
    halo.setAttribute("stroke", "#0071e3");
    halo.setAttribute("stroke-width", "3");
    halo.setAttribute("stroke-opacity", "0.45");
    g.appendChild(halo);
  }

  const bgPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  bgPath.setAttribute("class", "node-bg");

  let pathData = "";
  if (boxStyle === "rect") {
    pathData = `M 0 0 L ${node.width} 0 L ${node.width} ${node.height} L 0 ${node.height} Z`;
  } else if (boxStyle === "underline") {
    pathData = `M 0 ${node.height} L ${node.width} ${node.height}`;
  } else {
    pathData = getAppleSquirclePath(0, 0, node.width, node.height, r, 0.62);
  }
  bgPath.setAttribute("d", pathData);

  if (isRootOfView && boxStyle !== "underline") {
    const rootTheme = node.rootTheme || { bg: "#0071e3", border: "#0062c4" };
    bgPath.setAttribute("fill", rootTheme.bg);
    bgPath.setAttribute("stroke", rootTheme.border);
    bgPath.setAttribute("stroke-width", "1.2");
  } else if (boxStyle === "underline") {
    bgPath.setAttribute("fill", "none");
    bgPath.setAttribute("stroke", node.colorTheme ? node.colorTheme.line : "#86868b");
    bgPath.setAttribute("stroke-width", isSelected ? "3" : "2");
  } else {
    bgPath.setAttribute("fill", "#ffffff");
    bgPath.setAttribute("stroke", node.colorTheme ? node.colorTheme.border : "#cbd5e1");
    bgPath.setAttribute("stroke-width", "1.5");
  }
  g.appendChild(bgPath);

  let currentOffset = isRootOfView ? 24 : 16;

  // 1. 图标
  if (node.icon) {
    const iconText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    iconText.setAttribute("x", currentOffset + 7);
    iconText.setAttribute("y", node.height / 2 + 1);
    iconText.setAttribute("text-anchor", "middle");
    iconText.setAttribute("dominant-baseline", "central");
    iconText.setAttribute("font-size", "14");
    iconText.textContent = node.icon;
    g.appendChild(iconText);
    currentOffset += 22;
  }

  // 2. 优先级
  if (node.priority && PRIORITY_COLORS[node.priority]) {
    const pG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const pRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    pRect.setAttribute("x", currentOffset);
    pRect.setAttribute("y", node.height / 2 - 8);
    pRect.setAttribute("width", 22);
    pRect.setAttribute("height", 16);
    pRect.setAttribute("rx", "4");
    pRect.setAttribute("fill", PRIORITY_COLORS[node.priority].bg);
    pG.appendChild(pRect);

    const pTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    pTxt.setAttribute("x", currentOffset + 11);
    pTxt.setAttribute("y", node.height / 2);
    pTxt.setAttribute("text-anchor", "middle");
    pTxt.setAttribute("dominant-baseline", "central");
    pTxt.setAttribute("fill", "#ffffff");
    pTxt.setAttribute("font-size", "9.5");
    pTxt.setAttribute("font-weight", "700");
    pTxt.textContent = node.priority;
    pG.appendChild(pTxt);
    g.appendChild(pG);
    currentOffset += 26;
  }

  // 3. 进度
  if (node.progress) {
    const prgG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const prgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    prgCircle.setAttribute("cx", currentOffset + 8);
    prgCircle.setAttribute("cy", node.height / 2);
    prgCircle.setAttribute("r", "5.5");
    prgCircle.setAttribute("fill", "#0071e3");
    prgG.appendChild(prgCircle);
    g.appendChild(prgG);
    currentOffset += 20;
  }

  // 4. 备注
  if (node.note) {
    const noteG = document.createElementNS("http://www.w3.org/2000/svg", "text");
    noteG.setAttribute("x", currentOffset + 7);
    noteG.setAttribute("y", node.height / 2 + 1);
    noteG.setAttribute("text-anchor", "middle");
    noteG.setAttribute("dominant-baseline", "central");
    noteG.setAttribute("font-size", "12");
    noteG.setAttribute("cursor", "pointer");
    noteG.textContent = "📝";
    noteG.onclick = (e) => { e.stopPropagation(); openNotesDrawer(node); };
    g.appendChild(noteG);
    currentOffset += 22;
  }

  // 5. 文字排版与字号/粗细 (🌟 行内样式注入，彻底避免 CSS 样式表覆盖)
  const isDarkCanvas = ["space-gray", "midnight-abyss", "prussian-navy", "slate-chalkboard"].includes(state.canvasBgColor);
  let defaultFill = "#0f172a";
  if (boxStyle === "underline") {
    defaultFill = isDarkCanvas ? "#ffffff" : "#0f172a";
  } else if (isRootOfView) {
    defaultFill = "#ffffff";
  } else {
    defaultFill = isDarkCanvas ? "#f8fafc" : "#0f172a";
  }

  const finalFill = node.textColor && node.textColor !== "default" ? node.textColor : defaultFill;
  const fontSize = node.fontSize ? parseFloat(node.fontSize) : (isRootOfView ? 15.5 : 13.5);
  const fontWeight = node.fontWeight || (isRootOfView ? "700" : (level === 1 ? "600" : "500"));

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("class", "node-text");
  text.setAttribute("x", currentOffset + node.textWidth / 2);
  text.setAttribute("y", node.height / 2);
  text.setAttribute("text-anchor", "middle");
  
  // 同时注入 style 与 attribute 确保最高特异性
  text.style.fontSize = fontSize + "px";
  text.style.fontWeight = String(fontWeight);
  text.style.fill = finalFill;
  text.setAttribute("font-size", fontSize + "px");
  text.setAttribute("font-weight", String(fontWeight));
  text.setAttribute("fill", finalFill);

  text.textContent = node.text;
  g.appendChild(text);
  currentOffset += node.textWidth + 8;

  // 6. 标签
  if (node.tags && node.tags.length > 0) {
    node.tags.forEach(t => {
      const tagW = measureTextWidth(t, 9.5, "600") + 12;
      const tagG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const tagRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      tagRect.setAttribute("x", currentOffset);
      tagRect.setAttribute("y", node.height / 2 - 7);
      tagRect.setAttribute("width", tagW);
      tagRect.setAttribute("height", 14);
      tagRect.setAttribute("rx", "4");
      tagRect.setAttribute("fill", "#f1f5f9");
      tagRect.setAttribute("stroke", "#e2e8f0");
      tagRect.setAttribute("stroke-width", "0.8");
      tagG.appendChild(tagRect);

      const tagTxt = document.createElementNS("http://www.w3.org/2000/svg", "text");
      tagTxt.setAttribute("x", currentOffset + tagW / 2);
      tagTxt.setAttribute("y", node.height / 2);
      tagTxt.setAttribute("text-anchor", "middle");
      tagTxt.setAttribute("dominant-baseline", "central");
      tagTxt.setAttribute("fill", "#475569");
      tagTxt.style.fontSize = "9.5px";
      tagTxt.style.fontWeight = "600";
      tagTxt.textContent = t;
      tagG.appendChild(tagTxt);
      g.appendChild(tagG);
      currentOffset += tagW + 4;
    });
  }

  // 7. 折叠徽标
  if (node.children && node.children.length > 0 && !isRootOfView) {
    const badgeG = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const badgePosX = (node.branchDirection === "left") ? 0 : node.width;
    badgeG.setAttribute("transform", `translate(${badgePosX}, ${node.height / 2})`);

    const badgeCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    badgeCircle.setAttribute("r", 8);
    badgeCircle.setAttribute("fill", "#ffffff");
    badgeCircle.setAttribute("stroke", node.colorTheme ? node.colorTheme.badge : "#86868b");
    badgeG.appendChild(badgeCircle);

    const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    badgeText.setAttribute("fill", node.colorTheme ? node.colorTheme.badge : "#86868b");
    badgeText.style.fontSize = "9.5px";
    badgeText.style.fontWeight = "700";
    badgeText.setAttribute("text-anchor", "middle");
    badgeText.setAttribute("dominant-baseline", "central");
    badgeText.textContent = node.collapsed ? node.children.length : "-";
    badgeG.appendChild(badgeText);

    badgeG.addEventListener("mousedown", (e) => {
      e.stopPropagation(); e.preventDefault();
      node.collapsed = !node.collapsed;
      saveSnapshot();
      callbacks.onRender();
    });
    g.appendChild(badgeG);
  }

  // 点击事件与记忆掩码揭晓
  g.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    if (state.isRecallMode && isRecall) {
      node._unmasked = true;
      callbacks.onRender();
      return;
    }

    const now = Date.now();
    if (now - lastClickTime < 350 && lastClickNodeId === node.id) {
      lastClickTime = 0; lastClickNodeId = null;
      startEditNode(node, state, callbacks.onRender);
      return;
    }
    lastClickTime = now;
    lastClickNodeId = node.id;

    callbacks.onSelect(node.id);
  });

  layerNodes.appendChild(g);
}

export function startEditNode(node, state, onRender) {
  if (!node || !viewport || !inlineEditor) return;
  state.editingNodeId = node.id;

  const nodeEl = document.querySelector(`.svg-node[data-id="${node.id}"]`);
  if (!nodeEl) return;

  const vpRect = viewport.getBoundingClientRect();
  const nodeRect = nodeEl.getBoundingClientRect();

  inlineEditor.style.left = `${nodeRect.left - vpRect.left}px`;
  inlineEditor.style.top = `${nodeRect.top - vpRect.top}px`;
  inlineEditor.style.width = `${Math.max(nodeRect.width, 96)}px`;
  inlineEditor.style.height = `${nodeRect.height}px`;
  inlineEditor.style.fontSize = `${(node.id === state.focusedRootId ? 15.5 : 13.5) * camera.transform.scale}px`;
  inlineEditor.style.fontWeight = String(node.fontWeight || (node.id === state.focusedRootId ? "700" : "500"));
  inlineEditor.value = node.text;
  inlineEditor.classList.remove("hidden");

  setTimeout(() => { inlineEditor.focus(); inlineEditor.select(); }, 10);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    inlineEditor.classList.add("hidden");
    const val = inlineEditor.value.trim();
    if (val !== "") {
      node.text = val;
      if (node.id === state.mindData?.id) {
        const curTab = getActiveTab();
        if (curTab && !curTab.filePath) curTab.title = val;
      }
      saveSnapshot();
    }
    state.editingNodeId = null;
    onRender();
  };

  inlineEditor.onblur = finish;
  inlineEditor.onkeydown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") finish();
    else if (e.key === "Escape") { inlineEditor.value = node.text; finish(); }
  };
}

export function render(state, callbacks) {
  const currentRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
  if (layerConnections) layerConnections.innerHTML = "";
  if (layerNodes) layerNodes.innerHTML = "";

  computeLayout(currentRoot, 0, state.focusedRootId, state.layoutStructure, state.nodeSpacing || "normal");
  assignCoordinates(currentRoot, 0, 0, state.focusedRootId, state.layoutStructure, "right", null, state.colorPalette || "apple-classic", state.nodeSpacing || "normal");
  renderVectorTree(currentRoot, 0, state, callbacks);

  callbacks.onRequestTransform();
  updateMinimap();
  updateBreadcrumbs(state, (id) => {
    state.focusedRootId = id;
    callbacks.onRender();
  });
}
