import { state, getActiveTab, createNewTab } from "./js/core/state.js";
import { getGlobalSettings, saveGlobalSettings, applyAppTheme } from "./js/core/config.js";
import { render, resizeCanvas, syncInlineEditorPosition } from "./js/render/render.js";
import { renderOutliner } from "./js/render/outliner.js";
import { camera, requestTransformUpdate, locateFocusedNode } from "./js/core/camera.js";
import { initEventListeners, updateSelectionOnly } from "./js/ui/events.js";
import { syncInspectorUi, applyCanvasThemeToBody, initInspectorEvents } from "./js/ui/inspector.js";
import { renderHomeHub, initHomeEvents, recordRecentDoc, switchHomeTab } from "./js/ui/home.js";
import { renderTabBar, initTabBar } from "./js/core/tab-manager.js";
import { initNotesDrawer, closeNotesDrawer, syncNotesDrawerWithActiveNode } from "./js/ui/notes.js";
import { initFlashcards, toggleRecallMode, openFlashcardModal } from "./js/ui/flashcards.js";
import { initVaultManager, showLockScreen, hideLockScreen, updateSecurityDockStatus } from "./js/ui/vault.js";
import { initContextMenu } from "./js/ui/contextmenu.js";
import { initSearchEngine } from "./js/ui/search.js";
import { initIconPicker } from "./js/ui/icon-picker.js";
import { initAutoSaveEngine, openVersionHistoryModal, closeVersionHistoryModal, clearAllSnapshots, renderHistoryList, createVersionSnapshot } from "./js/storage/storage.js";
import { initSettingsViewEvents } from "./js/ui/settings.js";
import { appConfirm, showToast } from "./js/ui/dialog.js";
import { bus, EVENTS } from "./js/core/event-bus.js";
import { initMinimap, syncMinimapViewportBox } from "./js/render/minimap.js";
import { restoreSession, saveSessionImmediate } from "./js/storage/session.js";

const homeView = document.getElementById("home-view");
const workspaceView = document.getElementById("workspace-view");

export function toggleAppTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "light";
  const next = cur === "dark" ? "light" : "dark";
  const s = getGlobalSettings();
  s.appTheme = next;
  saveGlobalSettings(s);
  applyAppTheme(next);
  bus.emit(EVENTS.RENDER_APP);
  showToast(next === "dark" ? "🌙 已切换为深色黑曜模式" : "☀️ 已切换为浅色明亮模式");
}

export function showWorkspace() {
  if (state.tabs.length === 0) createNewTab();
  if (homeView) homeView.classList.add("hidden");
  if (workspaceView) workspaceView.classList.remove("hidden");
  document.querySelector(".workspace-body-layout")?.classList.toggle("sidebar-open", !document.getElementById("format-sidebar")?.classList.contains("collapsed"));

  const cur = getActiveTab();
  if (cur) {
    if (cur.camera && cur.camera.scale) {
      camera.transform.x = cur.camera.x;
      camera.transform.y = cur.camera.y;
      camera.transform.scale = cur.camera.scale;
    }
    applyCanvasThemeToBody(cur.canvasBgColor || "studio-white", cur.canvasBgPattern || "dots");
    if (cur.isEncrypted && cur._isLocked) {
      showLockScreen(cur);
    } else {
      hideLockScreen();
    }
  }

  resizeCanvas();
  renderApp();
  requestAnimationFrame(() => {
    import("./js/render/minimap.js").then(m => {
      m.updateMinimap();
      m.syncMinimapViewportBox();
    });
  });
  syncInspectorUi();
  updateSecurityDockStatus();
}

export function showHome() {
  const minimapBox = document.getElementById("minimap-viewport-box");
  if (minimapBox) minimapBox.style.display = "none";
  const cur = getActiveTab();
  if (cur) {
    cur.camera = { ...camera.transform };
    if (!cur._isLocked && cur.filePath) {
      recordRecentDoc(cur.title, cur.mindData, cur.layoutStructure, cur.filePath, {
        colorPalette: cur.colorPalette,
        lineStyle: cur.lineStyle,
        boxStyle: cur.boxStyle,
        canvasBgColor: cur.canvasBgColor,
        canvasBgPattern: cur.canvasBgPattern
      }, cur.isEncrypted, null, cur.passwordHint, cur.encryptedVault, cur.camera);
    }
  }
  hideLockScreen();
  closeNotesDrawer();

  if (workspaceView) workspaceView.classList.add("hidden");
  if (homeView) homeView.classList.remove("hidden");
  renderHomeHub(renderApp, showWorkspace);
}

function renderApp() {
  if (state.tabs.length === 0) { showHome(); return; }

  renderTabBar();

  const curTab = getActiveTab();
  const viewport = document.getElementById("viewport");
  const outlinerView = document.getElementById("outliner-view");
  const btnMind = document.getElementById("btn-mode-mindmap");
  const btnOut = document.getElementById("btn-mode-outliner");

  if (curTab?.isEncrypted && curTab?._isLocked) {
    outlinerView?.classList.add("hidden");
    viewport?.classList.remove("hidden");
    closeNotesDrawer();
    if (viewport) {
      const c = document.getElementById("canvas-main");
      if (c) {
        const cx = c.getContext("2d");
        if (cx) cx.clearRect(0, 0, c.width, c.height);
      }
    }
    showLockScreen(curTab);
    return;
  }

  if (state.viewMode === "outliner") {
    viewport?.classList.add("hidden");
    outlinerView?.classList.remove("hidden");
    btnMind?.classList.remove("active-mode");
    btnOut?.classList.add("active-mode");
    closeNotesDrawer();
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
        updateSelectionOnly();
        syncInspectorUi();
        locateFocusedNode(id, true);
        syncNotesDrawerWithActiveNode();
      },
      onRequestTransform: requestTransformUpdate
    });
  }
}

function renderCanvasOnly() {
  if (state.viewMode === "outliner" || state.tabs.length === 0) return;
  const curTab = getActiveTab();
  if (curTab?.isEncrypted && curTab?._isLocked) return;

  render(state, {
    onRender: renderApp,
    onSelect: (id) => {
      state.selectedIds = new Set([id]);
      updateSelectionOnly();
      syncInspectorUi();
      locateFocusedNode(id, true);
      syncNotesDrawerWithActiveNode();
    },
    onRequestTransform: requestTransformUpdate
  });
}

bus.on(EVENTS.RENDER_APP, renderApp);
bus.on(EVENTS.RENDER_CANVAS_ONLY, renderCanvasOnly);
bus.on(EVENTS.SHOW_WORKSPACE, showWorkspace);
bus.on(EVENTS.SHOW_HOME, showHome);
bus.on(EVENTS.SYNC_VAULT_UI, updateSecurityDockStatus);

bus.on(EVENTS.TRANSFORM_CHANGE, (transform) => {
  syncMinimapViewportBox();
  syncInlineEditorPosition();
  const zt = document.getElementById("txt-zoom-level");
  if (zt) zt.innerText = `${Math.round(transform.scale * 100)}%`;
});

document.getElementById("btn-back-home")?.addEventListener("click", showHome);
document.getElementById("btn-mode-mindmap")?.addEventListener("click", () => {
  const t = getActiveTab();
  if (t) {
    t.viewMode = "mindmap";
    resizeCanvas(true);
    renderApp();
    requestAnimationFrame(() => {
      import("./js/render/minimap.js").then(m => {
        m.updateMinimap();
        m.syncMinimapViewportBox();
      });
    });
  }
});
document.getElementById("btn-mode-outliner")?.addEventListener("click", () => {
  const t = getActiveTab();
  if (t?.isEncrypted && t?._isLocked) return;
  closeNotesDrawer();
  if (t) {
    t.viewMode = "outliner";
    requestAnimationFrame(() => {
      renderApp();
    });
  }
});
document.getElementById("btn-mode-flashcards")?.addEventListener("click", () => {
  const t = getActiveTab();
  if (t?.isEncrypted && t?._isLocked) return;
  closeNotesDrawer();
  openFlashcardModal();
});
document.getElementById("btn-active-recall")?.addEventListener("click", () => {
  const t = getActiveTab();
  if (t?.isEncrypted && t?._isLocked) return;
  toggleRecallMode(renderApp);
});

document.getElementById("btn-open-settings")?.addEventListener("click", () => {
  closeNotesDrawer();
  showHome();
  switchHomeTab("settings", renderApp, showWorkspace);
});

document.getElementById("btn-open-history")?.addEventListener("click", () => {
  closeNotesDrawer();
  openVersionHistoryModal(renderApp);
});
document.getElementById("nav-btn-history")?.addEventListener("click", () => {
  closeNotesDrawer();
  openVersionHistoryModal(renderApp);
});
document.getElementById("btn-history-close")?.addEventListener("click", closeVersionHistoryModal);

document.getElementById("btn-create-manual-snap")?.addEventListener("click", () => {
  const cur = getActiveTab();
  if (cur && !cur._isLocked) {
    createVersionSnapshot(cur, "manual");
    renderHistoryList(document.getElementById("history-search-input")?.value || "", renderApp);
    showToast("📸 当前版本快照已拍摄保存");
  }
});
document.getElementById("btn-history-clear-all")?.addEventListener("click", async () => {
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

window.addEventListener("beforeunload", (e) => {
  try {
    saveSessionImmediate();
    for (const t of state.tabs) {
      if (!t._isLocked && t.mindData && t.filePath) {
        recordRecentDoc(t.title, t.mindData, t.layoutStructure, t.filePath, {
          colorPalette: t.colorPalette,
          lineStyle: t.lineStyle,
          boxStyle: t.boxStyle,
          canvasBgColor: t.canvasBgColor,
          canvasBgPattern: t.canvasBgPattern
        }, t.isEncrypted, null, t.passwordHint, t.encryptedVault, t.camera);
      }
    }
  } catch (err) {}

  const hasUnsavedSecret = state.tabs.some(t => t.isEncrypted && t.isDirty && !t._isLocked);
  if (hasUnsavedSecret) {
    e.preventDefault();
    e.returnValue = "您有尚未保存至文件的加密保密文档，关闭后未保存的修改将被物理舍弃，确定退出吗？";
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

initTabBar();
initMinimap();
initEventListeners(renderApp);
initHomeEvents(renderApp, showWorkspace);
initNotesDrawer();
initFlashcards(renderApp);
initVaultManager(renderApp);
initContextMenu(renderApp);
initSearchEngine(renderApp);
initIconPicker(renderApp);
initAutoSaveEngine(renderApp);
initSettingsViewEvents(renderApp);
initInspectorEvents();

document.getElementById("btn-theme-toggle")?.addEventListener("click", toggleAppTheme);
document.getElementById("btn-theme-toggle-home")?.addEventListener("click", toggleAppTheme);

(async () => {
  applyAppTheme();
  const hasRestored = await restoreSession();
  if (hasRestored && state.tabs.length > 0) {
    const cur = getActiveTab();
    if (cur) {
      camera.transform = { ...cur.camera };
      applyCanvasThemeToBody(cur.canvasBgColor || "studio-white", cur.canvasBgPattern || "dots");
    }
    renderTabBar();
    syncInspectorUi();
  }
  showHome();
})();

if (typeof ResizeObserver !== "undefined") {
  const vpElement = document.getElementById("viewport");
  if (vpElement) {
    const ro = new ResizeObserver(() => {
      resizeCanvas();
      bus.emit(EVENTS.RENDER_APP);
    });
    ro.observe(vpElement);
  }
}

document.getElementById("btn-toggle-minimap")?.addEventListener("click", () => {
  const widget = document.getElementById("minimap-widget");
  const btn = document.getElementById("btn-toggle-minimap");
  if (!widget) return;
  const isHidden = widget.classList.toggle("hidden");
  btn?.classList.toggle("active", !isHidden);
  if (!isHidden) {
    requestAnimationFrame(() => {
      import("./js/render/minimap.js").then(m => {
        m.updateMinimap();
        m.syncMinimapViewportBox();
      });
    });
  }
});

const isDevMode = Boolean(
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV) ||
  window.location.protocol === "http:" ||
  window.location.port !== "" ||
  localStorage.getItem("YMIND_DEV") === "1"
);

if (isDevMode) {
  import("./js/test/test-runner.js").then(({ runAllTests }) => {
    window.runYMindTests = () => runAllTests(renderApp);
    window.addEventListener("keydown", (e) => {
      const isT = e.code === "KeyT" || e.key.toLowerCase() === "t" || e.key === "†";
      if (e.altKey && isT) {
        e.preventDefault();
        runAllTests(renderApp);
      }
    });

    function mountDevTestButton() {
      const barRight = document.querySelector(".top-bar-right");
      if (barRight && !document.getElementById("btn-run-all-tests")) {
        const btn = document.createElement("button");
        btn.id = "btn-run-all-tests";
        btn.className = "dock-capsule-btn";
        btn.style.cssText = "border-color: rgba(0, 113, 227, 0.4); color: var(--apple-blue);";
        btn.title = "[本地开发专用] 启动全系统自动化回归测试 (Alt+T)";
        btn.innerHTML = `<span style="font-size:12px;">🧪</span><span>测试</span>`;
        btn.onclick = () => runAllTests(renderApp);
        barRight.prepend(btn);
      }
    }

    mountDevTestButton();
    bus.on(EVENTS.SHOW_WORKSPACE, () => setTimeout(mountDevTestButton, 50));
  }).catch(() => {});
}
