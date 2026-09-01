import { sanitizeFilename } from "../ui/dialog.js";

export function serializeTabToPackage(tab) {
  const rootText = tab.mindData && tab.mindData.text ? tab.mindData.text.trim() : (tab.title || "思维导图");
  const presetFilename = sanitizeFilename(rootText);
  return {
    filePackage: {
      fileType: "YMIND_PRO_DOCUMENT",
      version: "3.0",
      title: tab.title || presetFilename,
      layoutStructure: tab.layoutStructure || "mindmap",
      colorPalette: tab.colorPalette || "apple-classic",
      lineStyle: tab.lineStyle || "curve",
      boxStyle: tab.boxStyle || "squircle",
      canvasTheme: tab.canvasTheme || "studio-light",
      mindData: tab.mindData
    },
    filenameWithExt: presetFilename + ".ymind",
    presetFilename: presetFilename
  };
}

export function normalizeMindNode(n) {
  if (!n || typeof n !== "object") return null;
  const data = (n.data && typeof n.data === "object") ? n.data : n;
  const text = data.text || data.title || data.topic || data.label || data.name || data.content ||
               n.text || n.title || n.topic || n.label || n.name || n.content || "新主题";
  const id = n.id ? String(n.id) : (data.id ? String(data.id) : ("node_" + Math.random().toString(36).substr(2, 7)));

  let priority = null;
  const rawP = data.priority || n.priority;
  if (rawP !== undefined && rawP !== null && rawP !== "") {
    const pStr = String(rawP).toUpperCase();
    priority = pStr.startsWith("P") ? pStr : ("P" + pStr);
  }

  let progress = null;
  const rawPrg = data.progress !== undefined ? data.progress : n.progress;
  if (rawPrg !== undefined && rawPrg !== null && rawPrg !== "") {
    if (typeof rawPrg === "number") {
      progress = rawPrg <= 4 ? (rawPrg * 25 + "%") : (rawPrg <= 100 ? (rawPrg + "%") : String(rawPrg));
    } else {
      progress = String(rawPrg);
    }
  }

  let tags = [];
  if (Array.isArray(data.tags)) tags = data.tags;
  else if (Array.isArray(n.tags)) tags = n.tags;
  else if (data.resource) tags = Array.isArray(data.resource) ? data.resource : [String(data.resource)];
  else if (n.resource) tags = Array.isArray(n.resource) ? n.resource : [String(n.resource)];

  let children = [];
  const rawChildren = n.children || data.children || n.topics || data.topics || n.subTopics || data.subTopics;
  if (Array.isArray(rawChildren)) {
    children = rawChildren.map(normalizeMindNode).filter(Boolean);
  } else if (rawChildren && rawChildren.attached && Array.isArray(rawChildren.attached)) {
    children = rawChildren.attached.map(normalizeMindNode).filter(Boolean);
  }

  return {
    id: id,
    text: String(text),
    icon: data.icon || n.icon || null,
    priority: priority,
    progress: progress,
    tags: tags.map(String),
    note: data.note || n.note || data.notes || n.notes || "",
    collapsed: Boolean(data.collapsed || n.collapsed || data.expand === false),
    children: children
  };
}

function convertFlatArrayToTree(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const nodeMap = new Map();
  let root = null;
  list.forEach(item => {
    const node = { ...item, children: [] };
    nodeMap.set(String(item.id), node);
    if (item.isroot || !item.parentid || (item.parentid === "root" && item.id === "root")) {
      root = node;
    }
  });
  if (!root && list[0]) root = nodeMap.get(String(list[0].id));
  list.forEach(item => {
    if (item.parentid && nodeMap.has(String(item.parentid))) {
      const parent = nodeMap.get(String(item.parentid));
      const current = nodeMap.get(String(item.id));
      if (parent && current && parent !== current) {
        if (!parent.children) parent.children = [];
        parent.children.push(current);
      }
    }
  });
  return root;
}

export function deserializePackage(parsed, defaultFileName = "本地思维导图", filePath = null) {
  let rootRaw = parsed;
  let loadedLayout = "mindmap", loadedPalette = "apple-classic", loadedLine = "curve", loadedBox = "squircle", loadedTheme = "studio-light";

  if (parsed && typeof parsed === "object") {
    if (parsed.mindData) {
      rootRaw = parsed.mindData;
      loadedLayout = parsed.layoutStructure || "mindmap";
      loadedPalette = parsed.colorPalette || "apple-classic";
      loadedLine = parsed.lineStyle || "curve";
      loadedBox = parsed.boxStyle || "squircle";
      loadedTheme = parsed.canvasTheme || "studio-light";
    } else if (parsed.root) {
      rootRaw = parsed.root;
    } else if (parsed.format === "node_tree" && parsed.data) {
      rootRaw = parsed.data;
    } else if (parsed.format === "node_array" && Array.isArray(parsed.data)) {
      rootRaw = convertFlatArrayToTree(parsed.data);
    } else if (parsed.data && typeof parsed.data === "object" && (parsed.data.id || parsed.data.topic || parsed.data.text || parsed.data.children)) {
      rootRaw = parsed.data;
    } else if (Array.isArray(parsed) && parsed[0]) {
      if (parsed[0].rootTopic) rootRaw = parsed[0].rootTopic;
      else if (parsed[0].root) rootRaw = parsed[0].root;
      else if (parsed[0].topic || parsed[0].text) rootRaw = parsed[0];
      else if (parsed.some(i => i.isroot || i.parentid === undefined)) {
        rootRaw = convertFlatArrayToTree(parsed);
      }
    } else if (parsed.rootTopic) {
      rootRaw = parsed.rootTopic;
    } else if (parsed.mindmap && parsed.mindmap.root) {
      rootRaw = parsed.mindmap.root;
    }
  }

  const loadedMindData = normalizeMindNode(rootRaw) || { id: "root", text: "中心主题", children: [] };
  let fileDisplayName = defaultFileName;
  if (filePath) {
    const parts = filePath.split(/[\\/\\]/);
    fileDisplayName = parts[parts.length - 1].replace(/\.[^/.]+$/, "");
  } else if (parsed && parsed.title) {
    fileDisplayName = parsed.title;
  } else if (parsed && parsed.meta && parsed.meta.name) {
    fileDisplayName = parsed.meta.name;
  } else if (loadedMindData && loadedMindData.text) {
    fileDisplayName = loadedMindData.text.trim();
  }

  return {
    fileDisplayName: fileDisplayName,
    loadedMindData: loadedMindData,
    loadedLayout: loadedLayout,
    loadedPalette: loadedPalette,
    loadedLine: loadedLine,
    loadedBox: loadedBox,
    loadedTheme: loadedTheme
  };
}
