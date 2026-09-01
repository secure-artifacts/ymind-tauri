import { state, getActiveTab, saveSnapshot } from "../core/state.js";
import { encryptMindPayload, decryptMindPayload, evaluatePasswordStrength } from "../storage/crypto.js";
import { showToast } from "./dialog.js";
import { syncInspectorUi } from "./inspector.js";

let renderAppRef = null;

export function updateSecurityDockStatus() {
  const tab = getActiveTab();
  const btnSecurity = document.getElementById("btn-toggle-security");
  const txtStatus = document.getElementById("txt-security-status");
  if (!tab || !btnSecurity) return;
  if (tab.isEncrypted) {
    btnSecurity.classList.add("primary-action");
    if (txtStatus) txtStatus.innerText = "已保护";
    btnSecurity.title = "已受 AES-256 双层信封加密保护 (点击管理/加锁)";
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
  if (tab.passwordHint) {
    if (txtPosterHint) txtPosterHint.innerText = tab.passwordHint;
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
}

export function hideLockScreen() {
  document.getElementById("canvas-vault-lock-screen")?.classList.add("hidden");
  const tab = getActiveTab();
  if (tab) tab._isLocked = false;
}

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
  const errorMsg = document.getElementById("vault-error-message");
  btnSecurity?.addEventListener("click", () => {
    const tab = getActiveTab();
    if (!tab) return;
    if (tab.isEncrypted && tab._isLocked) { showLockScreen(tab); return; }
    openVaultSetModal();
  });
  passInput?.addEventListener("input", () => {
    const res = evaluatePasswordStrength(passInput.value);
    if (meterFill) { meterFill.style.width = res.width; meterFill.style.backgroundColor = res.color; }
    if (strengthText) { strengthText.innerText = res.label; strengthText.style.color = res.color; }
  });
  btnCloseSet?.addEventListener("click", closeVaultSetModal);
  btnCancelSet?.addEventListener("click", closeVaultSetModal);
  btnSaveSet?.addEventListener("click", () => {
    const tab = getActiveTab();
    const p1 = passInput ? passInput.value.trim() : "";
    const p2 = passConfirm ? passConfirm.value.trim() : "";
    const hint = passHint ? passHint.value.trim() : "";
    if (!p1) { showToast("⚠️ 密码不能为空"); passInput?.focus(); return; }
    if (p1 !== p2) { showToast("⚠️ 两次输入的密码不一致"); passConfirm?.focus(); return; }
    tab.isEncrypted = true;
    tab.password = p1;
    tab.passwordHint = hint;
    tab.isDirty = true;
    saveSnapshot();
    closeVaultSetModal();
    updateSecurityDockStatus();
    if (renderAppRef) renderAppRef();
    showToast("🛡️ 已成功启用 AES-256-GCM 双层信封保险箱保护！");
  });
  btnDisable?.addEventListener("click", () => {
    const tab = getActiveTab();
    if (!tab) return;
    tab.isEncrypted = false;
    tab.password = null;
    tab.passwordHint = "";
    tab.isDirty = true;
    saveSnapshot();
    closeVaultSetModal();
    updateSecurityDockStatus();
    if (renderAppRef) renderAppRef();
    showToast("🔓 已解除加密保护，导图恢复为标准明文存储");
  });
  async function handleUnlockAttempt() {
    const tab = getActiveTab();
    if (!tab || !posterPass) return;
    if (posterPass.value === tab.password) {
      hideLockScreen();
      showToast("🔓 保险箱验证成功，已解密展开导图！");
      if (renderAppRef) renderAppRef();
    } else {
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
    else errorMsg?.classList.add("hidden");
  });
  window.__SYNC_VAULT_UI__ = updateSecurityDockStatus;
  updateSecurityDockStatus();
}
