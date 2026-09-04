import { countNodes } from "../core/tree-utils.js";
import { state, createNewTab } from "../core/state.js";
import { TEMPLATES } from "../data/templates.js";
import { camera } from "../core/camera.js";
import { syncInspectorUi, applyCanvasThemeToBody } from "./inspector.js";
import { syncSettingsForm } from "./settings.js";
import { showLockScreen, updateSecurityDockStatus } from "./vault.js";
import { showToast, appAlert, appConfirm } from "./dialog.js";

const RECENT_KEY = "YMIND_PRO_RECENT_DOCS_V2";
let activeHomeNav = "home";
let activeTemplateCategory = "all";

/**
 * 🌟 方案 B 纯净物理管道：自动清洗历史脏数据，绝对排除一切无物理路径的草稿条目
 */
export function getRecentDocs() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // 过滤并仅保留具有物理路径的真实磁盘文件
    const cleanFiles = parsed.filter(item => item && item.filePath && typeof item.filePath === "string" && item.filePath.trim().length > 0);
    if (cleanFiles.length !== parsed.length) {
      localStorage.setItem(RECENT_KEY, JSON.stringify(cleanFiles));
    }
    return cleanFiles;
  } catch {
    return [];
  }
}

/**
 * 🌟 方案 B 核心铁律：仅当文件存在合法磁盘绝对路径时，才允许登记入“最近文档”
 */
export function recordRecentDoc(title, data, layout = "mindmap", filePath = null, styles = {}, isEncrypted = false, password = null, passwordHint = "", encryptedVault = null, cameraTransform = null) {
  // 核心拦截：无物理路径的临时草稿绝不写入“最近文档”！
  if (!filePath || typeof filePath !== "string" || filePath.trim().length === 0) {
    return;
  }

  try {
    let recents = getRecentDocs();
    const docTitle = title || filePath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "");
    const existingIdx = recents.findIndex(r => r.filePath === filePath);

    const item = {
      id: existingIdx >= 0 ? recents[existingIdx].id : ("doc_" + Date.now()),
      title: docTitle,
      filePath: filePath,
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
      passwordHint: passwordHint || (encryptedVault?.hint || ""),
      encryptedVault: isEncrypted ? encryptedVault : null,
      camera: cameraTransform || (existingIdx >= 0 ? recents[existingIdx].camera : null),
      nodeCount: countNodes(data)
    };

    if (existingIdx >= 0) recents.splice(existingIdx, 1);
    recents.unshift(item);
    if (recents.length > 50) recents.pop();
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
  } catch (e) {
    console.warn("写入物理最近文档失败", e);
  }
}

export async function purgeDeletedFileEverywhere(filePath, docTitle, renderHome) {
  if (filePath) {
    const tabIdx = state.tabs.findIndex(t => t.filePath === filePath);
    if (tabIdx !== -1) {
      const [removedTab] = state.tabs.splice(tabIdx, 1);
      if (removedTab) {
        if (removedTab.spatialIndex) {
          removedTab.spatialIndex.clear();
          removedTab.spatialIndex = null;
        }
        removedTab.mindData = null;
        removedTab.history = [];
      }
      if (state.activeTabId === removedTab?.id) {
        state.activeTabId = state.tabs[0]?.id || null;
      }
    }

    let recents = getRecentDocs().filter(r => r.filePath !== filePath);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
  }
  if (typeof renderHome === "function") renderHome();
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
  const doc = getRecentDocs().find(r => r.id === docId);
  if (doc && doc.filePath) {
    purgeDeletedFileEverywhere(doc.filePath, doc.title, renderHome);
  } else {
    let recents = getRecentDocs().filter(r => r.id !== docId);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recents));
    renderHome();
  }
}

export async function clearAllRecentDocs(renderHome) {
  const recents = getRecentDocs();
  if (recents.length === 0) {
    showToast("📂 最近文件列表为空，无需清空");
    return;
  }

  const starredDocs = recents.filter(d => d.starred);
  let confirmMsg = `确定要清空全部 ${recents.length} 项本地文件历史记录吗？\n（此操作仅清除访问历史，不会删除电脑中的物理文件）`;

  if (starredDocs.length > 0) {
    confirmMsg = `列表中有 ${starredDocs.length} 个标有星标的文档，确认后将保留星标记录，其余清除。确定继续吗？`;
  }

  const confirmed = await appConfirm({
    title: "清空最近文件记录",
    message: confirmMsg,
    confirmText: "确认清空",
    cancelText: "取消",
    isDanger: true
  });

  if (!confirmed) return;

  if (starredDocs.length > 0) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(starredDocs));
    showToast(`🗑️ 已清空历史，保留了 ${starredDocs.length} 项星标文档`);
  } else {
    localStorage.setItem(RECENT_KEY, JSON.stringify([]));
    showToast("🗑️ 最近文件历史记录已清空");
  }

  if (typeof renderHome === "function") renderHome();
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

async function inspectDiskFile(filePath) {
  const invoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || window.__TAURI_INTERNALS__?.invoke;
  if (!invoke) return { exists: null, isWeb: true };

  try {
    const content = await invoke("read_file_content", { path: filePath });
    if (typeof content === "string") return { exists: true, content: content };
  } catch (e) {
    const msg = String(e?.message || e || "").toLowerCase();
    if (msg.includes("no such file") || msg.includes("os error 2") || msg.includes("cannot find the file")) {
      return { exists: false, content: null, reason: "DELETED" };
    }
  }

  return { exists: null, error: "UNVERIFIED" };
}

/**
 * 🌟 方案 B 专属：严格基于物理文件的加载与激活引擎
 */
async function openOrSwitchDoc(doc, openWorkspace, renderHome) {
  if (!doc || !doc.filePath) return;
  const docTitle = doc.title;
  const docFilePath = doc.filePath;

  const check = await inspectDiskFile(docFilePath);
  if (check.exists === false && check.reason === "DELETED") {
    await purgeDeletedFileEverywhere(docFilePath, docTitle, renderHome);
    const { showAppleBanner } = await import("./dialog.js");
    showAppleBanner({
      icon: "🗑️",
      title: "本地物理文件已不存在",
      message: `「${docTitle}」在电脑磁盘中已被移动或删除，已同步清理该项记录`,
      type: "danger",
      duration: 3200
    });
    return;
  }

  const existingTab = state.tabs.find(t => t.filePath === docFilePath);
  if (existingTab) {
    state.activeTabId = existingTab.id;
    if (existingTab.camera?.scale) {
      camera.transform.x = existingTab.camera.x;
      camera.transform.y = existingTab.camera.y;
      camera.transform.scale = existingTab.camera.scale;
    }
    applyCanvasThemeToBody(existingTab.canvasBgColor || "studio-white", existingTab.canvasBgPattern || "dots");
    openWorkspace();
    syncInspectorUi();
    if (existingTab.isEncrypted && existingTab._isLocked) showLockScreen(existingTab);
    showToast(`📂 已切换至已打开的「${existingTab.title}」`);
    return;
  }

  if (check.exists === true && check.content) {
    const { handleLoadedFileContent } = await import("./events.js");
    await handleLoadedFileContent(check.content, docFilePath);
    return;
  }

  if (check.isWeb) {
    const { appAlert } = await import("./dialog.js");
    await appAlert({
      title: "浏览器网页端安全限制",
      message: `无法直接穿透浏览器读取系统路径「${docFilePath}」。请点击左侧「打开本地文件」重新选取该文件。`,
      type: "info"
    });
  }
}

function openTemplateDoc(tpl, openWorkspace) {
  // 🌟 从模板创建时，自动分配唯一的 "未命名 1", "未命名 2"... 序号
  const newTab = createNewTab(tpl.id);
  newTab.filePath = null; // 纯临时草稿，不写 recent
  newTab.isDirty = true;
  camera.transform = { ...newTab.camera };
  applyCanvasThemeToBody(newTab.canvasBgColor || "studio-white", newTab.canvasBgPattern || "dots");
  openWorkspace();
  syncInspectorUi();
  showToast(`✨ 已从「${tpl.name}」模板新建工作区草稿`);
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
        TEMPLATES["project-sprint"],
        TEMPLATES["computer-systems"]
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
    list = list.filter(r => r.title.toLowerCase().includes(searchVal) || (r.filePath && r.filePath.toLowerCase().includes(searchVal)));
  }

  container.innerHTML = "";

  if (list.length === 0) {
    container.innerHTML = `
      <div class="recent-empty-state">
        <div class="empty-icon">📂</div>
        <div class="empty-text">暂无最近打开的物理文件</div>
        <div class="empty-sub">打开或保存一个思维导图文件，它将自动沉淀在此处以便快速回访</div>
      </div>
    `;
    return;
  }

  list.forEach(doc => {
    const row = document.createElement("div");
    row.className = "recent-doc-row";
    const starIcon = doc.starred ? "★" : "☆";
    const starClass = doc.starred ? "starred" : "";

    let iconChar = doc.isEncrypted ? "🔒" : "📄";
    const tagHtml = doc.isEncrypted ? '<span class="doc-badge-vault">AES-256</span>' : '';
    const pathDisplay = doc.filePath;

    const safeDocTitle = String(doc.title).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
    const safePath = String(pathDisplay).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
    row.innerHTML = `
      <div class="doc-icon-wrap">${iconChar}</div>
      <div class="doc-main-info">
        <div class="doc-title-row">
          <span class="doc-title">${safeDocTitle}</span>
          ${tagHtml}
        </div>
        <div class="doc-meta">
          <span>${formatTimeAgo(doc.time)}</span>
          <span>·</span>
          <span class="doc-path-text" title="${safePath}">${safePath}</span>
        </div>
      </div>
      <div class="doc-actions">
        <button class="doc-action-btn star-btn ${starClass}" title="${doc.starred ? "取消星标置顶" : "星标置顶"}">${starIcon}</button>
        <button class="doc-action-btn delete-btn" title="从历史中移除">✕</button>
      </div>
    `;

    row.onclick = (e) => {
      if (e.target.closest(".doc-actions")) return;
      openOrSwitchDoc(doc, openWorkspace, () => renderHomeHub(renderApp, openWorkspace));
    };

    row.querySelector(".star-btn").onclick = (e) => {
      e.stopPropagation();
      toggleStarDoc(doc.id, () => renderHomeHub(renderApp, openWorkspace));
    };
    row.querySelector(".delete-btn").onclick = (e) => {
      e.stopPropagation();
      removeRecentDoc(doc.id, () => renderHomeHub(renderApp, openWorkspace));
    };

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

  const btnClearAll = document.getElementById("btn-clear-recent-all");
  if (btnClearAll) {
    btnClearAll.onclick = (e) => {
      e.stopPropagation();
      clearAllRecentDocs(() => renderHomeHub(renderApp, openWorkspace));
    };
  }
}
