import { state, createNewTab } from "../core/state.js";
import { TEMPLATES } from "../data/templates.js";
import { camera } from "../core/camera.js";
import { syncInspectorUi, applyCanvasThemeToBody } from "./inspector.js";
import { syncSettingsForm } from "./settings.js";
import { encryptMindPayload } from "../storage/crypto.js";
import { showLockScreen, updateSecurityDockStatus } from "./vault.js";

const RECENT_KEY = "YMIND_PRO_RECENT_DOCS_V2";
let activeHomeNav = "home";
let activeTemplateCategory = "all";

export function getRecentDocs() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function recordRecentDoc(title, data, layout = "mindmap", filePath = null, styles = {}, isEncrypted = false, password = null, passwordHint = "", encryptedVault = null) {
  try {
    let recents = getRecentDocs();
    const docTitle = title || "未命名导图";
    const existingIdx = recents.findIndex(r => (filePath && r.filePath === filePath) || r.title === docTitle);

    let finalVault = encryptedVault;
    // 如果是加密导图，绝对不在本地持久化明文树，立即生成密文包
    if (isEncrypted && data && password && !finalVault) {
      finalVault = await encryptMindPayload(data, password, passwordHint);
    }

    const item = {
      id: existingIdx >= 0 ? recents[existingIdx].id : ("doc_" + Date.now()),
      title: docTitle,
      filePath: filePath || (existingIdx >= 0 ? recents[existingIdx].filePath : null),
      time: Date.now(),
      layout: layout || (existingIdx >= 0 ? recents[existingIdx].layout : "mindmap"),
      colorPalette: styles.colorPalette || (existingIdx >= 0 ? recents[existingIdx].colorPalette : "apple-classic"),
      lineStyle: styles.lineStyle || (existingIdx >= 0 ? recents[existingIdx].lineStyle : "curve"),
      boxStyle: styles.boxStyle || (existingIdx >= 0 ? recents[existingIdx].boxStyle : "squircle"),
      canvasTheme: styles.canvasTheme || (existingIdx >= 0 ? recents[existingIdx].canvasTheme : "studio-light"),
      canvasBgColor: styles.canvasBgColor || (existingIdx >= 0 ? recents[existingIdx].canvasBgColor : "studio-white"),
      canvasBgPattern: styles.canvasBgPattern || (existingIdx >= 0 ? recents[existingIdx].canvasBgPattern : "dots"),
      starred: existingIdx >= 0 ? Boolean(recents[existingIdx].starred) : false,
      isEncrypted: Boolean(isEncrypted),
      passwordHint: passwordHint || (finalVault?.hint || ""),
      encryptedVault: isEncrypted ? finalVault : null,
      nodeCount: isEncrypted ? (existingIdx >= 0 ? recents[existingIdx].nodeCount : 1) : countNodes(data),
      // 加密状态下完全置空明文数据
      data: isEncrypted ? null : (data ? JSON.parse(JSON.stringify(data)) : { id: "root", text: docTitle, children: [] })
    };

    if (existingIdx >= 0) recents.splice(existingIdx, 1);
    recents.unshift(item);
    if (recents.length > 50) recents.pop();
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
  } catch (e) {
    console.error("记录最近文档失败", e);
  }
}

function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) node.children.forEach(c => count += countNodes(c));
  return count;
}

export function toggleStarDoc(docId, renderHome) {
  let recents = getRecentDocs();
  const doc = recents.find(r => r.id === docId);
  if (doc) {
    doc.starred = !doc.starred;
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
    renderHome();
  }
}

export function removeRecentDoc(docId, renderHome) {
  let recents = getRecentDocs().filter(r => r.id !== docId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
  renderHome();
}

function formatTimeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚编辑";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(ts).toLocaleDateString();
}

function openOrSwitchDoc(doc, openWorkspace) {
  if (!doc) return;
  const docTitle = doc.title;
  const docFilePath = doc.filePath || null;
  const existingTab = state.tabs.find(t => (docFilePath && t.filePath === docFilePath) || t.title === docTitle);

  if (existingTab) {
    state.activeTabId = existingTab.id;
    camera.transform = existingTab.camera;
    applyCanvasThemeToBody(existingTab.canvasBgColor || "studio-white", existingTab.canvasBgPattern || "dots");
    openWorkspace();
    syncInspectorUi();
    if (existingTab.isEncrypted && existingTab._isLocked) {
      showLockScreen(existingTab);
    }
    return;
  }

  const newTab = createNewTab();
  newTab.title = docTitle;
  newTab.filePath = docFilePath;
  newTab.layoutStructure = doc.layout || "mindmap";
  newTab.colorPalette = doc.colorPalette || "apple-classic";
  newTab.lineStyle = doc.lineStyle || "curve";
  newTab.boxStyle = doc.boxStyle || "squircle";
  newTab.canvasTheme = doc.canvasTheme || "studio-light";
  newTab.canvasBgColor = doc.canvasBgColor || "studio-white";
  newTab.canvasBgPattern = doc.canvasBgPattern || "dots";
  newTab.isDirty = false;
  camera.transform = newTab.camera;

  if (doc.isEncrypted) {
    // 🛡️ 加密文档进入隔离锁屏态，绝不加载任何明文
    newTab.isEncrypted = true;
    newTab.encryptedVault = doc.encryptedVault;
    newTab.passwordHint = doc.passwordHint || "";
    newTab.mindData = { id: "root", text: "🔒 " + docTitle, children: [] };
    newTab.history = [];
    newTab._isLocked = true;
  } else {
    newTab.isEncrypted = false;
    newTab.encryptedVault = null;
    newTab.mindData = doc.data ? JSON.parse(JSON.stringify(doc.data)) : { id: "root", text: docTitle, children: [] };
    newTab.selectedIds = new Set([newTab.mindData.id || "root"]);
    newTab.focusedRootId = newTab.mindData.id || "root";
    newTab.history = [JSON.stringify(newTab.mindData)];
    newTab.historyIndex = 0;
  }

  applyCanvasThemeToBody(newTab.canvasBgColor, newTab.canvasBgPattern);
  openWorkspace();
  syncInspectorUi();
  updateSecurityDockStatus();

  if (newTab.isEncrypted && newTab._isLocked) {
    showLockScreen(newTab);
  }
}

function openTemplateDoc(tpl, openWorkspace) {
  const newTab = createNewTab(tpl.id);
  newTab.filePath = null;
  camera.transform = newTab.camera;
  applyCanvasThemeToBody(newTab.canvasBgColor || "studio-white", newTab.canvasBgPattern || "dots");
  recordRecentDoc(tpl.name, newTab.mindData, tpl.layout, null, {
    colorPalette: newTab.colorPalette,
    lineStyle: newTab.lineStyle,
    boxStyle: newTab.boxStyle,
    canvasTheme: newTab.canvasTheme,
    canvasBgColor: newTab.canvasBgColor,
    canvasBgPattern: newTab.canvasBgPattern
  }, false);
  openWorkspace();
  syncInspectorUi();
}

export function switchHomeTab(tabName, renderApp, openWorkspace) {
  activeHomeNav = tabName;
  document.querySelectorAll(".home-nav-item[data-nav]").forEach(i => {
    i.classList.toggle("active", i.dataset.nav === tabName);
  });
  renderHomeHub(renderApp, openWorkspace);
}

export function renderHomeHub(renderApp, openWorkspace) {
  const homeView = document.getElementById("home-view");
  if (!homeView) return;

  const hasActiveTabs = state.tabs && state.tabs.length > 0;
  const navWorkspaceBtn = document.getElementById("nav-btn-workspace");
  const quickResumeBtn = document.getElementById("btn-quick-resume");

  if (navWorkspaceBtn) navWorkspaceBtn.style.display = hasActiveTabs ? "flex" : "none";
  if (quickResumeBtn) quickResumeBtn.style.display = hasActiveTabs ? "inline-flex" : "none";

  const pageHome = document.getElementById("home-tab-page-home");
  const pageTemplates = document.getElementById("home-tab-page-templates");
  const pageStarred = document.getElementById("home-tab-page-starred");
  const pageSettings = document.getElementById("home-tab-page-settings");

  if (pageHome) pageHome.classList.toggle("hidden", activeHomeNav !== "home");
  if (pageTemplates) pageTemplates.classList.toggle("hidden", activeHomeNav !== "templates");
  if (pageStarred) pageStarred.classList.toggle("hidden", activeHomeNav !== "starred");
  if (pageSettings) pageSettings.classList.toggle("hidden", activeHomeNav !== "settings");

  if (activeHomeNav === "home") {
    const quickGrid = document.getElementById("home-quick-start");
    if (quickGrid) {
      quickGrid.innerHTML = "";
      const top4 = [
        TEMPLATES["ymind-feature-tour"],
        TEMPLATES["mindmap-blank"],
        TEMPLATES["logic-right-blank"],
        TEMPLATES["project-sprint"]
      ];

      top4.forEach(tpl => {
        if (!tpl) return;
        const card = document.createElement("div");
        card.className = "quick-card";
        card.innerHTML = `
          <div class="quick-icon">${tpl.icon}</div>
          <div class="quick-name">${tpl.name}</div>
          <div class="quick-desc">${tpl.desc}</div>
        `;
        card.onclick = () => openTemplateDoc(tpl, openWorkspace);
        quickGrid.appendChild(card);
      });
    }
    renderDocList("home-recent-list", getRecentDocs(), renderApp, openWorkspace);
  }

  if (activeHomeNav === "templates") {
    const fullGrid = document.getElementById("home-full-template-grid");
    if (fullGrid) {
      fullGrid.innerHTML = "";
      Object.values(TEMPLATES).forEach(tpl => {
        if (activeTemplateCategory !== "all" && tpl.category !== activeTemplateCategory) return;
        const card = document.createElement("div");
        card.className = "quick-card";
        card.innerHTML = `
          <div class="quick-icon">${tpl.icon}</div>
          <div class="quick-name">${tpl.name}</div>
          <div class="quick-desc">${tpl.desc}</div>
        `;
        card.onclick = () => openTemplateDoc(tpl, openWorkspace);
        fullGrid.appendChild(card);
      });
    }
  }

  if (activeHomeNav === "starred") {
    const starredDocs = getRecentDocs().filter(r => r.starred);
    renderDocList("home-starred-list", starredDocs, renderApp, openWorkspace);
  }

  if (activeHomeNav === "settings") {
    syncSettingsForm();
  }
}

function renderDocList(containerId, docs, renderApp, openWorkspace) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const searchInput = document.getElementById("home-recent-search");
  const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : "";

  let list = docs;
  if (searchVal) {
    list = list.filter(r => r.title.toLowerCase().includes(searchVal));
  }

  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `
      <div class="recent-empty-state">
        <div class="empty-icon">📂</div>
        <div class="empty-text">暂无相关导图文档</div>
        <div class="empty-sub">点击上方快捷起步，开启一份新的思维导图</div>
      </div>
    `;
    return;
  }

  list.forEach(doc => {
    const row = document.createElement("div");
    row.className = "recent-doc-row";
    const starIcon = doc.starred ? "★" : "☆";
    const starClass = doc.starred ? "starred" : "";
    const layoutLabel = {
      "mindmap": "经典双向",
      "logic-right": "向右逻辑",
      "logic-left": "向左逻辑",
      "org-down": "组织架构"
    }[doc.layout] || "思维导图";

    row.innerHTML = `
      <div class="doc-icon-wrap">${doc.isEncrypted ? "🔒" : "📄"}</div>
      <div class="doc-main-info">
        <div class="doc-title">${doc.title} ${doc.isEncrypted ? '<span class="apple-tag p1" style="font-size:9px;margin-left:4px;">AES-256</span>' : ''}</div>
        <div class="doc-meta">
          <span class="doc-time">${formatTimeAgo(doc.time)}</span>
          <span class="doc-dot">·</span>
          <span class="doc-badge">${layoutLabel}</span>
          <span class="doc-dot">·</span>
          <span class="doc-count">${doc.isEncrypted ? "加密保护" : (doc.nodeCount || 1) + " 个节点"}</span>
          <span class="doc-dot">·</span>
          <span class="doc-path" title="${doc.filePath || '本地草稿'}" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">📁 ${doc.filePath || '本地草稿'}</span>
        </div>
      </div>
      <div class="doc-actions">
        <button class="doc-action-btn star-btn ${starClass}" title="${doc.starred ? '取消收藏' : '收藏置顶'}">${starIcon}</button>
        <button class="doc-action-btn delete-btn" title="从历史中移除">✕</button>
      </div>
    `;

    row.onclick = (e) => {
      if (e.target.closest(".doc-actions")) return;
      openOrSwitchDoc(doc, openWorkspace);
    };

    row.querySelector(".star-btn").onclick = () => toggleStarDoc(doc.id, () => renderHomeHub(renderApp, openWorkspace));
    row.querySelector(".delete-btn").onclick = () => removeRecentDoc(doc.id, () => renderHomeHub(renderApp, openWorkspace));

    container.appendChild(row);
  });
}

export function initHomeEvents(renderApp, openWorkspace) {
  document.getElementById("nav-btn-workspace")?.addEventListener("click", () => {
    if (state.tabs.length > 0) openWorkspace();
  });

  document.getElementById("btn-quick-resume")?.addEventListener("click", () => {
    if (state.tabs.length > 0) openWorkspace();
  });

  document.querySelectorAll(".home-nav-item[data-nav]").forEach(item => {
    item.onclick = () => {
      document.querySelectorAll(".home-nav-item[data-nav]").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
      activeHomeNav = item.dataset.nav;
      renderHomeHub(renderApp, openWorkspace);
    };
  });

  document.querySelectorAll(".gallery-tab").forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll(".gallery-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      activeTemplateCategory = tab.dataset.cat;
      renderHomeHub(renderApp, openWorkspace);
    };
  });

  const searchInput = document.getElementById("home-recent-search");
  if (searchInput) {
    searchInput.oninput = () => renderHomeHub(renderApp, openWorkspace);
  }
}
