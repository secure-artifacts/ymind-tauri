import { state, getActiveTab, createNewTab, closeTab } from "./state.js";
import { camera, smartCenterOnSelectedNode } from "./camera.js";
import { syncInspectorUi } from "../ui/inspector.js";
import { recordRecentDoc } from "../ui/home.js";

const tabList = document.getElementById("tab-list");

export function getTabDisplayFilename(tab) {
  if (!tab) return "未命名导图";
  if (tab.filePath) {
    return tab.filePath.split(/[/\\]/).pop();
  }
  return tab.title || (tab.mindData?.text?.trim()) || "未命名导图";
}

export function renderTabBar(renderApp, showHome) {
  if (!tabList) return;
  tabList.innerHTML = "";

  if (state.tabs.length === 0) {
    showHome();
    return;
  }

  state.tabs.forEach(t => {
    const displayName = getTabDisplayFilename(t);
    const item = document.createElement("div");
    item.className = `apple-tab-item ${t.id === state.activeTabId ? "active" : ""} ${t.isDirty ? "is-dirty" : ""}`;
    item.title = t.filePath ? `${displayName} (${t.filePath})` : displayName;

    const dirtyDot = t.isDirty ? `<span class="tab-dirty-indicator" title="未保存的修改">●</span>` : "";

    item.innerHTML = `
      ${dirtyDot}
      <span class="tab-title-text">${displayName}</span>
      <span class="tab-close-btn" data-id="${t.id}" title="关闭标签页">✕</span>
    `;

    item.onclick = (e) => {
      if (e.target.classList.contains("tab-close-btn")) {
        e.stopPropagation();
        const remaining = closeTab(t.id);
if (remaining === 0) { showHome(); return; }
const cur = getActiveTab();
if (cur) { camera.transform = cur.camera; document.body.className = `theme-${cur.canvasTheme || "studio-light"}`; }
renderTabBar(renderApp, showHome); renderApp(); syncInspectorUi(); return;
      }
      state.activeTabId = t.id;
      camera.transform = t.camera;
      document.body.className = `theme-${t.canvasTheme || "studio-light"}`;
      renderTabBar(renderApp, showHome);
      renderApp();
      syncInspectorUi();
      smartCenterOnSelectedNode(state, false);
    };
    tabList.appendChild(item);
  });

  const activeTabDom = tabList.querySelector(".apple-tab-item.active");
  if (activeTabDom) {
    activeTabDom.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }
}

export function initTabBar(renderApp, showHome) {
  document.getElementById("btn-add-tab")?.addEventListener("click", () => {
    const newTab = createNewTab();
    document.body.className = "theme-studio-light";
    recordRecentDoc(newTab.title, newTab.mindData, newTab.layoutStructure, null, {
      colorPalette: "apple-classic",
      lineStyle: "curve",
      boxStyle: "squircle",
      canvasTheme: "studio-light"
    });
    renderTabBar(renderApp, showHome);
    renderApp();
    syncInspectorUi();
    smartCenterOnSelectedNode(state, false);
  });

  tabList?.addEventListener("wheel", (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      tabList.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}
