import { applyCanvasThemeToBody, syncInspectorUi } from "./inspector.js";
import { camera } from "../core/camera.js";
import { renderTabBar } from "../core/tab-manager.js";
import { state, getActiveTab, closeTab, saveSnapshot } from "../core/state.js";
import { encryptMindPayload, decryptMindPayload, evaluatePasswordStrength } from "../storage/crypto.js";
import { showToast } from "./dialog.js";
import { bus, EVENTS } from "../core/event-bus.js";

let renderAppRef = null;

export function updateSecurityDockStatus() {
  const tab = getActiveTab();
  const btnSecurity = document.getElementById("btn-toggle-security");
  const txtStatus = document.getElementById("txt-security-status");
  if (!tab || !btnSecurity) return;

  if (tab.isEncrypted) {
    btnSecurity.classList.add("primary-action");
    if (txtStatus) txtStatus.innerText = tab._isLocked ? "已锁定" : "已保护";
    btnSecurity.title = tab._isLocked ? "导图已锁定，点击解锁" : "Argon2id + AES-256 保护中 (点击立即锁定)";
  } else {
    btnSecurity.classList.remove("primary-action");
    if (txtStatus) txtStatus.innerText = "加密";
    btnSecurity.title = "设置 AES-256 密码保险箱 (Alt+L)";
  }
}

export function openVaultSetModal() {
  const tab = getActiveTab();
  const modalSet = document.getElementById("apple-vault-set-modal");
  if (!tab || !modalSet) return;

  const passInput = modalSet.querySelector("#vault-set-pass");
  const passConfirm = modalSet.querySelector("#vault-set-pass-confirm");
  const passHint = modalSet.querySelector("#vault-set-hint");
  const btnDisable = modalSet.querySelector("#btn-vault-disable");
  const btnSaveSet = modalSet.querySelector("#btn-vault-set-save");

  // 🛡️ 绝不明文回显主访问密码到 DOM 节点
  if (passInput) passInput.value = "";
  if (passConfirm) passConfirm.value = "";
  if (passHint) passHint.value = tab.passwordHint || "";
  passInput?.dispatchEvent(new Event("input"));

  if (tab.isEncrypted) {
    btnDisable?.classList.remove("hidden");
    if (btnSaveSet) btnSaveSet.innerText = "更新保险箱密码";
  } else {
    btnDisable?.classList.add("hidden");
    if (btnSaveSet) btnSaveSet.innerText = "启用保险箱保护";
  }
  modalSet.classList.remove("hidden");
  passInput?.focus();
}

export function closeVaultSetModal() {
  document.getElementById("apple-vault-set-modal")?.classList.add("hidden");
}

async function handleSaveVaultSettings() {
  const tab = getActiveTab();
  if (tab?._isLocked) {
    showToast("⚠️ 导图当前处于锁定状态，禁止修改密码配置");
    return;
  }
  const modal = document.getElementById("apple-vault-set-modal");
  const p1 = modal.querySelector("#vault-set-pass")?.value.trim();
  const p2 = modal.querySelector("#vault-set-pass-confirm")?.value.trim();
  const hint = modal.querySelector("#vault-set-hint")?.value.trim() || "";
  const btnSaveSet = modal.querySelector("#btn-vault-set-save");

  if (!p1) { showToast("⚠️ 密码不能为空"); return; }
  if (p1 !== p2) { showToast("⚠️ 两次输入的密码不一致"); return; }

  if (btnSaveSet) {
    btnSaveSet.innerText = "⏳ 正在计算密钥...";
    btnSaveSet.disabled = true;
  }

  try {
    tab.isEncrypted = true;
    tab.password = p1;
    tab.passwordHint = hint;
    tab._isLocked = false;
    tab.versions = [];
    tab.encryptedVault = await encryptMindPayload(tab.mindData, p1, hint);
    tab.isDirty = true;

    saveSnapshot();
    closeVaultSetModal();
    updateSecurityDockStatus();
    if (renderAppRef) renderAppRef();
    showToast("🛡️ 已启用 Argon2id + AES-256 密码保险箱！");
  } finally {
    if (btnSaveSet) {
      btnSaveSet.innerText = "启用保险箱保护";
      btnSaveSet.disabled = false;
    }
  }
}

function handleDisableVault() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.isEncrypted = false;
  tab.password = null;
  tab.passwordHint = "";
  tab.encryptedVault = null;
  tab._isLocked = false;
  tab.isDirty = true;

  saveSnapshot();
  closeVaultSetModal();
  updateSecurityDockStatus();
  if (renderAppRef) renderAppRef();
  showToast("🔓 已解除加密保护，导图恢复为标准明文存储");
}

export async function lockCurrentTab() {
  const tab = getActiveTab();
  if (!tab || !tab.isEncrypted) {
    openVaultSetModal();
    return;
  }

  if (tab.mindData && tab.password && !tab._isLocked) {
    tab.encryptedVault = await encryptMindPayload(tab.mindData, tab.password, tab.passwordHint || "");
  }

  tab.mindData = { id: "root", text: "🔒 导图已锁定", children: [] };
  tab.password = null;
  tab.history = [{ id: "root", text: "🔒 导图已锁定", children: [] }];
  tab.historyIndex = 0;
  // 🛡️ 物理粉碎撤销/重做命令栈，杜绝锁屏后按 ⌘Z 穿透恢复明文
  tab.historyStack = [];
  tab._isLocked = true;
  state.clipboardBranch = null;

  // 🛡️ 物理清理关联组件残存内存
  try {
    const { closeNotesDrawer } = await import("./notes.js");
    closeNotesDrawer();
    const txtArea = document.getElementById("notes-textarea");
    if (txtArea) txtArea.value = "";
    const preview = document.getElementById("notes-preview-content");
    if (preview) preview.innerHTML = "";
  } catch {}

  try {
    const { closeSearch } = await import("./search.js");
    closeSearch();
  } catch {}

  // 物理擦除 Canvas 帧缓冲残影
  const canvas = document.getElementById("canvas-main");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  const minimap = document.getElementById("minimap-canvas");
  if (minimap) {
    const mctx = minimap.getContext("2d");
    if (mctx) mctx.clearRect(0, 0, minimap.width, minimap.height);
  }

  showLockScreen(tab);
  updateSecurityDockStatus();
  showToast("🔒 画布、剪贴板与显存残影已安全锁定");
}

export function showLockScreen(tab) {
  const lockScreen = document.getElementById("canvas-vault-lock-screen");
  const posterTitle = document.getElementById("vault-poster-title");
  const posterHintBox = document.getElementById("vault-poster-hint-box");
  const txtPosterHint = document.getElementById("txt-vault-poster-hint");
  const posterPass = document.getElementById("vault-poster-password");
  const errorMsg = document.getElementById("vault-error-message");
  if (!lockScreen || !tab) return;

  tab._isLocked = true;
  if (posterTitle) posterTitle.innerText = `「${tab.title || "思维导图"}」受密码保护`;

  const hintText = tab.passwordHint || tab.encryptedVault?.hint;
  if (hintText) {
    if (txtPosterHint) txtPosterHint.innerText = hintText;
    posterHintBox?.classList.remove("hidden");
  } else {
    posterHintBox?.classList.add("hidden");
  }

  errorMsg?.classList.add("hidden");
  if (posterPass) {
    posterPass.value = "";
    setTimeout(() => posterPass.focus(), 50);
  }
  lockScreen.classList.remove("hidden");
  updateSecurityDockStatus();
}

export function hideLockScreen() {
  document.getElementById("canvas-vault-lock-screen")?.classList.add("hidden");
}
export const hideLockScreenDOM = hideLockScreen;

export function initVaultManager(renderApp) {
  renderAppRef = renderApp;
  const modalSet = document.getElementById("apple-vault-set-modal");
  if (modalSet) {
    const passInput = modalSet.querySelector("#vault-set-pass");
    const meterFill = modalSet.querySelector("#vault-pass-meter-fill");
    const strengthText = modalSet.querySelector("#vault-pass-strength-text");

    passInput?.addEventListener("input", () => {
      const res = evaluatePasswordStrength(passInput.value);
      if (meterFill) { meterFill.style.width = res.width; meterFill.style.backgroundColor = res.color; }
      if (strengthText) { strengthText.innerText = res.label; strengthText.style.color = res.color; }
    });

    modalSet.querySelector("#btn-close-vault-set")?.addEventListener("click", closeVaultSetModal);
    modalSet.querySelector("#btn-vault-set-cancel")?.addEventListener("click", closeVaultSetModal);
    modalSet.querySelector("#btn-vault-set-save")?.addEventListener("click", handleSaveVaultSettings);
    modalSet.querySelector("#btn-vault-disable")?.addEventListener("click", handleDisableVault);
  }
  const btnSecurity = document.getElementById("btn-toggle-security");
  const posterBox = document.getElementById("vault-poster-box");
  const posterPass = document.getElementById("vault-poster-password");
  const btnPosterUnlock = document.getElementById("btn-vault-poster-unlock");
  const btnPosterClose = document.getElementById("btn-vault-poster-close");
  const btnPosterBack = document.getElementById("btn-vault-poster-back");
  const errorMsg = document.getElementById("vault-error-message");

  function handleReturnToHome() {
    hideLockScreen();
    bus.emit(EVENTS.SHOW_HOME);
  }

  function handleCloseLockedDoc() {
    const curTab = getActiveTab();
    if (!curTab) return;
    hideLockScreen();
    const remaining = closeTab(curTab.id);
    if (remaining === 0) {
      bus.emit(EVENTS.SHOW_HOME);
    } else {
      const next = getActiveTab();
      if (next) {
        camera.transform = { ...next.camera };
        applyCanvasThemeToBody(next.canvasBgColor || "studio-white", next.canvasBgPattern || "dots");
        if (next.isEncrypted && next._isLocked) showLockScreen(next);
        else hideLockScreen();
      }
      renderTabBar();
      bus.emit(EVENTS.RENDER_APP);
      syncInspectorUi();
      updateSecurityDockStatus();
    }
  }

  btnPosterClose?.addEventListener("click", handleCloseLockedDoc);
  btnPosterBack?.addEventListener("click", handleReturnToHome);

  btnSecurity?.addEventListener("click", () => {
    const tab = getActiveTab();
    if (!tab) return;
    if (tab.isEncrypted && !tab._isLocked) {
      lockCurrentTab();
      return;
    }
    if (tab.isEncrypted && tab._isLocked) {
      showLockScreen(tab);
      return;
    }
    openVaultSetModal();
  });

  async function handleUnlockAttempt() {
    const tab = getActiveTab();
    if (!tab || !posterPass) return;
    const inputPass = posterPass.value.trim();
    if (!inputPass) return;

    try {
      if (!tab.encryptedVault) throw new Error("NO_VAULT");

      btnPosterUnlock.innerText = "⏳";
      btnPosterUnlock.disabled = true;

      const decryptedData = await decryptMindPayload(tab.encryptedVault, inputPass);
      tab.mindData = decryptedData;
      tab.password = inputPass;
      tab.passwordHint = tab.encryptedVault.hint || "";
      tab._isLocked = false;
      tab.selectedIds = new Set([tab.mindData.id || "root"]);
      tab.focusedRootId = tab.mindData.id || "root";
      tab.history = [JSON.parse(JSON.stringify(tab.mindData))];
      tab.historyIndex = 0;

      btnPosterUnlock.innerText = "➔";
      btnPosterUnlock.disabled = false;
      hideLockScreen();
      showToast("🔓 验签成功，已解密展开导图！");
      if (renderAppRef) renderAppRef();
    } catch (err) {
      btnPosterUnlock.innerText = "➔";
      btnPosterUnlock.disabled = false;
      posterBox?.classList.remove("vault-shake-anim");
      void posterBox?.offsetWidth;
      posterBox?.classList.add("vault-shake-anim");
      errorMsg?.classList.remove("hidden");
      posterPass.select();
    }
  }

  btnPosterUnlock?.addEventListener("click", handleUnlockAttempt);
  posterPass?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleUnlockAttempt();
    else if (e.key === "Escape") handleReturnToHome();
    else errorMsg?.classList.add("hidden");
  });

  updateSecurityDockStatus();
}
