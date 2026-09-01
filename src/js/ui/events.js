import { initNotesDrawer, openNotesDrawer } from './notes.js';
import { initFlashcards, openFlashcardModal, toggleRecallMode } from './flashcards.js';
import { state, saveSnapshot, undo, redo, findNode, findParent, getPrimarySelectedNode, getActiveTab, createNewTab } from '../core/state.js';
import { camera, requestTransformUpdate, smartCenterOnSelectedNode, startInertiaMomentum, stopAllCameraAnimations } from '../core/camera.js';
import { updateSelectionStyles, startEditNode } from '../render/render.js';
import { encryptMindPayload, decryptMindPayload, isEncryptedPackage } from '../storage/crypto.js';
import { recordRecentDoc } from './home.js';
import { syncInspectorUi } from './inspector.js';
import { serializeTabToPackage, deserializePackage } from '../core/serializer.js';
import { appAlert, appConfirm, appPrompt, showToast } from './dialog.js';
import { 
  openVersionHistoryModal, 
  closeVersionHistoryModal, 
  renderHistoryList, 
  createVersionSnapshot, 
  clearAllSnapshots 
} from '../storage/storage.js';

const invoke = window.__TAURI__ 
  ? (window.__TAURI__.core?.invoke || window.__TAURI__.tauri?.invoke) 
  : null;

function bindClick(id, handler) {
  const el = document.getElementById(id);
  if (el) el.onclick = handler;
}

export function initEventListeners(renderApp) {
  const viewport = document.getElementById("viewport");
  const marqueeBox = document.getElementById("marquee-box");
  const modalOverlay = document.getElementById("apple-modal-overlay");
  const modalTagsList = document.getElementById("modal-tags-list");
  const modalInput = document.getElementById("modal-input");
  const fileInput = document.getElementById("global-file-input");

  const formatSidebar = document.getElementById("format-sidebar");
  const btnToggleFormat = document.getElementById("btn-toggle-format");
  const btnCloseFormat = document.getElementById("btn-close-format");
  const minimapWidget = document.getElementById("minimap-widget");

  let isDraggingCanvas = false;
  let isMarqueeActive = false;
  let marqueeStart = { x: 0, y: 0 };
  let startPan = { x: 0, y: 0 };
  let dragStartPos = { x: 0, y: 0 };

  let lastMousePos = { x: 0, y: 0 };
  let lastMouseTime = 0;
  let velocity = { x: 0, y: 0 };

  function toggleFormatSidebar(openDirectly = false) {
    if (!formatSidebar) return;
    if (openDirectly) {
      formatSidebar.classList.remove("collapsed");
      if (btnToggleFormat) btnToggleFormat.classList.add("active");
    } else {
      const isCollapsed = formatSidebar.classList.toggle("collapsed");
      if (btnToggleFormat) btnToggleFormat.classList.toggle("active", !isCollapsed);
    }
    syncInspectorUi();
  }

  if (btnToggleFormat) btnToggleFormat.onclick = () => toggleFormatSidebar();
  if (btnCloseFormat) btnCloseFormat.onclick = () => toggleFormatSidebar();

  // 点击顶栏图标按钮时平滑打开右侧格式侧边栏并定位到图标区
  bindClick("btn-icon-picker", () => {
    toggleFormatSidebar(true);
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  bindClick("btn-open-history", () => openVersionHistoryModal(renderApp));
  bindClick("nav-btn-history", () => openVersionHistoryModal(renderApp));
  bindClick("btn-history-close", closeVersionHistoryModal);

  const historySearchInput = document.getElementById("history-search-input");
  if (historySearchInput) {
    historySearchInput.oninput = () => renderHistoryList(historySearchInput.value.trim(), renderApp);
  }

  bindClick("btn-create-manual-snap", () => {
    const snap = createVersionSnapshot(getActiveTab(), 'manual');
    if (snap) {
      renderHistoryList(historySearchInput?.value || "", renderApp);
      showToast(`📸 已为「${snap.tabTitle}」拍摄独立快照！`);
    }
  });

  bindClick("btn-history-clear-all", async () => {
    const ok = await appConfirm({
      title: "清空历史快照",
      message: "确定要清空全部历史快照吗？此操作将永久清理所有版本的备份数据且无法撤销。",
      isDanger: true,
      confirmText: "清空全部"
    });
    if (ok) {
      clearAllSnapshots();
      renderHistoryList("", renderApp);
      showToast("🗑️ 历史快照已清空");
    }
  });

  async function saveMindMapFile(forceSaveAs = false) {
    const tab = getActiveTab();
    if (!tab) return false;
    let contentToSave = "";
    const { filePackage, filenameWithExt, presetFilename } = serializeTabToPackage(tab);

    try {
      if (tab.isEncrypted && tab.password) {
        const encryptedPackage = await encryptMindPayload(filePackage, tab.password);
        contentToSave = JSON.stringify(encryptedPackage, null, 2);
      } else {
        contentToSave = JSON.stringify(filePackage, null, 2);
      }

      if (!forceSaveAs && tab.filePath && invoke) {
        const ok = await invoke("save_file_direct", { path: tab.filePath, content: contentToSave });
        if (ok) {
          tab.isDirty = false;
          createVersionSnapshot(tab, 'manual');
          recordRecentDoc(tab.title, tab.mindData, tab.layoutStructure, tab.filePath, tab);
          renderApp();
          showToast(`💾 已保存至: ${tab.filePath.split(/[/\\]/).pop()}`);
          return true;
        }
      }

      if (invoke) {
        const savedPath = await invoke("save_file_dialog", {
          content: contentToSave, filename: filenameWithExt, file_name: filenameWithExt,
          default_name: filenameWithExt, defaultName: filenameWithExt,
          default_path: filenameWithExt, defaultPath: filenameWithExt, name: filenameWithExt
        });

        if (savedPath) {
          tab.filePath = savedPath;
          tab.title = savedPath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, "");
          tab.isDirty = false;
          createVersionSnapshot(tab, 'manual');
          recordRecentDoc(tab.title, tab.mindData, tab.layoutStructure, tab.filePath, tab);
          renderApp();
          showToast(`✅ 已保存为: ${tab.title}`);
          return true;
        }
      } else {
        const blob = new Blob([contentToSave], { type: "application/json;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = blobUrl;
        a.download = filenameWithExt;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 1500);

        tab.title = presetFilename;
        tab.isDirty = false;
        createVersionSnapshot(tab, 'manual');
        recordRecentDoc(tab.title, tab.mindData, tab.layoutStructure, tab.filePath, tab);
        renderApp();
        showToast(`✅ 导图下载成功`);
        return true;
      }
    } catch (err) {
      appAlert({ title: "保存失败", message: String(err), type: "error" });
    }
    return false;
  }

  async function loadFileContent(jsonText, defaultFileName = "本地思维导图", filePath = null) {
    try {
      let parsed = JSON.parse(jsonText);

      if (isEncryptedPackage(parsed)) {
        const pwd = await appPrompt({
          title: "安全解密导图",
          message: "此导图受 AES-256 高强度加密保护，请输入访问密码：",
          inputType: "password",
          placeholder: "请输入密码..."
        });
        if (!pwd) return;
        try {
          parsed = await decryptMindPayload(parsed, pwd);
        } catch {
          await appAlert({ title: "解密失败", message: "密码错误或密文数据已被篡改，解密失败！", type: "error" });
          return;
        }
      }

      const { fileDisplayName, loadedMindData, loadedLayout, loadedPalette, loadedLine, loadedBox, loadedTheme } = deserializePackage(parsed, defaultFileName, filePath);

      if (!loadedMindData || typeof loadedMindData !== 'object' || (!loadedMindData.id && !loadedMindData.text)) {
        await appAlert({ title: "文件格式不兼容", message: "未识别到有效的思维导图结构化树状数据。", type: "warning" });
        return;
      }

      const existingTab = state.tabs.find(t => (filePath && t.filePath === filePath) || (!filePath && t.title === fileDisplayName && JSON.stringify(t.mindData) === JSON.stringify(loadedMindData)));

      if (existingTab) {
        state.activeTabId = existingTab.id;
        camera.transform = existingTab.camera;
        document.body.className = `theme-${existingTab.canvasTheme || 'studio-light'}`;
        window.__SHOW_WORKSPACE__ ? window.__SHOW_WORKSPACE__() : renderApp();
        syncInspectorUi();
        showToast(`📑 已切换至: ${fileDisplayName}`);
        return;
      }

      const currentTab = getActiveTab();
      const targetTab = (state.tabs.length === 1 && !currentTab.isDirty && !currentTab.filePath && (!currentTab.history || currentTab.history.length <= 1))
        ? currentTab
        : createNewTab();

      targetTab.title = fileDisplayName;
      targetTab.filePath = filePath;
      targetTab.mindData = JSON.parse(JSON.stringify(loadedMindData));
      targetTab.layoutStructure = loadedLayout;
      targetTab.colorPalette = loadedPalette;
      targetTab.lineStyle = loadedLine;
      targetTab.boxStyle = loadedBox;
      targetTab.canvasTheme = loadedTheme;
      targetTab.selectedIds = new Set([targetTab.mindData.id || "root"]);
      targetTab.focusedRootId = targetTab.mindData.id || "root";
      targetTab.isDirty = false;
      camera.transform = targetTab.camera;

      document.body.className = `theme-${loadedTheme}`;
      recordRecentDoc(fileDisplayName, targetTab.mindData, loadedLayout, filePath, targetTab);
      saveSnapshot();

      window.__SHOW_WORKSPACE__ ? window.__SHOW_WORKSPACE__() : renderApp();
      syncInspectorUi();
      showToast(`📂 已打开: ${fileDisplayName}`);
    } catch (err) {
      await appAlert({ title: "打开失败", message: "无法解析该文件：" + err.message, type: "error" });
    }
  }

  async function openLocalFile() {
    if (invoke) {
      try {
        const res = await invoke("open_file_dialog");
        if (res?.content) {
          loadFileContent(res.content, res.path.split(/[/\\]/).pop().replace(/\.[^/.]+$/, ""), res.path);
          return;
        }
      } catch (e) {
        console.warn("Tauri open dialog fallback to web input", e);
      }
    }
    if (fileInput) {
      fileInput.value = "";
      fileInput.click();
    }
  }

  if (fileInput) {
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      loadFileContent(await file.text(), file.name.replace(/\.[^/.]+$/, ""), null);
    };
  }

  function switchViewMode(mode) {
    state.viewMode = mode;
    renderApp();
    if (mode === "mindmap") smartCenterOnSelectedNode(state, true);
  }

  function batchSetPriority(priorityVal) {
    if (state.selectedIds.size === 0) return;
    state.selectedIds.forEach(id => {
      const node = findNode(id, state.mindData);
      if (node) node.priority = priorityVal === "none" ? null : priorityVal;
    });
    saveSnapshot();
    renderApp();
  }

  function batchSetProgress(progressVal) {
    if (state.selectedIds.size === 0) return;
    state.selectedIds.forEach(id => {
      const node = findNode(id, state.mindData);
      if (node) node.progress = progressVal === "none" ? null : progressVal;
    });
    saveSnapshot();
    renderApp();
  }

  function openTagManagerModal() {
    if (state.selectedIds.size === 0 || !modalOverlay) return;

    function renderModalTags() {
      if (!modalTagsList) return;
      modalTagsList.innerHTML = "";
      const primary = getPrimarySelectedNode();
      const tags = primary?.tags || [];

      if (tags.length === 0) {
        modalTagsList.innerHTML = '<span class="modal-tag-empty">暂无标签</span>';
        return;
      }

      tags.forEach(tag => {
        const pill = document.createElement("span");
        pill.className = "modal-tag-pill";
        pill.innerHTML = `<span>${tag}</span><span class="modal-tag-remove" title="删除">×</span>`;
        pill.querySelector(".modal-tag-remove").onclick = (e) => {
          e.stopPropagation();
          state.selectedIds.forEach(id => {
            const n = findNode(id, state.mindData);
            if (n?.tags) n.tags = n.tags.filter(t => t !== tag);
          });
          saveSnapshot();
          renderApp();
          renderModalTags();
        };
        modalTagsList.appendChild(pill);
      });
    }

    function closeModal() {
      modalOverlay.classList.add("hidden");
      if (modalInput) modalInput.value = "";
    }

    function addTagAndClose() {
      const val = modalInput?.value.trim();
      if (val) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) {
            if (!n.tags) n.tags = [];
            if (!n.tags.includes(val)) n.tags.push(val);
          }
        });
        saveSnapshot();
        renderApp();
      }
      closeModal();
    }

    renderModalTags();
    modalOverlay.classList.remove("hidden");
    modalInput?.focus();

    bindClick("modal-btn-cancel", closeModal);
    bindClick("modal-btn-confirm", addTagAndClose);

    if (modalInput) {
      modalInput.onkeydown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); addTagAndClose(); }
        else if (e.key === "Escape") closeModal();
      };
    }
  }

  function batchDelete() {
    if (state.selectedIds.size === 0) return;
    let changed = false;
    let fallbackId = state.focusedRootId;

    state.selectedIds.forEach(id => {
      if (id === state.focusedRootId) return;
      if (state.floatingNodes && state.floatingNodes.some(f => f.id === id)) {
        state.floatingNodes = state.floatingNodes.filter(f => f.id !== id);
        changed = true;
        return;
      }
      const parent = findParent(id, state.mindData);
      if (parent) {
        parent.children = parent.children.filter(c => c.id !== id);
        fallbackId = parent.id;
        changed = true;
      }
    });

    if (changed) {
      state.selectedIds = new Set([fallbackId]);
      saveSnapshot();
      renderApp();
    }
  }

  function addChildNode() {
    const primary = getPrimarySelectedNode();
    if (!primary) return;
    if (primary.collapsed) primary.collapsed = false;

    const newChild = { id: "node_" + Date.now(), text: "新分支主题", collapsed: false, children: [] };
    if (!primary.children) primary.children = [];
    primary.children.push(newChild);
    state.selectedIds = new Set([newChild.id]);
    saveSnapshot();
    renderApp();

    const target = findNode(newChild.id, state.mindData);
    if (target) startEditNode(target, state, renderApp);
  }

  function addSiblingNode() {
    const primary = getPrimarySelectedNode();
    if (!primary || primary.id === state.focusedRootId) {
      addChildNode();
      return;
    }
    if (state.floatingNodes && state.floatingNodes.some(f => f.id === primary.id)) {
      createFloatingNode((primary.customX || 300) + 40, (primary.customY || 100) + 50);
      return;
    }
    const parent = findParent(primary.id, state.mindData);
    if (!parent) return;
    const newSibling = { id: "node_" + Date.now(), text: "同级分支", collapsed: false, children: [] };
    const index = parent.children.findIndex(c => c.id === primary.id);
    parent.children.splice(index + 1, 0, newSibling);
    state.selectedIds = new Set([newSibling.id]);
    saveSnapshot();
    renderApp();

    const target = findNode(newSibling.id, state.mindData);
    if (target) startEditNode(target, state, renderApp);
  }

  document.getElementById("menu-structures")?.addEventListener("click", (e) => {
    const card = e.target.closest(".struct-card");
    if (!card) return;
    state.layoutStructure = card.dataset.structure;
    saveSnapshot();
    renderApp();
    syncInspectorUi();
    smartCenterOnSelectedNode(state, true);
  });

  document.getElementById("palette-options-grid")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".palette-chip");
    if (!chip) return;
    state.colorPalette = chip.dataset.palette;
    saveSnapshot();
    renderApp();
    syncInspectorUi();
  });

  document.getElementById("line-style-options")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".style-btn");
    if (!btn) return;
    state.lineStyle = btn.dataset.line;
    saveSnapshot();
    renderApp();
    syncInspectorUi();
  });

  document.getElementById("box-style-options")?.addEventListener("click", (e) => {
    const btn = e.target.closest(".style-btn");
    if (!btn) return;
    state.boxStyle = btn.dataset.box;
    saveSnapshot();
    renderApp();
    syncInspectorUi();
  });

  document.getElementById("menu-themes")?.addEventListener("click", (e) => {
    const card = e.target.closest(".theme-card");
    if (!card) return;
    const theme = card.dataset.theme;
    const tab = getActiveTab();
    if (tab) tab.canvasTheme = theme;
    document.body.className = `theme-${theme}`;
    saveSnapshot();
    renderApp();
    syncInspectorUi();
    requestTransformUpdate();
  });

  document.getElementById("menu-priority")?.addEventListener("click", (e) => {
    const item = e.target.closest(".popover-item");
    if (!item) return;
    batchSetPriority(item.dataset.priority);
    item.closest(".dropdown-wrapper")?.classList.remove("active");
  });

  document.getElementById("menu-progress")?.addEventListener("click", (e) => {
    const item = e.target.closest(".popover-item");
    if (!item) return;
    batchSetProgress(item.dataset.progress);
    item.closest(".dropdown-wrapper")?.classList.remove("active");
  });

  function toggleDropdown(wrapper) {
    if (!wrapper) return;
    const isAlreadyOpen = wrapper.classList.contains("active");
    document.querySelectorAll(".dropdown-wrapper").forEach(w => w.classList.remove("active"));
    if (!isAlreadyOpen) wrapper.classList.add("active");
  }

  bindClick("btn-priority", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-progress", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });

  window.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".dropdown-wrapper")) {
      document.querySelectorAll(".dropdown-wrapper.active").forEach(w => w.classList.remove("active"));
    }
  }, true);

  bindClick("btn-zoom-in", () => {
    stopAllCameraAnimations();
    camera.transform.scale = Math.min(3.5, camera.transform.scale * 1.25);
    requestTransformUpdate();
    syncInspectorUi();
  });
  bindClick("btn-zoom-out", () => {
    stopAllCameraAnimations();
    camera.transform.scale = Math.max(0.15, camera.transform.scale / 1.25);
    requestTransformUpdate();
    syncInspectorUi();
  });
  bindClick("txt-zoom-level", () => {
    stopAllCameraAnimations();
    camera.transform.scale = 1.0;
    requestTransformUpdate();
    syncInspectorUi();
    smartCenterOnSelectedNode(state, true);
  });
  bindClick("btn-smart-center", () => smartCenterOnSelectedNode(state, true));
  bindClick("btn-toggle-minimap", () => minimapWidget?.classList.toggle("hidden"));

  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.matches?.("input, textarea, select, [contenteditable=true]") || e.target.isContentEditable) && e.target.id !== "inline-editor") return;
    if (e.key === "Escape") {
      const activeDropdown = document.querySelector(".dropdown-wrapper.active");
      if (activeDropdown) {
        activeDropdown.classList.remove("active");
        return;
      }
    }

    if (state.editingNodeId) return;

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "h") { e.preventDefault(); openVersionHistoryModal(renderApp); return; }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); saveMindMapFile(true); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveMindMapFile(false); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") { e.preventDefault(); openLocalFile(); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key === "1") { e.preventDefault(); switchViewMode("mindmap"); return; }
    if (e.altKey && e.key === "2") { e.preventDefault(); switchViewMode("outliner"); return; }
    if (e.altKey && e.key.toLowerCase() === "o") { e.preventDefault(); switchViewMode(state.viewMode === "mindmap" ? "outliner" : "mindmap"); return; }

    if (state.viewMode === "outliner") return;

    if (e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); openNotesDrawer(getPrimarySelectedNode()); return; }
    if (e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); openFlashcardModal(); return; }
    if (e.altKey && e.key.toLowerCase() === "l") { e.preventDefault(); document.getElementById("btn-toggle-security")?.click(); return; }
    if (e.altKey && e.key.toLowerCase() === "r") { e.preventDefault(); toggleRecallMode(renderApp); return; }
    if (e.key === "Tab") { e.preventDefault(); addChildNode(); }
    else if (e.key === "Enter") { e.preventDefault(); addSiblingNode(); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); batchDelete(); }
    else if (["1", "2", "3", "4"].includes(e.key)) { e.preventDefault(); batchSetPriority("P" + e.key); }
    else if (e.key === "0") { e.preventDefault(); batchSetPriority("none"); }
    else if (e.altKey && (e.key.toLowerCase() === "c" || e.key === "ç")) { e.preventDefault(); smartCenterOnSelectedNode(state); }
    else if (e.key === "Escape") {
      closeVersionHistoryModal();
      const rootId = state.mindData?.id || "root"; if (state.focusedRootId !== rootId) { state.focusedRootId = rootId; renderApp(); smartCenterOnSelectedNode(state); }
    } else if (e.key === " " || e.key === "F2") {
      e.preventDefault();
      const primary = getPrimarySelectedNode();
      if (primary) startEditNode(primary, state, renderApp);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? redo(renderApp) : undo(renderApp);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      e.preventDefault(); redo(renderApp);
    }
  });

  if (viewport) {
    viewport.addEventListener("mousedown", (e) => {
      stopAllCameraAnimations();

      if (state.editingNodeId) {
        const editor = document.getElementById("inline-editor");
        if (editor && !editor.classList.contains("hidden")) {
          editor.blur();
        }
        return;
      }
      
      const isNode = e.target.closest && (e.target.closest(".svg-node") || e.target.closest(".svg-badge"));
      const isInteractiveUi = e.target.closest && (
        e.target.closest(".canvas-floating-controls") ||
        e.target.closest(".minimap-widget") ||
        e.target.closest(".inline-editor") ||
        e.target.closest(".apple-breadcrumb-capsule")
      );

      document.querySelectorAll(".dropdown-wrapper").forEach(w => w.classList.remove("active"));
      if (isNode || isInteractiveUi) return;
      // detail===2 removed to prevent click bleed-through

      e.preventDefault();
      lastMousePos = { x: e.clientX, y: e.clientY };
      lastMouseTime = performance.now();
      velocity = { x: 0, y: 0 };

      if ((e.shiftKey || e.metaKey || e.ctrlKey) && marqueeBox) {
        isMarqueeActive = true;
        const rect = viewport.getBoundingClientRect();
        marqueeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        marqueeBox.style.left = `${marqueeStart.x}px`;
        marqueeBox.style.top = `${marqueeStart.y}px`;
        marqueeBox.style.width = "0px";
        marqueeBox.style.height = "0px";
        marqueeBox.classList.remove("hidden");
      } else {
        isDraggingCanvas = true;
        document.body.classList.add("is-panning");
        startPan = { x: e.clientX - camera.transform.x, y: e.clientY - camera.transform.y };
        dragStartPos = { x: e.clientX, y: e.clientY };
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (state.editingNodeId) return;
      if (!isMarqueeActive && !isDraggingCanvas) return;

      const now = performance.now();
      const dt = now - lastMouseTime;
      if (dt > 8) {
        const rawVx = (e.clientX - lastMousePos.x) / dt;
        const rawVy = (e.clientY - lastMousePos.y) / dt;
        velocity.x = velocity.x * 0.35 + rawVx * 0.65;
        velocity.y = velocity.y * 0.35 + rawVy * 0.65;
        lastMousePos = { x: e.clientX, y: e.clientY };
        lastMouseTime = now;
      }

      if (isMarqueeActive && marqueeBox) {
        const rect = viewport.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;
        const left = Math.min(marqueeStart.x, curX);
        const top = Math.min(marqueeStart.y, curY);
        const width = Math.abs(curX - marqueeStart.x);
        const height = Math.abs(curY - marqueeStart.y);

        marqueeBox.style.left = `${left}px`;
        marqueeBox.style.top = `${top}px`;
        marqueeBox.style.width = `${width}px`;
        marqueeBox.style.height = `${height}px`;

        const worldL = (left - camera.transform.x) / camera.transform.scale;
        const worldR = (left + width - camera.transform.x) / camera.transform.scale;
        const worldT = (top - camera.transform.y) / camera.transform.scale;
        const worldB = (top + height - camera.transform.y) / camera.transform.scale;

        const currentRoot = findNode(state.focusedRootId, state.mindData) || state.mindData;
        const selected = new Set();

        function checkCollision(n) {
          if (n.x !== undefined && n.y !== undefined && n.width !== undefined && n.height !== undefined) {
            const nodeL = n.x;
            const nodeR = n.x + n.width;
            const nodeT = n.y;
            const nodeB = n.y + n.height;
            const intersects = !(nodeL > worldR || nodeR < worldL || nodeT > worldB || nodeB < worldT);
            if (intersects) selected.add(n.id);
          }
          if (n.children && !n.collapsed) n.children.forEach(checkCollision);
        }
        checkCollision(currentRoot);

        state.selectedIds = selected.size > 0 ? selected : new Set([state.focusedRootId]);
        updateSelectionStyles(state);
      } else if (isDraggingCanvas) {
        camera.transform.x = e.clientX - startPan.x;
        camera.transform.y = e.clientY - startPan.y;
        requestTransformUpdate();
      }
    });

    window.addEventListener("mouseup", () => {
      if (isMarqueeActive && marqueeBox) {
        isMarqueeActive = false;
        marqueeBox.classList.add("hidden");
      }
      if (isDraggingCanvas) {
        isDraggingCanvas = false;
        document.body.classList.remove("is-panning");
        if (Math.hypot(e.clientX - dragStartPos.x, e.clientY - dragStartPos.y) < 4) {
          state.selectedIds = new Set([state.focusedRootId]);
          updateSelectionStyles(state);
        }

        const timeSinceLastMove = performance.now() - lastMouseTime;
        if (timeSinceLastMove < 45) {
          const speed = Math.hypot(velocity.x, velocity.y);
          if (speed > 0.25) {
            const maxSpeed = 1.4;
            const scale = speed > maxSpeed ? maxSpeed / speed : 1;
            startInertiaMomentum(velocity.x * scale * 0.42, velocity.y * scale * 0.42);
          }
        }
      }
    });

    
    viewport.addEventListener("dblclick", (e) => {
      // 🌟 防穿透保护：工作区切换后 400ms 内禁止响应双击新建浮动节点
      if (Date.now() - (window.__WORKSPACE_OPENED_TIME__ || 0) < 450) return;
      const isNode = e.target.closest && (e.target.closest(".svg-node") || e.target.closest(".svg-badge"));
      const isInteractiveUi = e.target.closest && (
        e.target.closest(".canvas-floating-controls") ||
        e.target.closest(".minimap-widget") ||
        e.target.closest(".inline-editor") ||
        e.target.closest(".apple-breadcrumb-capsule") ||
        e.target.closest(".dropdown-wrapper")
      );
      if (isNode || isInteractiveUi) return;
      const vpRect = viewport.getBoundingClientRect();
      const worldX = (e.clientX - vpRect.left - camera.transform.x) / camera.transform.scale;
      const worldY = (e.clientY - vpRect.top - camera.transform.y) / camera.transform.scale;
      createFloatingNode(worldX, worldY);
    });

    viewport.addEventListener("wheel", (e) => {
      if (state.editingNodeId) {
        const editor = document.getElementById("inline-editor");
        if (editor && !editor.classList.contains("hidden")) editor.blur();
        return;
      }
      stopAllCameraAnimations();
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const prevScale = camera.transform.scale;
      const zoomFactor = Math.exp(-e.deltaY * 0.0018);
      const newScale = Math.min(Math.max(0.15, prevScale * zoomFactor), 3.5);

      camera.transform.x = mouseX - (mouseX - camera.transform.x) * (newScale / prevScale);
      camera.transform.y = mouseY - (mouseY - camera.transform.y) * (newScale / prevScale);
      camera.transform.scale = newScale;

      requestTransformUpdate();
      syncInspectorUi();
    }, { passive: false });
  }

  bindClick("btn-mode-mindmap", () => switchViewMode("mindmap"));
  bindClick("btn-mode-outliner", () => switchViewMode("outliner"));
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-mode-flashcards", openFlashcardModal);
  bindClick("btn-node-attributes", (e) => { e.stopPropagation(); toggleDropdown(e.currentTarget.closest(".dropdown-wrapper")); });
  bindClick("btn-open-full-icons", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    document.getElementById("btn-toggle-format")?.click();
    document.getElementById("inspector-icon-section")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  bindClick("btn-open-tag-modal", () => {
    document.querySelector(".dropdown-wrapper.active")?.classList.remove("active");
    openTagManagerModal();
  });

  document.querySelectorAll(".attr-icon-chip[data-quick-icon]").forEach(chip => {
    chip.addEventListener("click", (e) => {
      e.stopPropagation();
      const ic = chip.dataset.quickIcon;
      if (state.selectedIds) {
        state.selectedIds.forEach(id => {
          const n = findNode(id, state.mindData);
          if (n) n.icon = (n.icon === ic ? null : ic);
        });
        saveSnapshot();
        renderApp();
      }
      chip.closest(".dropdown-wrapper")?.classList.remove("active");
    });
  });
  bindClick("btn-add-child", addChildNode);
  bindClick("btn-add-sibling", addSiblingNode);
  bindClick("btn-delete", batchDelete);
  bindClick("btn-undo", () => undo(renderApp));
  bindClick("btn-redo", () => redo(renderApp));
  bindClick("btn-add-tag", openTagManagerModal);
  bindClick("btn-node-note", () => openNotesDrawer(getPrimarySelectedNode()));
  bindClick("btn-add-floating", () => createFloatingNode(camera.transform.x, camera.transform.y));
  bindClick("btn-active-recall", () => toggleRecallMode(renderApp));
  bindClick("btn-flashcards", openFlashcardModal);
  bindClick("btn-save", () => saveMindMapFile(false));
  bindClick("btn-open", openLocalFile);
  bindClick("nav-btn-open-file", openLocalFile);
  bindClick("btn-exit-focus", () => { 
    state.focusedRootId = state.mindData?.id || "root"; 
    renderApp(); 
    smartCenterOnSelectedNode(state);
  });
}

export function createFloatingNode(worldX, worldY) {
  const newFloat = {
    id: "float_" + Date.now(),
    text: "💭 浮动灵感主题",
    customX: (worldX || 250),
    customY: (worldY || 100),
    children: [],
    collapsed: false
  };
  if (!state.floatingNodes) state.floatingNodes = [];
  state.floatingNodes.push(newFloat);
  state.selectedIds = new Set([newFloat.id]);
  saveSnapshot();
  window.__RENDER_APP__ ? window.__RENDER_APP__() : null;
  const node = findNode(newFloat.id, state.mindData);
  if (node) startEditNode(node, state, window.__RENDER_APP__);
  showToast("💭 已创建自由浮动主题！");
}
