import { bus, EVENTS } from "./event-bus.js";

const SETTINGS_KEY = "YMIND_PRO_GLOBAL_SETTINGS";
let cachedGlobalSettings = null;

export function getDefaultSettings() {
  return {
    fontEn: "-apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Helvetica Neue\", sans-serif",
    fontZh: "\"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", sans-serif",
    layout: "mindmap",
    palette: "apple-classic",
    lineStyle: "curve",
    nodeSpacing: "normal",
    boxStyle: "squircle",
    canvasTheme: "studio-light",
    canvasBgColor: "studio-white",
    canvasBgPattern: "dots",
    focusFollowMode: "smooth",
    autoSaveInterval: "30"
  };
}

export function getGlobalSettings() {
  if (cachedGlobalSettings) return cachedGlobalSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    cachedGlobalSettings = raw ? { ...getDefaultSettings(), ...JSON.parse(raw) } : getDefaultSettings();
  } catch {
    cachedGlobalSettings = getDefaultSettings();
  }
  return cachedGlobalSettings;
}

export function saveGlobalSettings(s) {
  cachedGlobalSettings = { ...s };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  applyGlobalTypography(s);
  bus.emit(EVENTS.CONFIG_CHANGE, s);
}

export function applyGlobalTypography(s = getGlobalSettings()) {
  document.documentElement.style.setProperty("--font-en", s.fontEn);
  document.documentElement.style.setProperty("--font-zh", s.fontZh);
}
