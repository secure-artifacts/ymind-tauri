import { state, getActiveTab, createNewTab, getGlobalSettings, countNodes } from '../core/state.js';
import { appAlert, appConfirm, showToast } from '../ui/dialog.js';
import { syncInspectorUi } from '../ui/inspector.js';
import { serializeTabToPackage } from '../core/serializer.js';
import { showLockScreen, updateSecurityDockStatus } from '../ui/vault.js';
import { idbSaveSnapshot, idbGetAllSnapshots, idbDeleteSnapshot, idbClearSnapshots } from './idb.js';

let cachedSnapshots = [];
const deepClone = typeof structuredClone === "function" ? structuredClone : (obj) => JSON.parse(JSON.stringify(obj));

export async function refreshSnapshotsCache() {
  cachedSnapshots = await idbGetAllSnapshots();
  return cachedSnapshots;
}

export function getAllSnapshots() {
  return cachedSnapshots;
}

export function getSnapshotsStorageSize() {
  try {
    const json = JSON.stringify(cachedSnapshots);
    const bytes = new Blob([json]).size;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } catch {
    return "0 KB";
  }
}

export async function createVersionSnapshot(tab = getActiveTab(), trigger = 'auto') {
  if (!tab || tab._isLocked || !tab.mindData) return null;
  if (tab.isEncrypted && trigger === 'auto') return null;

  // 🌟 原生高速深拷贝（消除 5000+ 节点时的全量字符串序列化卡顿）
  const clonedData = tab.isEncrypted ? null : deepClone(tab.mindData);

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
    mindData: clonedData
  };

  await idbSaveSnapshot(newSnapshot);
  await refreshSnapshotsCache();
  return newSnapshot;
}

export async function deleteSnapshot(snapId) {
  await idbDeleteSnapshot(snapId);
  await refreshSnapshotsCache();
}

export async function clearAllSnapshots() {
  await idbClearSnapshots();
  cachedSnapshots = [];
}

export function restoreSnapshot(snapId, mode = 'new_tab', renderCallback) {
  const snap = cachedSnapshots.find(s => s.id === snapId);
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
    targetTab.history = [{ id: "root", text: "🔒 " + snap.tabTitle, children: [] }];
    targetTab.historyIndex = 0;
    targetTab._isLocked = true;
    showLockScreen(targetTab);
  } else {
    targetTab.isEncrypted = false;
    targetTab.encryptedVault = null;
    targetTab.mindData = deepClone(snap.mindData);
    targetTab.selectedIds = new Set([targetTab.mindData.id || "root"]);
    targetTab.focusedRootId = targetTab.mindData.id || "root";
    targetTab.history = [deepClone(targetTab.mindData)];
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
  const snap = cachedSnapshots.find(s => s.id === snapId);
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

  const blob = new Blob([JSON.stringify(filePackage, null, 2)], { type: "application/json" });
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
    // 🌟 并发竞态安全拦截：用户正在进行画布高频交互或编辑行内文本时，坚决延后快照写入
    if (state.isInteracting || state.editingNodeId) return;
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) return;

    state.tabs.forEach(tab => {
      if (tab.isDirty && !tab._isLocked && !tab.isEncrypted) {
        createVersionSnapshot(tab, "auto");
      }
    });
  }, intervalSec * 1000);
}

export async function initAutoSaveEngine(renderApp) {
  await refreshSnapshotsCache();
  checkCrashRecovery(renderApp);
  restartAutoSaveEngine(renderApp);
}

function checkCrashRecovery(renderApp) {
  if (cachedSnapshots.length === 0) return;
  const latest = cachedSnapshots[0];
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

export async function openVersionHistoryModal(renderApp) {
  const modal = document.getElementById("apple-history-modal");
  if (!modal) return;
  await refreshSnapshotsCache();
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

  let snapshots = cachedSnapshots;
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
        <div class="empty-sub">支持 IndexedDB 异步百兆级持久化</div>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = snapshots.map(snap => `
    <div class="history-snap-card" data-id="${snap.id}">
      <div class="snap-header-row">
        <div class="snap-title-group">
          <span class="snap-doc-title">${escapeHtml(snap.tabTitle)}</span>
          ${snap.trigger === 'manual' ? '<span class="snap-badge manual">📸 手动快照</span>' : '<span class="snap-badge auto">⏱️ 定时自动</span>'}
        </div>
        <span class="snap-time-tag">${formatDate(snap.timestamp)}</span>
      </div>
      <div class="snap-meta-row">
        <span>节点数: <strong>${snap.isEncrypted ? '🔒 密文' : snap.nodeCount}</strong></span>
        <span class="meta-dot">·</span>
        <span>存储: IndexedDB (安全隔离)</span>
      </div>
      <div class="snap-actions-row">
        <button class="snap-btn primary" data-action="restore-new">打开快照</button>
        <button class="snap-btn secondary" data-action="restore-overwrite">覆盖还原</button>
        <button class="snap-btn icon" data-action="export">💾 导出</button>
        <button class="snap-btn danger-icon" data-action="delete">🗑️</button>
      </div>
    </div>
  `).join('');

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
          message: "确定要使用此历史快照覆盖当前正在编辑的导图吗？",
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
        await deleteSnapshot(snapId);
        renderHistoryList(document.getElementById("history-search-input")?.value || "", renderApp);
        showToast("🗑️ 快照已删除");
      }
    };
  });
}

function formatDate(ts, compact = false) {
  const d = new Date(ts);
  const pad = n => n < 10 ? '0' + n : n;
  if (compact) {
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
  return `${d.getMonth()+1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
