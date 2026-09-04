import { state, findNode } from "../core/state.js";
import { camera, requestTransformUpdate } from "../core/camera.js";

const minimapWidget = document.getElementById("minimap-widget");
const minimapCanvas = document.getElementById("minimap-canvas");
const viewportBox = document.getElementById("minimap-viewport-box");
const viewport = document.getElementById("viewport");

let isDraggingMinimap = false;
let cachedMinX = 0, cachedMinY = 0, cachedPadding = 100, cachedScaleRatio = 1, cachedOffsetX = 0, cachedOffsetY = 0;

function isMinimapInactive() {
  const home = document.getElementById("home-view");
  return (home && !home.classList.contains("hidden")) ||
    state.viewMode === "outliner" ||
    !minimapWidget ||
    !minimapCanvas ||
    minimapWidget.classList.contains("hidden");
}

export function updateMinimap() {
  if (isMinimapInactive()) {
    if (viewportBox) viewportBox.style.display = "none";
    return;
  }

  const vpW = viewport?.clientWidth || 0;
  const vpH = viewport?.clientHeight || 0;
  // 容器还未布局出有效宽高，不进行渲染
  if (vpW < 100 || vpH < 100) {
    if (viewportBox) viewportBox.style.display = "none";
    return;
  }

  const currentRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
  if (!currentRoot) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  function scanBounds(n) {
    if (n && n.x !== undefined && n.y !== undefined) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + (n.width || 80));
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + (n.height || 36));
    }
    if (n.children && !n.collapsed) n.children.forEach(scanBounds);
  }
  scanBounds(currentRoot);

  if (minX === Infinity || !isFinite(minX) || maxX <= minX || maxY <= minY) {
    if (viewportBox) viewportBox.style.display = "none";
    return;
  }

  const padding = 100;
  const worldW = (maxX - minX) + padding * 2;
  const worldH = (maxY - minY) + padding * 2;

  const dpr = window.devicePixelRatio || 1;
  const mapW = Math.max(40, minimapWidget.offsetWidth || 180);
  const mapH = Math.max(40, minimapWidget.offsetHeight || 120);

  if (minimapCanvas.width !== Math.round(mapW * dpr) || minimapCanvas.height !== Math.round(mapH * dpr)) {
    minimapCanvas.width = Math.round(mapW * dpr);
    minimapCanvas.height = Math.round(mapH * dpr);
  }

  const ctx = minimapCanvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, mapW, mapH);

  const scaleRatio = Math.min(mapW / worldW, mapH / worldH);
  if (!isFinite(scaleRatio) || scaleRatio <= 0) return;

  const offsetX = (mapW - worldW * scaleRatio) / 2;
  const offsetY = (mapH - worldH * scaleRatio) / 2;

  cachedMinX = minX;
  cachedMinY = minY;
  cachedPadding = padding;
  cachedScaleRatio = scaleRatio;
  cachedOffsetX = offsetX;
  cachedOffsetY = offsetY;

  function drawMiniNode(n) {
    if (n.x === undefined || n.y === undefined) return;
    const nx = (n.x - minX + padding) * scaleRatio + offsetX;
    const ny = (n.y - minY + padding) * scaleRatio + offsetY;
    const nw = Math.max(3, (n.width || 80) * scaleRatio);
    const nh = Math.max(2, (n.height || 36) * scaleRatio);
    
    ctx.fillStyle = n.id === state.focusedRootId ? "#0071e3" : (n.colorTheme ? n.colorTheme.border : "#94a3b8");
    ctx.fillRect(nx, ny, nw, nh);

    if (n.children && !n.collapsed) n.children.forEach(drawMiniNode);
  }
  drawMiniNode(currentRoot);

  if (viewportBox) viewportBox.style.display = "block";
  syncMinimapViewportBox();
}

export function syncMinimapViewportBox() {
  if (isMinimapInactive() || !viewportBox || !viewport) {
    if (viewportBox) viewportBox.style.display = "none";
    return;
  }

  const viewScreenW = viewport.clientWidth || 0;
  const viewScreenH = viewport.clientHeight || 0;
  if (viewScreenW < 100 || viewScreenH < 100 || !isFinite(cachedScaleRatio) || cachedScaleRatio <= 0) {
    viewportBox.style.display = "none";
    return;
  }

  const scale = camera.transform.scale || 1.0;
  const mapW = minimapWidget.offsetWidth || 180;
  const mapH = minimapWidget.offsetHeight || 120;

  const camWorldL = (-camera.transform.x) / scale;
  const camWorldT = (-camera.transform.y) / scale;
  const camWorldW = viewScreenW / scale;
  const camWorldH = viewScreenH / scale;

  let boxL = (camWorldL - cachedMinX + cachedPadding) * cachedScaleRatio + cachedOffsetX;
  let boxT = (camWorldT - cachedMinY + cachedPadding) * cachedScaleRatio + cachedOffsetY;
  let boxW = camWorldW * cachedScaleRatio;
  let boxH = camWorldH * cachedScaleRatio;

  // 严格限制指示框，杜绝产生全屏巨大高亮框
  boxW = Math.max(10, Math.min(mapW, boxW));
  boxH = Math.max(8, Math.min(mapH, boxH));
  boxL = Math.max(0, Math.min(mapW - boxW, boxL));
  boxT = Math.max(0, Math.min(mapH - boxH, boxT));

  viewportBox.style.display = "block";
  viewportBox.style.transform = `translate3d(${boxL}px, ${boxT}px, 0)`;
  viewportBox.style.width = `${boxW}px`;
  viewportBox.style.height = `${boxH}px`;
}

function panByMinimapEvent(e) {
  if (!minimapWidget || !viewport) return;
  const rect = minimapWidget.getBoundingClientRect();
  const clickMapX = e.clientX - rect.left;
  const clickMapY = e.clientY - rect.top;

  if (!cachedScaleRatio || !isFinite(cachedScaleRatio)) return;

  const worldX = (clickMapX - cachedOffsetX) / cachedScaleRatio + cachedMinX - cachedPadding;
  const worldY = (clickMapY - cachedOffsetY) / cachedScaleRatio + cachedMinY - cachedPadding;

  camera.transform.x = (viewport.clientWidth || window.innerWidth) / 2 - worldX * camera.transform.scale;
  camera.transform.y = (viewport.clientHeight || window.innerHeight) / 2 - worldY * camera.transform.scale;
  requestTransformUpdate();
  syncMinimapViewportBox();
}

function onWindowMouseMove(e) {
  if (!isDraggingMinimap) return;
  panByMinimapEvent(e);
}

function onWindowMouseUp() {
  isDraggingMinimap = false;
}

export function initMinimap() {
  if (minimapWidget && !minimapWidget._isBound) {
    minimapWidget.onmousedown = (e) => {
      e.stopPropagation();
      isDraggingMinimap = true;
      panByMinimapEvent(e);
    };
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
    minimapWidget._isBound = true;
  }
}
