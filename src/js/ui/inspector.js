import { resizeCanvas } from "../render/render.js";
import { getActiveTab, saveSnapshot, getPrimarySelectedNode, findNode, state } from "../core/state.js";
import { invalidateFontCache } from "../geometry/layout.js";
import { COLOR_PALETTES, BG_COLOR_MAP } from "../data/palettes.js";
import { bus, EVENTS } from "../core/event-bus.js";

function applyNodeStyle(updateFn) {
  const targetIds = (state.selectedIds && state.selectedIds.size > 0)
    ? Array.from(state.selectedIds)
    : [getPrimarySelectedNode()?.id || state.focusedRootId || state.mindData?.id].filter(Boolean);

  if (targetIds.length === 0) return;

  targetIds.forEach(id => {
    const node = findNode(id, state.mindData);
    if (node) updateFn(node);
  });

  invalidateFontCache();
  state.isLayoutDirty = true;
  saveSnapshot();
  syncInspectorUi();
  resizeCanvas(true);
  bus.emit(EVENTS.RENDER_APP);
}

export function syncInspectorUi() {
  const tab = getActiveTab();
  if (!tab) return;

  const currentStructure = tab.layoutStructure || "mindmap";
  const currentPalette = tab.colorPalette || "apple-classic";
  const currentLine = tab.lineStyle || "curve";
  const currentBox = tab.boxStyle || "squircle";
  const currentColor = tab.canvasBgColor || "studio-white";
  const currentPattern = tab.canvasBgPattern || "dots";

  document.querySelectorAll("#menu-structures .struct-card").forEach(c => c.classList.toggle("active-item", c.dataset.structure === currentStructure));
  document.querySelectorAll("#palette-options-grid .palette-chip").forEach(c => c.classList.toggle("active", c.dataset.palette === currentPalette));
  document.querySelectorAll("#line-style-options .style-btn").forEach(b => b.classList.toggle("active", b.dataset.line === currentLine));
  document.querySelectorAll("#box-style-options .style-btn").forEach(b => b.classList.toggle("active", b.dataset.box === currentBox));
  document.querySelectorAll("#menu-bg-colors .bg-color-swatch").forEach(c => c.classList.toggle("active", c.dataset.color === currentColor));
  document.querySelectorAll("#menu-bg-patterns .bg-pattern-card").forEach(b => b.classList.toggle("active", b.dataset.pattern === currentPattern));

  const badgeStruct = document.getElementById("badge-cur-struct");
  if (badgeStruct) {
    const structNames = { "mindmap": "经典双向", "logic-right": "向右逻辑", "logic-left": "向左逻辑", "org-down": "组织架构" };
    badgeStruct.innerText = structNames[currentStructure] || "经典双向";
  }
  const badgePalette = document.getElementById("badge-cur-palette");
  if (badgePalette) {
    const palObj = COLOR_PALETTES[currentPalette];
    if (palObj) badgePalette.innerText = palObj.name.replace(/^[^\w\u4e00-\u9fa5]+/, "").trim();
  }

  const primaryNode = getPrimarySelectedNode();
  const btnBold = document.getElementById("btn-text-bold");
  const btnItalic = document.getElementById("btn-text-italic");
  const btnStrike = document.getElementById("btn-text-strike");

  if (!primaryNode) {
    document.querySelectorAll("#node-font-size-options .style-btn").forEach(b => b.classList.remove("active"));
    btnBold?.classList.remove("active");
    btnItalic?.classList.remove("active");
    btnStrike?.classList.remove("active");
    document.querySelectorAll("#node-text-color-options .bg-color-swatch").forEach(c => c.classList.remove("active"));
  } else {
    const isRoot = primaryNode.id === (state.focusedRootId || state.mindData?.id);
    const curSize = primaryNode.fontSize ? String(parseInt(primaryNode.fontSize, 10)) : (isRoot ? "16" : "14");
    
    // 粗体反显
    const isBold = primaryNode.fontWeight === "700" || primaryNode.fontWeight === "bold" || (isRoot && !primaryNode.fontWeight);
    btnBold?.classList.toggle("active", Boolean(isBold));

    // 斜体反显
    const isItalic = primaryNode.fontStyle === "italic";
    btnItalic?.classList.toggle("active", Boolean(isItalic));

    // 删除线反显
    const isStrike = primaryNode.textDecoration === "line-through";
    btnStrike?.classList.toggle("active", Boolean(isStrike));

    const curColor = primaryNode.textColor || "default";

    document.querySelectorAll("#node-font-size-options .style-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.size === curSize || (curSize === "16" && b.dataset.size === "14") || (curSize === "13.5" && b.dataset.size === "14"));
    });

    document.querySelectorAll("#node-text-color-options .bg-color-swatch").forEach(c => {
      c.classList.toggle("active", c.dataset.color === curColor);
    });
  }

  applyCanvasThemeToBody(currentColor, currentPattern);
}

export function applyCanvasThemeToBody(bgColor = "studio-white", bgPattern = "dots") {
  const vp = document.getElementById("viewport");
  const hex = BG_COLOR_MAP[bgColor] || "#f8fafc";
  document.body.className = `bg-color-${bgColor} bg-pattern-${bgPattern}`;
  document.body.setAttribute("data-bg-color", bgColor);
  document.body.setAttribute("data-bg-pattern", bgPattern);
  if (vp) {
    vp.className = `view-panel bg-color-${bgColor} bg-pattern-${bgPattern}`;
    vp.style.setProperty("background-color", hex, "important");
  }
}

export function renderPaletteGrid() {
  const grid = document.getElementById("palette-options-grid");
  if (!grid) return;

  const curPalette = getActiveTab()?.colorPalette || "apple-classic";
  
  grid.innerHTML = Object.values(COLOR_PALETTES).map(p => {
    const cat = p.cat || "classic";
    const barHtml = (p.branches || []).slice(0, 6).map(b => `<span style="background:${b.line}"></span>`).join("");
    const isCur = p.id === curPalette;
    return `
      <div class="palette-chip ${isCur ? 'active' : ''}" data-palette="${p.id}" data-pcat="${cat}">
        <span class="palette-chip-name">${p.name || p.id}</span>
        <div class="palette-spectrum-bar">${barHtml}</div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".palette-chip").forEach(chip => {
    chip.onclick = (e) => {
      e.stopPropagation();
      const tab = getActiveTab();
      if (tab) {
        tab.colorPalette = chip.dataset.palette;
        state.isLayoutDirty = true;
        saveSnapshot();
        syncInspectorUi();
        bus.emit(EVENTS.RENDER_APP);
      }
    };
  });
}

export function initInspectorEvents() {
  document.querySelectorAll(".inspector-accordion-header").forEach(h => {
    h.onclick = () => {
      const item = h.parentElement;
      if (!item) return;
      item.classList.toggle("open");
      if (item.classList.contains("open")) {
        if (item.dataset.section === "palette") {
          renderPaletteGrid();
          syncInspectorUi();
        }
      }
    };
  });

  // 字号切换
  document.querySelectorAll("#node-font-size-options .style-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      applyNodeStyle(node => { node.fontSize = btn.dataset.size; });
    };
  });

  const decorConfigs = [
    ["btn-text-bold", "fontWeight", ["700", "bold"], "400", "700"],
    ["btn-text-italic", "fontStyle", ["italic"], "normal", "italic"],
    ["btn-text-strike", "textDecoration", ["line-through"], "none", "line-through"]
  ];
  decorConfigs.forEach(([btnId, prop, activeMatches, offVal, onVal]) => {
    document.getElementById(btnId)?.addEventListener("click", (e) => {
      e.stopPropagation();
      const primary = getPrimarySelectedNode();
      const isActive = activeMatches.includes(primary?.[prop]);
      applyNodeStyle(node => { node[prop] = isActive ? offVal : onVal; });
    });
  });

  // 颜色切换
  document.querySelectorAll("#node-text-color-options .bg-color-swatch").forEach(swatch => {
    swatch.onclick = (e) => {
      e.stopPropagation();
      applyNodeStyle(node => { node.textColor = swatch.dataset.color; });
    };
  });

  document.querySelectorAll("#menu-structures .struct-card").forEach(card => {
    card.onclick = (e) => {
      e.stopPropagation();
      const tab = getActiveTab();
      if (tab) {
        tab.layoutStructure = card.dataset.structure;
        state.isLayoutDirty = true;
        saveSnapshot();
        syncInspectorUi();
        bus.emit(EVENTS.RENDER_APP);
      }
    };
  });

  renderPaletteGrid();

  document.querySelectorAll("#palette-category-tabs .palette-cat-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll("#palette-category-tabs .palette-cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.dataset.pcat;
      document.querySelectorAll("#palette-options-grid .palette-chip").forEach(chip => {
        chip.style.display = (cat === "all" || chip.dataset.pcat === cat) ? "flex" : "none";
      });
    };
  });

  const attrConfigs = [
    ["#line-style-options .style-btn", "line", "lineStyle"],
    ["#box-style-options .style-btn", "box", "boxStyle"],
    ["#menu-bg-colors .bg-color-swatch", "color", "canvasBgColor"],
    ["#menu-bg-patterns .bg-pattern-card", "pattern", "canvasBgPattern"]
  ];

  attrConfigs.forEach(([selector, dataKey, prop]) => {
    document.querySelectorAll(selector).forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const tab = getActiveTab();
        if (tab) {
          tab[prop] = el.dataset[dataKey];
          if (prop.startsWith("canvasBg")) applyCanvasThemeToBody(tab.canvasBgColor, tab.canvasBgPattern || "dots");
          saveSnapshot();
          syncInspectorUi();
          bus.emit(EVENTS.RENDER_APP);
        }
      };
    });
  });
}
