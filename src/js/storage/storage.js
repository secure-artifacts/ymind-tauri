import { state, getActiveTab, createNewTab, getGlobalSettings, countNodes } from '../core/state.js';
import { appAlert, appConfirm, showToast } from '../ui/dialog.js';
import { syncInspectorUi } from '../ui/inspector.js';
import { serializeTabToPackage } from '../core/serializer.js';
import { showLockScreen, updateSecurityDockStatus } from '../ui/vault.js';

const SNAPSHOTS_POOL_KEY = "YMIND_PRO_SNAPSHOTS_POOL";
const MAX_SNAPSHOTS = 18;

// 计算快照池实际占用的字节数
export function getSnapshotsStorageSize() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_POOL_KEY) || "";
    const bytes = new Blob([raw]).size;
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  } catch {
    return "未知";
  }
}

export function getAllSnapshots() {
  try {
    const raw = localStorage.getItem(SNAPSHOTS_POOL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn("读取快照池失败", e);
    return [];
  }
}

function saveSnapshotsPool(list) {
  try {
    localStorage.setItem(SNAPSHOTS_POOL_KEY, JSON.stringify(list));
  } catch (e) {
    try {
      const trimmed = list.slice(0, 6);
      localStorage.setItem(SNAPSHOTS_POOL_KEY, JSON.stringify(trimmed));
    } catch (err) {}
  }
}

export function createVersionSnapshot(tab = getActiveTab(), trigger = 'auto') {
  // 🛡️ 核心防线：锁定状态文档或加密文档在自动模式下一律不静默存快照
  if (!tab || tab._isLocked || !tab.mindData) return null;
  if (tab.isEncrypted && trigger === 'auto') return null;

  const snapshots = getAllSnapshots();
  const currentDataString = JSON.stringify(tab.mindData);

  const lastSnap = snapshots.find(s => s.tabTitle === tab.title);
  if (lastSnap && !tab.isEncrypted && JSON.stringify(lastSnap.mindData) === currentDataString && trigger === 'auto') {
    return null;
  }

  const newSnapshot = {
    id: "snap_" + Date.now(),
    tabTitle: tab.title || "未命名思维导图",
    layoutStructure: tab.layoutStructure || "mindmap",
    colorPalette: tab.colorPalette || "apple-classic",
    lineStyle: tab.lineStyle || "curve",
    boxStyle: tab.boxStyle || "squircle",
    canvasTheme: tab.canvasTheme || "studio-light",
    canvasBgColor: tab.canvasBgColor || "studio-white",
    canvasBgPattern: tab.canvasBgPattern || "dots",
    isEncrypted: Boolean(tab.isEncrypted),
    passwordHint: tab.passwordHint || "",
    encryptedVault: tab.isEncrypted ? tab.encryptedVault : null,
    nodeCount: countNodes(tab.mindData),
    timestamp: Date.now(),
    trigger: trigger,
    // 加密状态下绝不存明文
    mindData: tab.isEncrypted ? null : JSON.parse(currentDataString)
  };

  snapshots.unshift(newSnapshot);

  if (snapshots.length > MAX_SNAPSHOTS) {
    snapshots.splice(MAX_SNAPSHOTS);
  }

  saveSnapshotsPool(snapshots);
  return newSnapshot;
}

export function deleteSnapshot(snapId) {
  let list = getAllSnapshots().filter(s => s.id !== snapId);
  saveSnapshotsPool(list);
}

export function clearAllSnapshots() {
  localStorage.removeItem(SNAPSHOTS_POOL_KEY);
}

export function restoreSnapshot(snapId, mode = 'new_tab', renderCallback) {
  const snapshots = getAllSnapshots();
  const snap = snapshots.find(s => s.id === snapId);
  if (!snap) {
    appAlert({ title: "快照失效", message: "未找到该快照，可能已被清理。", type: "warning" });
    return;
  }

  let targetTab;
  if (mode === 'overwrite') {
    targetTab = getActiveTab();
    targetTab.title = snap.tabTitle;
  } else {
    targetTab = createNewTab();
    targetTab.title = `${snap.tabTitle} (快照还原)`;
  }

  targetTab.layoutStructure = snap.layoutStructure || "mindmap";
  targetTab.colorPalette = snap.colorPalette || "apple-classic";
  targetTab.lineStyle = snap.lineStyle || "curve";
  targetTab.boxStyle = snap.boxStyle || "squircle";
  targetTab.canvasTheme = snap.canvasTheme || "studio-light";
  targetTab.canvasBgColor = snap.canvasBgColor || "studio-white";
  targetTab.canvasBgPattern = snap.canvasBgPattern || "dots";
  targetTab.isDirty = false;

  if (snap.isEncrypted) {
    targetTab.isEncrypted = true;
    targetTab.encryptedVault = snap.encryptedVault;
    targetTab.passwordHint = snap.passwordHint || "";
    targetTab.mindData = { id: "root", text: "🔒 " + snap.tabTitle, children: [] };
    targetTab.history = [];
    targetTab._isLocked = true;
    showLockScreen(targetTab);
  } else {
    targetTab.isEncrypted = false;
    targetTab.encryptedVault = null;
    targetTab.mindData = JSON.parse(JSON.stringify(snap.mindData));
    targetTab.selectedIds = new Set([targetTab.mindData.id || "root"]);
    targetTab.focusedRootId = targetTab.mindData.id || "root";
    targetTab.history = [JSON.stringify(targetTab.mindData)];
    targetTab.historyIndex = 0;
  }

  document.body.className = `theme-${targetTab.canvasTheme}`;

  if (typeof renderCallback === 'function') {
    renderCallback();
    syncInspectorUi();
    updateSecurityDockStatus();
  }
}

export async function exportSnapshotToFile(snapId) {
  const snap = getAllSnapshots().find(s => s.id === snapId);
  if (!snap) return;

  const { filePackage } = await serializeTabToPackage({
    title: snap.tabTitle,
    layoutStructure: snap.layoutStructure,
    colorPalette: snap.colorPalette,
    lineStyle: snap.lineStyle,
    boxStyle: snap.boxStyle,
    canvasTheme: snap.canvasTheme,
    canvasBgColor: snap.canvasBgColor,
    canvasBgPattern: snap.canvasBgPattern,
    isEncrypted: snap.isEncrypted,
    mindData: snap.mindData
  });

  const dataStr = JSON.stringify(filePackage, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${snap.tabTitle}_备份_${formatDate(snap.timestamp, true)}.ymind`;
  a.click();
  showToast("💾 快照导出成功");
}

let autoSaveTimer = null;
export function restartAutoSaveEngine(renderApp) {
  if (autoSaveTimer) { clearInterval(autoSaveTimer); autoSaveTimer = null; }
  const intervalSec = parseInt(getGlobalSettings().autoSaveInterval || "30", 10);
  if (isNaN(intervalSec) || intervalSec <= 0) return;
  autoSaveTimer = setInterval(() => {
    state.tabs.forEach(tab => {
      // 🛡️ 严格排除加密或锁定中的文档
      if (tab.isDirty && !tab._isLocked && !tab.isEncrypted) {
        if (window.requestIdleCallback) window.requestIdleCallback(() => createVersionSnapshot(tab, "auto"), { timeout: 1500 });
        else setTimeout(() => createVersionSnapshot(tab, "auto"), 50);
      }
    });
  }, intervalSec * 1000);
}

export function initAutoSaveEngine(renderApp) {
  checkCrashRecovery(renderApp);
  restartAutoSaveEngine(renderApp);
}

function checkCrashRecovery(renderApp) {
  const snapshots = getAllSnapshots();
  if (snapshots.length === 0) return;

  const latest = snapshots[0];
  const diffMinutes = (Date.now() - latest.timestamp) / 60000;

  if (diffMinutes < 10 && latest.trigger === 'auto' && !latest.isEncrypted) {
    const modal = document.getElementById("apple-recovery-modal");
    const timeHint = document.getElementById("recovery-time-hint");
    const btnConfirm = document.getElementById("btn-recovery-confirm");
    const btnDiscard = document.getElementById("btn-recovery-discard");

    if (!modal) return;
    timeHint.innerText = `发现于 ${formatDate(latest.timestamp)} 自动备份的「${latest.tabTitle}」。`;
    modal.classList.remove("hidden");

    btnConfirm.onclick = () => {
      modal.classList.add("hidden");
      restoreSnapshot(latest.id, 'overwrite', renderApp);
      showToast("🛡️ 已成功加载上次草稿备份");
    };

    btnDiscard.onclick = () => {
      modal.classList.add("hidden");
    };
  }
}

export function openVersionHistoryModal(renderApp) {
  const modal = document.getElementById("apple-history-modal");
  if (!modal) return;
  renderHistoryList("", renderApp);
  modal.classList.remove("hidden");
}

export function closeVersionHistoryModal() {
  document.getElementById("apple-history-modal")?.classList.add("hidden");
}

export function renderHistoryList(filterKeyword = "", renderApp) {
  const listContainer = document.getElementById("history-snapshots-list");
  const countBadge = document.getElementById("history-total-count");
  const storageBadge = document.getElementById("history-storage-usage");
  if (!listContainer) return;

  let snapshots = getAllSnapshots();
  if (filterKeyword) {
    const kw = filterKeyword.toLowerCase();
    snapshots = snapshots.filter(s => s.tabTitle.toLowerCase().includes(kw));
  }

  if (countBadge) countBadge.innerText = `${snapshots.length} 个版本`;
  if (storageBadge) storageBadge.innerText = `容量占用: ${getSnapshotsStorageSize()}`;

  if (snapshots.length === 0) {
    listContainer.innerHTML = `
      <div class="history-empty-state">
        <div class="empty-icon">🕒</div>
        <div class="empty-text">暂无历史备份快照</div>
        <div class="empty-sub">普通导图将定时自动备份，加密文档受零泄露隔离保护</div>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = snapshots.map(snap => {
    const triggerBadge = getTriggerBadge(snap.trigger);
    return `
      <div class="history-snap-card" data-id="${snap.id}">
        <div class="snap-header-row">
          <div class="snap-title-group">
            <span class="snap-doc-title">${escapeXml(snap.tabTitle)}</span>
            ${triggerBadge}
          </div>
          <span class="snap-time-tag">${formatDate(snap.timestamp)}</span>
        </div>
        <div class="snap-meta-row">
          <span>结构: <strong>${getLayoutName(snap.layoutStructure)}</strong></span>
          <span class="meta-dot">·</span>
          <span>节点数: <strong>${snap.isEncrypted ? '🔒 密文封装' : snap.nodeCount}</strong></span>
          <span class="meta-dot">·</span>
          <span>状态: ${snap.isEncrypted ? '🔒 AES-256 加密' : '明文备份'}</span>
        </div>
        <div class="snap-actions-row">
          <button class="snap-btn primary" data-action="restore-new" title="作为新标签页打开">打开快照</button>
          <button class="snap-btn secondary" data-action="restore-overwrite" title="覆盖还原至当前工作区">覆盖还原</button>
          <button class="snap-btn icon" data-action="export" title="导出为文件">💾 导出</button>
          <button class="snap-btn danger-icon" data-action="delete" title="删除此快照">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  listContainer.querySelectorAll('.history-snap-card').forEach(card => {
    const snapId = card.dataset.id;
    card.onclick = async (e) => {
      const btn = e.target.closest('.snap-btn');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'restore-new') {
        restoreSnapshot(snapId, 'new_tab', renderApp);
        closeVersionHistoryModal();
      } else if (action === 'restore-overwrite') {
        const ok = await appConfirm({
          title: "覆盖还原确认",
          message: "确定要使用此历史快照覆盖当前正在编辑的导图吗？当前未保存的修改将被覆盖！",
          isDanger: true,
          confirmText: "确认覆盖"
        });
        if (ok) {
          restoreSnapshot(snapId, 'overwrite', renderApp);
          closeVersionHistoryModal();
          showToast("♻️ 已成功覆盖还原快照");
        }
      } else if (action === 'export') {
        await exportSnapshotToFile(snapId);
      } else if (action === 'delete') {
        deleteSnapshot(snapId);
        renderHistoryList(document.getElementById("history-search-input")?.value || "", renderApp);
        showToast("🗑️ 快照已删除");
      }
    };
  });
}

function getTriggerBadge(trigger) {
  if (trigger === 'manual') return `<span class="snap-badge manual">📸 手动快照</span>`;
  if (trigger === 'crash_guard') return `<span class="snap-badge guard">🛡️ 崩溃防护</span>`;
  return `<span class="snap-badge auto">⏱️ 定时自动</span>`;
}

function getLayoutName(layout) {
  return {
    "mindmap": "经典双向",
    "logic-right": "向右逻辑",
    "logic-left": "向左逻辑",
    "org-down": "组织架构"
  }[layout] || "思维导图";
}

function formatDate(ts, compact = false) {
  const d = new Date(ts);
  if (compact) {
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
  return `${d.getMonth()+1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function pad(n) { return n < 10 ? '0' + n : n; }

function escapeXml(unsafe) {
  return (unsafe || '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '\'': '&apos;', '"': '&quot;' }[c]));
}
