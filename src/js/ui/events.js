import { state, undo, redo, saveSnapshot, findParent, getActiveTab, createNewTab, getPrimarySelectedNode } from "../core/state.js";
import { camera, requestTransformUpdate, startInertiaMomentum, stopAllCameraAnimations, locateFocusedNode, smartCenterOnSelectedNode } from "../core/camera.js";
import { syncInspectorUi, applyCanvasThemeToBody } from "./inspector.js";
import { openNotesDrawer } from "./notes.js";
import { openFlashcardModal, toggleRecallMode } from "./flashcards.js";
import { showToast } from "./dialog.js";
import { serializeTabToPackage, deserializePackage, parseTextToTree } from "../core/serializer.js";
import { recordRecentDoc } from "./home.js";
import { showLockScreen, lockCurrentTab, openVaultSetModal, updateSecurityDockStatus } from "./vault.js";
import { closeTabWithConfirm } from "../core/tab-manager.js";

async function callTauri(cmd, args) {
  try {
    if (window.__TAURI__?.core?.invoke) return await window.__TAURI__.core.invoke(cmd, args);
    if (window.__TAURI__?.invoke) return await window.__TAURI__.invoke(cmd, args);
    if (window.__TAURI_INTERNALS__?.invoke) return await window.__TAURI_INTERNALS__.invoke(cmd, args);
  } catch (err) {
    console.error(`[Tauri IPC Error] ${cmd}:`, err);
  }
  return null;
}

function handleArrowNavigation(key, renderApp) {
  const current = getPrimarySelectedNode();
  if (!current || !state.mindData) return;

  const root = state.mindData;
  const isRoot = current.id === (state.focusedRootId || root.id);
  const parent = findParent(current.id, root);
  const structure = state.layoutStructure || "mindmap";

  let target = null;
  if (key === "ArrowRight") {
    if (isRoot) target = current.rightChildren?.[0] || current.children?.[0];
    else if (current.branchDirection === "left") target = parent;
    else if (current.children && current.children.length > 0 && !current.collapsed) target = current.children[0];
  } else if (key === "ArrowLeft") {
    if (isRoot) target = current.leftChildren?.[0] || current.children?.[1];
    else if (current.branchDirection === "left" && current.children?.length > 0 && !current.collapsed) target = current.children[0];
    else target = parent;
  } else if (key === "ArrowDown") {
    if (isRoot && structure === "org-down") target = current.children?.[0];
    else if (parent?.children) {
      const idx = parent.children.findIndex(c => c.id === current.id);
      if (idx >= 0 && idx < parent.children.length - 1) target = parent.children[idx + 1];
    }
  } else if (key === "ArrowUp") {
    if (structure === "org-down" && !isRoot) target = parent;
    else if (parent?.children) {
      const idx = parent.children.findIndex(c => c.id === current.id);
      if (idx > 0) target = parent.children[idx - 1];
    }
  }

  if (target) {
    state.selectedIds = new Set([target.id]);
    renderApp();
    locateFocusedNode(target.id, true);
  }
}

export function initEventListeners(renderApp) {
  const vp = document.getElementById("viewport");
  const marquee = document.getElementById("marquee-box");
  let isPanning = false, panStart = { x: 0, y: 0 }, lastPan = { x: 0, y: 0, t: 0 }, panVel = { x: 0, y: 0 };
  let isMarquee = false, marqueeStart = { x: 0, y: 0 };

  vp?.addEventListener("mousedown", (e) => {
    if (e.target.closest(".svg-node, .svg-badge, .canvas-floating-controls, .minimap-widget, .inline-editor")) return;
    if (e.shiftKey) {
      isMarquee = true;
      const rect = vp.getBoundingClientRect();
      marqueeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      if (marquee) {
        marquee.style.left = `${marqueeStart.x}px`; marquee.style.top = `${marqueeStart.y}px`;
        marquee.style.width = "0px"; marquee.style.height = "0px";
        marquee.classList.remove("hidden");
      }
      return;
    }
    stopAllCameraAnimations();
    isPanning = true;
    panVel = { x: 0, y: 0 };
    panStart = { x: e.clientX - camera.transform.x, y: e.clientY - camera.transform.y };
    lastPan = { x: e.clientX, y: e.clientY, t: performance.now() };
  });

  window.addEventListener("mousemove", (e) => {
    if (isPanning) {
      const now = performance.now(), dt = now - lastPan.t;
      if (dt > 10) {
        panVel = { x: (e.clientX - lastPan.x) / dt, y: (e.clientY - lastPan.y) / dt };
        lastPan = { x: e.clientX, y: e.clientY, t: now };
      }
      camera.transform.x = e.clientX - panStart.x;
      camera.transform.y = e.clientY - panStart.y;
      requestTransformUpdate();
    } else if (isMarquee && marquee) {
      const rect = vp.getBoundingClientRect();
      const curX = e.clientX - rect.left, curY = e.clientY - rect.top;
      const minX = Math.min(curX, marqueeStart.x), maxX = Math.max(curX, marqueeStart.x);
      const minY = Math.min(curY, marqueeStart.y), maxY = Math.max(curY, marqueeStart.y);
      marquee.style.left = `${minX}px`; marquee.style.top = `${minY}px`;
      marquee.style.width = `${maxX - minX}px`; marquee.style.height = `${maxY - minY}px`;

      const sel = new Set();
      document.querySelectorAll(".svg-node").forEach(el => {
        const nr = el.getBoundingClientRect(), nrx = nr.left - rect.left, nry = nr.top - rect.top;
        if (nrx >= minX && nrx + nr.width <= maxX && nry >= minY && nry + nr.height <= maxY) sel.add(el.dataset.id);
      });
      if (sel.size > 0) { state.selectedIds = sel; renderApp(); }
    }
  });

  window.addEventListener("mouseup", () => {
    if (isPanning && (Math.abs(panVel.x) > 0.3 || Math.abs(panVel.y) > 0.3)) startInertiaMomentum(panVel.x, panVel.y);
    isPanning = false;
    if (isMarquee) { isMarquee = false; marquee?.classList.add("hidden"); }
  });

  vp?.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const rect = vp.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const newScale = Math.min(3.0, Math.max(0.15, camera.transform.scale * factor));
    camera.transform.x = mx - (mx - camera.transform.x) * (newScale / camera.transform.scale);
    camera.transform.y = my - (my - camera.transform.y) * (newScale / camera.transform.scale);
    camera.transform.scale = newScale;
    requestTransformUpdate();
    const zt = document.getElementById("txt-zoom-level");
    if (zt) zt.innerText = `${Math.round(newScale * 100)}%`;
  }, { passive: false });

  function markDirtyAndRefresh() {
    const tab = getActiveTab();
    if (tab) tab.isDirty = true;
    saveSnapshot();
    renderApp();
  }

  function addChildNode() {
    const p = getPrimarySelectedNode(); if (!p) return;
    const child = { id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4), text: "新分支", collapsed: false, children: [] };
    if (!p.children) p.children = [];
    p.children.push(child); p.collapsed = false;
    state.selectedIds = new Set([child.id]);
    markDirtyAndRefresh();
    locateFocusedNode(child.id, true);
  }

  function addSiblingNode() {
    const p = getPrimarySelectedNode();
    if (!p || p.id === state.focusedRootId) return addChildNode();
    const parent = findParent(p.id, state.mindData); if (!parent) return;
    const sib = { id: "node_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4), text: "新主题", collapsed: false, children: [] };
    const idx = parent.children.findIndex(c => c.id === p.id);
    parent.children.splice(idx + 1, 0, sib);
    state.selectedIds = new Set([sib.id]);
    markDirtyAndRefresh();
    locateFocusedNode(sib.id, true);
  }

  function deleteSelectedNodes() {
    if (!state.selectedIds || state.selectedIds.size === 0) return;
    let fallbackId = state.focusedRootId;
    state.selectedIds.forEach(id => {
      if (id === state.focusedRootId) return;
      const parent = findParent(id, state.mindData);
      if (parent) { parent.children = parent.children.filter(c => c.id !== id); fallbackId = parent.id; }
    });
    state.selectedIds = new Set([fallbackId]);
    markDirtyAndRefresh();
  }

  document.getElementById("btn-add-child")?.addEventListener("click", addChildNode);
  document.getElementById("btn-add-sibling")?.addEventListener("click", addSiblingNode);
  document.getElementById("btn-delete")?.addEventListener("click", deleteSelectedNodes);
  document.getElementById("btn-undo")?.addEventListener("click", () => undo(renderApp));
  document.getElementById("btn-redo")?.addEventListener("click", () => redo(renderApp));
  document.getElementById("btn-node-note")?.addEventListener("click", () => openNotesDrawer());

  document.getElementById("btn-toggle-format")?.addEventListener("click", () => {
    const fs = document.getElementById("format-sidebar");
    fs?.classList.toggle("collapsed");
    document.getElementById("btn-toggle-format")?.classList.toggle("active", !fs?.classList.contains("collapsed"));
  });
  document.getElementById("btn-close-format")?.addEventListener("click", () => {
    document.getElementById("format-sidebar")?.classList.add("collapsed");
    document.getElementById("btn-toggle-format")?.classList.remove("active");
  });

  document.querySelectorAll("#menu-structures .struct-card").forEach(c => {
    c.onclick = () => {
      const t = getActiveTab();
      if (t) { t.layoutStructure = c.dataset.structure; markDirtyAndRefresh(); syncInspectorUi(); }
    };
  });
  document.querySelectorAll("#palette-options-grid .palette-chip").forEach(c => {
    c.onclick = () => {
      const t = getActiveTab();
      if (t) { t.colorPalette = c.dataset.palette; markDirtyAndRefresh(); syncInspectorUi(); }
    };
  });
  document.querySelectorAll("#line-style-options .style-btn").forEach(b => {
    b.onclick = () => {
      const t = getActiveTab();
      if (t) { t.lineStyle = b.dataset.line; markDirtyAndRefresh(); syncInspectorUi(); }
    };
  });
  document.querySelectorAll("#box-style-options .style-btn").forEach(b => {
    b.onclick = () => {
      const t = getActiveTab();
      if (t) { t.boxStyle = b.dataset.box; markDirtyAndRefresh(); syncInspectorUi(); }
    };
  });
  document.querySelectorAll("#menu-bg-colors .bg-color-swatch").forEach(c => {
    c.onclick = () => {
      const t = getActiveTab();
      if (t) { t.canvasBgColor = c.dataset.color; markDirtyAndRefresh(); applyCanvasThemeToBody(t.canvasBgColor, t.canvasBgPattern); syncInspectorUi(); }
    };
  });
  document.querySelectorAll("#menu-bg-patterns .bg-pattern-card").forEach(b => {
    b.onclick = () => {
      const t = getActiveTab();
      if (t) { t.canvasBgPattern = b.dataset.pattern; markDirtyAndRefresh(); applyCanvasThemeToBody(t.canvasBgColor, t.canvasBgPattern); syncInspectorUi(); }
    };
  });

  document.getElementById("btn-zoom-in")?.addEventListener("click", () => { camera.transform.scale = Math.min(3.0, camera.transform.scale * 1.2); requestTransformUpdate(); });
  document.getElementById("btn-zoom-out")?.addEventListener("click", () => { camera.transform.scale = Math.max(0.2, camera.transform.scale / 1.2); requestTransformUpdate(); });
  document.getElementById("txt-zoom-level")?.addEventListener("click", () => { camera.transform.scale = 1.0; requestTransformUpdate(); });
  document.getElementById("btn-smart-center")?.addEventListener("click", () => smartCenterOnSelectedNode(state, true));

  async function performSave() {
    let tab = getActiveTab();
    if (!tab || !tab.isDirty) return;

    const pkg = await serializeTabToPackage(tab);
    const contentStr = JSON.stringify(pkg.filePackage, null, 2);

    const savedPath = await callTauri("save_mindmap_file", {
      path: tab.filePath || null,
      defaultName: pkg.filenameWithExt,
      content: contentStr
    });

    if (savedPath) {
      if (savedPath === "CANCELLED") return;
      tab.filePath = savedPath;
      tab.title = savedPath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "");
    }

    tab.isDirty = false;
    recordRecentDoc(tab.title, tab.mindData, tab.layoutStructure, tab.filePath, {
      colorPalette: tab.colorPalette,
      lineStyle: tab.lineStyle,
      boxStyle: tab.boxStyle,
      canvasBgColor: tab.canvasBgColor,
      canvasBgPattern: tab.canvasBgPattern
    }, tab.isEncrypted, tab.password, tab.passwordHint, tab.encryptedVault);
    renderApp();
    const displayFileName = tab.filePath ? tab.filePath.split(/[\\/]/).pop() : (pkg.presetFilename + ".ymind");
    showToast(tab.isEncrypted ? `🛡️ 「${displayFileName}」已安全加密保存` : `💾 「${displayFileName}」保存成功`);
  }

  async function triggerOpenFile() {
    const tauriResult = await callTauri("open_mindmap_file", {});
    if (tauriResult) {
      const [filePath, contentStr] = tauriResult;
      let parsed = null;
      try { parsed = JSON.parse(contentStr); }
      catch { parsed = { title: filePath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, ""), mindData: parseTextToTree(contentStr) }; }

      let tab = getActiveTab() || createNewTab();
      const res = deserializePackage(parsed, "本地白板", filePath);
      
      tab.filePath = filePath;
      tab.title = res.fileDisplayName;
      tab.layoutStructure = res.loadedLayout;
      tab.colorPalette = res.loadedPalette;
      tab.lineStyle = res.loadedLine;
      tab.boxStyle = res.loadedBox;
      tab.canvasBgColor = res.loadedBgColor;
      tab.canvasBgPattern = res.loadedBgPattern;
      tab.isDirty = false;

      if (res.isEncrypted) {
        tab.isEncrypted = true;
        tab.encryptedVault = res.encryptedVault;
        tab.mindData = { id: "root", text: "🔒 " + tab.title, children: [] };
        tab._isLocked = true;
        showLockScreen(tab);
        showToast("🔒 此文件已受加密保护，请输入密码解锁");
      } else {
        tab.isEncrypted = false;
        tab.encryptedVault = null;
        tab.mindData = res.loadedMindData;
        tab.selectedIds = new Set([tab.mindData.id || "root"]);
        tab.focusedRootId = tab.mindData.id || "root";
        showToast(`📂 已打开: ${tab.title}`);
      }

      applyCanvasThemeToBody(tab.canvasBgColor, tab.canvasBgPattern);
      syncInspectorUi();
      updateSecurityDockStatus();

      if (window.__SHOW_WORKSPACE__) window.__SHOW_WORKSPACE__();
      else renderApp();
    }
  }

  document.getElementById("btn-save")?.addEventListener("click", performSave);
  document.getElementById("btn-open")?.addEventListener("click", triggerOpenFile);
  document.getElementById("nav-btn-open-file")?.addEventListener("click", triggerOpenFile);

  window.addEventListener("keydown", async (e) => {
    if (e.target.closest("input, textarea, select, [contenteditable=true]") || e.target.isContentEditable || state.editingNodeId) return;

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      handleArrowNavigation(e.key, renderApp);
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
    const cmd = isMac ? e.metaKey : e.ctrlKey;
    if (cmd && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(renderApp); else undo(renderApp); }
    else if (cmd && e.key.toLowerCase() === "y") { e.preventDefault(); redo(renderApp); }
    else if (cmd && e.key.toLowerCase() === "s") { e.preventDefault(); performSave(); }
    else if (cmd && e.key.toLowerCase() === "o") { e.preventDefault(); triggerOpenFile(); }
    // 🌟 快捷键 ⌘W / Ctrl+W 关闭标签，触发未保存确认
    else if (cmd && e.key.toLowerCase() === "w") {
      e.preventDefault();
      const curTab = getActiveTab();
      if (curTab) {
        await closeTabWithConfirm(curTab.id, renderApp, window.__SHOW_HOME__ || (() => {}));
      }
    }
    else if (e.altKey && e.key.toLowerCase() === "l") {
      e.preventDefault();
      const tab = getActiveTab();
      if (tab?.isEncrypted) lockCurrentTab();
      else openVaultSetModal();
    }
    else if (e.key === "Tab") { e.preventDefault(); addChildNode(); }
    else if (e.key === "Enter") { e.preventDefault(); addSiblingNode(); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelectedNodes(); }
  });

  // 标签管理模态框
  const tagModal = document.getElementById("apple-modal-overlay");
  const tagInput = document.getElementById("modal-input");
  const tagsListDom = document.getElementById("modal-tags-list");
  
  function renderTagsList(node) {
    if (!tagsListDom || !node) return;
    tagsListDom.innerHTML = (node.tags || []).map((t, idx) => `
      <span class="apple-tag p3" style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;margin:2px;cursor:pointer;" data-idx="${idx}">
        ${t} <span style="font-weight:bold;">×</span>
      </span>
    `).join("");
    tagsListDom.querySelectorAll("span.apple-tag").forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.idx, 10);
        node.tags.splice(idx, 1);
        renderTagsList(node);
        markDirtyAndRefresh();
      };
    });
  }

  document.getElementById("btn-open-tag-modal")?.addEventListener("click", () => {
    const p = getPrimarySelectedNode();
    if (!p || !tagModal) return;
    renderTagsList(p);
    tagModal.classList.remove("hidden");
    if (tagInput) { tagInput.value = ""; tagInput.focus(); }
  });

  function addTagFromInput() {
    const p = getPrimarySelectedNode();
    const val = tagInput?.value.trim();
    if (p && val) {
      if (!p.tags) p.tags = [];
      if (!p.tags.includes(val)) p.tags.push(val);
      if (tagInput) tagInput.value = "";
      renderTagsList(p);
      markDirtyAndRefresh();
    }
  }

  document.getElementById("modal-btn-confirm")?.addEventListener("click", addTagFromInput);
  tagInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addTagFromInput(); }
    else if (e.key === "Escape") { tagModal?.classList.add("hidden"); }
  });
  document.getElementById("modal-btn-cancel")?.addEventListener("click", () => tagModal?.classList.add("hidden"));
}
