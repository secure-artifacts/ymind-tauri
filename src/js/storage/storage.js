import { state, getActiveTab, createNewTab, countNodes, getGlobalSettings } from "../core/state.js";
import { appAlert, appConfirm, showToast, appPrompt, escapeHtml } from "../ui/dialog.js";
import { syncInspectorUi } from "../ui/inspector.js";
import { updateSecurityDockStatus } from "../ui/vault.js";
import { idbSaveSnapshot } from "./idb.js";

const deepClone = typeof structuredClone === "function" ? structuredClone : (obj) => JSON.parse(JSON.stringify(obj));
let gAutoSaveTimer = null;

export async function createVersionSnapshot(tab = getActiveTab(), trigger = "manual", customName = "") {
  if (!tab || !tab.mindData) return null;

  if (tab.isEncrypted || tab._isLocked) {
    if (trigger === "manual") showToast("🔒 保密文件已启用隐私隔离，禁止记录历史快照");
    return null;
  }

  if (!Array.isArray(tab.versions)) tab.versions = [];

  const snapName = customName.trim() || (trigger === "manual" ? ("里程碑 " + (tab.versions.length + 1)) : ("自动快照 " + formatDate(Date.now(), true)));

  const newSnapshot = {
    id: "ver_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    name: snapName,
    trigger: trigger,
    timestamp: Date.now(),
    tabTitle: tab.title || "思维导图",
    nodeCount: countNodes(tab.mindData),
    layoutStructure: tab.layoutStructure || "mindmap",
    colorPalette: tab.colorPalette || "apple-classic",
    lineStyle: tab.lineStyle || "curve",
    boxStyle: tab.boxStyle || "squircle",
    canvasBgColor: tab.canvasBgColor || "studio-white",
    canvasBgPattern: tab.canvasBgPattern || "dots",
    mindData: deepClone(tab.mindData)
  };

  tab.versions.unshift(newSnapshot);
  if (tab.versions.length > 30) tab.versions.pop();
  
  // 🌟 写入 IndexedDB 本地沙箱永久存档，供时光机查询与崩溃自愈
  idbSaveSnapshot(newSnapshot).catch(() => {});
  return newSnapshot;
}

export function restoreSnapshot(snapId, mode = "new_tab", renderCallback) {
  const curTab = getActiveTab();
  if (!curTab || !curTab.versions) return;

  const snap = curTab.versions.find(s => s.id === snapId);
  if (!snap) {
    appAlert({ title: "版本失效", message: "未在本文档内嵌记录中找到该版本。", type: "warning" });
    return;
  }

  let targetTab;
  if (mode === "overwrite") {
    targetTab = curTab;
    targetTab.mindData = deepClone(snap.mindData);
  } else {
    targetTab = createNewTab();
    targetTab.title = curTab.title + " (版本还原)";
    targetTab.mindData = deepClone(snap.mindData);
  }

  targetTab.layoutStructure = snap.layoutStructure || "mindmap";
  targetTab.colorPalette = snap.colorPalette || "apple-classic";
  targetTab.lineStyle = snap.lineStyle || "curve";
  targetTab.boxStyle = snap.boxStyle || "squircle";
  targetTab.canvasBgColor = snap.canvasBgColor || "studio-white";
  targetTab.canvasBgPattern = snap.canvasBgPattern || "dots";
  targetTab.selectedIds = new Set([targetTab.mindData.id || "root"]);
  targetTab.focusedRootId = targetTab.mindData.id || "root";
  targetTab.history = [deepClone(targetTab.mindData)];
  targetTab.historyIndex = 0;
  targetTab.isDirty = true;

  if (typeof renderCallback === "function") {
    renderCallback();
    syncInspectorUi();
    updateSecurityDockStatus();
  }
}

export function deleteSnapshot(snapId) {
  const curTab = getActiveTab();
  if (!curTab || !curTab.versions) return;
  curTab.versions = curTab.versions.filter(s => s.id !== snapId);
  curTab.isDirty = true;
}

export function clearAllSnapshots() {
  const curTab = getActiveTab();
  if (!curTab) return;
  curTab.versions = [];
  curTab.isDirty = true;
}

export async function openVersionHistoryModal(renderApp) {
  const modal = document.getElementById("apple-history-modal");
  if (!modal) return;
  const curTab = getActiveTab();
  if (!curTab) {
    showToast("⚠️ 当前没有打开的思维导图");
    return;
  }

  modal.innerHTML = `
    <div class="apple-modal-card history-modal-card">
      <div class="apple-modal-header" style="justify-content: space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="modal-header-icon primary" style="font-size: 18px;">📸</div>
          <div class="modal-title-wrap">
            <h3 class="apple-modal-title">文档内嵌时光机 (随身封包)</h3>
            <div style="font-size:11.5px;color:var(--text-tertiary);margin-top:2px;">
              当前文档: <strong style="color:var(--text-primary);">${escapeHtml(curTab.title || "未命名导图")}</strong>
              ${curTab.filePath ? " · 物理文件绑定" : " · 本地草稿"}
            </div>
          </div>
        </div>
        <button id="btn-history-close-x" class="inspector-close-btn" style="width:28px;height:28px;">✕</button>
      </div>

      ${curTab.isEncrypted ? `
        <div class="vault-hint-box" style="margin: 6px 0; background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.25); color: #dc2626;">
          🔒 <strong>保密文件安全隔离已生效</strong>：为防止商业机密泄露，加密文档严格禁止记录任何历史版本快照，所有快照已物理焚毁。
        </div>
      ` : `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:4px 0;">
          <div class="home-search-wrapper" style="flex:1;height:32px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input id="history-search-input" type="text" placeholder="搜索当前文档的版本..." style="font-size:12px;" />
          </div>
          <button id="btn-create-manual-snap" class="dock-capsule-btn primary-action" style="height:32px;">
            <span>📸 记录当前里程碑</span>
          </button>
          <button id="btn-history-clear-all" class="doc-action-btn delete-btn" title="清空本文档版本">清空</button>
        </div>
      `}

      <div id="history-snapshots-list" style="flex:1;overflow-y:auto;max-height:360px;display:flex;flex-direction:column;gap:8px;margin-top:4px;"></div>

      <div class="apple-modal-footer" style="justify-content: space-between; font-size: 11px; color: var(--text-tertiary);">
        <span>💡 时光机快照已同步至本地持久层，支持一键对比与历史版本找回</span>
        <button id="btn-history-done" class="modal-btn modal-btn-secondary">关闭</button>
      </div>
    </div>
  `;

  modal.classList.remove("hidden");

  document.getElementById("btn-history-close-x")?.addEventListener("click", () => modal.classList.add("hidden"));
  document.getElementById("btn-history-done")?.addEventListener("click", () => modal.classList.add("hidden"));

  if (!curTab.isEncrypted) {
    document.getElementById("btn-create-manual-snap")?.addEventListener("click", async () => {
      const snapName = await appPrompt({
        title: "记录里程碑版本",
        message: "为当前思维导图状态命名（如：方案一评审通过、重构前备份）：",
        placeholder: "输入里程碑说明...",
        defaultValue: "里程碑 " + ((curTab.versions?.length || 0) + 1)
      });
      if (snapName !== null && snapName !== undefined) {
        await createVersionSnapshot(curTab, "manual", snapName);
        renderHistoryList("", renderApp);
        showToast("📸 里程碑版本已记录至本文档");
      }
    });

    document.getElementById("btn-history-clear-all")?.addEventListener("click", async () => {
      const ok = await appConfirm({
        title: "清空当前文档版本",
        message: "确定要永久清空本文档内的所有历史版本吗？保存文件后将无法找回。",
        isDanger: true,
        confirmText: "确认清空"
      });
      if (ok) {
        clearAllSnapshots();
        renderHistoryList("", renderApp);
        showToast("🗑️ 本文档的历史版本已清空");
      }
    });

    document.getElementById("history-search-input")?.addEventListener("input", (e) => {
      renderHistoryList(e.target.value, renderApp);
    });
  }

  renderHistoryList("", renderApp);
}

export function renderHistoryList(filterKw = "", renderApp) {
  const container = document.getElementById("history-snapshots-list");
  if (!container) return;

  const curTab = getActiveTab();
  if (!curTab || curTab.isEncrypted) {
    container.innerHTML = `<div class="recent-empty-state"><div class="empty-icon">🔒</div><div class="empty-text">保密文档无历史版本</div></div>`;
    return;
  }

  let list = curTab.versions || [];
  if (filterKw) {
    const kw = filterKw.toLowerCase();
    list = list.filter(s => (s.name || "").toLowerCase().includes(kw));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="recent-empty-state" style="padding: 28px 0;">
        <div class="empty-icon">📂</div>
        <div class="empty-text">本文档暂无内嵌历史版本</div>
        <div class="empty-sub">点击上方「📸 记录当前里程碑」创建第一个版本</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(snap => `
    <div class="recent-doc-row" data-id="${snap.id}" style="background:#f8fafc;border-radius:10px;padding:10px 14px;border:1px solid var(--border-subtle);">
      <div class="doc-icon-wrap" style="font-size:18px;">🏷️</div>
      <div class="doc-main-info">
        <div class="doc-title-row">
          <span class="doc-title" style="font-size:13px;">${escapeHtml(snap.name)}</span>
          <span class="doc-badge-draft" style="background:rgba(0,113,227,0.1);color:var(--apple-blue);">${snap.nodeCount} 节点</span>
        </div>
        <div class="doc-meta" style="font-size:11px;">
          <span>${formatDate(snap.timestamp)}</span>
          <span>·</span>
          <span>${snap.trigger === "manual" ? "手动标记" : "自动快照"}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <button class="snap-btn-restore doc-action-btn" data-id="${snap.id}" style="font-size:11.5px;color:var(--apple-blue);font-weight:600;" title="还原到当前画布">覆盖还原</button>
        <button class="snap-btn-newtab doc-action-btn" data-id="${snap.id}" style="font-size:11.5px;color:var(--text-secondary);" title="以新标签页打开对比">对比打开</button>
        <button class="snap-btn-del doc-action-btn delete-btn" data-id="${snap.id}" title="删除此版本">✕</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll(".snap-btn-restore").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const ok = await appConfirm({
        title: "覆盖还原确认",
        message: "确定要将当前文档画布还原至选中的历史里程碑吗？",
        isDanger: true,
        confirmText: "确认还原"
      });
      if (ok) {
        restoreSnapshot(btn.dataset.id, "overwrite", renderApp);
        document.getElementById("apple-history-modal")?.classList.add("hidden");
        showToast("♻️ 已成功覆盖还原至该版本");
      }
    };
  });

  container.querySelectorAll(".snap-btn-newtab").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      restoreSnapshot(btn.dataset.id, "new_tab", renderApp);
      document.getElementById("apple-history-modal")?.classList.add("hidden");
      showToast("📑 已作为新标签页打开历史版本");
    };
  });

  container.querySelectorAll(".snap-btn-del").forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteSnapshot(btn.dataset.id);
      renderHistoryList(document.getElementById("history-search-input")?.value || "", renderApp);
      showToast("🗑️ 该版本已从文档中删除");
    };
  });
}

function formatDate(ts, compact = false) {
  const d = new Date(ts);
  const pad = n => n < 10 ? "0" + n : n;
  if (compact) {
    return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// 🌟 真实的自动保存引擎：启动定时轮询，自动备份脏文档
export async function initAutoSaveEngine(renderApp) {
  restartAutoSaveEngine(renderApp);
}

export function restartAutoSaveEngine(renderApp) {
  if (gAutoSaveTimer) {
    clearInterval(gAutoSaveTimer);
    gAutoSaveTimer = null;
  }

  const settings = getGlobalSettings();
  const intervalSec = parseInt(settings.autoSaveInterval || "30", 10);
  if (intervalSec <= 0) return; // 用户选择关闭

  gAutoSaveTimer = setInterval(async () => {
    const curTab = getActiveTab();
    if (!curTab || !curTab.mindData || curTab.isEncrypted || curTab._isLocked) return;
    
    // 仅在文档存在变动（脏状态）时自动记录快照并落盘
    if (curTab.isDirty) {
      await createVersionSnapshot(curTab, "auto");
    }
  }, intervalSec * 1000);
}

export function closeVersionHistoryModal() {
  document.getElementById("apple-history-modal")?.classList.add("hidden");
}
