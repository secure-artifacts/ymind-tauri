import { sanitizeFilename } from "../ui/dialog.js";
import { encryptMindPayload, isEncryptedPackage } from "../storage/crypto.js";

// 🌟 纯原生 ZIP 标准解析引擎：利用 EOCD 逆向定位 Central Directory，彻底解决 compSize === 0 流式 XMind 文件解析失败
export async function extractRealXMindZip(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const totalLen = arrayBuffer.byteLength;
  if (totalLen < 22) throw new Error("NOT_A_ZIP");

  // 1. 从文件末尾反向定位 End of Central Directory Record (签名 0x06054b50)
  let eocdOffset = -1;
  const maxSearch = Math.min(totalLen, 65535 + 22);
  for (let i = totalLen - 22; i >= totalLen - maxSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("ZIP_EOCD_NOT_FOUND");

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  // 2. 遍历 Central Directory 获取精确的 Local Header 偏移量与压缩大小
  let offset = cdOffset;
  const dec = new TextDecoder();

  for (let i = 0; i < totalEntries; i++) {
    if (offset + 46 > totalLen || view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);

    const nameBytes = new Uint8Array(arrayBuffer, offset + 46, nameLen);
    const fileName = dec.decode(nameBytes);

    if (fileName === "content.json") {
      // 3. 准确定位 Local Header 下的真实数据块
      if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) throw new Error("INVALID_LOCAL_HEADER");
      const localNameLen = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
      const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

      const rawSlice = new Uint8Array(arrayBuffer, dataOffset, compSize);
      if (method === 0) {
        return JSON.parse(dec.decode(rawSlice));
      } else if (method === 8) {
        const ds = new DecompressionStream("deflate-raw");
        const stream = new Response(rawSlice).body.pipeThrough(ds);
        const jsonText = await new Response(stream).text();
        return JSON.parse(jsonText);
      } else {
        throw new Error("UNSUPPORTED_ZIP_METHOD");
      }
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  throw new Error("XMIND_CONTENT_NOT_FOUND");
}

export async function serializeTabToPackage(tab) {
  const defaultTitle = (tab?.isEncrypted) ? (tab?.title || "保密思维导图") : (tab?.mindData?.text ? tab.mindData.text.trim() : (tab?.title || "思维导图"));
  const presetFilename = sanitizeFilename(defaultTitle);
  
  let finalPayload = tab?.mindData || { id: "root", text: "中心主题", children: [] };
  let isEncrypted = Boolean(tab?.isEncrypted);
  let encryptedPackage = tab?.encryptedVault || null;

  if (isEncrypted && tab?.password && !tab?._isLocked) {
    encryptedPackage = await encryptMindPayload(finalPayload, tab.password, tab.passwordHint || "");
  } else if (isEncrypted && !encryptedPackage) {
    throw new Error("CANNOT_SAVE_UNLOCKED_WITHOUT_PASSWORD");
  }

  return {
    filePackage: {
      fileType: "YMIND_PRO_DOCUMENT",
      version: "3.0",
      isEncrypted: isEncrypted,
      title: tab?.title || presetFilename,
      layoutStructure: tab?.layoutStructure || "mindmap",
      colorPalette: tab?.colorPalette || "apple-classic",
      lineStyle: tab?.lineStyle || "curve",
      boxStyle: tab?.boxStyle || "squircle",
      canvasTheme: tab?.canvasTheme || "studio-light",
      canvasBgColor: tab?.canvasBgColor || "studio-white",
      canvasBgPattern: tab?.canvasBgPattern || "dots",
      mindData: isEncrypted ? null : finalPayload,
      versions: isEncrypted ? [] : (tab?.versions || []),
      encryptedVault: isEncrypted ? encryptedPackage : null
    },
    filenameWithExt: presetFilename + ".ymind",
    presetFilename: presetFilename
  };
}

export function parseTextToTree(text, filename = "思维导图") {
  const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.trim().length > 0);
  if (lines.length === 0) return { id: "root", text: filename, children: [] };
  const rootText = lines[0].replace(/^[#\-\s*]+/, "").trim() || filename;
  const root = { id: "root", text: rootText, children: [] };
  const stack = [{ node: root, indent: -1 }];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const indent = raw.search(/\S/);
    const textClean = raw.replace(/^[#\-\s*]+/, "").trim();
    if (!textClean) continue;

    const newNode = { id: "node_" + Date.now() + "_" + i, text: textClean, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    if (!parent.children) parent.children = [];
    parent.children.push(newNode);
    stack.push({ node: newNode, indent: indent });
  }
  return root;
}

export function normalizeMindNode(n) {
  if (!n || typeof n !== "object") return null;
  const data = (n.data && typeof n.data === "object") ? n.data : n;
  const text = data.text || data.title || data.topic || data.label || data.name || data.content ||
               n.text || n.title || n.topic || n.label || n.name || n.content || "新主题";
  const id = n.id ? String(n.id) : (data.id ? String(data.id) : ("node_" + Math.random().toString(36).substr(2, 7)));

  let priority = null;
  const rawP = data.priority || n.priority;
  if (rawP !== undefined && rawP !== null && rawP !== "") {
    const pStr = String(rawP).toUpperCase();
    priority = pStr.startsWith("P") ? pStr : ("P" + pStr);
  }

  let progress = null;
  const rawPrg = data.progress !== undefined ? data.progress : n.progress;
  if (rawPrg !== undefined && rawPrg !== null && rawPrg !== "") {
    if (typeof rawPrg === "number") {
      progress = rawPrg <= 4 ? (rawPrg * 25 + "%") : (rawPrg <= 100 ? (rawPrg + "%") : String(rawPrg));
    } else {
      progress = String(rawPrg);
    }
  }

  let tags = [];
  if (Array.isArray(data.tags)) tags = data.tags;
  else if (Array.isArray(n.tags)) tags = n.tags;
  else if (data.resource) tags = Array.isArray(data.resource) ? data.resource : [String(data.resource)];
  else if (n.resource) tags = Array.isArray(n.resource) ? n.resource : [String(n.resource)];

  let children = [];
  const rawChildren = n.children || data.children || n.topics || data.topics || n.subTopics || data.subTopics;
  if (Array.isArray(rawChildren) && rawChildren.length > 0) {
    children = new Array(rawChildren.length);
    let cCount = 0;
    for (let i = 0; i < rawChildren.length; i++) {
      const child = normalizeMindNode(rawChildren[i]);
      if (child) children[cCount++] = child;
    }
    children.length = cCount;
  } else if (rawChildren && rawChildren.attached && Array.isArray(rawChildren.attached) && rawChildren.attached.length > 0) {
    children = new Array(rawChildren.attached.length);
    let cCount = 0;
    for (let i = 0; i < rawChildren.attached.length; i++) {
      const child = normalizeMindNode(rawChildren.attached[i]);
      if (child) children[cCount++] = child;
    }
    children.length = cCount;
  }

  return {
    id: id,
    text: String(text),
    icon: data.icon || n.icon || null,
    priority: priority,
    progress: progress,
    tags: tags.map(String),
    note: data.note || n.note || data.notes || n.notes || "",
    collapsed: Boolean(data.collapsed || n.collapsed || data.expand === false),
    fontSize: data.fontSize || n.fontSize || null,
    fontWeight: data.fontWeight || n.fontWeight || null,
    fontStyle: data.fontStyle || n.fontStyle || null,
    textDecoration: data.textDecoration || n.textDecoration || null,
    textColor: data.textColor || n.textColor || null,
    children: children
  };
}

export function deserializePackage(parsed, defaultFileName = "本地思维导图", filePath = null) {
  let rootRaw = parsed;
  let loadedLayout = "mindmap", loadedPalette = "apple-classic", loadedLine = "curve", loadedBox = "squircle", loadedTheme = "studio-light", loadedVersions = [];
  let loadedBgColor = "studio-white", loadedBgPattern = "dots";
  let isEncrypted = false;
  let encryptedVault = null;

  if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];

  if (parsed && typeof parsed === "object") {
    if (parsed.filePackage && typeof parsed.filePackage === "object") parsed = parsed.filePackage;
    
    if (parsed.isEncrypted || parsed.encryptedVault || isEncryptedPackage(parsed)) {
      isEncrypted = true;
      encryptedVault = parsed.encryptedVault || (isEncryptedPackage(parsed) ? parsed : null);
    }

    if (parsed.mindData) rootRaw = parsed.mindData;
    else if (parsed.rootTopic) rootRaw = parsed.rootTopic;
    else if (parsed.root) rootRaw = parsed.root;
    else if (parsed.data) rootRaw = parsed.data;
    else if (parsed.topic) rootRaw = parsed.topic;

    loadedLayout = parsed.layoutStructure || "mindmap";
    loadedPalette = parsed.colorPalette || "apple-classic";
    loadedLine = parsed.lineStyle || "curve";
    loadedBox = parsed.boxStyle || "squircle";
    loadedTheme = parsed.canvasTheme || "studio-light";
    loadedBgColor = parsed.canvasBgColor || "studio-white";
    loadedBgPattern = parsed.canvasBgPattern || "dots";
    loadedVersions = (!isEncrypted && Array.isArray(parsed.versions)) ? parsed.versions : [];
  }

  let fileDisplayName = defaultFileName;
  if (filePath) {
    const parts = filePath.split(/[\\/]/);
    fileDisplayName = parts[parts.length - 1].replace(/\.[^/.]+$/, "");
  } else if (parsed && parsed.title) {
    fileDisplayName = parsed.title;
  }

  const loadedMindData = isEncrypted ? null : (normalizeMindNode(rootRaw) || { id: "root", text: "中心主题", children: [] });

  return {
    fileDisplayName: fileDisplayName,
    loadedMindData: loadedMindData,
    isEncrypted: isEncrypted,
    encryptedVault: encryptedVault,
    loadedLayout: loadedLayout,
    loadedPalette: loadedPalette,
    loadedLine: loadedLine,
    loadedBox: loadedBox,
    loadedTheme: loadedTheme,
    loadedBgColor: loadedBgColor,
    loadedBgPattern: loadedBgPattern,
    loadedVersions: loadedVersions
  };
}
