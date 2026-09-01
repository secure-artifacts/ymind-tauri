import { initNotesDrawer, openNotesDrawer } from './js/ui/notes.js';
import { initVaultManager } from "./js/ui/vault.js";
import { initFlashcards, openFlashcardModal, toggleRecallMode } from './js/ui/flashcards.js';
import { state, saveSnapshot, getActiveTab, createNewTab, applyGlobalTypography } from "./js/core/state.js";
import { render, updateSelectionStyles } from "./js/render/render.js";
import { renderOutliner } from "./js/render/outliner.js";
import { updateMinimap } from "./js/render/minimap.js";
import { camera, requestTransformUpdate, smartCenterOnSelectedNode } from "./js/core/camera.js";
import { initEventListeners } from "./js/ui/events.js";
import { syncInspectorUi } from "./js/ui/inspector.js";
import { initContextMenu } from "./js/ui/contextmenu.js";
import { initSearchEngine } from "./js/ui/search.js";
import { initAutoSaveEngine } from "./js/storage/storage.js";
import { renderHomeHub, initHomeEvents, switchHomeTab } from "./js/ui/home.js";
import { renderTabBar, initTabBar } from "./js/core/tab-manager.js";
import { initSettingsViewEvents } from "./js/ui/settings.js";
import { initIconPicker } from "./js/ui/icon-picker.js";
const homeView = document.getElementById("home-view");
const workspaceView = document.getElementById("workspace-view");

export function showWorkspace() {
  if (state.tabs.length === 0) createNewTab();
  if (homeView) homeView.classList.add("hidden");
  if (workspaceView) workspaceView.classList.remove("hidden");
  window.__WORKSPACE_OPENED_TIME__ = Date.now();
  renderApp();
  const currentTab = getActiveTab();
  if (currentTab) {
    camera.transform = currentTab.camera;
    document.body.className = `theme-${currentTab.canvasTheme || "studio-light"}`;
  }
  smartCenterOnSelectedNode(state, false);
  renderApp();
  syncInspectorUi();
  if (window.__SYNC_VAULT_UI__) window.__SYNC_VAULT_UI__();
}

export function showHome() {
  if (workspaceView) workspaceView.classList.add("hidden");
  if (homeView) homeView.classList.remove("hidden");
  renderHomeHub(renderApp, showWorkspace);
}

export function openSettingsView() {
  showHome();
  switchHomeTab("settings", renderApp, showWorkspace);
}

window.__SHOW_WORKSPACE__ = showWorkspace;
window.__OPEN_NODE_NOTES__ = openNotesDrawer;
window.__OPEN_SETTINGS_VIEW__ = openSettingsView;

function renderApp() {
  if (state.tabs.length === 0) {
    showHome();
    return;
  }

  renderTabBar(renderApp, showHome);

  const viewport = document.getElementById("viewport");
  const outlinerView = document.getElementById("outliner-view");
  const btnModeMindmap = document.getElementById("btn-mode-mindmap");
  const btnModeOutliner = document.getElementById("btn-mode-outliner");

  if (state.viewMode === "outliner") {
    if (viewport) viewport.classList.add("hidden");
    if (outlinerView) outlinerView.classList.remove("hidden");
    if (btnModeMindmap) btnModeMindmap.classList.remove("active-mode");
    if (btnModeOutliner) btnModeOutliner.classList.add("active-mode");
    document.querySelectorAll(".mindmap-only-control").forEach(el => el.style.display = "none");
    renderOutliner(renderApp);
  } else {
    if (outlinerView) outlinerView.classList.add("hidden");
    if (viewport) viewport.classList.remove("hidden");
    if (btnModeOutliner) btnModeOutliner.classList.remove("active-mode");
    if (btnModeMindmap) btnModeMindmap.classList.add("active-mode");
    document.querySelectorAll(".mindmap-only-control").forEach(el => el.style.display = "");
    render(state, {
      onRender: renderApp,
      onSelect: (id, isMulti) => {
        if (isMulti) {
          if (state.selectedIds.has(id)) {
            if (state.selectedIds.size > 1) state.selectedIds.delete(id);
          } else {
            state.selectedIds.add(id);
          }
        } else {
          state.selectedIds = new Set([id]);
        }
        updateSelectionStyles(state);
      },
      onSelectRoot: (id) => {
        state.focusedRootId = id;
        state.selectedIds = new Set([id]);
        renderApp();
        smartCenterOnSelectedNode(state);
      },
      onRequestTransform: requestTransformUpdate
    });
    updateMinimap();
  }
}

window.__RENDER_APP__ = renderApp;

document.getElementById("btn-back-home")?.addEventListener("click", showHome);
document.getElementById("btn-open-settings")?.addEventListener("click", openSettingsView);

window.addEventListener("keydown", (e) => {
  if (homeView && !homeView.classList.contains("hidden")) {
    if ((e.key === "Escape" || (e.altKey && e.key.toLowerCase() === "m")) && state.tabs.length > 0) {
      e.preventDefault();
      showWorkspace();
    }
  }
});

applyGlobalTypography();
saveSnapshot();
initTabBar(renderApp, showHome);
initEventListeners(renderApp);
initContextMenu(renderApp);
initSearchEngine(renderApp);
initAutoSaveEngine(renderApp);
initHomeEvents(renderApp, showWorkspace);
initSettingsViewEvents(renderApp);
initIconPicker(renderApp);
initNotesDrawer(renderApp);
initFlashcards(renderApp);
initVaultManager(renderApp);

showHome();
console.log("🚀 [YMind Pro] 200+ 专属图标体系与渲染引擎就绪！");
