import { resizeCanvas } from "../render/render.js";
import { getActiveTab, saveSnapshot, getPrimarySelectedNode, findNode, state } from "../core/state.js";
import { invalidateFontCache } from "../geometry/layout.js";
import { COLOR_PALETTES } from "../data/palettes.js";
import { bus, EVENTS } from "../core/event-bus.js";

const BG_COLOR_MAP = {
  "studio-white": "#f8fafc", "warm-ivory": "#faf6ed", "vintage-parchment": "#f4eedb",
  "matcha-mist": "#f1f7f2", "lavender-fog": "#f7f4fb", "glacier-blue": "#f0f6fb",
  "morandi-stone": "#eeedf0", "space-gray": "#181a1f", "midnight-abyss": "#09090b",
  "prussian-navy": "#0c1a2e", "slate-chalkboard": "#13241b", "sakura-blossom": "#fff5f5",
  "sand-dune": "#f7f3e8", "cyber-violet": "#150e28", "obsidian-coffee": "#1c1614"
};

const PALETTE_CATEGORIES = {
  "apple-classic": "classic", "sketch-hand": "classic", "bauhaus-modern": "classic", "cambridge-library": "classic",
  "japanese-matcha": "nature", "nordic-forest": "nature", "deep-ocean": "nature", "fresh-mint": "nature", "botanical-sage": "nature",
  "morandi-nature": "muted", "terracotta-clay": "muted", "scandinavian-frost": "muted", "caramel-latte": "muted", "macaron-pastel": "muted",
  "sunset-glow": "dark", "mystic-nebula": "dark", "retro-synthwave": "dark", "cyberpunk": "dark", "aurora-dusk": "dark", "graphite-mono": "dark"
};

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
  if (!primaryNode) {
    document.querySelectorAll("#node-font-size-options .style-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#node-font-weight-options .style-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll("#node-text-color-options .bg-color-swatch").forEach(c => c.classList.remove("active"));
  } else {
    const isRoot = primaryNode.id === (state.focusedRootId || state.mindData?.id);
    const curSize = primaryNode.fontSize ? String(parseInt(primaryNode.fontSize, 10)) : (isRoot ? "16" : "14");
    let curWeight = primaryNode.fontWeight ? String(primaryNode.fontWeight) : (isRoot ? "700" : "500");
    if (curWeight === "bold") curWeight = "700";
    if (curWeight === "normal" || curWeight === "500") curWeight = "400";
    const curColor = primaryNode.textColor || "default";

    document.querySelectorAll("#node-font-size-options .style-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.size === curSize || (curSize === "16" && b.dataset.size === "14") || (curSize === "13.5" && b.dataset.size === "14"));
    });
    document.querySelectorAll("#node-font-weight-options .style-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.weight === curWeight || (curWeight === "400" && b.dataset.weight === "400"));
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
  
  // 🌟 100% 完整填充配色方案名称、Emoji 与 6 阶彩色渐变色块
  grid.innerHTML = Object.values(COLOR_PALETTES).map(p => {
    const cat = PALETTE_CATEGORIES[p.id] || "classic";
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
      // 🌟 折叠首次展开时触发核验，确保网格 100% 正确呈现
      if (item.classList.contains("open")) {
        if (item.dataset.section === "palette") {
          renderPaletteGrid();
          syncInspectorUi();
        }
      }
    };
  });

  document.querySelectorAll("#node-font-size-options .style-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      applyNodeStyle(node => { node.fontSize = btn.dataset.size; });
    };
  });

  document.querySelectorAll("#node-font-weight-options .style-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      applyNodeStyle(node => { node.fontWeight = btn.dataset.weight; });
    };
  });

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

  // 初次加载即刻渲染
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

  document.querySelectorAll("#line-style-options .style-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tab = getActiveTab();
      if (tab) {
        tab.lineStyle = btn.dataset.line;
        saveSnapshot();
        syncInspectorUi();
        bus.emit(EVENTS.RENDER_APP);
      }
    };
  });

  document.querySelectorAll("#box-style-options .style-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const tab = getActiveTab();
      if (tab) {
        tab.boxStyle = btn.dataset.box;
        saveSnapshot();
        syncInspectorUi();
        bus.emit(EVENTS.RENDER_APP);
      }
    };
  });

  document.querySelectorAll("#menu-bg-colors .bg-color-swatch").forEach(swatch => {
    swatch.onclick = (e) => {
      e.stopPropagation();
      const tab = getActiveTab();
      if (tab) {
        tab.canvasBgColor = swatch.dataset.color;
        applyCanvasThemeToBody(tab.canvasBgColor, tab.canvasBgPattern || "dots");
        saveSnapshot();
        syncInspectorUi();
        bus.emit(EVENTS.RENDER_APP);
      }
    };
  });

  document.querySelectorAll("#menu-bg-patterns .bg-pattern-card").forEach(card => {
    card.onclick = (e) => {
      e.stopPropagation();
      const tab = getActiveTab();
      if (tab) {
        tab.canvasBgPattern = card.dataset.pattern;
        applyCanvasThemeToBody(tab.canvasBgColor || "studio-white", tab.canvasBgPattern);
        saveSnapshot();
        syncInspectorUi();
        bus.emit(EVENTS.RENDER_APP);
      }
    };
  });
}
