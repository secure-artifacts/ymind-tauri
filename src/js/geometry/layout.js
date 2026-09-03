import { COLOR_PALETTES, PRIORITY_COLORS } from "../data/palettes.js";
import { getGlobalSettings } from "../core/config.js";
import { bus, EVENTS } from "../core/event-bus.js";

export { PRIORITY_COLORS };

export const SPACING_CONFIG = {
  compact: { hGap: 46, vGap: 16 },
  normal: { hGap: 66, vGap: 24 },
  loose: { hGap: 96, vGap: 36 }
};

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

bus.on(EVENTS.CONFIG_CHANGE, () => invalidateFontCache());

export function measureTextWidth(text, fontSize = 13.5, fontWeight = "500") {
  const fontFam = getActiveFontFamily();
  const rawText = String(text ?? "");
  const lines = rawText.split(/\r?\n/);
  let maxW = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cacheKey = `${line}_${fontSize}_${fontWeight}_${fontFam}`;
    let width = textWidthCache.get(cacheKey);
    if (width === undefined) {
      measureCtx.font = `${fontWeight} ${fontSize}px ${fontFam}`;
      width = measureCtx.measureText(line).width;
      if (textWidthCache.size >= 4000) {
        const iter = textWidthCache.keys();
        for (let j = 0; j < 800; j++) textWidthCache.delete(iter.next().value);
      }
      textWidthCache.set(cacheKey, width);
    }
    if (width > maxW) maxW = width;
  }
  return maxW;
}

export function measureNodeSize(node, level, focusedRootId) {
  const isRoot = node.id === focusedRootId;
  const isLevel1 = level === 1;
  const defFontSize = isRoot ? 16 : 13.5;
  const defFontWeight = isRoot ? "700" : (isLevel1 ? "600" : "500");
  const fontSize = node.fontSize ? parseFloat(node.fontSize) : defFontSize;
  const fontWeight = node.fontWeight || defFontWeight;
  const fontFam = getActiveFontFamily();

  const contentSignature = `${node.text}_${fontSize}_${fontWeight}_${node.icon || ""}_${node.priority || ""}_${node.progress || ""}_${node.note ? "1" : "0"}_${(node.tags || []).join(",")}_${fontFam}`;
  if (node._sizeSignature === contentSignature && node.width && node.height) return;

  const lines = String(node.text ?? "").split(/\r?\n/);
  const lineHeight = Math.round(fontSize * 1.38);
  const textWidth = measureTextWidth(node.text, fontSize, fontWeight);

  let extraLeftWidth = 0;
  if (node.icon) extraLeftWidth += 24;
  if (node.priority) extraLeftWidth += 28;
  if (node.progress) extraLeftWidth += 22;
  if (node.note) extraLeftWidth += 24;

  let tagsWidth = 0;
  if (node.tags && Array.isArray(node.tags) && node.tags.length > 0) {
    for (let i = 0; i < node.tags.length; i++) {
      tagsWidth += measureTextWidth(String(node.tags[i]), 10, "600") + 18;
    }
    tagsWidth += 6;
  }

  const padX = isRoot ? 26 : 20;
  const padY = isRoot ? 16 : 13;
  const minH = isRoot ? 48 : (isLevel1 ? 42 : 38);

  node.contentWidth = extraLeftWidth + textWidth + tagsWidth;
  node.width = Math.ceil(node.contentWidth + padX * 2);
  const rawH = Math.ceil((lines.length - 1) * lineHeight + fontSize + padY * 2);
  node.height = Math.max(minH, rawH);

  node.extraLeftWidth = extraLeftWidth;
  node.textWidth = textWidth;
  node.lines = lines;
  node.lineHeight = lineHeight;
  node._sizeSignature = contentSignature;
}

export function computeLayout(root, level = 0, focusedRootId = "root", structure = "mindmap", density = "normal") {
  const spacing = SPACING_CONFIG[density] || SPACING_CONFIG.normal;
  const { hGap, vGap } = spacing;

  const postOrder = [];
  const stack = [{ node: root, lvl: level }];

  while (stack.length > 0) {
    const { node, lvl } = stack.pop();
    measureNodeSize(node, lvl, focusedRootId);

    node.treeMinX = undefined;
    node.treeMaxX = undefined;
    node.treeMinY = undefined;
    node.treeMaxY = undefined;

    postOrder.push({ node, lvl });
    if (node.children && !node.collapsed) {
      for (let i = 0; i < node.children.length; i++) {
        stack.push({ node: node.children[i], lvl: lvl + 1 });
      }
    }
  }

  for (let i = postOrder.length - 1; i >= 0; i--) {
    const { node } = postOrder[i];
    if (!node.children || node.children.length === 0 || node.collapsed) {
      node.treeHeight = node.height;
      node.treeWidth = node.width;
      continue;
    }

    if (structure === "org-down") {
      let childrenWidth = 0;
      node.children.forEach((child, idx) => {
        childrenWidth += child.treeWidth;
        if (idx > 0) childrenWidth += hGap;
      });
      node.treeWidth = Math.max(node.width, childrenWidth);
      node.treeHeight = node.height;
    } else if (structure === "mindmap" && node.id === focusedRootId) {
      node.rightChildren = [];
      node.leftChildren = [];
      node.children.forEach((child, idx) => {
        idx % 2 === 0 ? node.rightChildren.push(child) : node.leftChildren.push(child);
      });

      let rHeight = 0, rWidth = 0;
      node.rightChildren.forEach((child, idx) => {
        rHeight += child.treeHeight;
        if (idx > 0) rHeight += vGap;
        rWidth = Math.max(rWidth, child.treeWidth || child.width);
      });
      node.rightTreeHeight = Math.max(node.height, rHeight);

      let lHeight = 0, lWidth = 0;
      node.leftChildren.forEach((child, idx) => {
        lHeight += child.treeHeight;
        if (idx > 0) lHeight += vGap;
        lWidth = Math.max(lWidth, child.treeWidth || child.width);
      });
      node.leftTreeHeight = Math.max(node.height, lHeight);
      node.treeHeight = Math.max(node.rightTreeHeight, node.leftTreeHeight);
      // 🌟 修复：完整计算双向思维导图根节点包含双翼分支的总宽度
      node.treeWidth = node.width + (rWidth > 0 ? (hGap + rWidth) : 0) + (lWidth > 0 ? (hGap + lWidth) : 0);
    } else {
      let childrenHeight = 0, maxChildW = 0;
      node.children.forEach((child, idx) => {
        childrenHeight += child.treeHeight;
        if (idx > 0) childrenHeight += vGap;
        maxChildW = Math.max(maxChildW, child.treeWidth || child.width);
      });
      node.treeHeight = Math.max(node.height, childrenHeight);
      // 🌟 修复：完整计算单向延伸逻辑图的分支总跨度宽度
      node.treeWidth = node.width + (node.children.length > 0 ? (hGap + maxChildW) : 0);
    }
  }
}

export function assignCoordinates(root, startX, startY, focusedRootId = "root", structure = "mindmap", defDirection = null, defTheme = null, paletteKey = "apple-classic", density = "normal", targetSpatialIndex = null) {
  const currentPalette = COLOR_PALETTES[paletteKey] || COLOR_PALETTES["apple-classic"];
  const paletteList = currentPalette.branches;
  const spacing = SPACING_CONFIG[density] || SPACING_CONFIG.normal;
  const { hGap, vGap } = spacing;

  if (targetSpatialIndex) targetSpatialIndex.clear();

  let initialDir = defDirection;
  if (!initialDir) {
    initialDir = (structure === "logic-left") ? "left" : ((structure === "org-down") ? "down" : "right");
  }

  const queue = [{
    node: root,
    x: startX,
    y: startY,
    direction: initialDir,
    theme: defTheme
  }];

  const processedList = [];

  while (queue.length > 0) {
    const { node, x, y, direction, theme } = queue.shift();
    node.x = x;
    node.y = y;
    node.branchDirection = direction;
    node.paletteKey = paletteKey;

    node.treeMinX = node.x;
    node.treeMaxX = node.x + node.width;
    node.treeMinY = node.y;
    node.treeMaxY = node.y + node.height;

    if (node.id === focusedRootId) node.rootTheme = currentPalette.root;
    if (theme) node.colorTheme = theme;

    if (targetSpatialIndex) {
      targetSpatialIndex.insert({
        id: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        node: node
      });
    }

    processedList.push(node);

    if (node.children && node.children.length > 0 && !node.collapsed) {
      if (structure === "org-down") {
        let curX = x + node.width / 2 - node.treeWidth / 2;
        node.children.forEach((child, idx) => {
          const nextTheme = (node.id === focusedRootId) ? paletteList[idx % paletteList.length] : node.colorTheme;
          const childX = curX + child.treeWidth / 2 - child.width / 2;
          queue.push({ node: child, x: childX, y: y + node.height + 48, direction: "down", theme: nextTheme });
          curX += child.treeWidth + hGap;
        });
      } else if (structure === "mindmap" && node.id === focusedRootId) {
        let startYR = y + node.height / 2 - node.rightTreeHeight / 2;
        node.rightChildren.forEach((child, idx) => {
          const nextTheme = paletteList[(idx * 2) % paletteList.length];
          const childY = startYR + child.treeHeight / 2 - child.height / 2;
          queue.push({ node: child, x: x + node.width + hGap, y: childY, direction: "right", theme: nextTheme });
          startYR += child.treeHeight + vGap;
        });

        let startYL = y + node.height / 2 - node.leftTreeHeight / 2;
        node.leftChildren.forEach((child, idx) => {
          const nextTheme = paletteList[(idx * 2 + 1) % paletteList.length];
          const childY = startYL + child.treeHeight / 2 - child.height / 2;
          queue.push({ node: child, x: x - child.width - hGap, y: childY, direction: "left", theme: nextTheme });
          startYL += child.treeHeight + vGap;
        });
      } else {
        const activeDir = (structure === "logic-left") ? "left" : (structure === "logic-right" ? "right" : direction);
        let curY = y + node.height / 2 - node.treeHeight / 2;

        node.children.forEach((child, idx) => {
          const nextTheme = (node.id === focusedRootId) ? paletteList[idx % paletteList.length] : node.colorTheme;
          const childY = curY + child.treeHeight / 2 - child.height / 2;
          const childX = (activeDir === "left") ? (x - child.width - hGap) : (x + node.width + hGap);
          queue.push({ node: child, x: childX, y: childY, direction: activeDir, theme: nextTheme });
          curY += child.treeHeight + vGap;
        });
      }
    }
  }

  for (let i = processedList.length - 1; i >= 0; i--) {
    const node = processedList[i];
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
}
