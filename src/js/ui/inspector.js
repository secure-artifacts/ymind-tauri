import { getActiveTab, saveSnapshot, getPrimarySelectedNode, findNode, state } from "../core/state.js";
import { invalidateFontCache } from "../geometry/layout.js";

const BG_COLOR_MAP = {
  "studio-white": "#f8fafc",
  "warm-ivory": "#faf6ed",
  "vintage-parchment": "#f4eedb",
  "matcha-mist": "#f1f7f2",
  "lavender-fog": "#f7f4fb",
  "glacier-blue": "#f0f6fb",
  "morandi-stone": "#eeedf0",
  "space-gray": "#181a1f",
  "midnight-abyss": "#09090b",
  "prussian-navy": "#0c1a2e",
  "slate-chalkboard": "#13241b"
};

// 通用节点样式批量/单选更新函数
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
  saveSnapshot();
  syncInspectorUi();
  if (window.__RENDER_APP__) window.__RENDER_APP__();
}

export function syncInspectorUi() {
  const tab = getActiveTab();
  if (!tab) return;

  const currentStructure = tab.layoutStructure || "mindmap";
  const currentPalette = tab.colorPalette || "apple-classic";
  const currentLine = tab.lineStyle || "curve";
  const currentBox = tab.boxStyle || "squircle";
  const currentSpacing = tab.nodeSpacing || "normal";
  const currentColor = tab.canvasBgColor || "studio-white";
  const currentPattern = tab.canvasBgPattern || "dots";

  document.querySelectorAll("#menu-structures .struct-card").forEach(c => c.classList.toggle("active-item", c.dataset.structure === currentStructure));
  document.querySelectorAll("#palette-options-grid .palette-chip").forEach(c => c.classList.toggle("active", c.dataset.palette === currentPalette));
  document.querySelectorAll("#line-style-options .style-btn").forEach(b => b.classList.toggle("active", b.dataset.line === currentLine));
  document.querySelectorAll("#box-style-options .style-btn").forEach(b => b.classList.toggle("active", b.dataset.box === currentBox));
  document.querySelectorAll("#node-spacing-options .style-btn").forEach(b => b.classList.toggle("active", b.dataset.spacing === currentSpacing));
  document.querySelectorAll("#menu-bg-colors .bg-color-swatch").forEach(c => c.classList.toggle("active", c.dataset.color === currentColor));
  document.querySelectorAll("#menu-bg-patterns .bg-pattern-card").forEach(b => b.classList.toggle("active", b.dataset.pattern === currentPattern));

  // 🌟 同步选中节点的专属字号、粗细、文字颜色
  const primaryNode = getPrimarySelectedNode();
  if (primaryNode) {
    const isRoot = primaryNode.id === (state.focusedRootId || state.mindData?.id);
    const curSize = primaryNode.fontSize ? String(parseInt(primaryNode.fontSize, 10)) : (isRoot ? "16" : "14");
    const curWeight = primaryNode.fontWeight ? String(primaryNode.fontWeight) : (isRoot ? "700" : "500");
    const curColor = primaryNode.textColor || "default";

    document.querySelectorAll("#node-font-size-options .style-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.size === curSize || (curSize === "16" && b.dataset.size === "14"));
    });
    document.querySelectorAll("#node-font-weight-options .style-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.weight === curWeight || (curWeight === "500" && b.dataset.weight === "400"));
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

  document.body.className = "bg-color-" + bgColor + " bg-pattern-" + bgPattern;
  document.body.setAttribute("data-bg-color", bgColor);
  document.body.setAttribute("data-bg-pattern", bgPattern);

  if (vp) {
    vp.className = "view-panel bg-color-" + bgColor + " bg-pattern-" + bgPattern;
    vp.style.setProperty("background-color", hex, "important");
  }
}

export function initInspectorEvents(renderApp) {
  // 手风琴折叠
  document.querySelectorAll(".inspector-accordion-header").forEach(h => {
    h.onclick = () => {
      h.parentElement?.classList.toggle("open");
    };
  });

  // 🌟 1. 节点字号大小点击
  document.querySelectorAll("#node-font-size-options .style-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      applyNodeStyle(node => {
        node.fontSize = btn.dataset.size;
      });
    };
  });

  // 🌟 2. 节点字体粗细点击
  document.querySelectorAll("#node-font-weight-options .style-btn").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      applyNodeStyle(node => {
        node.fontWeight = btn.dataset.weight;
      });
    };
  });

  // 🌟 3. 节点文字颜色点击
  document.querySelectorAll("#node-text-color-options .bg-color-swatch").forEach(swatch => {
    swatch.onclick = (e) => {
      e.stopPropagation();
      applyNodeStyle(node => {
        node.textColor = swatch.dataset.color;
      });
    };
  });

  // 4. 骨架结构切换
  document.querySelectorAll("#menu-structures .struct-card").forEach(card => {
    card.onclick = (e) => {
      e.stopPropagation();
      const tab = getActiveTab();
      if (tab) {
        tab.layoutStructure = card.dataset.structure;
        saveSnapshot();
        syncInspectorUi();
        if (window.__RENDER_APP__) window.__RENDER_APP__();
      }
    };
  });

  // 5. 调色板分类筛选
  document.querySelectorAll("#palette-category-tabs .palette-cat-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#palette-category-tabs .palette-cat-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const cat = btn.dataset.pcat;
      document.querySelectorAll("#palette-options-grid .palette-chip").forEach(chip => {
        chip.style.display = (cat === "all" || chip.dataset.pcat === cat) ? "flex" : "none";
      });
    };
  });
}
