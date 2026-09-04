import { state, getActiveTab } from "../core/state.js";
import { QuadTree } from "../geometry/spatial-tree.js";
import { idbSaveDraft, idbGetDraft, idbDeleteDraft } from "./idb.js";
import { bus, EVENTS } from "../core/event-bus.js";

const HOT_EXIT_KEY = "WORKSPACE_HOT_EXIT_SESSION_V1";
let sessionSaveTimer = null;

export function serializeTabForSession(tab) {
  if (!tab) return null;
  const isEncrypted = Boolean(tab.isEncrypted);
  // 🛡️ 核心安全铁律：保密文件在 Hot Exit 会话中坚决物理阻断明文树与撤销栈落盘
  const safeMindData = isEncrypted
    ? { id: "root", text: "🔒 保密导图已锁定", children: [] }
    : tab.mindData;

  return {
    id: tab.id,
    title: tab.title || "未命名导图",
    filePath: tab.filePath || null,
    isDirty: Boolean(tab.isDirty),
    mindData: safeMindData,
    selectedIds: isEncrypted ? ["root"] : Array.from(tab.selectedIds || []),
    focusedRootId: isEncrypted ? "root" : (tab.focusedRootId || "root"),
    layoutStructure: tab.layoutStructure || "mindmap",
    nodeSpacing: tab.nodeSpacing || "normal",
    colorPalette: tab.colorPalette || "apple-classic",
    lineStyle: tab.lineStyle || "curve",
    boxStyle: tab.boxStyle || "squircle",
    canvasBgColor: tab.canvasBgColor || "studio-white",
    canvasBgPattern: tab.canvasBgPattern || "dots",
    viewMode: isEncrypted ? "mindmap" : (tab.viewMode || "mindmap"),
    camera: tab.camera ? { ...tab.camera } : { x: window.innerWidth / 3, y: window.innerHeight / 2 - 40, scale: 1 },
    history: isEncrypted ? [] : (tab.history || []).slice(-25),
    historyIndex: isEncrypted ? 0 : (tab.historyIndex ?? 0),
    versions: isEncrypted ? [] : (tab.versions || []),
    isEncrypted: isEncrypted,
    passwordHint: tab.passwordHint || "",
    encryptedVault: tab.encryptedVault || null,
    _isLocked: isEncrypted
  };
}

export function deserializeTabFromSession(item) {
  if (!item || !item.id) return null;
  const rootId = item.mindData?.id || "root";
  return {
    id: item.id,
    title: item.title,
    filePath: item.filePath || null,
    isDirty: Boolean(item.isDirty),
    mindData: item.mindData,
    selectedIds: new Set(item.selectedIds && item.selectedIds.length ? item.selectedIds : [rootId]),
    focusedRootId: item.focusedRootId || rootId,
    layoutStructure: item.layoutStructure || "mindmap",
    nodeSpacing: item.nodeSpacing || "normal",
    colorPalette: item.colorPalette || "apple-classic",
    lineStyle: item.lineStyle || "curve",
    boxStyle: item.boxStyle || "squircle",
    canvasBgColor: item.canvasBgColor || "studio-white",
    canvasBgPattern: item.canvasBgPattern || "dots",
    viewMode: item.viewMode || "mindmap",
    camera: item.camera || { x: window.innerWidth / 3, y: window.innerHeight / 2 - 40, scale: 1 },
    history: item.history && item.history.length ? item.history : (item.mindData ? [item.mindData] : []),
    historyIndex: item.historyIndex ?? 0,
    spatialIndex: new QuadTree(),
    versions: item.versions || [],
    isEncrypted: Boolean(item.isEncrypted),
    passwordHint: item.passwordHint || "",
    encryptedVault: item.encryptedVault || null,
    _isLocked: Boolean(item.isEncrypted)
  };
}

export async function saveSessionImmediate() {
  if (sessionSaveTimer) {
    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = null;
  }
  try {
    if (!state.tabs || state.tabs.length === 0) {
      await idbDeleteDraft(HOT_EXIT_KEY);
      return;
    }
    const sessionPayload = {
      activeTabId: state.activeTabId,
      tabs: state.tabs.map(serializeTabForSession).filter(Boolean),
      timestamp: Date.now()
    };
    await idbSaveDraft(HOT_EXIT_KEY, sessionPayload);
  } catch (err) {
    console.warn("[HotExit] Failed to persist workspace session:", err);
  }
}

export function scheduleSessionSave() {
  if (sessionSaveTimer) clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(() => {
    saveSessionImmediate();
  }, 260);
}

export async function restoreSession() {
  try {
    const raw = await idbGetDraft(HOT_EXIT_KEY);
    if (!raw || !Array.isArray(raw.tabs) || raw.tabs.length === 0) {
      return false;
    }

    const restoredTabs = raw.tabs.map(deserializeTabFromSession).filter(Boolean);
    if (restoredTabs.length === 0) return false;

    state.tabs = restoredTabs;
    state.activeTabId = (raw.activeTabId && restoredTabs.some(t => t.id === raw.activeTabId))
      ? raw.activeTabId
      : restoredTabs[0].id;
    state.isLayoutDirty = true;
    return true;
  } catch (e) {
    console.warn("[HotExit] Failed to hydrate workspace session:", e);
    return false;
  }
}

export async function clearSession() {
  if (sessionSaveTimer) {
    clearTimeout(sessionSaveTimer);
    sessionSaveTimer = null;
  }
  await idbDeleteDraft(HOT_EXIT_KEY);
}

bus.on(EVENTS.CONFIG_CHANGE, scheduleSessionSave);
