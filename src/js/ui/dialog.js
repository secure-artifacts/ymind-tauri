export function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

export function sanitizeFilename(n) {
  return (n || "").replace(/[\\/:*?"<>|\r\n\t]/g, "_").trim() || "思维导图";
}

let activeToastTimer = null;
let activeToastElement = null;

/**
 * 🍏 灵动岛风格超高定 Apple 悬浮胶囊微弹窗
 * - 支持自动分离首字符 Emoji / 图标
 * - 连击平滑呼吸形变过渡，永不生硬跳帧
 */
export function showToast(message, duration = 2200) {
  if (!activeToastElement) {
    activeToastElement = document.getElementById("apple-toast");
    if (!activeToastElement) {
      activeToastElement = document.createElement("div");
      activeToastElement.id = "apple-toast";
      activeToastElement.className = "apple-toast hidden";
      document.body.appendChild(activeToastElement);
    }
  }

  const rawMsg = String(message || "").trim();
  // 匹配前置 Emoji 或特色符号 (如 🎯, 🌳, 💾, 🔒, 🚩, 🗑️ 等)
  const emojiMatch = rawMsg.match(/^(\p{Extended_Pictographic}|\uFE0F|[★☆⚡⚠️✅❌ℹ️])+[\s·]*/u);
  
  let iconHtml = "";
  let textHtml = "";

  if (emojiMatch) {
    const iconStr = emojiMatch[0].trim();
    const restText = rawMsg.slice(emojiMatch[0].length).trim();
    iconHtml = `<span class="apple-toast-icon">${iconStr}</span>`;
    textHtml = `<span class="apple-toast-text">${escapeHtml(restText)}</span>`;
  } else {
    textHtml = `<span class="apple-toast-text">${escapeHtml(rawMsg)}</span>`;
  }

  clearTimeout(activeToastTimer);

  activeToastElement.innerHTML = `${iconHtml}${textHtml}`;
  activeToastElement.classList.remove("hidden", "fade-out");

  // 强制回流以重新触发完整的 Apple 动力学弹簧曲线
  void activeToastElement.offsetWidth;
  activeToastElement.classList.add("show");

  activeToastTimer = setTimeout(() => {
    activeToastElement.classList.remove("show");
    activeToastElement.classList.add("fade-out");
    setTimeout(() => {
      activeToastElement.classList.add("hidden");
      activeToastElement.classList.remove("fade-out");
    }, 280);
  }, duration);
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

let activeBannerTimer = null;
export function showAppleBanner({ icon = "ℹ️", title = "", message = "", type = "info", duration = 3200 } = {}) {
  let el = document.getElementById("apple-banner-drop");
  if (!el) {
    el = document.createElement("div");
    el.id = "apple-banner-drop";
    el.className = "apple-banner-drop";
    document.body.appendChild(el);
  }

  clearTimeout(activeBannerTimer);

  el.innerHTML = `
    <div class="apple-banner-icon-wrap ${type}">${icon}</div>
    <div class="apple-banner-content">
      <div class="apple-banner-title">${escapeHtml(title)}</div>
      <div class="apple-banner-message" title="${escapeHtml(message)}">${escapeHtml(message)}</div>
    </div>
  `;

  el.classList.remove("leave");
  void el.offsetWidth;
  el.classList.add("show");

  activeBannerTimer = setTimeout(() => {
    el.classList.remove("show");
    el.classList.add("leave");
  }, duration);
}
