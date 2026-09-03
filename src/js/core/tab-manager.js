import { state, getActiveTab, createNewTab, closeTab } from "./state.js";
import { camera, smartCenterOnSelectedNode } from "./camera.js";
import { syncInspectorUi, applyCanvasThemeToBody } from "../ui/inspector.js";
import { recordRecentDoc } from "../ui/home.js";
import { showLockScreen, hideLockScreenDOM, updateSecurityDockStatus } from "../ui/vault.js";
import { appConfirm } from "../ui/dialog.js";
import { bus, EVENTS } from "./event-bus.js";

const tabList = document.getElementById("tab-list");
let isTabDelegationBound = false;

export function getTabDisplayFilename(tab) {
  if (!tab) return "未命名导图";
  if (tab.filePath) return tab.filePath.split(/[\\/]/).pop();
  return tab.title || (tab.mindData?.text?.trim()) || "未命名草稿";
}

export async function closeTabWithConfirm(tabId, renderApp, showHome) {
  const t = state.tabs.find(tab => tab.id === tabId);
  if (!t) return;

  const displayName = getTabDisplayFilename(t);
  if ((t.isDirty || !t.filePath) && !t._isLocked) {
    const isUnsavedDraft = !t.filePath;
    const ok = await appConfirm({
      title: isUnsavedDraft ? "草稿未保存至文件" : "未保存的修改",
      message: `「${displayName}」尚未保存为本地文件。关闭标签页将退出当前编辑，确定要关闭吗？`,
      isDanger: true,
      confirmText: "确认关闭",
      cancelText: "继续编辑"
    });
    if (!ok) return;
  }

  const remaining = closeTab(t.id);
  if (remaining === 0) {
    bus.emit(EVENTS.SHOW_HOME);
    return;
  }

  const cur = getActiveTab();
  if (cur) {
    camera.transform = { ...cur.camera };
    applyCanvasThemeToBody(cur.canvasBgColor || "studio-white", cur.canvasBgPattern || "dots");
    if (cur.isEncrypted && cur._isLocked) showLockScreen(cur);
    else hideLockScreenDOM();
  }
  renderTabBar();
  bus.emit(EVENTS.RENDER_APP);
  syncInspectorUi();
  updateSecurityDockStatus();
}

export function renderTabBar() {
  if (!tabList) return;

  if (state.tabs.length === 0) {
    bus.emit(EVENTS.SHOW_HOME);
    return;
  }

  const curTab = getActiveTab();
  if (curTab) {
    const displayName = getTabDisplayFilename(curTab);
    const isDraft = !curTab.filePath;
    document.title = (curTab.isDirty ? "● " : "") + (isDraft ? "[草稿] " : "") + displayName + " - YMind Pro";
  }

  const btnSave = document.getElementById("btn-save");
  if (btnSave) {
    const isLocked = Boolean(curTab?._isLocked);
    const isDraft = Boolean(!curTab?.filePath);
    const isDirty = Boolean(curTab?.isDirty);
    const canSave = (isDraft || isDirty) && !isLocked;

    btnSave.disabled = !canSave;
    btnSave.classList.toggle("is-dirty", canSave);
    btnSave.classList.toggle("is-saved", !canSave);

    let btnText = "已保存";
    let btnTitle = "当前文件已全部同步保存至本地";
    if (isDraft) {
      btnText = "保存至文件";
      btnTitle = "当前为本地草稿，点击立即保存 (⌘S / Ctrl+S)";
    } else if (isDirty) {
      btnText = "保存修改";
      btnTitle = "有未保存的修改，点击保存 (⌘S / Ctrl+S)";
    }
    btnSave.title = btnTitle;
    btnSave.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline></svg>
      <span>${btnText}</span>
      ${canSave ? `<span class="save-btn-dirty-dot"></span>` : ""}
    `;
  }

  // 🌟 DOM Diffing: 仅增量更新/复用元素，彻底停止 innerHTML = "" 产生的内存碎片
  const activeIds = new Set(state.tabs.map(t => t.id));
  Array.from(tabList.children).forEach(child => {
    if (!activeIds.has(child.dataset.tabId)) child.remove();
  });

  state.tabs.forEach((t) => {
    const displayName = getTabDisplayFilename(t);
    const isDraft = !t.filePath;
    const isActive = t.id === state.activeTabId;

    let item = tabList.querySelector(`[data-tab-id="${t.id}"]`);
    if (!item) {
      item = document.createElement("div");
      item.dataset.tabId = t.id;
      tabList.appendChild(item);
    }

    item.className = `apple-tab-item ${isActive ? "active" : ""} ${t.isDirty || isDraft ? "is-dirty" : ""}`;
    item.title = `${isDraft ? "[草稿] " : ""}${displayName}`;

    const dirtyDot = (t.isDirty || isDraft) ? `<span class="tab-dirty-indicator"></span>` : "";
    const lockIcon = t.isEncrypted ? `<span style="font-size:10px;margin-right:2px;">🔒</span>` : "";

    item.innerHTML = `
      ${dirtyDot}
      ${lockIcon}
      <span class="tab-title-text">${displayName}</span>
      <span class="tab-close-btn" data-close-id="${t.id}" title="关闭标签页">✕</span>
    `;
  });

  const activeDom = tabList.querySelector(".apple-tab-item.active");
  activeDom?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

export function initTabBar(renderApp, showHome) {
  if (!isTabDelegationBound && tabList) {
    // 🌟 单一事件委托：挂载在容器上，永不重复注册
    tabList.addEventListener("click", async (e) => {
      const closeBtn = e.target.closest("[data-close-id]");
      if (closeBtn) {
        e.stopPropagation();
        await closeTabWithConfirm(closeBtn.dataset.closeId, renderApp, showHome);
        return;
      }

      const item = e.target.closest(".apple-tab-item");
      if (!item) return;

      const tabId = item.dataset.tabId;
      if (!tabId || tabId === state.activeTabId) return;

      const prev = getActiveTab();
      if (prev) prev.camera = { ...camera.transform };

      state.activeTabId = tabId;
      state.isLayoutDirty = true;

      const t = getActiveTab();
      if (t) {
        camera.transform = { ...t.camera };
        applyCanvasThemeToBody(t.canvasBgColor || "studio-white", t.canvasBgPattern || "dots");
        if (t.isEncrypted && t._isLocked) showLockScreen(t);
        else hideLockScreenDOM();
      }

      renderTabBar();
      bus.emit(EVENTS.RENDER_APP);
      syncInspectorUi();
      updateSecurityDockStatus();
    });
    isTabDelegationBound = true;
  }

  document.getElementById("btn-add-tab")?.addEventListener("click", () => {
    const newTab = createNewTab();
    newTab.filePath = null;
    newTab.isDirty = true;
    recordRecentDoc(newTab.title, newTab.mindData, newTab.layoutStructure, null, {
      colorPalette: newTab.colorPalette,
      lineStyle: newTab.lineStyle,
      boxStyle: newTab.boxStyle,
      canvasTheme: newTab.canvasTheme,
      canvasBgColor: newTab.canvasBgColor,
      canvasBgPattern: newTab.canvasBgPattern
    }, false);
    hideLockScreenDOM();
    renderTabBar();
    bus.emit(EVENTS.RENDER_APP);
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
