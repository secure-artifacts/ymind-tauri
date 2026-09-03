import { state, findNode, saveSnapshot, getPrimarySelectedNode } from "../core/state.js";
import { showToast } from "./dialog.js";
import { bus, EVENTS } from "../core/event-bus.js";

let activeNoteNodeId = null;
let noteSaveTimer = null;

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m]));
}

function sanitizeUrl(url) {
  const clean = String(url || "").trim();
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(clean)) return clean;
  return "#";
}

function renderInlineTokens(rawText) {
  let s = escapeHtml(rawText);
  // 行内行代码 `code`
  s = s.replace(/`([^`\r\n]+)`/g, (_, code) => `<code>${code}</code>`);
  // **粗体**
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  // *斜体*
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  // [安全链接](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    return `<a href="${sanitizeUrl(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });
  return s;
}

// 🌟 O(N) 线性扫描词法状态机：彻底根除 ReDoS 正则灾难性回溯隐患
export function renderMarkdown(md) {
  if (!md || !md.trim()) return `<div class="empty-note-hint">暂无备注内容，点击上方「编辑」开始书写...</div>`;

  const lines = md.split(/\r?\n/);
  const out = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeLines = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 代码块围栏判定 ```
    const fence = line.match(/^```([a-zA-Z0-9_-]*)/);
    if (fence) {
      if (!inCodeBlock) {
        if (inList) { out.push("</ul>"); inList = false; }
        inCodeBlock = true;
        codeLang = fence[1] || "";
        codeLines = [];
      } else {
        inCodeBlock = false;
        const safeLang = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
        out.push(`<pre><code${safeLang}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // 标题语法
    if (/^###\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${renderInlineTokens(line.replace(/^###\s+/, ""))}</h3>`);
      continue;
    }
    if (/^##\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h2>${renderInlineTokens(line.replace(/^##\s+/, ""))}</h2>`);
      continue;
    }
    if (/^#\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h1>${renderInlineTokens(line.replace(/^#\s+/, ""))}</h1>`);
      continue;
    }

    // 引用语法
    if (/^>\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<blockquote>${renderInlineTokens(line.replace(/^>\s+/, ""))}</blockquote>`);
      continue;
    }

    // 任务列表待办复选框
    if (/^-\s+\[ \]\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<div class="note-check"><input type="checkbox" disabled> ${renderInlineTokens(line.replace(/^-\s+\[ \]\s+/, ""))}</div>`);
      continue;
    }
    if (/^-\s+\[[xX]\]\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<div class="note-check"><input type="checkbox" checked disabled> <del>${renderInlineTokens(line.replace(/^-\s+\[[xX]\]\s+/, ""))}</del></div>`);
      continue;
    }

    // 无序列表项
    if (/^-\s+(.*)/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${renderInlineTokens(line.replace(/^-\s+/, ""))}</li>`);
      continue;
    }

    if (inList) { out.push("</ul>"); inList = false; }

    if (line.trim() === "") {
      out.push("<br/>");
    } else {
      out.push(`<p>${renderInlineTokens(line)}</p>`);
    }
  }

  if (inList) out.push("</ul>");
  if (inCodeBlock) {
    out.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  return out.join("");
}

export function initNotesDrawer() {
  const drawer = document.getElementById("notes-drawer");
  const closeBtn = document.getElementById("btn-close-notes");
  const textarea = document.getElementById("notes-textarea");
  const preview = document.getElementById("notes-preview-content");
  const tabEdit = document.getElementById("tab-notes-edit");
  const tabPrev = document.getElementById("tab-notes-preview");
  const btnClear = document.getElementById("btn-clear-notes");

  if (!drawer) return;

  function switchTab(mode) {
    if (mode === "edit") {
      tabEdit?.classList.add("active");
      tabPrev?.classList.remove("active");
      textarea?.classList.remove("hidden");
      preview?.classList.add("hidden");
      textarea?.focus();
    } else {
      tabPrev?.classList.add("active");
      tabEdit?.classList.remove("active");
      textarea?.classList.add("hidden");
      preview?.classList.remove("hidden");
      if (preview && textarea) preview.innerHTML = renderMarkdown(textarea.value);
    }
  }

  tabEdit?.addEventListener("click", () => switchTab("edit"));
  tabPrev?.addEventListener("click", () => switchTab("preview"));
  closeBtn?.addEventListener("click", closeNotesDrawer);

  textarea?.addEventListener("input", () => {
    if (!activeNoteNodeId) return;
    const node = findNode(activeNoteNodeId, state.mindData);
    if (node) {
      node.note = textarea.value;
      bus.emit(EVENTS.RENDER_APP);
      clearTimeout(noteSaveTimer);
      noteSaveTimer = setTimeout(() => saveSnapshot(), 600);
    }
  });

  btnClear?.addEventListener("click", () => {
    if (!activeNoteNodeId || !textarea) return;
    textarea.value = "";
    const node = findNode(activeNoteNodeId, state.mindData);
    if (node) {
      delete node.note;
      saveSnapshot();
      bus.emit(EVENTS.RENDER_APP);
    }
    switchTab("edit");
    showToast("🗑️ 备注已清除");
  });

  document.querySelectorAll(".note-tool-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!textarea) return;
      const tag = btn.dataset.tag;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const sel = text.substring(start, end) || "文本";
      let rep = "";
      if (tag === "b") rep = `**${sel}**`;
      else if (tag === "i") rep = `*${sel}*`;
      else if (tag === "h") rep = `\n### ${sel}\n`;
      else if (tag === "code") rep = `\n\`\`\`\n${sel}\n\`\`\`\n`;
      else if (tag === "list") rep = `\n- ${sel}`;
      else if (tag === "check") rep = `\n- [ ] ${sel}`;
      else if (tag === "quote") rep = `\n> ${sel}`;
      textarea.value = text.substring(0, start) + rep + text.substring(end);
      textarea.focus();
      textarea.dispatchEvent(new Event("input"));
    });
  });
}

export function openNotesDrawer(node) {
  const targetNode = node || getPrimarySelectedNode();
  if (!targetNode) return;
  activeNoteNodeId = targetNode.id;
  const drawer = document.getElementById("notes-drawer");
  const title = document.getElementById("notes-drawer-title");
  const textarea = document.getElementById("notes-textarea");
  if (!drawer || !textarea) return;

  if (title) title.innerText = (targetNode.icon ? targetNode.icon + " " : "") + (targetNode.text || "节点备注");
  textarea.value = targetNode.note || "";
  drawer.classList.remove("hidden");
  document.getElementById("tab-notes-edit")?.click();
}

export function closeNotesDrawer() {
  document.getElementById("notes-drawer")?.classList.add("hidden");
  activeNoteNodeId = null;
}
