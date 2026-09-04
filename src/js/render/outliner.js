import { state, findParent, findNode } from "../core/state.js";
import { executeCommand, COMMANDS } from "../core/history.js";
import { PRIORITY_COLORS } from "../data/palettes.js";
import { openNotesDrawer } from "../ui/notes.js";

let renderAppRef = null;
let isComposingIME = false;

const ROW_HEIGHT = 34;
const POOL_SIZE = 45;

let flatVisibleList = [];
let domPool = [];
let isPoolInitialized = false;
let rafScrollId = null;
let pendingFocusNodeId = null;

export function renderOutliner(renderApp) {
  renderAppRef = renderApp;
  const outlinerPanel = document.getElementById("outliner-view");
  const outlinerContent = document.getElementById("outliner-content");
  if (!outlinerContent || !outlinerPanel) return;

  if (!outlinerPanel._vScrollBound) {
    outlinerPanel.addEventListener("scroll", onScrollDebounced, { passive: true });
    outlinerContent.addEventListener("compositionstart", () => { isComposingIME = true; });
    outlinerContent.addEventListener("compositionend", () => { isComposingIME = false; });
    outlinerPanel._vScrollBound = true;
  }

  const root = state.mindData;
  if (!root) return;

  flatVisibleList = collectVisibleNodesFast(root);
  setupVirtualContainer(outlinerContent, flatVisibleList.length);
  initDomPool(outlinerContent);
  updateVisibleSlice();

  // 🌟 处理连续回车创建后的无缝聚焦
  if (pendingFocusNodeId) {
    const targetSlot = domPool.find(p => p.activeNodeId === pendingFocusNodeId);
    if (targetSlot) {
      targetSlot.textDiv.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(targetSlot.textDiv);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    pendingFocusNodeId = null;
  }
}

function collectVisibleNodesFast(root) {
  const list = [];
  if (!root.children || root.children.length === 0) return list;

  const stack = [];
  for (let i = root.children.length - 1; i >= 0; i--) {
    stack.push({ node: root.children[i], parentNode: root, depth: 0 });
  }

  while (stack.length > 0) {
    const item = stack.pop();
    list.push(item);
    const n = item.node;

    if (n.children && n.children.length > 0 && !n.collapsed) {
      for (let j = n.children.length - 1; j >= 0; j--) {
        stack.push({ node: n.children[j], parentNode: n, depth: item.depth + 1 });
      }
    }
  }
  return list;
}

function setupVirtualContainer(content, totalCount) {
  let rootHeader = content.querySelector(".outliner-root-wrapper");
  if (!rootHeader) {
    rootHeader = document.createElement("div");
    rootHeader.className = "outliner-root-wrapper";
    const safeTitle = String(state.mindData?.text || "中心主题").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
    rootHeader.innerHTML = `<div class="outliner-title-input" contenteditable="true" spellcheck="false">${safeTitle}</div>`;
    content.innerHTML = "";
    content.appendChild(rootHeader);

    const titleInput = rootHeader.querySelector(".outliner-title-input");
    titleInput.onblur = () => {
      if (isComposingIME) return;
      const val = titleInput.innerText.trim();
      if (val && val !== state.mindData.text) {
        state.mindData.text = val;
        if (renderAppRef) renderAppRef();
      }
    };
  } else {
    const titleInput = rootHeader.querySelector(".outliner-title-input");
    if (titleInput && document.activeElement !== titleInput && !isComposingIME) {
      titleInput.innerText = state.mindData?.text || "中心主题";
    }
  }

  let listContainer = content.querySelector(".outliner-list-virtual");
  if (!listContainer) {
    listContainer = document.createElement("div");
    listContainer.className = "outliner-list-virtual";
    listContainer.style.position = "relative";
    listContainer.style.width = "100%";
    content.appendChild(listContainer);
  }
  listContainer.style.height = `${Math.max(100, totalCount * ROW_HEIGHT)}px`;
}

function initDomPool(content) {
  const listContainer = content.querySelector(".outliner-list-virtual");
  if (!listContainer || isPoolInitialized) return;

  listContainer.innerHTML = "";
  domPool = [];

  for (let i = 0; i < POOL_SIZE; i++) {
    const row = document.createElement("div");
    row.className = "outliner-row";
    row.style.position = "absolute";
    row.style.left = "0";
    row.style.right = "0";
    row.style.height = `${ROW_HEIGHT}px`;
    row.style.display = "none";

    const toggleIcon = document.createElement("div");
    toggleIcon.className = "outliner-toggle-icon";
    toggleIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    row.appendChild(toggleIcon);

    const bullet = document.createElement("div");
    bullet.className = "outliner-bullet";
    row.appendChild(bullet);

    const badges = document.createElement("div");
    badges.className = "outliner-badges";
    row.appendChild(badges);

    const textDiv = document.createElement("div");
    textDiv.className = "outliner-text-input";
    textDiv.contentEditable = "true";
    textDiv.spellcheck = false;
    row.appendChild(textDiv);

    const noteTag = document.createElement("span");
    noteTag.className = "outliner-note-indicator hidden";
    noteTag.innerText = "📝 备注";
    row.appendChild(noteTag);

    listContainer.appendChild(row);

    domPool.push({
      el: row,
      toggleIcon,
      bullet,
      badges,
      textDiv,
      noteTag,
      activeNodeId: null
    });
  }

  isPoolInitialized = true;
}

function onScrollDebounced() {
  if (rafScrollId) return;
  rafScrollId = requestAnimationFrame(() => {
    updateVisibleSlice();
    rafScrollId = null;
  });
}

function updateVisibleSlice() {
  if (isComposingIME) return;
  const panel = document.getElementById("outliner-view");
  if (!panel || domPool.length === 0) return;

  const scrollTop = panel.scrollTop;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const totalVisible = flatVisibleList.length;

  for (let slot = 0; slot < POOL_SIZE; slot++) {
    const poolItem = domPool[slot];
    const dataIndex = startIndex + slot;

    if (dataIndex >= totalVisible) {
      poolItem.el.style.display = "none";
      continue;
    }

    const { node, parentNode, depth } = flatVisibleList[dataIndex];
    const rowEl = poolItem.el;

    rowEl.style.display = "flex";
    rowEl.style.transform = `translate3d(0, ${dataIndex * ROW_HEIGHT}px, 0)`;
    rowEl.style.paddingLeft = `${depth * 24 + 10}px`;
    rowEl.classList.toggle("selected", state.selectedIds.has(node.id));
    rowEl.dataset.id = node.id;
    poolItem.activeNodeId = node.id;

    const hasChildren = node.children && node.children.length > 0;
    poolItem.toggleIcon.className = `outliner-toggle-icon ${hasChildren ? (node.collapsed ? "collapsed" : "expanded") : "leaf"}`;
    poolItem.toggleIcon.onclick = (e) => {
      e.stopPropagation();
      if (hasChildren) {
        node.collapsed = !node.collapsed;
        flatVisibleList = collectVisibleNodesFast(state.mindData);
        setupVirtualContainer(document.getElementById("outliner-content"), flatVisibleList.length);
        updateVisibleSlice();
      }
    };

    poolItem.bullet.onclick = (e) => {
      e.stopPropagation();
      state.selectedIds = new Set([node.id]);
      updateVisibleSlice();
      if (renderAppRef) renderAppRef();
    };

    poolItem.badges.innerHTML = "";
    if (node.icon) {
      const ic = document.createElement("span");
      ic.className = "outliner-icon-tag";
      ic.innerText = node.icon;
      poolItem.badges.appendChild(ic);
    }
    if (node.priority && PRIORITY_COLORS[node.priority]) {
      const p = document.createElement("span");
      p.className = "apple-tag";
      p.style.background = PRIORITY_COLORS[node.priority].bg;
      p.innerText = node.priority;
      poolItem.badges.appendChild(p);
    }
    if (node.progress) {
      const prg = document.createElement("span");
      prg.className = "outliner-progress-pill";
      prg.innerText = node.progress;
      poolItem.badges.appendChild(prg);
    }

    if (document.activeElement !== poolItem.textDiv) {
      poolItem.textDiv.innerText = node.text || "";
    }

    poolItem.textDiv.onfocus = () => {
      state.selectedIds = new Set([node.id]);
      rowEl.classList.add("selected");
    };

    poolItem.textDiv.onblur = () => {
      if (isComposingIME) return;
      const val = poolItem.textDiv.innerText.trim();
      if (val !== node.text) {
        executeCommand({
          type: COMMANDS.SET_TEXT,
          nodeId: node.id,
          oldText: node.text,
          newText: val || "新主题"
        });
      }
    };

    // 🌟 核心修复：严防 IME 状态下误触发 Enter，并在创建后自动无缝转移光标
    poolItem.textDiv.onkeydown = (e) => {
      if (isComposingIME || e.isComposing || e.keyCode === 229) return;

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const newSibling = {
          id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
          text: "",
          children: []
        };
        const idx = parentNode.children.findIndex(c => c.id === node.id);
        executeCommand({
          type: COMMANDS.INSERT_NODE,
          parentId: parentNode.id,
          index: idx + 1,
          node: newSibling
        });

        pendingFocusNodeId = newSibling.id;
        state.selectedIds = new Set([newSibling.id]);
        flatVisibleList = collectVisibleNodesFast(state.mindData);
        setupVirtualContainer(document.getElementById("outliner-content"), flatVisibleList.length);
        renderOutliner(renderAppRef);
      }
    };

    if (node.note) {
      poolItem.noteTag.classList.remove("hidden");
      poolItem.noteTag.onclick = (e) => {
        e.stopPropagation();
        openNotesDrawer(node);
      };
    } else {
      poolItem.noteTag.classList.add("hidden");
    }
  }
}
