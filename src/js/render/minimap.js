import { state, findNode } from "../core/state.js";
import { camera, requestTransformUpdate } from "../core/camera.js";

const minimapWidget = document.getElementById("minimap-widget");
const minimapCanvas = document.getElementById("minimap-canvas");
const viewportBox = document.getElementById("minimap-viewport-box");
const viewport = document.getElementById("viewport");

let isDraggingMinimap = false;
let cachedMinX = 0, cachedMinY = 0, cachedPadding = 100, cachedScaleRatio = 1, cachedOffsetX = 0, cachedOffsetY = 0;

export function updateMinimap() {
  if (state.viewMode === "outliner" || !minimapWidget || !minimapCanvas) return;

  const currentRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  function scanBounds(n) {
    if (n.x !== undefined && n.y !== undefined) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + n.width);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + n.height);
    }
    if (n.children && !n.collapsed) n.children.forEach(scanBounds);
  }
  scanBounds(currentRoot);

  if (minX === Infinity) return;

  const padding = 100;
  const worldW = (maxX - minX) + padding * 2;
  const worldH = (maxY - minY) + padding * 2;

  const dpr = window.devicePixelRatio || 1;
  const mapW = minimapWidget.offsetWidth || 180;
  const mapH = minimapWidget.offsetHeight || 120;

  if (minimapCanvas.width !== mapW * dpr || minimapCanvas.height !== mapH * dpr) {
    minimapCanvas.width = mapW * dpr;
    minimapCanvas.height = mapH * dpr;
  }

  const ctx = minimapCanvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, mapW, mapH);

  const scaleRatio = Math.min(mapW / worldW, mapH / worldH);
  const offsetX = (mapW - worldW * scaleRatio) / 2;
  const offsetY = (mapH - worldH * scaleRatio) / 2;

  cachedMinX = minX;
  cachedMinY = minY;
  cachedPadding = padding;
  cachedScaleRatio = scaleRatio;
  cachedOffsetX = offsetX;
  cachedOffsetY = offsetY;

  function drawMiniNode(n) {
    const nx = (n.x - minX + padding) * scaleRatio + offsetX;
    const ny = (n.y - minY + padding) * scaleRatio + offsetY;
    const nw = Math.max(4, n.width * scaleRatio);
    const nh = Math.max(2, n.height * scaleRatio);
    
    ctx.fillStyle = n.id === state.focusedRootId ? "#0071e3" : (n.colorTheme ? n.colorTheme.border : "#94a3b8");
    ctx.fillRect(nx, ny, nw, nh);

    if (n.children && !n.collapsed) n.children.forEach(drawMiniNode);
  }
  drawMiniNode(currentRoot);
  syncMinimapViewportBox();
}

export function syncMinimapViewportBox() {
  if (state.viewMode === "outliner" || !viewportBox || !viewport) return;

  const viewScreenW = viewport.clientWidth || window.innerWidth;
  const viewScreenH = viewport.clientHeight || window.innerHeight;

  const camWorldL = (-camera.transform.x) / camera.transform.scale;
  const camWorldT = (-camera.transform.y) / camera.transform.scale;
  const camWorldW = viewScreenW / camera.transform.scale;
  const camWorldH = viewScreenH / camera.transform.scale;

  const boxL = (camWorldL - cachedMinX + cachedPadding) * cachedScaleRatio + cachedOffsetX;
  const boxT = (camWorldT - cachedMinY + cachedPadding) * cachedScaleRatio + cachedOffsetY;
  const boxW = camWorldW * cachedScaleRatio;
  const boxH = camWorldH * cachedScaleRatio;

  viewportBox.style.transform = `translate3d(${boxL}px, ${boxT}px, 0)`;
  viewportBox.style.width = `${Math.max(10, boxW)}px`;
  viewportBox.style.height = `${Math.max(8, boxH)}px`;
}

if (minimapWidget) {
  minimapWidget.onmousedown = (e) => {
    isDraggingMinimap = true;
    panByMinimapEvent(e);
  };
}

window.addEventListener("mousemove", (e) => {
  if (!isDraggingMinimap) return;
  panByMinimapEvent(e);
});

window.addEventListener("mouseup", () => {
  isDraggingMinimap = false;
});

function panByMinimapEvent(e) {
  const rect = minimapWidget.getBoundingClientRect();
  const clickMapX = e.clientX - rect.left;
  const clickMapY = e.clientY - rect.top;

  const worldX = (clickMapX - cachedOffsetX) / cachedScaleRatio + cachedMinX - cachedPadding;
  const worldY = (clickMapY - cachedOffsetY) / cachedScaleRatio + cachedMinY - cachedPadding;

  camera.transform.x = (viewport.clientWidth || window.innerWidth) / 2 - worldX * camera.transform.scale;
  camera.transform.y = (viewport.clientHeight || window.innerHeight) / 2 - worldY * camera.transform.scale;
  requestTransformUpdate();
  syncMinimapViewportBox();
}
