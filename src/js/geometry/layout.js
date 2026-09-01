import { COLOR_PALETTES, PRIORITY_COLORS } from '../data/palettes.js';
import { getGlobalSettings } from '../core/state.js';

export { PRIORITY_COLORS };
export const NODE_H_GAP = 58;
export const NODE_V_GAP = 20;

const measureCanvas = document.createElement("canvas");
const measureCtx = measureCanvas.getContext("2d");
const textWidthCache = new Map();

let cachedFontFamily = null;
export function getActiveFontFamily() {
  if (!cachedFontFamily) {
    const cfg = getGlobalSettings();
    cachedFontFamily = `${cfg.fontEn}, ${cfg.fontZh}`;
  }
  return cachedFontFamily;
}
export function invalidateFontCache() {
  cachedFontFamily = null;
  textWidthCache.clear();
}

export function measureTextWidth(text, fontSize = 13.5, fontWeight = "500") {
  const fontFam = getActiveFontFamily();
  const cacheKey = `${text}_${fontSize}_${fontWeight}_${fontFam}`;
  const cached = textWidthCache.get(cacheKey);
  if (cached !== undefined) return cached;

  measureCtx.font = `${fontWeight} ${fontSize}px ${fontFam}`;
  const width = measureCtx.measureText(text).width;
  if (textWidthCache.size > 2000) textWidthCache.clear();
  textWidthCache.set(cacheKey, width);
  return width;
}

export function measureNodeSize(node, level, focusedRootId) {
  const isRoot = node.id === focusedRootId;
  const fontSize = isRoot ? 15.5 : 13.5;
  const fontWeight = isRoot ? "700" : (level === 1 ? "600" : "500");
  const textWidth = measureTextWidth(node.text, fontSize, fontWeight);

  let extraLeftWidth = 0;
  if (node.icon) extraLeftWidth += 22;
  if (node.priority) extraLeftWidth += 26;
  if (node.progress) extraLeftWidth += 20;
  if (node.note) extraLeftWidth += 22;

  let tagsWidth = 0;
  if (node.tags && node.tags.length > 0) {
    for (let i = 0; i < node.tags.length; i++) {
      tagsWidth += measureTextWidth(node.tags[i], 9.5, "600") + 16;
    }
  }

  const padX = isRoot ? 24 : 16;
  const padY = isRoot ? 13 : 8;

  node.contentWidth = extraLeftWidth + textWidth + tagsWidth;
  node.width = node.contentWidth + padX * 2;
  node.height = fontSize + padY * 2;
  node.extraLeftWidth = extraLeftWidth;
  node.textWidth = textWidth;
}

export function computeLayout(node, level = 0, focusedRootId = "root", structure = "mindmap") {
  measureNodeSize(node, level, focusedRootId);

  if (!node.children || node.children.length === 0 || node.collapsed) {
    node.treeHeight = node.height;
    node.treeWidth = node.width;
    return;
  }

  if (structure === "org-down") {
    let childrenWidth = 0;
    node.children.forEach((child, index) => {
      computeLayout(child, level + 1, focusedRootId, structure);
      childrenWidth += child.treeWidth;
      if (index > 0) childrenWidth += NODE_H_GAP;
    });
    node.treeWidth = Math.max(node.width, childrenWidth);
    node.treeHeight = node.height;
  } else if (structure === "mindmap" && node.id === focusedRootId) {
    node.rightChildren = [];
    node.leftChildren = [];
    node.children.forEach((child, idx) => {
      idx % 2 === 0 ? node.rightChildren.push(child) : node.leftChildren.push(child);
    });

    let rHeight = 0;
    node.rightChildren.forEach((child, idx) => {
      computeLayout(child, level + 1, focusedRootId, structure);
      rHeight += child.treeHeight;
      if (idx > 0) rHeight += NODE_V_GAP;
    });
    node.rightTreeHeight = Math.max(node.height, rHeight);

    let lHeight = 0;
    node.leftChildren.forEach((child, idx) => {
      computeLayout(child, level + 1, focusedRootId, structure);
      lHeight += child.treeHeight;
      if (idx > 0) lHeight += NODE_V_GAP;
    });
    node.leftTreeHeight = Math.max(node.height, lHeight);
    node.treeHeight = Math.max(node.rightTreeHeight, node.leftTreeHeight);
  } else {
    let childrenHeight = 0;
    node.children.forEach((child, index) => {
      computeLayout(child, level + 1, focusedRootId, structure);
      childrenHeight += child.treeHeight;
      if (index > 0) childrenHeight += NODE_V_GAP;
    });
    node.treeHeight = Math.max(node.height, childrenHeight);
  }
}

export function assignCoordinates(node, x, y, focusedRootId = "root", structure = "mindmap", direction = "right", colorTheme = null, paletteKey = "apple-classic") {
  const currentPalette = COLOR_PALETTES[paletteKey] || COLOR_PALETTES["apple-classic"];
  const paletteList = currentPalette.branches;

  node.x = x;
  node.y = y;
  node.branchDirection = direction;
  node.paletteKey = paletteKey;

  node.treeMinX = node.x;
  node.treeMaxX = node.x + node.width;
  node.treeMinY = node.y;
  node.treeMaxY = node.y + node.height;

  if (node.id === focusedRootId) node.rootTheme = currentPalette.root;
  if (colorTheme) node.colorTheme = colorTheme;

  if (!node.children || node.children.length === 0 || node.collapsed) return;

  if (structure === "org-down") {
    let startX = x + node.width / 2 - node.treeWidth / 2;
    node.children.forEach((child, idx) => {
      const nextTheme = (node.id === focusedRootId) ? paletteList[idx % paletteList.length] : node.colorTheme;
      const childX = startX + child.treeWidth / 2 - child.width / 2;
      assignCoordinates(child, childX, y + node.height + 54, focusedRootId, structure, "down", nextTheme, paletteKey);
      startX += child.treeWidth + NODE_H_GAP;
    });
  } else if (structure === "mindmap" && node.id === focusedRootId) {
    let startYR = y + node.height / 2 - node.rightTreeHeight / 2;
    node.rightChildren.forEach((child, idx) => {
      const nextTheme = paletteList[(idx * 2) % paletteList.length];
      const childY = startYR + child.treeHeight / 2 - child.height / 2;
      assignCoordinates(child, x + node.width + NODE_H_GAP, childY, focusedRootId, structure, "right", nextTheme, paletteKey);
      startYR += child.treeHeight + NODE_V_GAP;
    });

    let startYL = y + node.height / 2 - node.leftTreeHeight / 2;
    node.leftChildren.forEach((child, idx) => {
      const nextTheme = paletteList[(idx * 2 + 1) % paletteList.length];
      const childY = startYL + child.treeHeight / 2 - child.height / 2;
      assignCoordinates(child, x - child.width - NODE_H_GAP, childY, focusedRootId, structure, "left", nextTheme, paletteKey);
      startYL += child.treeHeight + NODE_V_GAP;
    });
  } else {
    const activeDir = (structure === "logic-left" || direction === "left") ? "left" : "right";
    let startY = y + node.height / 2 - node.treeHeight / 2;

    node.children.forEach((child, idx) => {
      const nextTheme = (node.id === focusedRootId) ? paletteList[idx % paletteList.length] : node.colorTheme;
      const childY = startY + child.treeHeight / 2 - child.height / 2;
      const childX = (activeDir === "left") ? (x - child.width - NODE_H_GAP) : (x + node.width + NODE_H_GAP);
      assignCoordinates(child, childX, childY, focusedRootId, structure, activeDir, nextTheme, paletteKey);
      startY += child.treeHeight + NODE_V_GAP;
    });
  }

  // 🌟 回溯计算完整子树的世界坐标包围盒
  if (node.children && !node.collapsed) {
    for (let c of node.children) {
      if (c.treeMinX !== undefined) {
        node.treeMinX = Math.min(node.treeMinX, c.treeMinX);
        node.treeMaxX = Math.max(node.treeMaxX, c.treeMaxX);
        node.treeMinY = Math.min(node.treeMinY, c.treeMinY);
        node.treeMaxY = Math.max(node.treeMaxY, c.treeMaxY);
      }
    }
  }
}
