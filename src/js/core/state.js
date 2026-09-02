import { TEMPLATES } from "../data/templates.js";
import { invalidateFontCache } from "../geometry/layout.js";

const SETTINGS_KEY = "YMIND_PRO_GLOBAL_SETTINGS";
let cachedGlobalSettings = null;

export function getDefaultSettings() {
  return {
    fontEn: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Helvetica Neue\", sans-serif",
    fontZh: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif",
    layout: "mindmap",
    palette: "apple-classic",
    lineStyle: "curve",
    nodeSpacing: "normal",
    boxStyle: "squircle",
    canvasTheme: "studio-light",
    canvasBgColor: "studio-white",
    canvasBgPattern: "dots",
    focusFollowMode: "smooth",
    autoSaveInterval: "30"
  };
}

export function getGlobalSettings() {
  if (cachedGlobalSettings) return cachedGlobalSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    cachedGlobalSettings = raw ? { ...getDefaultSettings(), ...JSON.parse(raw) } : getDefaultSettings();
  } catch {
    cachedGlobalSettings = getDefaultSettings();
  }
  return cachedGlobalSettings;
}

export function saveGlobalSettings(s) {
  cachedGlobalSettings = { ...s };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  applyGlobalTypography(s);
  invalidateFontCache();
}

export function applyGlobalTypography(s = getGlobalSettings()) {
  document.documentElement.style.setProperty("--font-en", s.fontEn);
  document.documentElement.style.setProperty("--font-zh", s.fontZh);
}

export const state = {
  tabs: [],
  activeTabId: null,
  isZenMode: false,
  isRecallMode: false,
  editingNodeId: null,
  clipboardBranch: null
};

export function getActiveTab() {
  if (!state.tabs || state.tabs.length === 0) return null;
  return state.tabs.find(t => t.id === state.activeTabId) || state.tabs[0];
}

Object.defineProperties(state, {
  mindData: {
    get() { return getActiveTab()?.mindData || null; },
    set(v) { const t = getActiveTab(); if (t) t.mindData = v; }
  },
  selectedIds: {
    get() { return getActiveTab()?.selectedIds || new Set(); },
    set(v) { const t = getActiveTab(); if (t) t.selectedIds = v; }
  },
  focusedRootId: {
    get() { return getActiveTab()?.focusedRootId || "root"; },
    set(v) { const t = getActiveTab(); if (t) t.focusedRootId = v; }
  },
  layoutStructure: {
    get() { return getActiveTab()?.layoutStructure || "mindmap"; },
    set(v) { const t = getActiveTab(); if (t) t.layoutStructure = v; }
  },
  colorPalette: {
    get() { return getActiveTab()?.colorPalette || "apple-classic"; },
    set(v) { const t = getActiveTab(); if (t) t.colorPalette = v; }
  },
  nodeSpacing: {
    get() { return getActiveTab()?.nodeSpacing || "normal"; },
    set(v) { const t = getActiveTab(); if (t) t.nodeSpacing = v; }
  },
  lineStyle: {
    get() { return getActiveTab()?.lineStyle || "curve"; },
    set(v) { const t = getActiveTab(); if (t) t.lineStyle = v; }
  },
  boxStyle: {
    get() { return getActiveTab()?.boxStyle || "squircle"; },
    set(v) { const t = getActiveTab(); if (t) t.boxStyle = v; }
  },
  canvasBgColor: {
    get() { return getActiveTab()?.canvasBgColor || "studio-white"; },
    set(v) { const t = getActiveTab(); if (t) t.canvasBgColor = v; }
  },
  canvasBgPattern: {
    get() { return getActiveTab()?.canvasBgPattern || "dots"; },
    set(v) { const t = getActiveTab(); if (t) t.canvasBgPattern = v; }
  },
  viewMode: {
    get() { return getActiveTab()?.viewMode || "mindmap"; },
    set(v) { const t = getActiveTab(); if (t) t.viewMode = v; }
  },
  isDirty: {
    get() { return getActiveTab()?.isDirty || false; },
    set(v) { const t = getActiveTab(); if (t) t.isDirty = v; }
  }
});

export function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) count += countNodes(node.children[i]);
  }
  return count;
}

export function saveSnapshot() {
  const tab = getActiveTab();
  if (!tab || !tab.mindData) return;
  tab.isDirty = true;
  const snapStr = JSON.stringify(tab.mindData);
  if (!tab.history) { tab.history = []; tab.historyIndex = -1; }
  if (tab.historyIndex >= 0 && tab.history[tab.historyIndex] === snapStr) return;
  if (tab.historyIndex < tab.history.length - 1) tab.history.splice(tab.historyIndex + 1);
  tab.history.push(snapStr);
  if (tab.history.length > 50) tab.history.shift();
  else tab.historyIndex++;
}

export function undo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.history || tab.historyIndex <= 0) return;
  tab.historyIndex--;
  try {
    const parsed = JSON.parse(tab.history[tab.historyIndex]);
    tab.mindData = parsed.mindData || parsed;
  } catch {}
  tab.isDirty = true;
  renderCallback();
}

export function redo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.history || tab.historyIndex >= tab.history.length - 1) return;
  tab.historyIndex++;
  try {
    const parsed = JSON.parse(tab.history[tab.historyIndex]);
    tab.mindData = parsed.mindData || parsed;
  } catch {}
  tab.isDirty = true;
  renderCallback();
}

export function findNode(id, node = state.mindData) {
  if (!node) return null;
  if (node.id === id) return node;
  if (node.children) {
    for (let child of node.children) {
      const res = findNode(id, child);
      if (res) return res;
    }
  }
  return null;
}

export function findParent(id, node = state.mindData) {
  if (!node || !node.children) return null;
  for (let child of node.children) {
    if (child.id === id) return node;
    const res = findParent(id, child);
    if (res) return res;
  }
  return null;
}

export function getAncestors(targetId, node = state.mindData, path = []) {
  if (!node) return null;
  if (node.id === targetId) return [...path, node];
  if (node.children) {
    for (let child of node.children) {
      const found = getAncestors(targetId, child, [...path, node]);
      if (found) return found;
    }
  }
  return null;
}

export function getPrimarySelectedNode() {
  const tab = getActiveTab();
  if (!tab || !tab.mindData) return null;
  const firstId = tab.selectedIds.values().next().value;
  return findNode(firstId, tab.mindData) || findNode(tab.focusedRootId, tab.mindData) || tab.mindData;
}

export function loadTemplate(templateId) {
  const tpl = TEMPLATES[templateId] || TEMPLATES["mindmap-blank"];
  let tab = getActiveTab() || createNewTab(templateId);
  tab.title = tpl.name;
  tab.mindData = JSON.parse(JSON.stringify(tpl.data));
  tab.layoutStructure = tpl.layout || "mindmap";
  tab.colorPalette = "apple-classic";
  tab.lineStyle = "curve";
  tab.boxStyle = "squircle";
  tab.canvasBgColor = "studio-white";
  tab.canvasBgPattern = "dots";
  tab.selectedIds = new Set([tab.mindData.id || "root"]);
  tab.focusedRootId = tab.mindData.id || "root";
  tab.history = [JSON.stringify(tab.mindData)];
  tab.historyIndex = 0;
  tab.isDirty = true;
  return tab;
}

export function createNewTab(templateId = "mindmap-blank") {
  const tpl = TEMPLATES[templateId] || TEMPLATES["mindmap-blank"];
  const newTab = {
    id: "tab_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    title: tpl.name,
    filePath: null,
    isDirty: true,
    mindData: JSON.parse(JSON.stringify(tpl.data)),
    selectedIds: new Set([tpl.data.id || "root"]),
    focusedRootId: tpl.data.id || "root",
    layoutStructure: tpl.layout || "mindmap",
    nodeSpacing: "normal",
    colorPalette: "apple-classic",
    lineStyle: "curve",
    boxStyle: "squircle",
    canvasBgColor: "studio-white",
    canvasBgPattern: "dots",
    viewMode: "mindmap",
    camera: { x: window.innerWidth / 3, y: window.innerHeight / 2 - 40, scale: 1 },
    history: [JSON.stringify(tpl.data)],
    historyIndex: 0
  };
  state.tabs.push(newTab);
  state.activeTabId = newTab.id;
  return newTab;
}

export function closeTab(tabId) {
  const idx = state.tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return state.tabs.length;
  state.tabs.splice(idx, 1);
  if (state.tabs.length === 0) {
    state.activeTabId = null;
    return 0;
  }
  if (state.activeTabId === tabId) {
    state.activeTabId = state.tabs[Math.max(0, idx - 1)].id;
  }
  return state.tabs.length;
}
