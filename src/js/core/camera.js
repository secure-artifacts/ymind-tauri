import { findParent, getPrimarySelectedNode, findNode, state, getActiveTab, getGlobalSettings } from "./state.js";
import { syncMinimapViewportBox } from "../render/minimap.js";

export const camera = {
  transform: { x: window.innerWidth / 3, y: window.innerHeight / 2 - 40, scale: 1 },
  isTransformPending: false,
  cameraAnimationId: null,
  inertiaAnimationId: null
};
window.__CAMERA_TRANSFORM__ = camera.transform;

function syncTabCamera() {
  const curTab = getActiveTab();
  if (curTab) curTab.camera = { ...camera.transform };
}

export function requestTransformUpdate() {
  if (camera.isTransformPending) return;
  camera.isTransformPending = true;
  requestAnimationFrame(() => {
    const x = camera.transform.x;
    const y = camera.transform.y;
    const s = camera.transform.scale;
    const targetEl = document.getElementById("canvas-stage");
    if (targetEl) {
      targetEl.setAttribute("transform", `translate(${x} ${y}) scale(${s})`);
    }
    syncMinimapViewportBox();
    
    const zt = document.getElementById("txt-zoom-level");
    if (zt) zt.innerText = `${Math.round(s * 100)}%`;

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
      syncTabCamera();
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

export function smoothPanTo(targetX, targetY, targetScale = camera.transform.scale, duration = 280) {
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

    if (progress < 1) {
      camera.cameraAnimationId = requestAnimationFrame(step);
    } else {
      camera.cameraAnimationId = null;
      syncTabCamera();
    }
  }
  camera.cameraAnimationId = requestAnimationFrame(step);
}

/**
 * 🌟 核心算法：以「锚点节点 + 直接子节点列表」作为精确范围与数量考量单元
 */
function getDirectChildrenCluster(targetNode, root) {
  if (!targetNode || !root) return null;

  const isRoot = targetNode.id === (state.focusedRootId || root.id);
  const structure = state.layoutStructure || "mindmap";

  let anchorNode = targetNode;

  // 1. 无子节点的叶子节点：锚点提升为其直接父节点
  if (!isRoot && (!targetNode.children || targetNode.children.length === 0 || targetNode.collapsed)) {
    const parent = findParent(targetNode.id, root);
    if (parent) anchorNode = parent;
  }

  const isAnchorRoot = anchorNode.id === (state.focusedRootId || root.id);
  const directChildren = (anchorNode.children && !anchorNode.collapsed) ? anchorNode.children : [];
  const childCount = directChildren.length;

  // 2. 双向导图根节点的对称平衡范围
  if (isAnchorRoot && structure === "mindmap") {
    const rootCenterX = root.x + (root.width || 80) / 2;
    const rootCenterY = root.y + (root.height || 36) / 2;

    let leftMax = 0;
    let rightMax = 0;
    let minY = root.y;
    let maxY = root.y + (root.height || 36);

    // 收集根节点自身的直接子节点
    directChildren.forEach(c => {
      if (c.x !== undefined && c.y !== undefined) {
        const w = c.width || 80;
        const h = c.height || 36;
        if (c.x < rootCenterX) leftMax = Math.max(leftMax, rootCenterX - c.x);
        if (c.x + w > rootCenterX) rightMax = Math.max(rightMax, (c.x + w) - rootCenterX);
        minY = Math.min(minY, c.y);
        maxY = Math.max(maxY, c.y + h);
      }
    });

    const maxHalfWidth = Math.max(leftMax, rightMax);
    const symmetricWidth = maxHalfWidth * 2;
    const totalHeight = maxY - minY;

    return {
      width: Math.max(root.width || 80, symmetricWidth),
      height: totalHeight,
      centerX: rootCenterX,
      centerY: (minY + maxY) / 2,
      childCount: childCount,
      isRoot: true
    };
  }

  // 3. 常规分支锚点：仅包含 [anchorNode 自身 + 其全部直接子节点]
  const focusGroup = [anchorNode, ...directChildren];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  focusGroup.forEach(n => {
    if (n.x !== undefined && n.y !== undefined) {
      const w = n.width || 80;
      const h = n.height || 36;
      minX = Math.min(minX, n.x);
      maxX = Math.max(maxX, n.x + w);
      minY = Math.min(minY, n.y);
      maxY = Math.max(maxY, n.y + h);
    }
  });

  if (minX === Infinity) return null;

  return {
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    childCount: childCount,
    isRoot: isAnchorRoot
  };
}

/**
 * 🌟 自适应直接子节点范围与数量的动态平衡缩放
 */
export function smartAdaptiveCenter(nodeOrId = null, animated = true) {
  const root = state.mindData;
  if (!root) return;

  const vp = document.getElementById("viewport");
  if (!vp) return;

  const vpRect = vp.getBoundingClientRect();
  const usableWidth = vpRect.width > 0 ? vpRect.width : window.innerWidth;
  const usableHeight = vpRect.height > 0 ? vpRect.height : window.innerHeight;

  let targetNode = null;
  if (typeof nodeOrId === "string") targetNode = findNode(nodeOrId, root);
  else if (nodeOrId && typeof nodeOrId === "object" && nodeOrId.id && nodeOrId.x !== undefined) targetNode = nodeOrId;
  else targetNode = getPrimarySelectedNode();

  if (!targetNode) targetNode = findNode(state.focusedRootId, root) || root;

  // 获取「锚点 + 直接子节点」的紧凑范围与子节点数量
  const cluster = getDirectChildrenCluster(targetNode, root);
  if (!cluster) return;

  // 视口安全内边距
  const padX = cluster.isRoot ? 90 : 75;
  const padY = cluster.isRoot ? 70 : 55;
  const totalW = cluster.width + padX * 2;
  const totalH = cluster.height + padY * 2;

  // 几何理想适配比例
  let fitScale = Math.min(usableWidth / totalW, usableHeight / totalH);

  // ⚖️ 子节点数量与缩放比例联动规则：
  // 1. 无子节点或极少子节点 (k <= 3): 100% 显示，绝无冗余缩小与放大
  // 2. 中等子节点 (4 <= k <= 8): 适配缩放，可读性下限保底 0.75
  // 3. 密集多子节点 (k > 8): 适配缩放，可读性下限保底 0.65
  let minAllowed = 0.65;
  if (cluster.isRoot) {
    minAllowed = 0.45;
  } else if (cluster.childCount <= 3) {
    minAllowed = 0.88;
  } else if (cluster.childCount <= 8) {
    minAllowed = 0.72;
  }

  let targetScale = Math.max(minAllowed, Math.min(1.00, fitScale));

  // 舒适度吸附：如果计算结果非常接近 100% (>= 0.88 且放得下)，吸附为 1.00 原生清晰度
  if (targetScale >= 0.88 && fitScale >= 0.88) {
    targetScale = 1.00;
  }

  // 中心对齐
  const screenCenterX = usableWidth * 0.50;
  const screenCenterY = usableHeight * 0.50;
  const targetX = screenCenterX - cluster.centerX * targetScale;
  const targetY = screenCenterY - cluster.centerY * targetScale;

  if (animated) {
    smoothPanTo(targetX, targetY, targetScale, 280);
  } else {
    stopAllCameraAnimations();
    camera.transform.x = targetX;
    camera.transform.y = targetY;
    camera.transform.scale = targetScale;
    syncTabCamera();
    requestTransformUpdate();
  }
}

export function locateFocusedNode(nodeOrId = null, animated = true) {
  const followMode = getGlobalSettings().focusFollowMode || "smooth";
  if (followMode === "off") return;
  smartAdaptiveCenter(nodeOrId, animated);
}

export function smartCenterOnSelectedNode(stateRef, animated = true) {
  smartAdaptiveCenter(null, animated);
}

export function locateNodeCenter(nodeOrId = null, animated = true) {
  smartAdaptiveCenter(nodeOrId, animated);
}

export function ensureNodeVisible(nodeOrId = null, animated = true) {
  smartAdaptiveCenter(nodeOrId, animated);
}
