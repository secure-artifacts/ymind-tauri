import { getActiveTab } from '../core/state.js';
import { camera } from '../core/camera.js';
import { syncInspectorIcons } from './icon-picker.js';

export function syncInspectorUi() {
  const tab = getActiveTab();
  if (!tab) return;

  const currentStructure = tab.layoutStructure || "mindmap";
  const currentPalette = tab.colorPalette || "apple-classic";
  const currentLine = tab.lineStyle || "curve";
  const currentBox = tab.boxStyle || "squircle";
  const currentTheme = tab.canvasTheme || "studio-light";

  document.querySelectorAll("#menu-structures .struct-card").forEach(c => {
    c.classList.toggle("active-item", c.dataset.structure === currentStructure);
  });
  document.querySelectorAll("#palette-options-grid .palette-chip").forEach(c => {
    c.classList.toggle("active", c.dataset.palette === currentPalette);
  });
  document.querySelectorAll("#line-style-options .style-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.line === currentLine);
  });
  document.querySelectorAll("#box-style-options .style-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.box === currentBox);
  });
  document.querySelectorAll("#menu-themes .theme-card").forEach(c => {
    c.classList.toggle("active-item", c.dataset.theme === currentTheme);
  });

  const zoomText = document.getElementById("txt-zoom-level");
  if (zoomText) {
    zoomText.innerText = `${Math.round(camera.transform.scale * 100)}%`;
  }

  // 🌟 同步当前选中节点的图标状态
  syncInspectorIcons();
}
