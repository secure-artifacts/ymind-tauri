import { TEMPLATES } from "../data/templates.js";
import { QuadTree } from "../geometry/spatial-tree.js";
import { countNodes, findNode, findParent, getAncestors, sanitizeTreeForHistory } from "./tree-utils.js";
import { getGlobalSettings, saveGlobalSettings, getDefaultSettings, applyGlobalTypography } from "./config.js";

export { countNodes, findNode, findParent, getAncestors, sanitizeTreeForHistory };
export { getGlobalSettings, saveGlobalSettings, getDefaultSettings, applyGlobalTypography };

export const state = {
  tabs: [],
  activeTabId: null,
  isZenMode: false,
  isRecallMode: false,
  isLayoutDirty: true,
  isInteracting: false,
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
    set(v) { const t = getActiveTab(); if (t) { t.mindData = v; state.isLayoutDirty = true; } }
  },
  selectedIds: {
    get() { return getActiveTab()?.selectedIds || new Set(); },
    set(v) { const t = getActiveTab(); if (t) t.selectedIds = v; }
  },
  focusedRootId: {
    get() { return getActiveTab()?.focusedRootId || "root"; },
    set(v) { const t = getActiveTab(); if (t) { t.focusedRootId = v; state.isLayoutDirty = true; } }
  },
  layoutStructure: {
    get() { return getActiveTab()?.layoutStructure || "mindmap"; },
    set(v) { const t = getActiveTab(); if (t) { t.layoutStructure = v; state.isLayoutDirty = true; } }
  },
  colorPalette: {
    get() { return getActiveTab()?.colorPalette || "apple-classic"; },
    set(v) { const t = getActiveTab(); if (t) t.colorPalette = v; }
  },
  nodeSpacing: {
    get() { return getActiveTab()?.nodeSpacing || "normal"; },
    set(v) { const t = getActiveTab(); if (t) { t.nodeSpacing = v; state.isLayoutDirty = true; } }
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

export function getPrimarySelectedNode() {
  const tab = getActiveTab();
  if (!tab || !tab.mindData || !tab.selectedIds || tab.selectedIds.size === 0) return null;
  const firstId = tab.selectedIds.values().next().value;
  if (!firstId) return null;
  return findNode(firstId, tab.mindData);
}

export function loadTemplate(templateId) {
  const tpl = TEMPLATES[templateId] || TEMPLATES["mindmap-blank"];
  let tab = getActiveTab() || createNewTab(templateId);
  tab.title = tpl.name;
  tab.mindData = sanitizeTreeForHistory(tpl.data);
  tab.layoutStructure = tpl.layout || "mindmap";
  tab.colorPalette = "apple-classic";
  tab.lineStyle = "curve";
  tab.boxStyle = "squircle";
  tab.canvasBgColor = "studio-white";
  tab.canvasBgPattern = "dots";
  tab.selectedIds = new Set([tab.mindData.id || "root"]);
  tab.focusedRootId = tab.mindData.id || "root";
  tab.history = [sanitizeTreeForHistory(tab.mindData)];
  tab.historyIndex = 0;
  tab.isDirty = true;
  tab.spatialIndex = new QuadTree();
  state.isLayoutDirty = true;
  return tab;
}

export function createNewTab(templateId = "mindmap-blank") {
  const tpl = TEMPLATES[templateId] || TEMPLATES["mindmap-blank"];
  const newTab = {
    id: "tab_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    title: tpl.name,
    filePath: null,
    isDirty: true,
    mindData: sanitizeTreeForHistory(tpl.data),
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
    history: [sanitizeTreeForHistory(tpl.data)],
    historyIndex: 0,
    spatialIndex: new QuadTree()
  };
  state.tabs.push(newTab);
  state.activeTabId = newTab.id;
  state.isLayoutDirty = true;
  return newTab;
}

export function closeTab(tabId) {
  const idx = state.tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return state.tabs.length;
  
  const [closedTab] = state.tabs.splice(idx, 1);
  if (closedTab) {
    if (closedTab.spatialIndex) {
      closedTab.spatialIndex.clear();
      closedTab.spatialIndex = null;
    }
    closedTab.mindData = null;
    closedTab.history = [];
    closedTab.camera = null;
  }

  state.isLayoutDirty = true;
  if (state.tabs.length === 0) {
    state.activeTabId = null;
    return 0;
  }
  if (state.activeTabId === tabId) {
    state.activeTabId = state.tabs[Math.max(0, idx - 1)].id;
  }
  return state.tabs.length;
}

export { saveSnapshot, undo, redo } from "./history.js";
