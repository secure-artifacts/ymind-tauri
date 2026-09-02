import { findParent, getPrimarySelectedNode, findNode, state, getGlobalSettings } from "./state.js";
import { syncMinimapViewportBox } from "../render/minimap.js";

export const camera = {
  transform: { x: window.innerWidth / 3, y: window.innerHeight / 2 - 40, scale: 1 },
  isTransformPending: false,
  cameraAnimationId: null,
  inertiaAnimationId: null
};
window.__CAMERA_TRANSFORM__ = camera.transform;

export function requestTransformUpdate() {
  if (camera.isTransformPending) return;
  camera.isTransformPending = true;
  requestAnimationFrame(() => {
    const x = camera.transform.x;
    const y = camera.transform.y;
    const s = camera.transform.scale;
    const targetEl = document.getElementById("canvas-stage");
    if (targetEl) {
      targetEl.setAttribute("transform", "translate(" + x + " " + y + ") scale(" + s + ")");
    }
    syncMinimapViewportBox();
    camera.isTransformPending = false;
  });
}

export function startInertiaMomentum(vx, vy) {
  if (camera.inertiaAnimationId) cancelAnimationFrame(camera.inertiaAnimationId);
  let curVx = vx;
  let curVy = vy;
  const friction = 0.86;
  const minVelocity = 0.02;
  function momentumStep() {
    if (Math.abs(curVx) < minVelocity && Math.abs(curVy) < minVelocity) {
      camera.inertiaAnimationId = null;
      return;
    }
    camera.transform.x += curVx * 10;
    camera.transform.y += curVy * 10;
    curVx *= friction;
    curVy *= friction;
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
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function smoothPanTo(targetX, targetY, targetScale = camera.transform.scale, duration = 200) {
  stopAllCameraAnimations();
  const startX = camera.transform.x;
  const startY = camera.transform.y;
  const startScale = camera.transform.scale;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = easeOutCubic(progress);

    camera.transform.x = startX + (targetX - startX) * ease;
    camera.transform.y = startY + (targetY - startY) * ease;
    camera.transform.scale = startScale + (targetScale - startScale) * ease;
    requestTransformUpdate();

    if (progress < 1) camera.cameraAnimationId = requestAnimationFrame(step);
    else camera.cameraAnimationId = null;
  }
  camera.cameraAnimationId = requestAnimationFrame(step);
}

// 🌟 全局焦点移动平滑定位引擎（避让右侧面板，平滑居中聚焦）
export function locateFocusedNode(nodeOrId = null, animated = true) {
  const followMode = getGlobalSettings().focusFollowMode || "smooth";
  if (followMode === "off") return; // 关闭移动定位

  const vp = document.getElementById("viewport");
  if (!vp || !state.mindData) return;

  let targetNode = null;
  if (typeof nodeOrId === "string") {
    targetNode = findNode(nodeOrId, state.mindData);
  } else if (nodeOrId && typeof nodeOrId === "object") {
    targetNode = nodeOrId;
  } else {
    targetNode = getPrimarySelectedNode();
  }

  if (!targetNode || targetNode.x === undefined || targetNode.y === undefined) return;

  const vpRect = vp.getBoundingClientRect();
  const s = camera.transform.scale;

  // 避让右侧打开的检查器面板 (340px)
  const isInspectorOpen = !document.getElementById("format-sidebar")?.classList.contains("collapsed");
  const usableWidth = isInspectorOpen ? Math.max(300, vpRect.width - 340) : vpRect.width;

  const targetScreenX = usableWidth * 0.46;
  const targetScreenY = vpRect.height * 0.5;

  const targetX = targetScreenX - (targetNode.x + (targetNode.width || 80) / 2) * s;
  const targetY = targetScreenY - (targetNode.y + (targetNode.height || 36) / 2) * s;

  const dist = Math.hypot(targetX - camera.transform.x, targetY - camera.transform.y);
  if (dist < 3) return;

  if (followMode === "instant" || !animated) {
    stopAllCameraAnimations();
    camera.transform.x = targetX;
    camera.transform.y = targetY;
    requestTransformUpdate();
  } else {
    smoothPanTo(targetX, targetY, s, 220);
  }
}

export function smartCenterOnSelectedNode(state, animated = true) {
  locateFocusedNode(getPrimarySelectedNode(), animated);
}

export function locateNodeCenter(nodeOrId = null, animated = true) {
  locateFocusedNode(nodeOrId, animated);
}

export function ensureNodeVisible(nodeOrId = null, animated = true) {
  locateFocusedNode(nodeOrId, animated);
}
