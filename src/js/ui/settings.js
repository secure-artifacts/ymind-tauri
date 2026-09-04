import { COLOR_PALETTES, CANVAS_THEMES, CANVAS_PATTERNS } from "../data/palettes.js";
import { getGlobalSettings, saveGlobalSettings, getDefaultSettings } from "../core/state.js";
import { showToast, escapeHtml } from "./dialog.js";
import { restartAutoSaveEngine } from "../storage/storage.js";

let scannedFontsCache = null;
const customSelectRegistry = new Map();

export function createCustomSelect(containerId, optionsData, initialValue, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  container.className = "apple-custom-select";
  container.dataset.value = initialValue;

  let currentVal = initialValue;
  let currentLabel = findLabelByValue(optionsData, initialValue);

  function render() {
    let optionsHtml = "";
    optionsData.forEach(group => {
      if (group.title) {
        optionsHtml += `<div class="apple-custom-group-title">${group.title}</div>`;
      }
      group.items.forEach(item => {
        const isSelected = item.value === currentVal;
        optionsHtml += `
          <div class="apple-custom-option ${isSelected ? "selected" : ""}" data-val="${escapeHtml(item.value)}" data-label="${escapeHtml(item.label)}">
            <span>${item.label}</span>
            ${isSelected ? "<span class=\"apple-custom-check\">✓</span>" : ""}
          </div>
        `;
      });
    });

    container.innerHTML = `
      <button class="apple-custom-trigger" type="button">
        <span class="apple-custom-trigger-text">${escapeHtml(currentLabel)}</span>
        <svg class="apple-custom-trigger-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <div class="apple-custom-dropdown">
        <div class="apple-custom-scroll">${optionsHtml}</div>
      </div>
    `;

    const trigger = container.querySelector(".apple-custom-trigger");
    trigger.onclick = (e) => {
      e.stopPropagation();
      const isOpen = container.classList.contains("open");
      document.querySelectorAll(".apple-custom-select").forEach(el => el.classList.remove("open"));
      if (!isOpen) container.classList.add("open");
    };

    container.querySelectorAll(".apple-custom-option").forEach(opt => {
      opt.onclick = (e) => {
        e.stopPropagation();
        currentVal = opt.dataset.val;
        currentLabel = opt.dataset.label;
        container.dataset.value = currentVal;
        container.classList.remove("open");
        render();
        if (typeof onChange === "function") onChange(currentVal);
      };
    });
  }

  render();

  const controller = {
    getValue: () => currentVal,
    setValue: (val) => {
      currentVal = val;
      currentLabel = findLabelByValue(optionsData, val);
      container.dataset.value = val;
      render();
    },
    updateOptions: (newOptions, keepVal = currentVal) => {
      optionsData = newOptions;
      currentVal = keepVal;
      currentLabel = findLabelByValue(optionsData, keepVal);
      container.dataset.value = keepVal;
      render();
    }
  };

  customSelectRegistry.set(containerId, controller);
  return controller;
}

function findLabelByValue(optionsData, val) {
  for (let group of optionsData) {
    for (let item of group.items) {
      if (item.value === val) return item.label;
    }
  }
  if (val) {
    const clean = val.replace(/"/g, "").split(",")[0].trim();
    if (clean.startsWith("-apple-system")) return "系统默认西文";
    if (clean.includes("PingFang")) return "系统默认中文";
    return clean;
  }
  return "请选择...";
}

window.addEventListener("click", (e) => {
  if (!e.target.closest(".apple-custom-select")) {
    document.querySelectorAll(".apple-custom-select").forEach(el => el.classList.remove("open"));
  }
});

export async function scanSystemFonts() {
  const chineseSet = new Set();
  const englishSet = new Set();

  if (typeof window.queryLocalFonts === "function") {
    try {
      const fontList = await window.queryLocalFonts();
      fontList.forEach(f => {
        const fam = f.family;
        if (!fam) return;
        if (isChineseFont(fam)) chineseSet.add(fam);
        else englishSet.add(fam);
      });
    } catch (e) {}
  }

  const presetZh = [
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑",
    "Source Han Sans CN", "思源黑体", "Source Han Serif CN", "思源宋体",
    "HarmonyOS Sans SC", "MiSans", "OPPO Sans", "vivo Sans",
    "STKaiti", "华文楷体", "KaiTi", "楷体", "STSong", "华文宋体",
    "Songti SC", "SimSun", "宋体", "FangSong", "仿宋", "SimHei", "黑体"
  ];
  
  const presetEn = [
    "SF Pro Display", "SF Pro Text", "Helvetica Neue", "Helvetica",
    "Arial", "Inter", "Roboto", "Segoe UI", "JetBrains Mono", "Fira Code",
    "Consolas", "Courier New", "Georgia", "Times New Roman", "Trebuchet MS",
    "Verdana", "Chalkboard SE", "Comic Sans MS", "Cascadia Code", "Monaco"
  ];

  presetZh.forEach(f => { if (checkFontAvailable(f)) chineseSet.add(f); });
  presetEn.forEach(f => { if (checkFontAvailable(f)) englishSet.add(f); });

  scannedFontsCache = {
    chinese: Array.from(chineseSet).sort(),
    english: Array.from(englishSet).sort()
  };
  return scannedFontsCache;
}

function isChineseFont(name) {
  if (/[\u4e00-\u9fa5]/.test(name)) return true;
  const zhKeywords = ["pingfang", "hiragino", "yahei", "simsun", "kaiti", "songti", "fangsong", "heiti", "han sans", "han serif", "noto sans cjk", "noto serif cjk", "harmonyos", "misans", "oppo sans", "wenquanyi", "dengxian", "stkai", "stsong"];
  const lower = name.toLowerCase();
  return zhKeywords.some(kw => lower.includes(kw));
}

function checkFontAvailable(fontName) {
  if (document.fonts && document.fonts.check) {
    if (document.fonts.check(`14px "${fontName}"`)) return true;
  }
  const testStr = "mmmmmmmmmmlli";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  ctx.font = "72px monospace";
  const baselineMono = ctx.measureText(testStr).width;
  ctx.font = "72px sans-serif";
  const baselineSans = ctx.measureText(testStr).width;

  ctx.font = `72px "${fontName}", monospace`;
  const m = ctx.measureText(testStr).width;
  ctx.font = `72px "${fontName}", sans-serif`;
  const s = ctx.measureText(testStr).width;

  return m !== baselineMono || s !== baselineSans;
}

export async function syncSettingsForm() {
  const s = getGlobalSettings();

  const configs = [
    ["wrap-setting-app-theme", [
      { value: "light", label: "☀️ 浅色明亮模式 (Light Mode)" },
      { value: "dark", label: "🌙 深色黑曜模式 (Dark Mode)" },
      { value: "auto", label: "💻 跟随操作系统设置 (System Auto)" }
    ], s.appTheme || "light"],
    ["wrap-setting-default-layout", [
      { value: "mindmap", label: "🌳 经典双向导图" }, { value: "logic-right", label: "➡️ 向右逻辑推导图" },
      { value: "logic-left", label: "⬅️ 向左逆向归因图" }, { value: "org-down", label: "🏢 经典组织架构图" }
    ], s.layout],
    ["wrap-setting-default-palette", Object.values(COLOR_PALETTES).map(p => ({ value: p.id, label: p.name })), s.palette],
    ["wrap-setting-default-line", [
      { value: "curve", label: "平滑曲线" }, { value: "rounded-ortho", label: "圆角折线" },
      { value: "sharp-ortho", label: "直角折线" }, { value: "straight", label: "极简直线" }, { value: "arc-corner", label: "现代圆弧" }
    ], s.lineStyle],
    ["wrap-setting-default-box", [
      { value: "squircle", label: "超椭圆卡片" }, { value: "rect", label: "几何方框" },
      { value: "underline", label: "极简下划线" }, { value: "solid", label: "实色填充卡片" }
    ], s.boxStyle],
    ["wrap-setting-default-bg-color", CANVAS_THEMES.map(t => ({ value: t.id, label: t.label })), s.canvasBgColor || "studio-white"],
    ["wrap-setting-default-bg-pattern", CANVAS_PATTERNS.map(p => ({ value: p.id, label: p.label })), s.canvasBgPattern || "dots"],
    ["wrap-setting-auto-save", [
      { value: "0", label: "🚫 关闭自动保存" }, { value: "15", label: "⏱️ 每 15 秒" }, { value: "30", label: "⏱️ 每 30 秒 (推荐)" },
      { value: "60", label: "⏱️ 每 1 分钟" }, { value: "300", label: "⏱️ 每 5 分钟" }, { value: "600", label: "⏱️ 每 10 分钟" }
    ], s.autoSaveInterval || "30"],
    ["wrap-setting-focus-follow", [
      { value: "smooth", label: "🚀 开启平滑移动 (推荐)" }, { value: "instant", label: "⚡ 瞬时直达定位" }, { value: "off", label: "🚫 关闭移动定位" }
    ], s.focusFollowMode || "smooth"]
  ];

  configs.forEach(([id, items, val]) => createCustomSelect(id, [{ items }], val));

  if (!scannedFontsCache) {
    const fonts = await scanSystemFonts();
    applyFontOptions(fonts, s.fontEn, s.fontZh);
  } else {
    applyFontOptions(scannedFontsCache, s.fontEn, s.fontZh);
  }
}

function applyFontOptions(fonts, curEn, curZh) {
  const enGroups = [{
    title: `💻 本地已安装西文字体 (${fonts.english.length})`,
    items: fonts.english.map(f => ({ value: `"${f}", sans-serif`, label: f }))
  }];

  const zhGroups = [{
    title: `💻 本地已安装中文字体 (${fonts.chinese.length})`,
    items: fonts.chinese.map(f => ({ value: `"${f}", sans-serif`, label: f }))
  }];

  createCustomSelect("wrap-setting-font-en", enGroups, curEn, updateTypographyPreview);
  createCustomSelect("wrap-setting-font-zh", zhGroups, curZh, updateTypographyPreview);

  const badge = document.getElementById("badge-font-count");
  if (badge) {
    badge.innerText = `已检测到 ${fonts.chinese.length + fonts.english.length} 款本地字体`;
    badge.classList.remove("hidden");
  }

  updateTypographyPreview();
}

export function updateTypographyPreview() {
  const ctrlEn = customSelectRegistry.get("wrap-setting-font-en");
  const ctrlZh = customSelectRegistry.get("wrap-setting-font-zh");
  const previewBox = document.getElementById("settings-font-preview");
  if (!previewBox) return;

  const fontEn = ctrlEn ? ctrlEn.getValue() : "-apple-system, BlinkMacSystemFont, \"SF Pro Text\"";
  const fontZh = ctrlZh ? ctrlZh.getValue() : "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif";
  previewBox.style.fontFamily = `${fontEn}, ${fontZh}`;
}

export function initSettingsViewEvents(renderApp) {
  const btnSave = document.getElementById("btn-page-settings-save");
  const btnReset = document.getElementById("btn-page-settings-reset");
  const btnScan = document.getElementById("btn-scan-local-fonts");

  btnScan?.addEventListener("click", async () => {
    const txt = document.getElementById("txt-scan-fonts");
    if (txt) txt.innerText = "正在扫描...";
    showToast("🔍 正在扫描系统本地已安装字体...");
    const fonts = await scanSystemFonts();
    const curSettings = getGlobalSettings();
    applyFontOptions(fonts, curSettings.fontEn, curSettings.fontZh);
    if (txt) txt.innerText = "重新扫描本地字体";
    showToast(`✅ 成功加载 ${fonts.chinese.length + fonts.english.length} 款本地字体`);
  });

  btnSave?.addEventListener("click", () => {
    const newSettings = {
      appTheme: customSelectRegistry.get("wrap-setting-app-theme")?.getValue() || "light",
      fontEn: customSelectRegistry.get("wrap-setting-font-en")?.getValue() || "-apple-system, BlinkMacSystemFont, \"SF Pro Text\"",
      fontZh: customSelectRegistry.get("wrap-setting-font-zh")?.getValue() || "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif",
      layout: customSelectRegistry.get("wrap-setting-default-layout")?.getValue() || "mindmap",
      palette: customSelectRegistry.get("wrap-setting-default-palette")?.getValue() || "apple-classic",
      lineStyle: customSelectRegistry.get("wrap-setting-default-line")?.getValue() || "curve",
      boxStyle: customSelectRegistry.get("wrap-setting-default-box")?.getValue() || "squircle",
      canvasBgColor: customSelectRegistry.get("wrap-setting-default-bg-color")?.getValue() || "studio-white",
      canvasBgPattern: customSelectRegistry.get("wrap-setting-default-bg-pattern")?.getValue() || "dots",
      autoSaveInterval: customSelectRegistry.get("wrap-setting-auto-save")?.getValue() || "30",
      focusFollowMode: customSelectRegistry.get("wrap-setting-focus-follow")?.getValue() || "smooth"
    };

    saveGlobalSettings(newSettings);
    import("../core/config.js").then(c => c.applyAppTheme(newSettings.appTheme));
    restartAutoSaveEngine(renderApp);
    renderApp();
    showToast("⚙️ 偏好设置与默认样式已保存并即时生效");
  });

  btnReset?.addEventListener("click", () => {
    const def = getDefaultSettings();
    customSelectRegistry.get("wrap-setting-font-en")?.setValue(def.fontEn);
    customSelectRegistry.get("wrap-setting-font-zh")?.setValue(def.fontZh);
    customSelectRegistry.get("wrap-setting-default-layout")?.setValue(def.layout);
    customSelectRegistry.get("wrap-setting-default-palette")?.setValue(def.palette);
    customSelectRegistry.get("wrap-setting-default-line")?.setValue(def.lineStyle);
    customSelectRegistry.get("wrap-setting-default-box")?.setValue(def.boxStyle);
    customSelectRegistry.get("wrap-setting-default-bg-color")?.setValue(def.canvasBgColor || "studio-white");
    customSelectRegistry.get("wrap-setting-default-bg-pattern")?.setValue(def.canvasBgPattern || "dots");
    customSelectRegistry.get("wrap-setting-auto-save")?.setValue(def.autoSaveInterval || "30");
    customSelectRegistry.get("wrap-setting-focus-follow")?.setValue(def.focusFollowMode || "smooth");
    updateTypographyPreview();
  });
}
