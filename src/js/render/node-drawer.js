import { drawAppleSquircle } from "../geometry/squircle.js";
import { measureTextWidth, PRIORITY_COLORS, getActiveFontFamily } from "../geometry/layout.js";

export function drawNodeContent(ctx, node, level, isRootOfView, state) {
  const fontFam = getActiveFontFamily();
  let currentOffset = isRootOfView ? 24 : 18;
  const centerY = node.y + node.height / 2;

  // 1. 图标
  if (node.icon) {
    ctx.font = `14px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.icon, node.x + currentOffset + 7, centerY + 1.2);
    currentOffset += 22;
  }

  // 2. 优先级 P1 ~ P4
  if (node.priority && PRIORITY_COLORS[node.priority]) {
    const pColor = PRIORITY_COLORS[node.priority].bg;
    ctx.beginPath();
    drawAppleSquircle(ctx, node.x + currentOffset, centerY - 8, 22, 16, 4);
    ctx.fillStyle = pColor;
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold 9.5px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.priority, node.x + currentOffset + 11, centerY);
    currentOffset += 26;
  }

  // 3. 进度环
  if (node.progress) {
    const prgVal = parseInt(node.progress, 10) || 0;
    const angle = (prgVal / 100) * (Math.PI * 2);
    const prgX = node.x + currentOffset + 8;

    ctx.beginPath();
    ctx.arc(prgX, centerY, 5.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(0, 113, 227, 0.18)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    if (angle > 0) {
      ctx.beginPath();
      ctx.arc(prgX, centerY, 5.5, -Math.PI / 2, -Math.PI / 2 + angle);
      ctx.strokeStyle = prgVal === 100 ? "#34c759" : "#0071e3";
      ctx.lineWidth = 1.8;
      ctx.lineCap = "round";
      ctx.stroke();
    }
    currentOffset += 20;
  }

  // 4. 备注指示符
  if (node.note) {
    ctx.font = `12px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("📝", node.x + currentOffset + 7, centerY + 1);
    currentOffset += 22;
  }

  // 5. 核心文字（支持多行与主动回忆遮罩）
  const boxStyle = state.boxStyle || "squircle";
  const isDarkCanvas = ["space-gray", "midnight-abyss", "prussian-navy", "slate-chalkboard", "cyber-violet", "obsidian-coffee"].includes(state.canvasBgColor);
  const defaultFill = (isRootOfView || boxStyle === "solid" || isDarkCanvas) ? "#ffffff" : "#1d1d1f";
  const finalFill = node.textColor && node.textColor !== "default" ? node.textColor : defaultFill;
  const fontSize = node.fontSize ? parseFloat(node.fontSize) : (isRootOfView ? 15.5 : 13.5);
  const fontWeight = node.fontWeight || (isRootOfView ? "700" : (level === 1 ? "600" : "500"));

  ctx.fillStyle = finalFill;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFam}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = node.lines || String(node.text ?? "").split(/\r?\n/);
  const lineHeight = node.lineHeight || Math.round(fontSize * 1.35);
  const totalH = (lines.length - 1) * lineHeight;
  const textStartY = centerY - totalH / 2;

  const isRecall = Boolean(state.isRecallMode && !isRootOfView && !node._unmasked);
  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const lineText = lines[lIdx];
    const curLineY = textStartY + lIdx * lineHeight;
    if (isRecall) {
      ctx.save();
      ctx.filter = "blur(4.5px)";
      ctx.globalAlpha = 0.28;
      ctx.fillText(lineText, node.x + currentOffset + node.textWidth / 2, curLineY);
      ctx.restore();
    } else {
      ctx.fillText(lineText, node.x + currentOffset + node.textWidth / 2, curLineY);
    }
  }

  currentOffset += node.textWidth + 8;

  // 6. 节点标签
  if (node.tags && Array.isArray(node.tags) && node.tags.length > 0) {
    for (let tIdx = 0; tIdx < node.tags.length; tIdx++) {
      const tagText = String(node.tags[tIdx]);
      const tagW = measureTextWidth(tagText, 9.5, "600") + 12;
      ctx.beginPath();
      drawAppleSquircle(ctx, node.x + currentOffset, centerY - 7, tagW, 14, 4);
      ctx.fillStyle = boxStyle === "solid" ? "rgba(255,255,255,0.2)" : (isDarkCanvas ? "rgba(255,255,255,0.1)" : "#f1f5f9");
      ctx.fill();
      ctx.strokeStyle = boxStyle === "solid" ? "rgba(255,255,255,0.3)" : (isDarkCanvas ? "rgba(255,255,255,0.15)" : "#e2e8f0");
      ctx.lineWidth = 0.8;
      ctx.stroke();

      ctx.fillStyle = (boxStyle === "solid" || isDarkCanvas) ? "#ffffff" : "#475569";
      ctx.font = `600 9.5px ${fontFam}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tagText, node.x + currentOffset + tagW / 2, centerY);
      currentOffset += tagW + 4;
    }
  }

  // 7. 折叠徽章
  if (node.children && node.children.length > 0 && !isRootOfView) {
    const badgeX = (node.branchDirection === "left") ? node.x : (node.x + node.width);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.06)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1;

    ctx.beginPath();
    ctx.arc(badgeX, centerY, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = isDarkCanvas ? "#1e293b" : "#ffffff";
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = node.colorTheme ? node.colorTheme.badge : "#86868b";
    ctx.lineWidth = 1.1;
    ctx.stroke();

    ctx.fillStyle = node.colorTheme ? node.colorTheme.badge : "#86868b";
    ctx.font = `bold 9.5px ${fontFam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.collapsed ? String(node.children.length) : "−", badgeX, centerY + 0.4);
    ctx.restore();
  }
}
