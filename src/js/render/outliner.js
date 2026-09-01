import { state, saveSnapshot, findParent } from "../core/state.js";
import { PRIORITY_COLORS } from "../data/palettes.js";

const outlinerContent = document.getElementById("outliner-content");

export function renderOutliner(renderApp) {
  if (!outlinerContent) return;
  outlinerContent.innerHTML = "";

  const root = state.mindData;

  const titleWrapper = document.createElement("div");
  titleWrapper.className = "outliner-root-wrapper";

  const rootInput = document.createElement("div");
  rootInput.className = "outliner-title-input";
  rootInput.contentEditable = "true";
  rootInput.spellcheck = false;
  rootInput.innerText = root.text;

  rootInput.onblur = () => {
    if (root.text !== rootInput.innerText.trim() && rootInput.innerText.trim()) {
      root.text = rootInput.innerText.trim();
      saveSnapshot();
      renderApp();
    }
  };

  rootInput.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newChild = { id: "node_" + Date.now(), text: "新主题", collapsed: false, children: [] };
      if (!root.children) root.children = [];
      root.children.unshift(newChild);
      saveSnapshot();
      renderApp();
      setTimeout(() => focusNodeText(newChild.id), 20);
    }
  };

  titleWrapper.appendChild(rootInput);
  outlinerContent.appendChild(titleWrapper);

  if (root.children && root.children.length > 0) {
    const listContainer = document.createElement("div");
    listContainer.className = "outliner-list";
    root.children.forEach(child => {
      listContainer.appendChild(createOutlinerNode(child, root, renderApp));
    });
    outlinerContent.appendChild(listContainer);
  }
}

function createOutlinerNode(node, parentNode, renderApp) {
  const item = document.createElement("div");
  item.className = "outliner-item";
  item.dataset.id = node.id;

  const row = document.createElement("div");
  row.className = `outliner-row ${state.selectedIds.has(node.id) ? "selected" : ""}`;

  const collapseIcon = document.createElement("div");
  collapseIcon.className = `outliner-toggle-icon ${node.children && node.children.length > 0 ? (node.collapsed ? "collapsed" : "expanded") : "leaf"}`;
  collapseIcon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
  collapseIcon.onclick = (e) => {
    e.stopPropagation();
    if (node.children && node.children.length > 0) {
      node.collapsed = !node.collapsed;
      saveSnapshot();
      renderApp();
    }
  };
  row.appendChild(collapseIcon);

  const bullet = document.createElement("div");
  bullet.className = "outliner-bullet";
  bullet.onclick = (e) => {
    e.stopPropagation();
    state.selectedIds = new Set([node.id]);
    renderApp();
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

  if (node.tags && node.tags.length > 0) {
    node.tags.forEach(t => {
      const tag = document.createElement("span");
      tag.className = "outliner-tag-pill";
      tag.innerText = t;
      badgesWrap.appendChild(tag);
    });
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
    if (node.text !== textDiv.innerText.trim() && textDiv.innerText.trim()) {
      node.text = textDiv.innerText.trim();
      saveSnapshot();
      renderApp();
    }
  };

  textDiv.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const newSibling = { id: "node_" + Date.now(), text: "新主题", collapsed: false, children: [] };
      const idx = parentNode.children.findIndex(c => c.id === node.id);
      parentNode.children.splice(idx + 1, 0, newSibling);
      state.selectedIds = new Set([newSibling.id]);
      saveSnapshot();
      renderApp();
      setTimeout(() => focusNodeText(newSibling.id), 20);
    } else if (e.key === "Tab") {
      e.preventDefault();
      const idx = parentNode.children.findIndex(c => c.id === node.id);

      if (e.shiftKey) {
        const grandParent = findParent(parentNode.id, state.mindData);
        if (grandParent) {
          parentNode.children.splice(idx, 1);
          const pIdx = grandParent.children.findIndex(c => c.id === parentNode.id);
          grandParent.children.splice(pIdx + 1, 0, node);
          saveSnapshot();
          renderApp();
          setTimeout(() => focusNodeText(node.id), 20);
        }
      } else {
        if (idx > 0) {
          const prevSibling = parentNode.children[idx - 1];
          parentNode.children.splice(idx, 1);
          if (!prevSibling.children) prevSibling.children = [];
          prevSibling.children.push(node);
          prevSibling.collapsed = false;
          saveSnapshot();
          renderApp();
          setTimeout(() => focusNodeText(node.id), 20);
        }
      }
    } else if (e.key === "Backspace" && textDiv.innerText.trim() === "") {
      e.preventDefault();
      const idx = parentNode.children.findIndex(c => c.id === node.id);
      parentNode.children.splice(idx, 1);
      const fallbackNode = idx > 0 ? parentNode.children[idx - 1] : parentNode;
      state.selectedIds = new Set([fallbackNode.id]);
      saveSnapshot();
      renderApp();
      setTimeout(() => focusNodeText(fallbackNode.id), 20);
    }
  };

  row.appendChild(textDiv);
  if (node.note) {
    const noteBadge = document.createElement("span");
    noteBadge.className = "outliner-tag-pill";
    noteBadge.style.cursor = "pointer";
    noteBadge.innerText = "📝 备注";
    noteBadge.title = node.note;
    noteBadge.onclick = (e) => { e.stopPropagation(); window.__OPEN_NODE_NOTES__ ? window.__OPEN_NODE_NOTES__(node) : null; };
    row.appendChild(noteBadge);
  }
  item.appendChild(row);

  if (node.children && node.children.length > 0 && !node.collapsed) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "outliner-children";
    node.children.forEach(child => {
      childrenContainer.appendChild(createOutlinerNode(child, node, renderApp));
    });
    item.appendChild(childrenContainer);
  }

  return item;
}

function focusNodeText(nodeId) {
  const item = document.querySelector(`.outliner-item[data-id="${nodeId}"] .outliner-text-input`) || 
               document.querySelector(".outliner-title-input");
  if (item) {
    item.focus();
    const range = document.createRange();
    range.selectNodeContents(item);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
