import { saveSessionImmediate, scheduleSessionSave } from "../storage/session.js";
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

const PROXY_TAB_SCHEMA = {
  mindData: [null, true],
  selectedIds: [() => new Set(), false],
  focusedRootId: ["root", true],
  layoutStructure: ["mindmap", true],
  colorPalette: ["apple-classic", false],
  nodeSpacing: ["normal", true],
  lineStyle: ["curve", false],
  boxStyle: ["squircle", false],
  canvasBgColor: ["studio-white", false],
  canvasBgPattern: ["dots", false],
  viewMode: ["mindmap", false],
  isDirty: [false, false]
};

for (const [prop, [defaultVal, isLayoutSensitive]] of Object.entries(PROXY_TAB_SCHEMA)) {
  Object.defineProperty(state, prop, {
    get() {
      const tab = getActiveTab();
      return tab ? tab[prop] : (typeof defaultVal === "function" ? defaultVal() : defaultVal);
    },
    set(val) {
      const tab = getActiveTab();
      if (tab) {
        tab[prop] = val;
        if (isLayoutSensitive) state.isLayoutDirty = true;
      }
    }
  });
}

export function getPrimarySelectedNode() {
  const tab = getActiveTab();
  if (!tab || !tab.mindData || !tab.selectedIds || tab.selectedIds.size === 0) return null;
  const firstId = tab.selectedIds.values().next().value;
  if (!firstId) return null;
  return findNode(firstId, tab.mindData);
}

/**
 * 🌟 方案 B 专属：智能未命名编号发生器 (类似 VS Code "Untitled-1", "Untitled-2")
 */
export function generateNextUntitledTitle(basePrefix = "未命名") {
  const existingTitles = new Set(state.tabs.map(t => t.title));
  let counter = 1;
  while (existingTitles.has(`${basePrefix} ${counter}`)) {
    counter++;
  }
  return `${basePrefix} ${counter}`;
}

export function loadTemplate(templateId) {
  const tpl = TEMPLATES[templateId] || TEMPLATES["mindmap-blank"];
  let tab = getActiveTab() || createNewTab(templateId);
  tab.title = tpl.name;
  tab.mindData = sanitizeTreeForHistory(tpl.data);
  tab.layoutStructure = tpl.layout || "mindmap";
  tab.colorPalette = getGlobalSettings().palette || "apple-classic";
  tab.lineStyle = getGlobalSettings().lineStyle || "curve";
  tab.boxStyle = getGlobalSettings().boxStyle || "squircle";
  tab.canvasBgColor = getGlobalSettings().canvasBgColor || "studio-white";
  tab.canvasBgPattern = getGlobalSettings().canvasBgPattern || "dots";
  tab.selectedIds = new Set([tab.mindData.id || "root"]);
  tab.focusedRootId = tab.mindData.id || "root";
  tab.historyStack = [{ type: "SNAPSHOT", payload: sanitizeTreeForHistory(tab.mindData) }];
  tab.historyIndex = 0;
  tab.isDirty = true;
  tab.spatialIndex = new QuadTree();
  state.isLayoutDirty = true;
  return tab;
}

export function createNewTab(templateId = "mindmap-blank", customTitle = null) {
  const tpl = TEMPLATES[templateId] || TEMPLATES["mindmap-blank"];
  const isDefaultBlank = templateId === "mindmap-blank";
  
  // 🌟 若为默认空白导图，自动赋予自增名称 "未命名 1", "未命名 2"；若为模板，加序号消重
  let assignedTitle = customTitle;
  if (!assignedTitle) {
    // 🌟 统一规范：所有未落盘新建文档一律进入 "未命名 1", "未命名 2" 自增序列
    assignedTitle = generateNextUntitledTitle("未命名");
  }

  const initialTree = sanitizeTreeForHistory(tpl.data);
  if (isDefaultBlank) {
    initialTree.text = assignedTitle;
  }

  const newTab = {
    id: "tab_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    title: assignedTitle,
    filePath: null, // 明确无物理路径，属于纯会话草稿
    isDirty: true,
    mindData: initialTree,
    selectedIds: new Set([initialTree.id || "root"]),
    focusedRootId: initialTree.id || "root",
    layoutStructure: tpl.layout || "mindmap",
    nodeSpacing: "normal",
    colorPalette: getGlobalSettings().palette || "apple-classic",
    lineStyle: getGlobalSettings().lineStyle || "curve",
    boxStyle: getGlobalSettings().boxStyle || "squircle",
    canvasBgColor: getGlobalSettings().canvasBgColor || "studio-white",
    canvasBgPattern: getGlobalSettings().canvasBgPattern || "dots",
    viewMode: "mindmap",
    camera: { x: window.innerWidth / 3, y: window.innerHeight / 2 - 40, scale: 1 },
    historyStack: [{ type: "SNAPSHOT", payload: sanitizeTreeForHistory(initialTree) }],
    historyIndex: 0,
    spatialIndex: new QuadTree(),
    versions: []
  };
  state.tabs.push(newTab);
  state.activeTabId = newTab.id;
  state.isLayoutDirty = true;
  saveSessionImmediate();
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
    closedTab.historyStack = [];
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
  saveSessionImmediate();
  return state.tabs.length;
}

export { saveSnapshot, undo, redo, COMMANDS, executeCommand } from "./history.js";
