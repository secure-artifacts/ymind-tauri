import { state, findNode, saveSnapshot, getPrimarySelectedNode } from "../core/state.js";
import { showToast, escapeHtml } from "./dialog.js";
import { bus, EVENTS } from "../core/event-bus.js";

let activeNoteNodeId = null;
let noteSaveTimer = null;
let taskCounter = 0;

function sanitizeUrl(url) {
  const clean = String(url || "").trim();
  if (/^(https?:\/\/|mailto:|#|\/)/i.test(clean)) return clean;
  return "#";
}

function renderInlineTokens(rawText) {
  let s = escapeHtml(rawText);
  // 行内代码
  s = s.replace(/`([^`\r\n]+)`/g, (_, code) => `<code class="note-inline-code">${code}</code>`);
  // 高亮标记 ==text==
  s = s.replace(/==([^=\r\n]+)==/g, '<mark class="note-highlight">$1</mark>');
  // 删除线 ~~text~~
  s = s.replace(/~~([^~\r\n]+)~~/g, '<del class="note-del">$1</del>');
  // 加粗
  s = s.replace(/\*\*([^*\r\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_\r\n]+)__/g, "<strong>$1</strong>");
  // 斜体
  s = s.replace(/\*([^*\r\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_\r\n]+)_/g, "<em>$1</em>");
  // 下标与上标
  s = s.replace(/~([^~\r\n]+)~/g, "<sub>$1</sub>");
  s = s.replace(/\^([^\^\r\n]+)\^/g, "<sup>$1</sup>");
  // 图片 ![alt](url)
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, href) => {
    return `<img src="${sanitizeUrl(href)}" alt="${alt}" class="note-inline-img" loading="lazy" />`;
  });
  // 链接 [label](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    return `<a href="${sanitizeUrl(href)}" target="_blank" rel="noopener noreferrer" class="note-link">${label} ↗</a>`;
  });
  return s;
}

function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

function isTableDelimiter(line) {
  return /^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(line);
}

function parseTableAlignments(delimLine) {
  const cells = delimLine.trim().replace(/^\||\|$/g, "").split("|");
  return cells.map(c => {
    const s = c.trim();
    if (s.startsWith(":") && s.endsWith(":")) return "center";
    if (s.endsWith(":")) return "right";
    return "left";
  });
}

export function renderMarkdown(md) {
  taskCounter = 0;
  if (!md || !md.trim()) {
    return `
      <div class="notes-empty-preview">
        <div class="empty-icon" style="font-size:36px;margin-bottom:8px;">📝</div>
        <div class="empty-text" style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">当前节点暂无备注</div>
        <div class="empty-sub" style="font-size:12px;color:var(--text-tertiary);line-height:1.5;max-width:260px;">
          支持 GFM 表格、代码高亮、Callout 卡片、重点标记及待办复选框
        </div>
        <button id="btn-start-write-note" class="btn-start-note">✍️ 立即添加备注</button>
      </div>
    `;
  }

  const lines = md.split(/\r?\n/);
  const out = [];
  let inCodeBlock = false;
  let codeLang = "";
  let codeLines = [];
  let inList = false;
  let inNumList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. 代码块
    const fence = line.match(/^```([a-zA-Z0-9_-]*)/);
    if (fence) {
      if (!inCodeBlock) {
        if (inList) { out.push("</ul>"); inList = false; }
        if (inNumList) { out.push("</ol>"); inNumList = false; }
        inCodeBlock = true;
        codeLang = fence[1] || "plaintext";
        codeLines = [];
      } else {
        inCodeBlock = false;
        const codeText = codeLines.join("\n");
        const safeLang = codeLang.toUpperCase();
        out.push(`
          <div class="code-block-wrapper">
            <div class="code-block-header">
              <span class="code-lang-tag">${escapeHtml(safeLang)}</span>
              <button class="btn-copy-code" data-code="${escapeHtml(codeText)}" title="复制全部代码">📋 复制</button>
            </div>
            <pre><code class="language-${escapeHtml(codeLang)}">${escapeHtml(codeText)}</code></pre>
          </div>
        `);
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // 2. GFM 表格解析
    if (isTableRow(line) && i + 1 < lines.length && isTableDelimiter(lines[i + 1])) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }

      const headers = line.trim().replace(/^\||\|$/g, "").split("|").map(s => s.trim());
      const aligns = parseTableAlignments(lines[i + 1]);
      i += 1;

      const rows = [];
      while (i + 1 < lines.length && isTableRow(lines[i + 1])) {
        i++;
        const rowCells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(s => s.trim());
        rows.push(rowCells);
      }

      let tblHtml = '<div class="notes-table-container"><table class="notes-table"><thead><tr>';
      headers.forEach((h, hIdx) => {
        const al = aligns[hIdx] || "left";
        tblHtml += `<th style="text-align:${al};">${renderInlineTokens(h)}</th>`;
      });
      tblHtml += '</tr></thead><tbody>';
      rows.forEach(r => {
        tblHtml += '<tr>';
        headers.forEach((_, cIdx) => {
          const val = r[cIdx] !== undefined ? r[cIdx] : "";
          const al = aligns[cIdx] || "left";
          tblHtml += `<td style="text-align:${al};">${renderInlineTokens(val)}</td>`;
        });
        tblHtml += '</tr>';
      });
      tblHtml += '</tbody></table></div>';
      out.push(tblHtml);
      continue;
    }

    // 3. Callout / 提示卡片
    const calloutMatch = line.match(/^>\s*\[!(NOTE|TIP|WARNING|DANGER|TODO|SUCCESS)\]\s*(.*)/i);
    if (calloutMatch) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }

      const type = calloutMatch[1].toLowerCase();
      const firstLine = calloutMatch[2];
      const calloutBody = [firstLine];

      while (i + 1 < lines.length && /^>\s*(.*)/.test(lines[i + 1])) {
        i++;
        calloutBody.push(lines[i].replace(/^>\s*/, ""));
      }

      const iconMap = {
        tip: "💡", note: "ℹ️", warning: "⚠️", danger: "🚨", todo: "📌", success: "✅"
      };
      const titleMap = {
        tip: "提示与技巧", note: "注意说明", warning: "重点警告", danger: "高危事项", todo: "待办跟进", success: "已达成"
      };

      const typeKey = iconMap[type] ? type : "note";
      out.push(`
        <div class="note-callout ${typeKey}">
          <div class="note-callout-header">
            <span>${iconMap[typeKey]}</span>
            <strong>${titleMap[typeKey]}</strong>
          </div>
          <div class="note-callout-body">${calloutBody.map(l => renderInlineTokens(l)).join("<br/>")}</div>
        </div>
      `);
      continue;
    }

    // 4. 水平分割线
    if (/^\s*([-*_]){3,}\s*$/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      out.push('<hr class="note-hr" />');
      continue;
    }

    // 5. 标题 (H1 - H6)
    if (/^######\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      out.push(`<h6>${renderInlineTokens(RegExp.$1)}</h6>`);
      continue;
    }
    if (/^#####\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      out.push(`<h5>${renderInlineTokens(RegExp.$1)}</h5>`);
      continue;
    }
    if (/^####\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      out.push(`<h4>${renderInlineTokens(RegExp.$1)}</h4>`);
      continue;
    }
    if (/^###\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      out.push(`<h3>${renderInlineTokens(RegExp.$1)}</h3>`);
      continue;
    }
    if (/^##\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      out.push(`<h2>${renderInlineTokens(RegExp.$1)}</h2>`);
      continue;
    }
    if (/^#\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      out.push(`<h1>${renderInlineTokens(RegExp.$1)}</h1>`);
      continue;
    }

    // 6. 普通引用块
    if (/^>\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      out.push(`<blockquote>${renderInlineTokens(RegExp.$1)}</blockquote>`);
      continue;
    }

    // 7. 任务复选框
    const taskMatch = line.match(/^-\s*\[([ xX])\]\s*(.*)/);
    if (taskMatch) {
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      if (!inList) { out.push('<ul class="note-task-list">'); inList = true; }
      const isChecked = taskMatch[1].toLowerCase() === "x";
      const taskBody = taskMatch[2];
      const curIdx = taskCounter++;
      out.push(`
        <li class="note-task-item">
          <input type="checkbox" class="note-task-checkbox" data-task-idx="${curIdx}" ${isChecked ? "checked" : ""} />
          <span class="note-task-text ${isChecked ? "task-done" : ""}">${renderInlineTokens(taskBody)}</span>
        </li>
      `);
      continue;
    }

    // 8. 有序列表
    if (/^\d+\.\s+(.*)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      if (!inNumList) { out.push("<ol>"); inNumList = true; }
      out.push(`<li>${renderInlineTokens(RegExp.$1)}</li>`);
      continue;
    }

    // 9. 无序列表
    if (/^[-*+]\s+(.*)/.test(line)) {
      if (inNumList) { out.push("</ol>"); inNumList = false; }
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${renderInlineTokens(RegExp.$1)}</li>`);
      continue;
    }

    if (inList) { out.push("</ul>"); inList = false; }
    if (inNumList) { out.push("</ol>"); inNumList = false; }

    if (line.trim() === "") {
      out.push('<div class="note-spacer"></div>');
    } else {
      out.push(`<p>${renderInlineTokens(line)}</p>`);
    }
  }

  if (inList) out.push("</ul>");
  if (inNumList) out.push("</ol>");
  if (inCodeBlock) {
    out.push(`<div class="code-block-wrapper"><pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`);
  }

  return out.join("");
}

function updateNotesStats(text) {
  const countEl = document.getElementById("notes-word-count");
  if (!countEl) return;
  const raw = String(text || "").trim();
  if (!raw) {
    countEl.innerText = "0 字 · 0 行";
    return;
  }
  const lines = raw.split(/\r?\n/).length;
  const chars = raw.length;
  countEl.innerText = `${chars} 字 · ${lines} 行 · 约 ${Math.max(1, Math.ceil(chars / 300))} 分钟阅读`;
}

export function flushPendingNote() {
  if (noteSaveTimer) {
    clearTimeout(noteSaveTimer);
    noteSaveTimer = null;
  }
  if (!activeNoteNodeId) return;
  const textarea = document.getElementById("notes-textarea");
  if (!textarea) return;

  const node = findNode(activeNoteNodeId, state.mindData);
  if (node && (node.note || "") !== textarea.value) {
    node.note = textarea.value;
    saveSnapshot();
  }
}

export function isNotesDrawerOpen() {
  const drawer = document.getElementById("notes-drawer");
  return Boolean(drawer && !drawer.classList.contains("hidden"));
}

function bindPreviewInteractions(previewContainer) {
  if (!previewContainer) return;

  // 空态引导切换至编辑
  previewContainer.querySelector("#btn-start-write-note")?.addEventListener("click", () => {
    document.getElementById("tab-notes-edit")?.click();
  });

  // 代码块一键复制
  previewContainer.querySelectorAll(".btn-copy-code").forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const code = btn.dataset.code || "";
      try {
        await navigator.clipboard.writeText(code);
        btn.innerText = "✅ 已复制";
        setTimeout(() => { btn.innerText = "📋 复制"; }, 1500);
      } catch {
        showToast("⚠️ 复制失败，请手动选取复制代码");
      }
    };
  });

  // 待办复选框交互直接回写
  previewContainer.querySelectorAll(".note-task-checkbox").forEach(chk => {
    chk.onchange = (e) => {
      e.stopPropagation();
      const targetIdx = parseInt(chk.dataset.taskIdx, 10);
      const isChecked = chk.checked;
      toggleTaskInMarkdown(targetIdx, isChecked);
    };
  });
}

function toggleTaskInMarkdown(taskIdx, newChecked) {
  if (!activeNoteNodeId) return;
  const textarea = document.getElementById("notes-textarea");
  if (!textarea) return;

  let text = textarea.value;
  let count = 0;
  text = text.replace(/^(\s*-\s*\[)([ xX])(\]\s*)/gm, (match, prefix, check, suffix) => {
    if (count === taskIdx) {
      count++;
      return `${prefix}${newChecked ? "x" : " "}${suffix}`;
    }
    count++;
    return match;
  });

  textarea.value = text;
  const node = findNode(activeNoteNodeId, state.mindData);
  if (node) {
    node.note = text;
    saveSnapshot();
    bus.emit(EVENTS.RENDER_APP);
  }

  const preview = document.getElementById("notes-preview-content");
  if (preview) {
    preview.innerHTML = renderMarkdown(text);
    bindPreviewInteractions(preview);
  }
  updateNotesStats(text);
}

export function syncNotesDrawerWithActiveNode() {
  if (!isNotesDrawerOpen()) return;

  const primaryNode = getPrimarySelectedNode();
  if (!primaryNode) {
    closeNotesDrawer();
    return;
  }

  if (primaryNode.id === activeNoteNodeId) {
    const title = document.getElementById("notes-drawer-title");
    if (title) title.innerText = (primaryNode.icon ? primaryNode.icon + " " : "") + (primaryNode.text || "节点备注");
    return;
  }

  flushPendingNote();
  activeNoteNodeId = primaryNode.id;

  const title = document.getElementById("notes-drawer-title");
  const textarea = document.getElementById("notes-textarea");
  const preview = document.getElementById("notes-preview-content");

  if (title) title.innerText = (primaryNode.icon ? primaryNode.icon + " " : "") + (primaryNode.text || "节点备注");
  if (textarea) textarea.value = primaryNode.note || "";

  if (preview) {
    preview.innerHTML = renderMarkdown(primaryNode.note || "");
    bindPreviewInteractions(preview);
  }
  updateNotesStats(primaryNode.note || "");
}

export function initNotesDrawer() {
  const drawer = document.getElementById("notes-drawer");
  const closeBtn = document.getElementById("btn-close-notes");
  const textarea = document.getElementById("notes-textarea");
  const preview = document.getElementById("notes-preview-content");
  const tabEdit = document.getElementById("tab-notes-edit");
  const tabPrev = document.getElementById("tab-notes-preview");
  const btnClear = document.getElementById("btn-clear-notes");
  const toolbar = document.getElementById("notes-toolbar");
  const viewHint = document.getElementById("notes-view-hint");

  if (!drawer) return;

  function switchTab(mode) {
    if (mode === "edit") {
      tabEdit?.classList.add("active");
      tabPrev?.classList.remove("active");
      textarea?.classList.remove("hidden");
      preview?.classList.add("hidden");
      toolbar?.classList.remove("hidden");
      if (viewHint) viewHint.innerText = "✍️ 正在编辑 (内容自动实时保存)";
      textarea?.focus();
    } else {
      flushPendingNote();
      tabPrev?.classList.add("active");
      tabEdit?.classList.remove("active");
      textarea?.classList.add("hidden");
      preview?.classList.remove("hidden");
      toolbar?.classList.add("hidden");
      if (viewHint) viewHint.innerText = "👁️ 预览模式 (可直接点击勾选待办)";
      if (preview && textarea) {
        preview.innerHTML = renderMarkdown(textarea.value);
        bindPreviewInteractions(preview);
      }
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
      noteSaveTimer = setTimeout(() => saveSnapshot(), 500);
      updateNotesStats(textarea.value);
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
    updateNotesStats("");
    switchTab("preview");
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
      else if (tag === "strike") rep = `~~${sel}~~`;
      else if (tag === "mark") rep = `==${sel}==`;
      else if (tag === "h") rep = `\n### ${sel}\n`;
      else if (tag === "code") rep = `\n\`\`\`javascript\n${sel}\n\`\`\`\n`;
      else if (tag === "table") {
        rep = `\n| 列名称 1 | 核心要点 2 | 进度说明 |\n| :--- | :---: | ---: |\n| 数据项 A | 关键详情 | 100% |\n| 数据项 B | 备忘重点 | 50% |\n`;
      }
      else if (tag === "list") rep = `\n- ${sel}`;
      else if (tag === "numlist") rep = `\n1. ${sel}`;
      else if (tag === "check") rep = `\n- [ ] ${sel}`;
      else if (tag === "callout") rep = `\n> [!TIP] 建议事项\n> ${sel}\n`;
      else if (tag === "quote") rep = `\n> ${sel}`;
      else if (tag === "hr") rep = `\n---\n`;

      textarea.value = text.substring(0, start) + rep + text.substring(end);
      textarea.focus();
      textarea.dispatchEvent(new Event("input"));
    });
  });
}

export function openNotesDrawer(node) {
  const targetNode = node || getPrimarySelectedNode();
  if (!targetNode) {
    showToast("💡 请先在画布或大纲中选中一个节点");
    return;
  }
  flushPendingNote();
  activeNoteNodeId = targetNode.id;

  const drawer = document.getElementById("notes-drawer");
  const title = document.getElementById("notes-drawer-title");
  const textarea = document.getElementById("notes-textarea");
  const preview = document.getElementById("notes-preview-content");
  if (!drawer || !textarea) return;

  if (title) title.innerText = (targetNode.icon ? targetNode.icon + " " : "") + (targetNode.text || "节点备注");
  textarea.value = targetNode.note || "";

  if (preview) {
    preview.innerHTML = renderMarkdown(targetNode.note || "");
    bindPreviewInteractions(preview);
  }
  updateNotesStats(targetNode.note || "");

  drawer.classList.remove("hidden");
  document.getElementById("tab-notes-preview")?.click();
}

export function closeNotesDrawer() {
  flushPendingNote();
  const drawer = document.getElementById("notes-drawer");
  if (drawer) drawer.classList.add("hidden");
  activeNoteNodeId = null;
}
