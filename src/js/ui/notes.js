import { state, findNode, saveSnapshot, getPrimarySelectedNode } from "../core/state.js";
import { showToast } from "./dialog.js";

let activeNoteNodeId = null;
let noteSaveTimer = null;

export function initNotesDrawer(renderApp) {
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
      renderApp();
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
      renderApp();
    }
    switchTab("edit");
    showToast("🗑️ 备注已清除");
  });

  // 工具栏 Markdown 快捷插入
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

function renderMarkdown(md) {
  if (!md || !md.trim()) return `<div class="empty-note-hint">暂无备注内容，点击上方「编辑」开始书写...</div>`;
  let html = md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n### (.*?)(?=\n|$)/g, "<h3>$1</h3>")
    .replace(/\n## (.*?)(?=\n|$)/g, "<h2>$1</h2>")
    .replace(/\n# (.*?)(?=\n|$)/g, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\`\`\`([\s\S]*?)\`\`\`/g, "<pre><code>$1</code></pre>")
    .replace(/\`(.*?)\`/g, "<code>$1</code>")
    .replace(/- \[ \] (.*?)(?=\n|$)/g, "<div class=\"note-check\"><input type=\"checkbox\" disabled> $1</div>")
    .replace(/- \[x\] (.*?)(?=\n|$)/g, "<div class=\"note-check\"><input type=\"checkbox\" checked disabled> <del>$1</del></div>")
    .replace(/^- (.*?)(?=\n|$)/gm, "<li>$1</li>")
    .replace(/^> (.*?)(?=\n|$)/gm, "<blockquote>$1</blockquote>")
    .replace(/\n/g, "<br/>");
  return html;
}