import { findParent, getPrimarySelectedNode } from "./state.js";
import { syncMinimapViewportBox } from "../render/minimap.js";

let lastCullCam = { x: window.innerWidth / 3, y: window.innerHeight / 2 - 40, scale: 1 };
let cullTimer = null;

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

    const targetEl = document.getElementById("canvas-stage"); if (targetEl) { targetEl.setAttribute("transform", "translate(" + x + " " + y + ") scale(" + s + ")"); }

    syncMinimapViewportBox();
    camera.isTransformPending = false;

    const dist = Math.hypot(x - lastCullCam.x, y - lastCullCam.y) / s;
    const scaleDiff = Math.abs(s - lastCullCam.scale) / lastCullCam.scale;
    // 禁用平移期间的 DOM 暴力清空，保持极致丝滑与完整呈现
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

export function smoothPanTo(targetX, targetY, targetScale = camera.transform.scale, duration = 240) {
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

export function smartCenterOnSelectedNode(state, animated = true) {
  const targetNode = getPrimarySelectedNode();
  let anchor = targetNode;
  const vp = document.getElementById("viewport");
  if (!anchor || !vp) return;

  const hasExpandedChildren = anchor.children && anchor.children.length > 0 && !anchor.collapsed;
  if (!hasExpandedChildren && anchor.id !== state.focusedRootId) {
    const parent = findParent(anchor.id, state.mindData);
    if (parent) anchor = parent;
  }

  const rect = vp.getBoundingClientRect();
  const targetScreenX = rect.width * 0.35;
  const targetScreenY = rect.height * 0.5;

  const targetX = targetScreenX - (anchor.x + anchor.width / 2) * camera.transform.scale;
  const targetY = targetScreenY - (anchor.y + anchor.height / 2) * camera.transform.scale;

  if (animated) smoothPanTo(targetX, targetY);
  else {
    stopAllCameraAnimations();
    camera.transform.x = targetX;
    camera.transform.y = targetY;
    requestTransformUpdate();
  }
}