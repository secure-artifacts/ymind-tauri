import { saveSessionImmediate } from "../storage/session.js";
import { state, getActiveTab, createNewTab, getPrimarySelectedNode, findNode } from "../core/state.js";
import { saveSnapshot } from "../core/history.js";
import { isNodeVisibleInTree } from "../core/tree-utils.js";
import { camera, requestTransformUpdate, startInertiaMomentum, stopAllCameraAnimations, locateFocusedNode, smartAdaptiveCenter, zoomViewportByFactor, resetZoom100 } from "../core/camera.js";
import { syncInspectorUi, applyCanvasThemeToBody } from "./inspector.js";
import { openNotesDrawer, syncNotesDrawerWithActiveNode, closeNotesDrawer } from "./notes.js";
import { showToast } from "./dialog.js";
import { serializeTabToPackage, deserializePackage, parseTextToTree, extractRealXMindZip } from "../core/serializer.js";
import { recordRecentDoc } from "./home.js";
import { showLockScreen, updateSecurityDockStatus } from "./vault.js";
import { startEditNode, setDropIndicator } from "../render/render.js";
import { addChildNode, addSiblingNode, deleteSelectedNodes, markDirtyAndRefresh } from "../interaction/node-actions.js";
import { bindGlobalShortcuts } from "../interaction/shortcuts.js";
import { bus, EVENTS } from "../core/event-bus.js";
import { findParent, getAncestors } from "../core/state.js";

let peekTargetNode = null;
let gDragNode = null;
let gIsDragging = false;
let gDragStart = { x: 0, y: 0 };
let gDropTarget = null;

// 🌟 强大的全树拓扑拾取算法：智能判定“跨分支挂载改父级”与“同级兄弟插入排序”
function calculateFullTreeDrop(worldX, worldY, dragNode) {
  if (!dragNode || dragNode.id === state.focusedRootId) return null;
  const curTab = getActiveTab();
  if (!curTab?.spatialIndex) return null;

  // 1. 优先判定：是否悬停在某个目标节点本体上方 -> 触发【跨分支挂载为子节点 (Reparent)】
  const hoverNode = curTab.spatialIndex.pickNode(worldX, worldY, 10);
  const currentParent = findParent(dragNode.id, state.mindData);

  // 正确防环校验：目标节点不能是自身、不能是自身后代(防死循环)、且不能是当前直接父节点(已经是其子节点)
  const isDescendant = hoverNode ? Boolean(findNode(hoverNode.id, dragNode)) : false;
  const isCurrentParent = currentParent && hoverNode && currentParent.id === hoverNode.id;

  if (hoverNode && hoverNode.id !== dragNode.id && !isDescendant && !isCurrentParent) {
    return {
      type: "reparent",
      targetParent: hoverNode,
      indicator: {
        type: "reparent",
        x: hoverNode.x,
        y: hoverNode.y,
        width: hoverNode.width,
        height: hoverNode.height
      }
    };
  }

  // 2. 次级判定：是否处于当前父级下的同级兄弟槽位 -> 触发【同级插入排序】
  const parent = findParent(dragNode.id, state.mindData);
  if (!parent || !parent.children || parent.children.length <= 1) return null;

  const siblings = parent.children;
  const structure = state.layoutStructure || "mindmap";

  if (structure === "org-down") {
    let closest = -1, minD = Infinity;
    for (let i = 0; i <= siblings.length; i++) {
      let slotX;
      if (i === 0) slotX = siblings[0].x - 12;
      else if (i === siblings.length) slotX = siblings[siblings.length - 1].x + siblings[siblings.length - 1].width + 12;
      else slotX = (siblings[i - 1].x + siblings[i - 1].width + siblings[i].x) / 2;

      let d = Math.abs(worldX - slotX);
      if (d < minD && d < 70 && Math.abs(worldY - siblings[0].y) < 140) {
        minD = d;
        closest = i;
      }
    }
    if (closest !== -1) {
      let lineX;
      if (closest === 0) lineX = siblings[0].x - 8;
      else if (closest === siblings.length) lineX = siblings[siblings.length - 1].x + siblings[siblings.length - 1].width + 8;
      else lineX = (siblings[closest - 1].x + siblings[closest - 1].width + siblings[closest].x) / 2;

      return {
        type: "reorder",
        parent,
        insertIndex: closest,
        indicator: { x1: lineX, y1: siblings[0].y - 8, x2: lineX, y2: siblings[0].y + siblings[0].height + 8 }
      };
    }
  } else {
    const sameSide = siblings.filter(s => {
      if (structure === "mindmap" && parent.id === state.focusedRootId) {
        return s.branchDirection === dragNode.branchDirection;
      }
      return true;
    });
    if (sameSide.length > 1) {
      let closest = -1, minD = Infinity;
      for (let i = 0; i <= sameSide.length; i++) {
        let slotY;
        if (i === 0) slotY = sameSide[0].y - 10;
        else if (i === sameSide.length) slotY = sameSide[sameSide.length - 1].y + sameSide[sameSide.length - 1].height + 10;
        else slotY = (sameSide[i - 1].y + sameSide[i - 1].height + sameSide[i].y) / 2;

        let d = Math.abs(worldY - slotY);
        if (d < minD && d < 65 && Math.abs(worldX - sameSide[0].x) < 180) {
          minD = d;
          closest = i;
        }
      }

      if (closest !== -1) {
        let lineY;
        if (closest === 0) lineY = sameSide[0].y - 8;
        else if (closest === sameSide.length) lineY = sameSide[sameSide.length - 1].y + sameSide[sameSide.length - 1].height + 8;
        else lineY = (sameSide[closest - 1].y + sameSide[closest - 1].height + sameSide[closest].y) / 2;

        let minX = sameSide[0].x - 6;
        let maxX = sameSide[0].x + Math.max(...sameSide.map(s => s.width)) + 6;
        let insIdx = (closest === sameSide.length) ? (siblings.indexOf(sameSide[sameSide.length - 1]) + 1) : siblings.indexOf(sameSide[closest]);

        return {
          type: "reorder",
          parent,
          insertIndex: insIdx,
          indicator: { x1: minX, y1: lineY, x2: maxX, y2: lineY }
        };
      }
    }
  }

  return null;
}

async function callTauri(cmd, args = {}) {
  if (window.__TAURI__?.core?.invoke) return await window.__TAURI__.core.invoke(cmd, args);
  if (window.__TAURI__?.invoke) return await window.__TAURI__.invoke(cmd, args);
  if (window.__TAURI_INTERNALS__?.invoke) return await window.__TAURI_INTERNALS__.invoke(cmd, args);
  throw new Error("TAURI_IPC_UNAVAILABLE");
}



function computeDirectMarquee(minX, maxX, minY, maxY) {
  const { x, y, scale: s } = camera.transform;
  const worldL = (minX - x) / s, worldR = (maxX - x) / s;
  const worldT = (minY - y) / s, worldB = (maxY - y) / s;
  const hitSet = new Set();
  const root = findNode(state.focusedRootId, state.mindData) || state.mindData;
  if (!root) return hitSet;

  function traverse(n) {
    if (n.x !== undefined && n.y !== undefined) {
      const nx2 = n.x + n.width, ny2 = n.y + n.height;
      if (!(nx2 < worldL || n.x > worldR || ny2 < worldT || n.y > worldB)) {
        hitSet.add(n.id);
      }
    }
    if (n.children && !n.collapsed) {
      for (let i = 0; i < n.children.length; i++) traverse(n.children[i]);
    }
  }
  traverse(root);
  return hitSet;
}

export function updateSelectionOnly() {
  bus.emit(EVENTS.RENDER_APP);
  syncNotesDrawerWithActiveNode();
}

export async function handleLoadedFileContent(contentData, filePath, renderApp) {
  closeNotesDrawer();
  let parsed = null;
  if (contentData instanceof ArrayBuffer) {
    try {
      parsed = await extractRealXMindZip(contentData);
    } catch {
      contentData = new TextDecoder().decode(contentData);
    }
  }
  if (typeof contentData === "string") {
    try {
      parsed = JSON.parse(contentData);
    } catch {
      parsed = {
        title: filePath ? filePath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "") : "本地导图",
        mindData: parseTextToTree(contentData)
      };
    }
  }

  const cur = getActiveTab();
  const shouldReuse = cur && !cur.filePath && !cur.isDirty && (!cur.mindData?.children || cur.mindData.children.length === 0);
  let tab = shouldReuse ? cur : createNewTab();
  const res = deserializePackage(parsed, "本地思维导图", filePath);

  tab.filePath = (filePath && (filePath.includes("/") || filePath.includes("\\"))) ? filePath : null;
  tab.title = res.fileDisplayName;
  tab.layoutStructure = res.loadedLayout;
  tab.colorPalette = res.loadedPalette;
  tab.lineStyle = res.loadedLine;
  tab.boxStyle = res.loadedBox;
  tab.canvasBgColor = res.loadedBgColor;
  tab.canvasBgPattern = res.loadedBgPattern;
  tab.isDirty = false;
  state.isLayoutDirty = true;
  tab.versions = res.isEncrypted ? [] : (res.loadedVersions || []);

  if (res.isEncrypted) {
    tab.isEncrypted = true;
    tab.encryptedVault = res.encryptedVault;
    tab.mindData = { id: "root", text: "🔒 " + tab.title, children: [] };
    tab._isLocked = true;
    showLockScreen(tab);
    showToast("🔒 此文档已受密码保护，请输入密码解锁");
  } else {
    tab.isEncrypted = false;
    tab.encryptedVault = null;
    tab.mindData = res.loadedMindData;
    tab.selectedIds = new Set([tab.mindData.id || "root"]);
    tab.focusedRootId = tab.mindData.id || "root";
    showToast("📂 已打开: " + tab.title);
  }

  applyCanvasThemeToBody(tab.canvasBgColor, tab.canvasBgPattern);
  syncInspectorUi();
  updateSecurityDockStatus();

  // 🌟 核心修复：文件一旦成功加载，立即记录进最近文档列表！
  recordRecentDoc(tab.title, tab.mindData, tab.layoutStructure, tab.filePath, {
    colorPalette: tab.colorPalette,
    lineStyle: tab.lineStyle,
    boxStyle: tab.boxStyle,
    canvasBgColor: tab.canvasBgColor,
    canvasBgPattern: tab.canvasBgPattern
  }, tab.isEncrypted, tab.password, tab.passwordHint, tab.encryptedVault, tab.camera);

  bus.emit(EVENTS.SHOW_WORKSPACE);
}

export async function performSave(customTab = null) {
  let tab = customTab || getActiveTab();
  if (!tab) return;
  if (tab._isLocked) { showToast("⚠️ 请先输入密码解锁后再保存"); return; }

  const pkg = await serializeTabToPackage(tab);
  const contentStr = JSON.stringify(pkg.filePackage, null, 2);

  try {
    const savedPath = await callTauri("save_mindmap_file", {
      path: tab.filePath || null,
      defaultName: pkg.filenameWithExt,
      content: contentStr
    });
    if (!savedPath || savedPath === "CANCELLED") return;

    tab.filePath = savedPath;
    tab.title = savedPath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "");
    tab.isDirty = false;

    recordRecentDoc(tab.title, tab.mindData, tab.layoutStructure, tab.filePath, {
      colorPalette: tab.colorPalette,
      lineStyle: tab.lineStyle,
      boxStyle: tab.boxStyle,
      canvasBgColor: tab.canvasBgColor,
      canvasBgPattern: tab.canvasBgPattern
    }, tab.isEncrypted, tab.password, tab.passwordHint, tab.encryptedVault, tab.camera);

    bus.emit(EVENTS.RENDER_APP);
    saveSessionImmediate();
    showToast(tab.isEncrypted ? "🛡️ 「" + tab.title + "」已加密保存" : "💾 「" + tab.title + "」已保存");
  } catch {
    const blob = new Blob([contentStr], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = pkg.filenameWithExt;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    tab.isDirty = false;
    recordRecentDoc(tab.title, tab.mindData, tab.layoutStructure, tab.filePath, {
      colorPalette: tab.colorPalette,
      lineStyle: tab.lineStyle,
      boxStyle: tab.boxStyle,
      canvasBgColor: tab.canvasBgColor,
      canvasBgPattern: tab.canvasBgPattern
    }, tab.isEncrypted, tab.password, tab.passwordHint, tab.encryptedVault, tab.camera);

    bus.emit(EVENTS.RENDER_APP);
    saveSessionImmediate();
    showToast("💾 文件已下载保存为: " + pkg.filenameWithExt);
  }
}



function initNodeAttributeEvents(renderApp) {
  const btnAttr = document.getElementById("btn-node-attributes");
  const wrapper = btnAttr?.closest(".dropdown-wrapper");

  btnAttr?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper?.classList.toggle("active");
  });

  window.addEventListener("click", (e) => {
    if (wrapper && !wrapper.contains(e.target)) wrapper.classList.remove("active");
  });

  document.querySelectorAll("[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      wrapper?.classList.remove("active");
      const icon = chip.dataset.quickIcon;
      const target = getPrimarySelectedNode();
      if (!target) return;
      target.icon = (target.icon === icon) ? null : icon;
      markDirtyAndRefresh(renderApp);
      syncNotesDrawerWithActiveNode();
    });
  });

  document.getElementById("btn-open-full-icons")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper?.classList.remove("active");
    const fs = document.getElementById("format-sidebar");
    const layout = document.querySelector(".workspace-body-layout");
    fs?.classList.remove("collapsed");
    document.getElementById("btn-toggle-format")?.classList.add("active");
    layout?.classList.add("sidebar-open");
    const iconSec = document.querySelector('.inspector-accordion-item[data-section="icons"]');
    if (iconSec) {
      iconSec.classList.add("open");
      iconSec.scrollIntoView({ behavior: "smooth" });
    }
  });

  document.querySelectorAll("#menu-priority .popover-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      wrapper?.classList.remove("active");
      const p = item.dataset.priority;
      const target = getPrimarySelectedNode();
      if (!target) return;
      target.priority = (p === "none") ? null : p;
      markDirtyAndRefresh(renderApp);
    });
  });

  document.querySelectorAll("#menu-progress .popover-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      wrapper?.classList.remove("active");
      const prg = item.dataset.progress;
      const target = getPrimarySelectedNode();
      if (!target) return;
      target.progress = (prg === "none") ? null : prg;
      markDirtyAndRefresh(renderApp);
    });
  });

  const tagModal = document.getElementById("apple-modal-overlay");

  function renderTagModalList(node) {
    if (!tagModal) return;
    const tagList = tagModal.querySelector("#modal-tags-list");
    if (!tagList) return;

    const tags = Array.isArray(node.tags) ? node.tags : [];
    tagList.innerHTML = tags.map(t => `
      <span class="apple-modal-tag">
        <span>${t}</span>
        <span class="tag-del-btn" data-tag="${t}" style="cursor:pointer;font-weight:700;">×</span>
      </span>
    `).join("");

    tagList.querySelectorAll(".tag-del-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        node.tags = (node.tags || []).filter(item => item !== btn.dataset.tag);
        renderTagModalList(node);
        markDirtyAndRefresh(renderApp);
      };
    });
  }

  function addCurrentInputTag(node) {
    if (!tagModal) return;
    const tagInput = tagModal.querySelector("#modal-input");
    if (!tagInput) return;
    const val = tagInput.value.trim();
    if (!val) return;
    if (!Array.isArray(node.tags)) node.tags = [];
    if (!node.tags.includes(val)) {
      node.tags.push(val);
      renderTagModalList(node);
      markDirtyAndRefresh(renderApp);
    }
    tagInput.value = "";
    tagInput.focus();
  }

  document.getElementById("btn-open-tag-modal")?.addEventListener("click", (e) => {
    e.stopPropagation();
    wrapper?.classList.remove("active");
    const node = getPrimarySelectedNode();
    if (!node || !tagModal) return;

    renderTagModalList(node);
    const tagInput = tagModal.querySelector("#modal-input");
    if (tagInput) tagInput.value = "";
    tagModal.classList.remove("hidden");
    tagInput?.focus();

    tagModal.querySelector("#modal-btn-cancel").onclick = () => tagModal.classList.add("hidden");
    tagModal.querySelector("#modal-btn-confirm").onclick = () => addCurrentInputTag(node);
    tagInput.onkeydown = (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        addCurrentInputTag(node);
      } else if (ev.key === "Escape") {
        tagModal.classList.add("hidden");
      }
    };
  });
}

export function initEventListeners(renderApp) {
  const vp = document.getElementById("viewport");
  const marquee = document.getElementById("marquee-box");
  let isPanning = false, panStart = { x: 0, y: 0 };
  let lastMoveTime = 0, lastClientX = 0, lastClientY = 0;
  let panVel = { x: 0, y: 0 };
  let isMarquee = false, marqueeStart = { x: 0, y: 0 };
  let lastClickTime = 0, lastClickNodeId = null;

  vp?.addEventListener("mousedown", (e) => {
    if (e.target.closest(".canvas-floating-controls, .minimap-widget, .inline-editor")) return;
    const rect = vp.getBoundingClientRect();
    const clickScreenX = e.clientX - rect.left;
    const clickScreenY = e.clientY - rect.top;
    const s = camera.transform.scale;
    const worldX = (clickScreenX - camera.transform.x) / s;
    const worldY = (clickScreenY - camera.transform.y) / s;

    const curTab = getActiveTab();
    const curRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
    const isVisible = (id) => isNodeVisibleInTree(id, curRoot);

    let badgeNode = curTab?.spatialIndex?.pickCollapseBadge(worldX, worldY, state.focusedRootId, isVisible);
    
    if (badgeNode) {
      e.stopPropagation();
      badgeNode.collapsed = !badgeNode.collapsed;
      state.isLayoutDirty = true;
      saveSnapshot();
      curTab?.spatialIndex?.clear();
      bus.emit(EVENTS.RENDER_APP);
      return;
    }

    let node = curTab?.spatialIndex?.pickNode(worldX, worldY, 8, isVisible);
    

    if (node) {
      e.stopPropagation();
      if (state.isRecallMode && node.id !== state.focusedRootId) {
        peekTargetNode = node;
        node._unmasked = true;
        bus.emit(EVENTS.RENDER_APP);
        return;
      }
      const now = Date.now();
      if (now - lastClickTime < 350 && lastClickNodeId === node.id) {
        lastClickTime = 0; lastClickNodeId = null;
        startEditNode(node, state, renderApp, false);
        return;
      }
      lastClickTime = now;
      lastClickNodeId = node.id;

      if (node.id !== state.focusedRootId && !e.shiftKey) {
        gDragNode = node;
        gDragStart = { x: e.clientX, y: e.clientY };
        gIsDragging = false;
      }

      if (e.shiftKey) {
        const nextSet = new Set(state.selectedIds);
        if (nextSet.has(node.id)) nextSet.delete(node.id);
        else nextSet.add(node.id);
        state.selectedIds = nextSet;
      } else {
        state.selectedIds = new Set([node.id]);
      }

      bus.emit(EVENTS.RENDER_APP);
      syncInspectorUi();
      locateFocusedNode(node.id, true);
      syncNotesDrawerWithActiveNode();
      return;
    }

    if (e.shiftKey) {
      isMarquee = true;
      marqueeStart = { x: clickScreenX, y: clickScreenY };
      if (marquee) {
        marquee.style.left = marqueeStart.x + "px";
        marquee.style.top = marqueeStart.y + "px";
        marquee.style.width = "0px";
        marquee.style.height = "0px";
        marquee.classList.remove("hidden");
      }
      return;
    }

    stopAllCameraAnimations();
    isPanning = true;
    state.isInteracting = true;
    panVel = { x: 0, y: 0 };
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    lastMoveTime = performance.now();
    panStart = { x: e.clientX - camera.transform.x, y: e.clientY - camera.transform.y };
  });

  window.addEventListener("mousemove", (e) => {
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const s = camera.transform.scale;
    const wx = (e.clientX - rect.left - camera.transform.x) / s;
    const wy = (e.clientY - rect.top - camera.transform.y) / s;

    // 🌟 实时计算拖拽挂载与重排
    if (gDragNode) {
      if (!gIsDragging && Math.hypot(e.clientX - gDragStart.x, e.clientY - gDragStart.y) > 4) {
        gIsDragging = true;
        isPanning = false;
        vp.style.cursor = "grabbing";
      }
      if (gIsDragging) {
        gDropTarget = calculateFullTreeDrop(wx, wy, gDragNode);
        setDropIndicator(gDropTarget ? gDropTarget.indicator : null);
        bus.emit(EVENTS.RENDER_CANVAS_ONLY);
        return;
      }
    }

    const curTab = getActiveTab();
    const curRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
    const isVisible = (id) => isNodeVisibleInTree(id, curRoot);

    if (!isPanning && !isMarquee) {
      let badgeHit = curTab?.spatialIndex?.pickCollapseBadge(wx, wy, state.focusedRootId, isVisible);
      
      let nodeHit = badgeHit || curTab?.spatialIndex?.pickNode(wx, wy, 8, isVisible);
      

      if (e.shiftKey) {
        vp.style.cursor = nodeHit ? "pointer" : "crosshair";
      } else {
        vp.style.cursor = badgeHit ? "pointer" : (nodeHit ? "pointer" : "grab");
      }
    }

    if (isPanning) {
      vp.style.cursor = "grabbing";
      const now = performance.now();
      const dt = now - lastMoveTime;
      if (dt > 10) {
        panVel = { x: (e.clientX - lastClientX) / dt, y: (e.clientY - lastClientY) / dt };
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        lastMoveTime = now;
      }
      camera.transform.x = e.clientX - panStart.x;
      camera.transform.y = e.clientY - panStart.y;
      requestTransformUpdate();
    } else if (isMarquee && marquee) {
      const curX = e.clientX - rect.left, curY = e.clientY - rect.top;
      const minX = Math.min(curX, marqueeStart.x), maxX = Math.max(curX, marqueeStart.x);
      const minY = Math.min(curY, marqueeStart.y), maxY = Math.max(curY, marqueeStart.y);
      marquee.style.left = minX + "px";
      marquee.style.top = minY + "px";
      marquee.style.width = Math.max(1, maxX - minX) + "px";
      marquee.style.height = Math.max(1, maxY - minY) + "px";

      const hitIds = computeDirectMarquee(minX, maxX, minY, maxY);
      const isSame = hitIds.size === state.selectedIds.size && [...hitIds].every(id => state.selectedIds.has(id));
      if (!isSame) {
        state.selectedIds = hitIds;
        bus.emit(EVENTS.RENDER_APP);
        syncNotesDrawerWithActiveNode();
      }
    }
  });

  window.addEventListener("mouseup", () => {
    // 🌟 提交跨分支改挂父级或同级排序结果
    if (gIsDragging && gDropTarget && gDragNode) {
      const oldParent = findParent(gDragNode.id, state.mindData);
      if (oldParent) {
        if (gDropTarget.type === "reparent") {
          // 从旧父级中移除，挂入新父级子列表
          oldParent.children = oldParent.children.filter(c => c.id !== gDragNode.id);
          const newParent = gDropTarget.targetParent;
          if (!newParent.children) newParent.children = [];
          newParent.children.push(gDragNode);
          newParent.collapsed = false;
          markDirtyAndRefresh(renderApp);
          showToast(`🔀 已成功移入「${newParent.text}」下`);
        } else if (gDropTarget.type === "reorder") {
          const { parent, insertIndex } = gDropTarget;
          const oldIdx = parent.children.findIndex(c => c.id === gDragNode.id);
          if (oldIdx !== -1) {
            parent.children.splice(oldIdx, 1);
            const finalIdx = (oldIdx < insertIndex) ? (insertIndex - 1) : insertIndex;
            parent.children.splice(finalIdx, 0, gDragNode);
            markDirtyAndRefresh(renderApp);
            showToast("↕️ 节点顺序已更新");
          }
        }
      }
    }

    gDragNode = null;
    gIsDragging = false;
    gDropTarget = null;
    setDropIndicator(null);
    bus.emit(EVENTS.RENDER_CANVAS_ONLY);

    if (state.isRecallMode && peekTargetNode) {
      peekTargetNode._unmasked = false;
      peekTargetNode = null;
      bus.emit(EVENTS.RENDER_APP);
    }

    if (isPanning) {
      const timeSinceLastMove = performance.now() - lastMoveTime;
      if (timeSinceLastMove < 45 && (Math.abs(panVel.x) > 0.12 || Math.abs(panVel.y) > 0.12)) {
        startInertiaMomentum(panVel.x * 1.5, panVel.y * 1.5);
      } else {
        state.isInteracting = false;
        requestTransformUpdate();
      }
      const curTab = getActiveTab();
      if (curTab) curTab.camera = { ...camera.transform };
    }
    isPanning = false;

    if (isMarquee) {
      isMarquee = false;
      if (marquee) {
        marquee.classList.add("hidden");
        marquee.style.width = "0px";
        marquee.style.height = "0px";
      }
      syncInspectorUi();
      syncNotesDrawerWithActiveNode();
    }
  });

  vp?.addEventListener("wheel", (e) => {
    e.preventDefault();
    stopAllCameraAnimations();
    state.isInteracting = true;
    if (state.editingNodeId) document.getElementById("inline-editor")?.blur();

    const rect = vp.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (e.shiftKey) { camera.transform.x -= (e.deltaY || e.deltaX); requestTransformUpdate(); return; }
    if (e.altKey) { camera.transform.y -= e.deltaY; requestTransformUpdate(); return; }
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2 && Math.abs(e.deltaX) > 1) {
      camera.transform.x -= e.deltaX; requestTransformUpdate(); return;
    }

    let rawDelta = e.deltaY;
    if (e.deltaMode === 1) rawDelta *= 30;
    else if (e.deltaMode === 2) rawDelta *= 100;

    const clampedDelta = Math.max(-100, Math.min(100, rawDelta));
    const zoomFactor = Math.exp(-clampedDelta * 0.001);
    const oldScale = camera.transform.scale;
    let newScale = Math.max(0.15, Math.min(3.0, oldScale * zoomFactor));

    if (Math.abs(newScale - oldScale) < 0.0001) return;
    const scaleRatio = newScale / oldScale;
    camera.transform.x = mx - (mx - camera.transform.x) * scaleRatio;
    camera.transform.y = my - (my - camera.transform.y) * scaleRatio;
    camera.transform.scale = newScale;

    const curTab = getActiveTab();
    if (curTab) curTab.camera = { ...camera.transform };
    requestTransformUpdate();

    clearTimeout(window.__ZOOM_REST_TIMER__);
    window.__ZOOM_REST_TIMER__ = setTimeout(() => {
      state.isInteracting = false;
      requestTransformUpdate();
    }, 120);
  }, { passive: false });

  document.getElementById("btn-add-child")?.addEventListener("click", () => {
    addChildNode(renderApp);
    syncNotesDrawerWithActiveNode();
  });
  document.getElementById("btn-add-sibling")?.addEventListener("click", () => {
    addSiblingNode(renderApp);
    syncNotesDrawerWithActiveNode();
  });
  document.getElementById("btn-delete")?.addEventListener("click", () => {
    deleteSelectedNodes(renderApp);
    syncNotesDrawerWithActiveNode();
  });
  document.getElementById("btn-undo")?.addEventListener("click", () => {
    undo(renderApp);
    syncNotesDrawerWithActiveNode();
  });
  document.getElementById("btn-redo")?.addEventListener("click", () => {
    redo(renderApp);
    syncNotesDrawerWithActiveNode();
  });
  document.getElementById("btn-node-note")?.addEventListener("click", () => openNotesDrawer());

  document.getElementById("btn-toggle-format")?.addEventListener("click", () => {
    const fs = document.getElementById("format-sidebar");
    const layout = document.querySelector(".workspace-body-layout");
    fs?.classList.toggle("collapsed");
    const isExpanded = !fs?.classList.contains("collapsed");
    document.getElementById("btn-toggle-format")?.classList.toggle("active", isExpanded);
    layout?.classList.toggle("sidebar-open", isExpanded);
  });
  document.getElementById("btn-close-format")?.addEventListener("click", () => {
    const fs = document.getElementById("format-sidebar");
    const layout = document.querySelector(".workspace-body-layout");
    fs?.classList.add("collapsed");
    document.getElementById("btn-toggle-format")?.classList.remove("active");
    layout?.classList.remove("sidebar-open");
  });

  document.getElementById("btn-zoom-in")?.addEventListener("click", () => zoomViewportByFactor(1.15));
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => zoomViewportByFactor(1 / 1.15));
  document.getElementById("txt-zoom-level")?.addEventListener("click", () => resetZoom100());
  document.getElementById("btn-smart-center")?.addEventListener("click", () => {
    smartAdaptiveCenter(null, true);
    showToast("🎯 画布已自适应居中");
  });

  async function triggerOpenFile() {
    closeNotesDrawer();
    try {
      const tauriResult = await callTauri("open_mindmap_file", {});
      if (!tauriResult || tauriResult === "CANCELLED") return;
      const [filePath, contentStr] = tauriResult;
      await handleLoadedFileContent(contentStr, filePath, renderApp);
    } catch {
      const fileInput = document.getElementById("global-file-input");
      if (!fileInput) return;
      fileInput.value = "";
      fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const isXMind = file.name.endsWith(".xmind");
        const reader = new FileReader();
        if (isXMind) {
          reader.onload = async (ev) => await handleLoadedFileContent(ev.target.result, file.name, renderApp);
          reader.readAsArrayBuffer(file);
        } else {
          reader.onload = async (ev) => await handleLoadedFileContent(ev.target.result, file.name, renderApp);
          reader.readAsText(file);
        }
      };
      fileInput.click();
    }
  }

  document.getElementById("btn-save")?.addEventListener("click", () => performSave());
  document.getElementById("btn-open")?.addEventListener("click", triggerOpenFile);
  document.getElementById("nav-btn-open-file")?.addEventListener("click", triggerOpenFile);

  initNodeAttributeEvents(renderApp);
  bindGlobalShortcuts(renderApp, performSave, triggerOpenFile);
}
