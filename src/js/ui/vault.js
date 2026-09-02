import { state, getActiveTab, closeTab, saveSnapshot } from "../core/state.js";
import { encryptMindPayload, decryptMindPayload, evaluatePasswordStrength } from "../storage/crypto.js";
import { showToast } from "./dialog.js";

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
  const passInput = document.getElementById("vault-set-pass");
  const passConfirm = document.getElementById("vault-set-pass-confirm");
  const passHint = document.getElementById("vault-set-hint");
  const btnDisable = document.getElementById("btn-vault-disable");
  const btnSaveSet = document.getElementById("btn-vault-set-save");
  if (!tab || !modalSet || !passInput) return;

  passInput.value = tab.password || "";
  if (passConfirm) passConfirm.value = tab.password || "";
  if (passHint) passHint.value = tab.passwordHint || "";
  passInput.dispatchEvent(new Event("input"));

  if (tab.isEncrypted) {
    btnDisable?.classList.remove("hidden");
    if (btnSaveSet) btnSaveSet.innerText = "更新保险箱密码";
  } else {
    btnDisable?.classList.add("hidden");
    if (btnSaveSet) btnSaveSet.innerText = "启用保险箱保护";
  }
  modalSet.classList.remove("hidden");
  passInput.focus();
}

export function closeVaultSetModal() {
  document.getElementById("apple-vault-set-modal")?.classList.add("hidden");
}

// 🛡️ 核心防线：锁定时彻底销毁内存树、剪贴板分支与搜索缓存
export async function lockCurrentTab() {
  const tab = getActiveTab();
  if (!tab || !tab.isEncrypted) {
    openVaultSetModal();
    return;
  }

  if (tab.mindData && tab.password) {
    tab.encryptedVault = await encryptMindPayload(tab.mindData, tab.password, tab.passwordHint || "");
  }

  tab.mindData = { id: "root", text: "🔒 导图已锁定", children: [] };
  tab.password = null;
  tab.history = [];
  tab.historyIndex = -1;
  tab._isLocked = true;

  // 抹除全局剪贴板与 DOM 画布
  state.clipboardBranch = null;
  const layerNodes = document.getElementById("layer-nodes");
  const layerConns = document.getElementById("layer-connections");
  if (layerNodes) layerNodes.innerHTML = "";
  if (layerConns) layerConns.innerHTML = "";

  showLockScreen(tab);
  updateSecurityDockStatus();
  showToast("🔒 画布与剪贴板已安全锁定");
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
  if (posterTitle) posterTitle.innerText = "「" + (tab.title || "思维导图") + "」受密码保护";
  
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
  const btnSecurity = document.getElementById("btn-toggle-security");
  const btnCloseSet = document.getElementById("btn-close-vault-set");
  const btnCancelSet = document.getElementById("btn-vault-set-cancel");
  const btnSaveSet = document.getElementById("btn-vault-set-save");
  const btnDisable = document.getElementById("btn-vault-disable");
  const passInput = document.getElementById("vault-set-pass");
  const passConfirm = document.getElementById("vault-set-pass-confirm");
  const passHint = document.getElementById("vault-set-hint");
  const meterFill = document.getElementById("vault-pass-meter-fill");
  const strengthText = document.getElementById("vault-pass-strength-text");
  const posterBox = document.getElementById("vault-poster-box");
  const posterPass = document.getElementById("vault-poster-password");
  const btnPosterUnlock = document.getElementById("btn-vault-poster-unlock");
  const btnPosterClose = document.getElementById("btn-vault-poster-close");
  const btnPosterBack = document.getElementById("btn-vault-poster-back");
  const errorMsg = document.getElementById("vault-error-message");

  function handleReturnToHome() {
    hideLockScreen();
    const curTab = getActiveTab();
    if (curTab && curTab.isEncrypted && curTab._isLocked && !curTab.password) {
      closeTab(curTab.id);
    }
    if (window.__SHOW_HOME__) {
      window.__SHOW_HOME__();
    } else {
      document.getElementById("btn-back-home")?.click();
    }
  }

  btnPosterClose?.addEventListener("click", handleReturnToHome);
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

  passInput?.addEventListener("input", () => {
    const res = evaluatePasswordStrength(passInput.value);
    if (meterFill) { meterFill.style.width = res.width; meterFill.style.backgroundColor = res.color; }
    if (strengthText) { strengthText.innerText = res.label; strengthText.style.color = res.color; }
  });

  btnCloseSet?.addEventListener("click", closeVaultSetModal);
  btnCancelSet?.addEventListener("click", closeVaultSetModal);

  btnSaveSet?.addEventListener("click", async () => {
    const tab = getActiveTab();
    const p1 = passInput ? passInput.value.trim() : "";
    const p2 = passConfirm ? passConfirm.value.trim() : "";
    const hint = passHint ? passHint.value.trim() : "";

    if (!p1) { showToast("⚠️ 密码不能为空"); passInput?.focus(); return; }
    if (p1 !== p2) { showToast("⚠️ 两次输入的密码不一致"); passConfirm?.focus(); return; }

    btnSaveSet.innerText = "⏳ 正在计算 64MB Argon2id...";
    btnSaveSet.disabled = true;

    try {
      tab.isEncrypted = true;
      tab.password = p1;
      tab.passwordHint = hint;
      tab._isLocked = false;
      tab.encryptedVault = await encryptMindPayload(tab.mindData, p1, hint);
      tab.isDirty = true;

      saveSnapshot();
      closeVaultSetModal();
      updateSecurityDockStatus();
      if (renderAppRef) renderAppRef();
      showToast("🛡️ 已启用第一梯队 Argon2id (64MB) + AES-256 保险箱！");
    } finally {
      btnSaveSet.innerText = "启用保险箱保护";
      btnSaveSet.disabled = false;
    }
  });

  btnDisable?.addEventListener("click", () => {
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
    showToast("🔓 已解除加密保护，导图已恢复为标准明文存储");
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
      tab.history = [JSON.stringify(tab.mindData)];
      tab.historyIndex = 0;

      btnPosterUnlock.innerText = "➔";
      btnPosterUnlock.disabled = false;
      hideLockScreen();
      showToast("🔓 Argon2id 验签成功，已展开导图！");
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

  window.__SYNC_VAULT_UI__ = updateSecurityDockStatus;
  updateSecurityDockStatus();
}
