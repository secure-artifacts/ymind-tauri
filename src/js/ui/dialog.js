function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
export function sanitizeFilename(n) {
  return (n || "").replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim() || "思维导图";
}
export function showToast(m) {
  let t = document.getElementById("apple-toast") || Object.assign(document.createElement("div"), { id: "apple-toast", className: "apple-toast" });
  document.body.appendChild(t);
  t.innerText = m;
  t.classList.remove("hidden", "fade-out");
  t.classList.add("show");
  clearTimeout(window.__TOAST_TIMER__);
  window.__TOAST_TIMER__ = setTimeout(() => {
    t.classList.add("fade-out");
    setTimeout(() => t.classList.add("hidden"), 300);
  }, 1800);
}

let activeDialogCleanup = null;
function mountDialog(renderHtml, onAttach) {
  return new Promise(resolve => {
    if (activeDialogCleanup) activeDialogCleanup();
    const overlay = document.getElementById("apple-system-dialog-overlay");
    if (!overlay) return resolve(null);

    overlay.innerHTML = renderHtml;
    overlay.classList.remove("hidden");

    let finished = false;
    const cleanup = (result) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("keydown", handleKeyDown, true);
      overlay.classList.add("hidden");
      overlay.innerHTML = "";
      activeDialogCleanup = null;
      resolve(result);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const input = overlay.querySelector("#dialog-input");
        cleanup(input ? input.value : true);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cleanup(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    activeDialogCleanup = () => cleanup(null);
    onAttach(overlay, cleanup);
  });
}

export function appAlert({ title = "系统提示", message = "", type = "info", confirmText = "确定" } = {}) {
  return mountDialog(`
    <div class="apple-modal-card dialog-modal-card">
      <div class="apple-modal-header"><div class="modal-header-icon ${type}">ℹ️</div><div class="modal-title-wrap"><h3 class="apple-modal-title">${escapeHtml(title)}</h3></div></div>
      <div class="apple-modal-body"><p class="dialog-message">${escapeHtml(message)}</p></div>
      <div class="apple-modal-footer"><button id="dialog-btn-confirm" class="modal-btn modal-btn-primary">${escapeHtml(confirmText)}</button></div>
    </div>
  `, (overlay, cleanup) => {
    const btn = overlay.querySelector("#dialog-btn-confirm");
    btn?.focus();
    btn?.addEventListener("click", () => cleanup(true));
  });
}

export function appConfirm({ title = "请确认", message = "", confirmText = "确认", cancelText = "取消", isDanger = false } = {}) {
  return mountDialog(`
    <div class="apple-modal-card dialog-modal-card">
      <div class="apple-modal-header"><div class="modal-header-icon ${isDanger ? "danger" : "warning"}">${isDanger ? "🗑️" : "⚠️"}</div><div class="modal-title-wrap"><h3 class="apple-modal-title">${escapeHtml(title)}</h3></div></div>
      <div class="apple-modal-body"><p class="dialog-message">${escapeHtml(message)}</p></div>
      <div class="apple-modal-footer">
        <button id="dialog-btn-cancel" class="modal-btn modal-btn-secondary">${escapeHtml(cancelText)}</button>
        <button id="dialog-btn-confirm" class="modal-btn ${isDanger ? "modal-btn-danger" : "modal-btn-primary"}">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `, (overlay, cleanup) => {
    overlay.querySelector("#dialog-btn-confirm")?.focus();
    overlay.querySelector("#dialog-btn-confirm")?.addEventListener("click", () => cleanup(true));
    overlay.querySelector("#dialog-btn-cancel")?.addEventListener("click", () => cleanup(false));
  });
}

export function appPrompt({ title = "请输入", message = "", placeholder = "", defaultValue = "", inputType = "text", confirmText = "确定", cancelText = "取消" } = {}) {
  return mountDialog(`
    <div class="apple-modal-card dialog-modal-card">
      <div class="apple-modal-header"><div class="modal-header-icon primary">🔒</div><div class="modal-title-wrap"><h3 class="apple-modal-title">${escapeHtml(title)}</h3></div></div>
      <div class="apple-modal-body">${message ? `<p class="dialog-message">${escapeHtml(message)}</p>` : ""}<div class="dialog-input-wrapper"><input id="dialog-input" class="apple-modal-input" type="${inputType}" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}" autocomplete="off" /></div></div>
      <div class="apple-modal-footer">
        <button id="dialog-btn-cancel" class="modal-btn modal-btn-secondary">${escapeHtml(cancelText)}</button>
        <button id="dialog-btn-confirm" class="modal-btn modal-btn-primary">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `, (overlay, cleanup) => {
    const input = overlay.querySelector("#dialog-input");
    input?.focus();
    input?.select();
    overlay.querySelector("#dialog-btn-confirm")?.addEventListener("click", () => cleanup(input.value));
    overlay.querySelector("#dialog-btn-cancel")?.addEventListener("click", () => cleanup(null));
  });
}
