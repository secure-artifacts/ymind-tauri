import { state, getActiveTab, findNode, getPrimarySelectedNode } from "./state.js";
import { getGlobalSettings } from "./config.js";
import { bus, EVENTS } from "./event-bus.js";
import { computeLayout, assignCoordinates } from "../geometry/layout.js";

export const camera = {
  transform: { x: window.innerWidth / 2 - 60, y: window.innerHeight / 2 - 30, scale: 1 },
  isTransformPending: false,
  cameraAnimationId: null,
  inertiaAnimationId: null
};

function syncTabCamera() {
  const curTab = getActiveTab();
  if (curTab) curTab.camera = { ...camera.transform };
}

export function requestTransformUpdate() {
  if (camera.isTransformPending) return;
  camera.isTransformPending = true;
  requestAnimationFrame(() => {
    bus.emit(EVENTS.RENDER_CANVAS_ONLY);
    bus.emit(EVENTS.TRANSFORM_CHANGE, camera.transform);
    camera.isTransformPending = false;
  });
}

export function startInertiaMomentum(vx, vy) {
  if (camera.inertiaAnimationId) cancelAnimationFrame(camera.inertiaAnimationId);

  state.isInteracting = true;
  const maxVel = 2.0;
  let curVx = Math.max(-maxVel, Math.min(maxVel, vx));
  let curVy = Math.max(-maxVel, Math.min(maxVel, vy));

  let lastTime = performance.now();
  const friction = 0.0085;

  function momentumStep(now) {
    const dt = Math.min(now - lastTime, 24);
    lastTime = now;
    const speed = Math.hypot(curVx, curVy);

    if (speed < 0.02) {
      camera.inertiaAnimationId = null;
      state.isInteracting = false;
      syncTabCamera();
      requestTransformUpdate();
      return;
    }

    camera.transform.x += curVx * dt;
    camera.transform.y += curVy * dt;

    const decay = Math.exp(-friction * dt);
    curVx *= decay;
    curVy *= decay;

    requestTransformUpdate();
    camera.inertiaAnimationId = requestAnimationFrame(momentumStep);
  }
  camera.inertiaAnimationId = requestAnimationFrame(momentumStep);
}

export function stopAllCameraAnimations() {
  if (camera.cameraAnimationId) {
    cancelAnimationFrame(camera.cameraAnimationId);
    camera.cameraAnimationId = null;
  }
  if (camera.inertiaAnimationId) {
    cancelAnimationFrame(camera.inertiaAnimationId);
    camera.inertiaAnimationId = null;
  }
  state.isInteracting = false;
}

export function springAnimateTo(targetX, targetY, targetScale = camera.transform.scale, tension = 170, friction = 22) {
  stopAllCameraAnimations();
  state.isInteracting = true;

  let curX = camera.transform.x, curY = camera.transform.y, curS = camera.transform.scale;
  let vx = 0, vy = 0, vs = 0;
  let lastTime = performance.now();

  function springStep(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.032);
    lastTime = now;

    const ax = -tension * (curX - targetX) - friction * vx;
    const ay = -tension * (curY - targetY) - friction * vy;
    const as = -tension * (curS - targetScale) - friction * vs;

    vx += ax * dt;
    vy += ay * dt;
    vs += as * dt;

    curX += vx * dt;
    curY += vy * dt;
    curS += vs * dt;

    camera.transform.x = curX;
    camera.transform.y = curY;
    camera.transform.scale = curS;
    requestTransformUpdate();

    const isResting = Math.abs(curX - targetX) < 0.4 && Math.abs(curY - targetY) < 0.4 &&
                      Math.abs(curS - targetScale) < 0.002 && Math.hypot(vx, vy, vs) < 0.1;

    if (isResting) {
      camera.transform.x = targetX;
      camera.transform.y = targetY;
      camera.transform.scale = targetScale;
      camera.cameraAnimationId = null;
      state.isInteracting = false;
      syncTabCamera();
      requestTransformUpdate();
    } else {
      camera.cameraAnimationId = requestAnimationFrame(springStep);
    }
  }
  camera.cameraAnimationId = requestAnimationFrame(springStep);
}

// 🌟 强健的自适应全景居中：确保未就绪时自动核算，无论聚焦何处均能完美自适应视口
export function smartAdaptiveCenter(nodeOrId = null, animated = true) {
  const currentRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
  if (!currentRoot) return;

  const vp = document.getElementById("viewport");
  if (!vp) return;

  const usableW = vp.clientWidth || window.innerWidth;
  const usableH = vp.clientHeight || window.innerHeight;

  // 若节点未曾计算过坐标，先跑一次几何解算
  if (currentRoot.x === undefined || currentRoot.y === undefined) {
    computeLayout(currentRoot, 0, state.focusedRootId, state.layoutStructure, state.nodeSpacing || "normal");
    assignCoordinates(currentRoot, 0, 0, state.focusedRootId, state.layoutStructure, null, null, state.colorPalette || "apple-classic", state.nodeSpacing || "normal", getActiveTab()?.spatialIndex);
    state.isLayoutDirty = false;
  }

  let targetNode = currentRoot;
  if (typeof nodeOrId === "string") {
    targetNode = findNode(nodeOrId, currentRoot) || currentRoot;
  } else if (nodeOrId && typeof nodeOrId === "object" && nodeOrId.id) {
    targetNode = nodeOrId;
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  function scan(n) {
    if (n.x !== undefined && n.y !== undefined) {
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + (n.width || 80));
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + (n.height || 36));
    }
    if (n.children && !n.collapsed) n.children.forEach(scan);
  }
  scan(targetNode);

  if (minX === Infinity) {
    stopAllCameraAnimations();
    camera.transform.x = usableW / 2 - 60;
    camera.transform.y = usableH / 2 - 30;
    camera.transform.scale = 1.0;
    syncTabCamera();
    requestTransformUpdate();
    return;
  }

  const padX = 120, padY = 90;
  const totalW = (maxX - minX) + padX * 2;
  const totalH = (maxY - minY) + padY * 2;

  const fitScale = Math.min(usableW / totalW, usableH / totalH);
  const targetScale = Math.max(0.15, Math.min(1.2, fitScale));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const targetX = usableW / 2 - centerX * targetScale;
  const targetY = usableH / 2 - centerY * targetScale;

  if (animated) {
    springAnimateTo(targetX, targetY, targetScale, 170, 22);
  } else {
    stopAllCameraAnimations();
    camera.transform.x = targetX;
    camera.transform.y = targetY;
    camera.transform.scale = targetScale;
    syncTabCamera();
    requestTransformUpdate();
  }
}

// 统一的视口中心定比缩放
export function zoomViewportByFactor(factor) {
  const vp = document.getElementById("viewport");
  const cx = (vp?.clientWidth || window.innerWidth) / 2;
  const cy = (vp?.clientHeight || window.innerHeight) / 2;
  const oldScale = camera.transform.scale;
  const newScale = Math.min(3.0, Math.max(0.15, oldScale * factor));
  camera.transform.x = cx - (cx - camera.transform.x) * (newScale / oldScale);
  camera.transform.y = cy - (cy - camera.transform.y) * (newScale / oldScale);
  camera.transform.scale = newScale;
  syncTabCamera();
  requestTransformUpdate();
}

// 统一的 100% 居中复位
export function resetZoom100() {
  const vp = document.getElementById("viewport");
  const cx = (vp?.clientWidth || window.innerWidth) / 2;
  const cy = (vp?.clientHeight || window.innerHeight) / 2;
  const oldScale = camera.transform.scale;
  camera.transform.x = cx - (cx - camera.transform.x) * (1.0 / oldScale);
  camera.transform.y = cy - (cy - camera.transform.y) * (1.0 / oldScale);
  camera.transform.scale = 1.0;
  syncTabCamera();
  requestTransformUpdate();
}

export function locateFocusedNode(nodeOrId = null, animated = true) {
  const followMode = getGlobalSettings().focusFollowMode || "smooth";
  if (followMode === "off") return;

  const root = state.mindData;
  if (!root) return;

  const vp = document.getElementById("viewport");
  if (!vp) return;

  let targetNode = null;
  if (typeof nodeOrId === "string") targetNode = findNode(nodeOrId, root);
  else if (nodeOrId && typeof nodeOrId === "object" && nodeOrId.id) targetNode = nodeOrId;
  else targetNode = getPrimarySelectedNode();

  if (!targetNode || targetNode.x === undefined) return;

  const screenW = vp.clientWidth || window.innerWidth;
  const screenH = vp.clientHeight || window.innerHeight;
  const currentScale = camera.transform.scale;

  const nodeScreenX = targetNode.x * currentScale + camera.transform.x;
  const nodeScreenY = targetNode.y * currentScale + camera.transform.y;
  const nodeScreenW = (targetNode.width || 80) * currentScale;
  const nodeScreenH = (targetNode.height || 36) * currentScale;

  const safeMarginX = Math.max(140, screenW * 0.16);
  const safeMarginY = Math.max(100, screenH * 0.16);

  const isInsideSafeZone =
    nodeScreenX >= safeMarginX &&
    nodeScreenX + nodeScreenW <= screenW - safeMarginX &&
    nodeScreenY >= safeMarginY &&
    nodeScreenY + nodeScreenH <= screenH - safeMarginY;

  if (isInsideSafeZone) return;

  const nodeCenterX = targetNode.x + (targetNode.width || 80) / 2;
  const nodeCenterY = targetNode.y + (targetNode.height || 36) / 2;

  const targetX = screenW / 2 - nodeCenterX * currentScale;
  const targetY = screenH / 2 - nodeCenterY * currentScale;

  if (animated && followMode === "smooth") {
    springAnimateTo(targetX, targetY, currentScale, 190, 24);
  } else {
    stopAllCameraAnimations();
    camera.transform.x = targetX;
    camera.transform.y = targetY;
    syncTabCamera();
    requestTransformUpdate();
  }
}

export function smartCenterOnSelectedNode(stateRef, animated = true) { smartAdaptiveCenter(null, animated); }
export function locateNodeCenter(nodeOrId = null, animated = true) { locateFocusedNode(nodeOrId, animated); }
export function ensureNodeVisible(nodeOrId = null, animated = true) { locateFocusedNode(nodeOrId, animated); }
