import { state, getActiveTab, createNewTab, closeTab } from "./state.js";
import { camera, smartCenterOnSelectedNode } from "./camera.js";
import { syncInspectorUi, applyCanvasThemeToBody } from "../ui/inspector.js";
import { recordRecentDoc } from "../ui/home.js";
import { showLockScreen, hideLockScreenDOM, updateSecurityDockStatus } from "../ui/vault.js";
import { appConfirm } from "../ui/dialog.js";

const tabList = document.getElementById("tab-list");

export function getTabDisplayFilename(tab) {
  if (!tab) return "未命名导图";
  if (tab.filePath) {
    return tab.filePath.split(/[\\/]/).pop();
  }
  return tab.title || (tab.mindData?.text?.trim()) || "未命名导图";
}

// 🛡️ 核心关闭拦截函数
export async function closeTabWithConfirm(tabId, renderApp, showHome) {
  const t = state.tabs.find(tab => tab.id === tabId);
  if (!t) return;

  const displayName = getTabDisplayFilename(t);

  // 如果有未保存的修改且当前不是仅处于未解密锁屏状态，弹出危险确认框
  if (t.isDirty && !t._isLocked) {
    const ok = await appConfirm({
      title: "未保存的修改",
      message: `「${displayName}」包含尚未保存的修改。关闭标签页将导致所有未保存内容丢失，确定要放弃修改并关闭吗？`,
      isDanger: true,
      confirmText: "放弃修改并关闭",
      cancelText: "继续编辑"
    });
    if (!ok) return;
  }

  const remaining = closeTab(t.id);
  if (remaining === 0) { 
    showHome(); 
    return; 
  }

  const cur = getActiveTab();
  if (cur) {
    camera.transform = { ...cur.camera };
    applyCanvasThemeToBody(cur.canvasBgColor || "studio-white", cur.canvasBgPattern || "dots");
    if (cur.isEncrypted && cur._isLocked) showLockScreen(cur);
    else hideLockScreenDOM();
  }
  renderTabBar(renderApp, showHome);
  renderApp();
  syncInspectorUi();
  updateSecurityDockStatus();
}

export function renderTabBar(renderApp, showHome) {
  if (!tabList) return;
  tabList.innerHTML = "";

  if (state.tabs.length === 0) {
    showHome();
    return;
  }

  const curTab = getActiveTab();
  if (curTab) {
    const displayName = getTabDisplayFilename(curTab);
    document.title = (curTab.isDirty ? "● " : "") + displayName + " - YMind Pro";
  }

  const btnSave = document.getElementById("btn-save");
  if (btnSave) {
    const isDirty = Boolean(curTab?.isDirty && !curTab?._isLocked);
    btnSave.classList.toggle("is-dirty", isDirty);
    btnSave.classList.toggle("is-saved", !isDirty);
    btnSave.title = isDirty ? "当前有未保存的修改 (⌘S / Ctrl+S 立即保存)" : "当前修改已全部保存";
    btnSave.disabled = !isDirty;
    btnSave.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
      <span>${isDirty ? "保存" : "已保存"}</span>
      ${isDirty ? `<span class="save-btn-dirty-dot"></span>` : ""}
    `;
  }

  state.tabs.forEach(t => {
    const displayName = getTabDisplayFilename(t);
    const item = document.createElement("div");
    item.className = "apple-tab-item " + (t.id === state.activeTabId ? "active" : "") + " " + (t.isDirty ? "is-dirty" : "");
    item.title = (t.isDirty ? "[未保存] " : "") + (t.filePath ? (displayName + " (" + t.filePath + ")") : displayName);

    const dirtyDot = t.isDirty ? `<span class="tab-dirty-indicator" title="未保存的修改 (⌘S 保存)"></span>` : "";
    const lockIcon = t.isEncrypted ? `<span style="font-size:10px;margin-right:2px;">🔒</span>` : "";

    item.innerHTML = `
      ${dirtyDot}
      ${lockIcon}
      <span class="tab-title-text">${displayName}</span>
      <span class="tab-close-btn" data-id="${t.id}" title="关闭标签页">✕</span>
    `;

    item.onclick = async (e) => {
      if (e.target.classList.contains("tab-close-btn")) {
        e.stopPropagation();
        await closeTabWithConfirm(t.id, renderApp, showHome);
        return;
      }
      const prev = getActiveTab();
      if (prev) prev.camera = { ...camera.transform };
      state.activeTabId = t.id;
      camera.transform = { ...t.camera };
      applyCanvasThemeToBody(t.canvasBgColor || "studio-white", t.canvasBgPattern || "dots");

      if (t.isEncrypted && t._isLocked) {
        showLockScreen(t);
      } else {
        hideLockScreenDOM();
      }

      renderTabBar(renderApp, showHome);
      renderApp();
      syncInspectorUi();
      updateSecurityDockStatus();
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
    recordRecentDoc(newTab.title, newTab.mindData, newTab.layoutStructure, null, {
      colorPalette: newTab.colorPalette,
      lineStyle: newTab.lineStyle,
      boxStyle: newTab.boxStyle,
      canvasTheme: newTab.canvasTheme,
      canvasBgColor: newTab.canvasBgColor,
      canvasBgPattern: newTab.canvasBgPattern
    }, false);
    hideLockScreenDOM();
    renderTabBar(renderApp, showHome);
    renderApp();
    syncInspectorUi();
    updateSecurityDockStatus();
    smartCenterOnSelectedNode(state, false);
  });

  tabList?.addEventListener("wheel", (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      tabList.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}
