import { state, saveSnapshot, findParent, findNode } from "../core/state.js";
import { PRIORITY_COLORS } from "../data/palettes.js";

let renderAppRef = null;
let pendingFocusNodeId = null;
let isComposingIME = false;

export function renderOutliner(renderApp) {
  renderAppRef = renderApp;
  const outlinerPanel = document.getElementById("outliner-view");
  const outlinerContent = document.getElementById("outliner-content");
  if (!outlinerContent || !outlinerPanel) return;

  // 监听 IME 中文/日文输入法合成状态
  if (!outlinerContent._imeBound) {
    outlinerContent.addEventListener("compositionstart", () => { isComposingIME = true; });
    outlinerContent.addEventListener("compositionend", () => { isComposingIME = false; });
    outlinerContent._imeBound = true;
  }

  renderOutlinerDocument();
}

function flattenOutlinerTree(root) {
  const list = [];
  function traverse(node, parentNode, depth) {
    list.push({ node, parentNode, depth });
    if (node.children && node.children.length > 0 && !node.collapsed) {
      node.children.forEach(child => traverse(child, node, depth + 1));
    }
  }
  if (root.children) {
    root.children.forEach(child => traverse(child, root, 0));
  }
  return list;
}

function renderOutlinerDocument() {
  const outlinerContent = document.getElementById("outliner-content");
  if (!outlinerContent) return;

  // 🌟 输入法处于拼音/选词状态时，绝对禁止触发 DOM 重建与文本覆写
  if (isComposingIME) return;

  const root = state.mindData;
  if (!root) return;

  const activeEl = document.activeElement;
  if (activeEl && outlinerContent.contains(activeEl)) {
    if (activeEl.classList.contains("outliner-text-input")) {
      const row = activeEl.closest(".outliner-row");
      const nodeId = row?.dataset.id;
      const targetNode = findNode(nodeId, root);
      const val = activeEl.innerText.trim();
      if (targetNode && val !== "" && val !== targetNode.text) {
        targetNode.text = val;
        saveSnapshot();
      }
      pendingFocusNodeId = nodeId;
    } else if (activeEl.classList.contains("outliner-title-input")) {
      const val = activeEl.innerText.trim();
      if (val !== "" && val !== root.text) {
        root.text = val;
        saveSnapshot();
      }
    }
  }

  let rootHeader = outlinerContent.querySelector(".outliner-root-wrapper");
  if (!rootHeader) {
    rootHeader = document.createElement("div");
    rootHeader.className = "outliner-root-wrapper";
    rootHeader.innerHTML = `<div class="outliner-title-input" contenteditable="true" spellcheck="false">${root.text || "中心主题"}</div>`;
    
    const titleInput = rootHeader.querySelector(".outliner-title-input");
    titleInput.onblur = () => {
      if (isComposingIME) return;
      const val = titleInput.innerText.trim();
      if (val && val !== root.text) {
        root.text = val;
        saveSnapshot();
        if (renderAppRef) renderAppRef();
      }
    };
    titleInput.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const newChild = { id: "node_" + Date.now(), text: "新主题", collapsed: false, children: [] };
        if (!root.children) root.children = [];
        root.children.unshift(newChild);
        state.selectedIds = new Set([newChild.id]);
        pendingFocusNodeId = newChild.id;
        saveSnapshot();
        if (renderAppRef) renderAppRef();
      }
    };
    outlinerContent.innerHTML = "";
    outlinerContent.appendChild(rootHeader);
  } else {
    const titleInput = rootHeader.querySelector(".outliner-title-input");
    if (titleInput && document.activeElement !== titleInput && !isComposingIME) {
      titleInput.innerText = root.text || "中心主题";
    }
  }

  let listContainer = outlinerContent.querySelector(".outliner-list");
  if (!listContainer) {
    listContainer = document.createElement("div");
    listContainer.className = "outliner-list";
    outlinerContent.appendChild(listContainer);
  }

  // 🌟 动态弹性排版：移除定高裁剪，支持节点多行文本自然包裹
  const flatList = flattenOutlinerTree(root);
  listContainer.innerHTML = "";

  for (let i = 0; i < flatList.length; i++) {
    listContainer.appendChild(createRowElement(flatList[i]));
  }

  if (pendingFocusNodeId) {
    const rowToFocus = listContainer.querySelector(`.outliner-row[data-id="${pendingFocusNodeId}"] .outliner-text-input`);
    if (rowToFocus) {
      rowToFocus.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(rowToFocus);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    pendingFocusNodeId = null;
  }
}

function createRowElement({ node, parentNode, depth }) {
  const row = document.createElement("div");
  row.className = `outliner-row ${state.selectedIds.has(node.id) ? "selected" : ""}`;
  row.style.paddingLeft = `${depth * 22 + 4}px`;
  row.style.minHeight = "34px";
  row.style.height = "auto";
  row.dataset.id = node.id;

  const hasChildren = node.children && node.children.length > 0;
  const collapseIcon = document.createElement("div");
  collapseIcon.className = `outliner-toggle-icon ${hasChildren ? (node.collapsed ? "collapsed" : "expanded") : "leaf"}`;
  collapseIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  collapseIcon.onclick = (e) => {
    e.stopPropagation();
    if (hasChildren) {
      node.collapsed = !node.collapsed;
      saveSnapshot();
      if (renderAppRef) renderAppRef();
    }
  };
  row.appendChild(collapseIcon);

  const bullet = document.createElement("div");
  bullet.className = "outliner-bullet";
  bullet.onclick = (e) => {
    e.stopPropagation();
    state.selectedIds = new Set([node.id]);
    if (renderAppRef) renderAppRef();
  };
  row.appendChild(bullet);

  const badgesWrap = document.createElement("div");
  badgesWrap.className = "outliner-badges";

  if (node.icon) {
    const ic = document.createElement("span");
    ic.className = "outliner-icon-tag";
    ic.innerText = node.icon;
    badgesWrap.appendChild(ic);
  }

  if (node.priority && PRIORITY_COLORS[node.priority]) {
    const p = document.createElement("span");
    p.className = "apple-tag";
    p.style.background = PRIORITY_COLORS[node.priority].bg;
    p.innerText = node.priority;
    badgesWrap.appendChild(p);
  }

  if (node.progress) {
    const prg = document.createElement("span");
    prg.className = "outliner-progress-pill";
    prg.innerText = node.progress;
    badgesWrap.appendChild(prg);
  }

  row.appendChild(badgesWrap);

  const textDiv = document.createElement("div");
  textDiv.className = "outliner-text-input";
  textDiv.contentEditable = "true";
  textDiv.spellcheck = false;
  textDiv.innerText = node.text;

  textDiv.onfocus = () => {
    state.selectedIds = new Set([node.id]);
  };

  textDiv.onblur = () => {
    if (isComposingIME) return;
    const val = textDiv.innerText.trim();
    if (val && val !== node.text) {
      node.text = val;
      saveSnapshot();
      if (renderAppRef) renderAppRef();
    }
  };

  textDiv.onkeydown = (e) => {
    if (isComposingIME) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const newSibling = { id: "node_" + Date.now(), text: "新主题", collapsed: false, children: [] };
      const idx = parentNode.children.findIndex(c => c.id === node.id);
      parentNode.children.splice(idx + 1, 0, newSibling);
      state.selectedIds = new Set([newSibling.id]);
      pendingFocusNodeId = newSibling.id;
      saveSnapshot();
      if (renderAppRef) renderAppRef();
    } else if (e.key === "Tab") {
      e.preventDefault();
      const idx = parentNode.children.findIndex(c => c.id === node.id);
      if (e.shiftKey) {
        const grandParent = findParent(parentNode.id, state.mindData);
        if (grandParent) {
          parentNode.children.splice(idx, 1);
          const pIdx = grandParent.children.findIndex(c => c.id === parentNode.id);
          grandParent.children.splice(pIdx + 1, 0, node);
          pendingFocusNodeId = node.id;
          saveSnapshot();
          if (renderAppRef) renderAppRef();
        }
      } else if (idx > 0) {
        const prevSibling = parentNode.children[idx - 1];
        parentNode.children.splice(idx, 1);
        if (!prevSibling.children) prevSibling.children = [];
        prevSibling.children.push(node);
        prevSibling.collapsed = false;
        pendingFocusNodeId = node.id;
        saveSnapshot();
        if (renderAppRef) renderAppRef();
      }
    } else if (e.key === "Backspace" && textDiv.innerText.trim() === "") {
      e.preventDefault();
      const idx = parentNode.children.findIndex(c => c.id === node.id);
      parentNode.children.splice(idx, 1);
      const fallbackNode = idx > 0 ? parentNode.children[idx - 1] : parentNode;
      state.selectedIds = new Set([fallbackNode.id]);
      pendingFocusNodeId = fallbackNode.id;
      saveSnapshot();
      if (renderAppRef) renderAppRef();
    }
  };

  row.appendChild(textDiv);
  return row;
}
