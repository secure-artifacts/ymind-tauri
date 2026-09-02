import { state, getActiveTab, createNewTab } from "./js/core/state.js";
import { render } from "./js/render/render.js";
import { renderOutliner } from "./js/render/outliner.js";
import { camera, requestTransformUpdate, smartCenterOnSelectedNode, locateFocusedNode } from "./js/core/camera.js";
import { initEventListeners } from "./js/ui/events.js";
import { syncInspectorUi, applyCanvasThemeToBody, initInspectorEvents } from "./js/ui/inspector.js";
import { renderHomeHub, initHomeEvents, recordRecentDoc } from "./js/ui/home.js";
import { renderTabBar, initTabBar } from "./js/core/tab-manager.js";
import { initNotesDrawer, openNotesDrawer } from "./js/ui/notes.js";
import { initFlashcards, toggleRecallMode, openFlashcardModal } from "./js/ui/flashcards.js";
import { initVaultManager, showLockScreen, hideLockScreen, updateSecurityDockStatus } from "./js/ui/vault.js";
import { initContextMenu } from "./js/ui/contextmenu.js";
import { initSearchEngine } from "./js/ui/search.js";
import { initIconPicker } from "./js/ui/icon-picker.js";
import { initAutoSaveEngine, openVersionHistoryModal, closeVersionHistoryModal, clearAllSnapshots, renderHistoryList } from "./js/storage/storage.js";
import { initSettingsViewEvents } from "./js/ui/settings.js";

const homeView = document.getElementById("home-view");
const workspaceView = document.getElementById("workspace-view");

export function showWorkspace() {
  if (state.tabs.length === 0) createNewTab();
  if (homeView) homeView.classList.add("hidden");
  if (workspaceView) workspaceView.classList.remove("hidden");

  const cur = getActiveTab();
  if (cur) {
    camera.transform = cur.camera;
    applyCanvasThemeToBody(cur.canvasBgColor || "studio-white", cur.canvasBgPattern || "dots");
    if (cur.isEncrypted && cur._isLocked) {
      showLockScreen(cur);
    } else {
      hideLockScreen();
    }
  }

  renderApp();
  smartCenterOnSelectedNode(state, false);
  syncInspectorUi();
  updateSecurityDockStatus();
}

export function showHome() {
  const cur = getActiveTab();
  if (cur && !cur._isLocked) {
    recordRecentDoc(cur.title, cur.mindData, cur.layoutStructure, cur.filePath, {
      colorPalette: cur.colorPalette,
      lineStyle: cur.lineStyle,
      boxStyle: cur.boxStyle,
      canvasBgColor: cur.canvasBgColor,
      canvasBgPattern: cur.canvasBgPattern
    }, cur.isEncrypted, cur.password, cur.passwordHint, cur.encryptedVault);
  }
  hideLockScreen();
  if (workspaceView) workspaceView.classList.add("hidden");
  if (homeView) homeView.classList.remove("hidden");
  renderHomeHub(renderApp, showWorkspace);
}

window.__SHOW_WORKSPACE__ = showWorkspace;
window.__SHOW_HOME__ = showHome;

function renderApp() {
  if (state.tabs.length === 0) { showHome(); return; }

  renderTabBar(renderApp, showHome);

  const curTab = getActiveTab();
  const viewport = document.getElementById("viewport");
  const outlinerView = document.getElementById("outliner-view");
  const btnMind = document.getElementById("btn-mode-mindmap");
  const btnOut = document.getElementById("btn-mode-outliner");

  if (curTab?.isEncrypted && curTab?._isLocked) {
    outlinerView?.classList.add("hidden");
    viewport?.classList.remove("hidden");
    const layerNodes = document.getElementById("layer-nodes");
    const layerConns = document.getElementById("layer-connections");
    if (layerNodes) layerNodes.innerHTML = "";
    if (layerConns) layerConns.innerHTML = "";
    showLockScreen(curTab);
    return;
  }

  if (state.viewMode === "outliner") {
    viewport?.classList.add("hidden");
    outlinerView?.classList.remove("hidden");
    btnMind?.classList.remove("active-mode");
    btnOut?.classList.add("active-mode");
    renderOutliner(renderApp);
  } else {
    outlinerView?.classList.add("hidden");
    viewport?.classList.remove("hidden");
    btnOut?.classList.remove("active-mode");
    btnMind?.classList.add("active-mode");
    render(state, {
      onRender: renderApp,
      onSelect: (id) => {
        state.selectedIds = new Set([id]);
        renderApp();
        locateFocusedNode(id, true);
      },
      onRequestTransform: requestTransformUpdate
    });
  }
}

window.__RENDER_APP__ = renderApp;

document.getElementById("btn-back-home")?.addEventListener("click", showHome);
document.getElementById("btn-mode-mindmap")?.addEventListener("click", () => {
  const t = getActiveTab();
  if (t) { t.viewMode = "mindmap"; renderApp(); }
});
document.getElementById("btn-mode-outliner")?.addEventListener("click", () => {
  const t = getActiveTab();
  if (t?.isEncrypted && t?._isLocked) return;
  if (t) { t.viewMode = "outliner"; renderApp(); }
});
document.getElementById("btn-mode-flashcards")?.addEventListener("click", () => {
  const t = getActiveTab();
  if (t?.isEncrypted && t?._isLocked) return;
  openFlashcardModal();
});
document.getElementById("btn-active-recall")?.addEventListener("click", () => {
  const t = getActiveTab();
  if (t?.isEncrypted && t?._isLocked) return;
  toggleRecallMode(renderApp);
});

// 快照时光机
document.getElementById("btn-open-history")?.addEventListener("click", () => openVersionHistoryModal(renderApp));
document.getElementById("nav-btn-history")?.addEventListener("click", () => openVersionHistoryModal(renderApp));
document.getElementById("btn-history-close")?.addEventListener("click", closeVersionHistoryModal);
document.getElementById("btn-create-manual-snap")?.addEventListener("click", () => {
  const cur = getActiveTab();
  if (cur && !cur._isLocked) {
    import("./js/storage/storage.js").then(m => {
      m.createVersionSnapshot(cur, 'manual');
      m.renderHistoryList(document.getElementById("history-search-input")?.value || "", renderApp);
      import("./js/ui/dialog.js").then(d => d.showToast("📸 当前版本快照已拍摄保存"));
    });
  }
});
document.getElementById("btn-history-clear-all")?.addEventListener("click", async () => {
  const { appConfirm, showToast } = await import("./js/ui/dialog.js");
  const ok = await appConfirm({
    title: "彻底粉碎快照库",
    message: "确定要永久清空所有历史版本快照吗？此操作无法撤销！",
    isDanger: true,
    confirmText: "立即彻底粉碎"
  });
  if (ok) {
    clearAllSnapshots();
    renderHistoryList("", renderApp);
    showToast("🗑️ 所有历史快照已被永久粉碎");
  }
});
document.getElementById("history-search-input")?.addEventListener("input", (e) => {
  renderHistoryList(e.target.value, renderApp);
});

// 🛡️ 窗口关闭/刷新防丢拦截
window.addEventListener("beforeunload", (e) => {
  const hasUnsaved = state.tabs.some(t => t.isDirty && !t._isLocked);
  if (hasUnsaved) {
    e.preventDefault();
    e.returnValue = "您有未保存的导图修改，确定要关闭退出吗？";
    return e.returnValue;
  }
});

window.addEventListener("keydown", (e) => {
  const lockScreen = document.getElementById("canvas-vault-lock-screen");
  if (lockScreen && !lockScreen.classList.contains("hidden") && e.key === "Escape") {
    e.preventDefault();
    showHome();
    return;
  }
  if (homeView && !homeView.classList.contains("hidden") && e.key === "Escape" && state.tabs.length > 0) {
    e.preventDefault();
    showWorkspace();
  }
});

// 初始化全套核心生命周期与交互引擎
initTabBar(renderApp, showHome);
initEventListeners(renderApp);
initHomeEvents(renderApp, showWorkspace);
initNotesDrawer(renderApp);
initFlashcards(renderApp);
initVaultManager(renderApp);
initContextMenu(renderApp);
initSearchEngine(renderApp);
initIconPicker(renderApp);
initAutoSaveEngine(renderApp);
initSettingsViewEvents(renderApp);
initInspectorEvents(renderApp);

showHome();
console.log("🛡️ [YMind Pro Studio] 未保存修改防丢与关闭确认拦截系统已就绪！");

// 🧪 注册全局自动化测试热键 (Ctrl+Shift+T / Alt+T)

window.addEventListener("keydown", (e) => {
  if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "t") || (e.altKey && e.key.toLowerCase() === "t")) {
    e.preventDefault();
    runAllTests(renderApp);
  }
});

// 🧪 本地自动化测试热键 (Alt+T / Ctrl+Shift+T，动态按需加载，不影响生产代码)
window.addEventListener("keydown", async (e) => {
  if ((e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "t") || (e.altKey && e.key.toLowerCase() === "t")) {
    e.preventDefault();
    try {
      const { runAllTests } = await import("./js/test/test-runner.js");
      runAllTests(renderApp);
    } catch {
      console.info("💡 本地测试模块未包含在提交中");
    }
  }
});
