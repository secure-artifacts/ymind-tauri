import { TEMPLATES } from "../data/templates.js";
import { invalidateFontCache } from "../geometry/layout.js";

const SETTINGS_KEY = "YMIND_PRO_GLOBAL_SETTINGS";
let cachedGlobalSettings = null;

export function getDefaultSettings() {
  return {
    fontEn: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Helvetica Neue\"",
    fontZh: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif",
    layout: "mindmap",
    palette: "apple-classic",
    lineStyle: "curve",
    boxStyle: "squircle",
    canvasTheme: "studio-light"
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
  clipboardBranch: null,
  isZenMode: false,
  editingNodeId: null
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
    get() { return getActiveTab()?.layoutStructure || getGlobalSettings().layout; },
    set(v) { const t = getActiveTab(); if (t) t.layoutStructure = v; }
  },
  colorPalette: {
    get() { return getActiveTab()?.colorPalette || getGlobalSettings().palette; },
    set(v) { const t = getActiveTab(); if (t) t.colorPalette = v; }
  },
  lineStyle: {
    get() { return getActiveTab()?.lineStyle || getGlobalSettings().lineStyle; },
    set(v) { const t = getActiveTab(); if (t) t.lineStyle = v; }
  },
  boxStyle: {
    get() { return getActiveTab()?.boxStyle || getGlobalSettings().boxStyle; },
    set(v) { const t = getActiveTab(); if (t) t.boxStyle = v; }
  },
  canvasTheme: {
    get() { return getActiveTab()?.canvasTheme || getGlobalSettings().canvasTheme; },
    set(v) { const t = getActiveTab(); if (t) t.canvasTheme = v; }
  },
  viewMode: {
    get() { return getActiveTab()?.viewMode || "mindmap"; },
    set(v) { const t = getActiveTab(); if (t) t.viewMode = v; }
  },
  isDirty: {
    get() { return getActiveTab()?.isDirty || false; },
    set(v) { const t = getActiveTab(); if (t) t.isDirty = v; }
  },
  password: {
    get() { return getActiveTab()?.password || null; },
    set(v) { const t = getActiveTab(); if (t) t.password = v; }
  },
  isRecallMode: {
    get() { return getActiveTab()?.isRecallMode || false; },
    set(v) { const t = getActiveTab(); if (t) t.isRecallMode = v; }
  },
  isEncrypted: {
    get() { return getActiveTab()?.isEncrypted || false; },
    set(v) { const t = getActiveTab(); if (t) t.isEncrypted = v; }
  }
});

export function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      count += countNodes(node.children[i]);
    }
  }
  return count;
}

export function saveSnapshot() {
  const tab = getActiveTab();
  if (!tab || !tab.mindData) return;
  const snapStr = JSON.stringify(tab.mindData);
  if (!tab.history) { tab.history = []; tab.historyIndex = -1; }
  if (tab.historyIndex >= 0 && tab.history[tab.historyIndex] === snapStr) return;
  if (tab.historyIndex < tab.history.length - 1) {
    tab.history.splice(tab.historyIndex + 1);
  }
  tab.history.push(snapStr);
  tab.isDirty = true;
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
  } catch(e) {}
  cleanInvalidSelections();
  renderCallback();
}

export function redo(renderCallback) {
  const tab = getActiveTab();
  if (!tab || !tab.history || tab.historyIndex >= tab.history.length - 1) return;
  tab.historyIndex++;
  try {
    const parsed = JSON.parse(tab.history[tab.historyIndex]);
    tab.mindData = parsed.mindData || parsed;
  } catch(e) {}
  cleanInvalidSelections();
  renderCallback();
}

export function cleanInvalidSelections() {
  const tab = getActiveTab();
  if (!tab) return;
  const valid = new Set();
  function check(n) {
    if (!n) return;
    if (tab.selectedIds.has(n.id)) valid.add(n.id);
    if (n.children) n.children.forEach(check);
  }
  check(tab.mindData);
  tab.selectedIds = valid.size > 0 ? valid : new Set([tab.focusedRootId]);
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
  const cfg = getGlobalSettings();
  let tab = getActiveTab() || createNewTab(templateId);
  tab.title = tpl.name;
  tab.mindData = JSON.parse(JSON.stringify(tpl.data));
  tab.layoutStructure = tpl.layout || cfg.layout;
  tab.colorPalette = cfg.palette;
  tab.lineStyle = cfg.lineStyle;
  tab.boxStyle = cfg.boxStyle;
  tab.canvasTheme = cfg.canvasTheme;
  tab.selectedIds = new Set([tab.mindData.id || "root"]);
  tab.focusedRootId = tab.mindData.id || "root";
  tab.isEncrypted = false;
  tab.password = null;
  tab.history = [JSON.stringify(tab.mindData)];
  tab.historyIndex = 0;
  tab.isDirty = false;
  return tab;
}

export function createNewTab(templateId = "mindmap-blank") {
  const tpl = TEMPLATES[templateId] || TEMPLATES["mindmap-blank"];
  const cfg = getGlobalSettings();
  const newTab = {
    id: "tab_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    title: tpl.name,
    filePath: null,
    isDirty: false,
    isEncrypted: false,
    password: null,
    mindData: JSON.parse(JSON.stringify(tpl.data)),
    selectedIds: new Set([tpl.data.id || "root"]),
    focusedRootId: tpl.data.id || "root",
    layoutStructure: tpl.layout || cfg.layout,
    colorPalette: cfg.palette,
    lineStyle: cfg.lineStyle,
    boxStyle: cfg.boxStyle,
    canvasTheme: cfg.canvasTheme,
    viewMode: "mindmap",
    camera: { x: window.innerWidth / 3, y: window.innerHeight / 2 - 40, scale: 1 },
    isRecallMode: false,
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
