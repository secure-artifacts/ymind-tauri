import { ICON_CATEGORIES } from '../data/icons.js';
import { state, saveSnapshot, findNode, getPrimarySelectedNode } from '../core/state.js';

let activeCategory = "frequent";

export function initIconPicker(renderApp) {
  const tabContainer = document.getElementById("inspector-icon-tabs");
  const gridContainer = document.getElementById("inspector-icon-grid");
  const btnClear = document.getElementById("btn-inspector-clear-icon");

  if (!tabContainer || !gridContainer) return;

  function renderTabs() {
    tabContainer.innerHTML = ICON_CATEGORIES.map(cat => `
      <button class="inspector-icon-tab-btn ${cat.id === activeCategory ? 'active' : ''}" data-cat="${cat.id}">
        ${cat.name.split(' ')[0]}
      </button>
    `).join('');

    tabContainer.querySelectorAll(".inspector-icon-tab-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        activeCategory = btn.dataset.cat;
        renderTabs();
        renderGrid();
      };
    });
  }

  function renderGrid() {
    const currentCat = ICON_CATEGORIES.find(c => c.id === activeCategory) || ICON_CATEGORIES[0];
    const primaryNode = getPrimarySelectedNode();
    const currentIcon = primaryNode?.icon || null;

    gridContainer.innerHTML = currentCat.icons.map(ic => {
      const isActive = ic.char === currentIcon;
      return `
        <div class="inspector-icon-chip ${isActive ? 'active' : ''}" data-char="${ic.char}" title="${ic.name}">
          <span>${ic.char}</span>
        </div>
      `;
    }).join('');

    gridContainer.querySelectorAll(".inspector-icon-chip").forEach(chip => {
      chip.onclick = (e) => {
        e.stopPropagation();
        const char = chip.dataset.char;
        const newIcon = (char === currentIcon) ? null : char;
        applyIconToSelection(newIcon);
      };
    });
  }

  function applyIconToSelection(iconChar) {
    if (!state.selectedIds || state.selectedIds.size === 0) return;
    state.selectedIds.forEach(id => {
      const node = findNode(id, state.mindData);
      if (node) node.icon = iconChar;
    });
    state.isLayoutDirty = true;
    saveSnapshot();
    renderApp();
    syncInspectorIcons();
  }

  btnClear?.addEventListener("click", (e) => {
    e.stopPropagation();
    applyIconToSelection(null);
  });

  renderTabs();
  renderGrid();
}

export function syncInspectorIcons() {
  const gridContainer = document.getElementById("inspector-icon-grid");
  if (!gridContainer) return;
  const primaryNode = getPrimarySelectedNode();
  const currentIcon = primaryNode?.icon || null;

  gridContainer.querySelectorAll(".inspector-icon-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.char === currentIcon);
  });
}
