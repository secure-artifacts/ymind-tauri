import { sanitizeFilename } from '../ui/dialog.js';

export function serializeTabToPackage(tab) {
  const rootText = tab.mindData?.text?.trim() || tab.title || "思维导图";
  const presetFilename = sanitizeFilename(rootText);

  return {
    filePackage: {
      fileType: "YMIND_PRO_DOCUMENT",
      version: "3.0",
      title: tab.title || presetFilename,
      layoutStructure: tab.layoutStructure || "mindmap",
      colorPalette: tab.colorPalette || "apple-classic",
      lineStyle: tab.lineStyle || "curve",
      boxStyle: tab.boxStyle || "squircle",
      canvasTheme: tab.canvasTheme || "studio-light",
      mindData: tab.mindData,
      floatingNodes: tab.floatingNodes || []
    },
    filenameWithExt: `${presetFilename}.ymind`,
    presetFilename
  };
}

export function deserializePackage(parsed, defaultFileName = "本地思维导图", filePath = null) {
  let loadedMindData = parsed;
  let loadedLayout = "mindmap";
  let loadedPalette = "apple-classic";
  let loadedLine = "curve";
  let loadedBox = "squircle";
  let loadedTheme = "studio-light";
  let tabFloatingNodes = parsed.floatingNodes || [];

  if (parsed.mindData && typeof parsed.mindData === 'object') {
    loadedMindData = parsed.mindData;
    if (parsed.floatingNodes) tabFloatingNodes = parsed.floatingNodes;
    loadedLayout = parsed.layoutStructure || "mindmap";
    loadedPalette = parsed.colorPalette || "apple-classic";
    loadedLine = parsed.lineStyle || "curve";
    loadedBox = parsed.boxStyle || "squircle";
    loadedTheme = parsed.canvasTheme || "studio-light";
  }

  const fileDisplayName = filePath 
    ? filePath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, "") 
    : (parsed.title || loadedMindData.text?.trim() || defaultFileName);

  return {
    fileDisplayName,
    loadedMindData,
    loadedLayout,
    loadedPalette,
    loadedLine,
    loadedBox,
    loadedTheme,
    tabFloatingNodes
  };
}
