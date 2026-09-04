function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const bytes = new Uint8Array(binary_string.length);
  for (let i = 0; i < binary_string.length; i++) bytes[i] = binary_string.charCodeAt(i);
  return bytes.buffer;
}

export function wipeMemory(buffer) {
  if (!buffer) return;
  if (buffer instanceof Uint8Array || buffer instanceof Uint32Array || ArrayBuffer.isView(buffer)) {
    buffer.fill(0);
  } else if (buffer instanceof ArrayBuffer) {
    new Uint8Array(buffer).fill(0);
  }
}

async function invokeTauri(cmd, args = {}) {
  const invoke = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke || window.__TAURI_INTERNALS__?.invoke;
  if (invoke) {
    return await invoke(cmd, args);
  }
  return null;
}

// 🌟 真实派生并返回元数据标识（彻底消除虚假标识带来的桌面端验密失败）
export async function deriveKeyWithAccurateMetadata(password, salt) {
  const enc = new TextEncoder();
  const saltBase64 = typeof salt === "string" ? salt : arrayBufferToBase64(salt);
  const saltBytes = typeof salt === "string" ? base64ToArrayBuffer(salt) : (salt.buffer ? salt : new Uint8Array(salt).buffer);

  // 1. 尝试调用 Tauri Rust 原生 Argon2id
  try {
    const nativeKeyBase64 = await invokeTauri("native_argon2id_derive", {
      password: String(password),
      salt: saltBase64,
      timeCost: 3,
      memoryCost: 4096,
      parallelism: 4
    });
    if (nativeKeyBase64) {
      return {
        keyBytes: new Uint8Array(base64ToArrayBuffer(nativeKeyBase64)),
        kdf: "Argon2id-RFC9106",
        format: "YMIND_PRO_VAULT_V3_ARGON2ID"
      };
    }
  } catch {}

  // 2. 纯浏览器环境原生 WebCrypto PBKDF2-SHA512
  const pwdBytes = typeof password === "string" ? enc.encode(password) : password;
  const baseKey = await crypto.subtle.importKey("raw", pwdBytes, { name: "PBKDF2" }, false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-512" },
    baseKey,
    256
  );
  return {
    keyBytes: new Uint8Array(derivedBits),
    kdf: "PBKDF2-SHA512",
    format: "YMIND_PRO_VAULT_V3_PBKDF2"
  };
}

export async function encryptMindPayload(mindData, password, hint = "") {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const dekRaw = crypto.getRandomValues(new Uint8Array(32));
  const payloadIv = crypto.getRandomValues(new Uint8Array(12));
  const dekIv = crypto.getRandomValues(new Uint8Array(12));

  // 实事求是获取真实派生出的 KDF 类型
  const { keyBytes: kekBytes, kdf, format } = await deriveKeyWithAccurateMetadata(password, salt);
  const aad = enc.encode(format);

  const kekKey = await crypto.subtle.importKey("raw", kekBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const dekKey = await crypto.subtle.importKey("raw", dekRaw, { name: "AES-GCM" }, false, ["encrypt"]);

  const payloadCiphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: payloadIv, additionalData: aad },
    dekKey,
    enc.encode(JSON.stringify(mindData))
  );

  const wrappedDek = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: dekIv, additionalData: aad },
    kekKey,
    dekRaw
  );

  wipeMemory(kekBytes);
  wipeMemory(dekRaw);

  return {
    format: format,
    cipher: "AES-256-GCM",
    kdf: kdf,
    timeCost: 3,
    memoryCost: 4096,
    parallelism: 4,
    hint: hint ? hint.trim() : "",
    salt: arrayBufferToBase64(salt),
    dekIv: arrayBufferToBase64(dekIv),
    wrappedDek: arrayBufferToBase64(wrappedDek),
    payloadIv: arrayBufferToBase64(payloadIv),
    payloadCipher: arrayBufferToBase64(payloadCiphertext),
    timestamp: Date.now()
  };
}

export async function decryptMindPayload(encryptedPackage, password) {
  if (!encryptedPackage) throw new Error("EMPTY_PACKAGE");

  const enc = new TextEncoder();
  const format = encryptedPackage.format || "";
  const kdf = encryptedPackage.kdf || "";

  const isLegacy = format === "YMIND_PRO_VAULT_V2" || format === "XMIND_SECURE_V1";

  try {
    const aad = enc.encode(format);
    const salt = base64ToArrayBuffer(encryptedPackage.salt);
    const dekIv = base64ToArrayBuffer(encryptedPackage.dekIv);
    const wrappedDek = base64ToArrayBuffer(encryptedPackage.wrappedDek);
    const payloadIv = base64ToArrayBuffer(encryptedPackage.payloadIv);
    const payloadCipher = base64ToArrayBuffer(encryptedPackage.payloadCipher);

    let kekBytes = null;

    // 🌟 核心修正：严格依据包内记录的真实 KDF 解算密钥
    if (isLegacy || kdf === "PBKDF2-SHA512" || format === "YMIND_PRO_VAULT_V3_PBKDF2") {
      const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
      const derivedBits = await crypto.subtle.deriveBits(
        { name: "PBKDF2", salt: salt, iterations: encryptedPackage.iterations || (isLegacy ? 600000 : 100000), hash: "SHA-512" },
        baseKey,
        256
      );
      kekBytes = new Uint8Array(derivedBits);
    } else {
      // 桌面端真实 Argon2id 解密通道
      const saltBase64 = arrayBufferToBase64(salt);
      const nativeKeyBase64 = await invokeTauri("native_argon2id_derive", {
        password: String(password),
        salt: saltBase64,
        timeCost: encryptedPackage.timeCost || 3,
        memoryCost: encryptedPackage.memoryCost || 4096,
        parallelism: encryptedPackage.parallelism || 4
      });
      if (nativeKeyBase64) {
        kekBytes = new Uint8Array(base64ToArrayBuffer(nativeKeyBase64));
      }
    }

    if (!kekBytes) throw new Error("KDF_FAILED");

    const kekKey = await crypto.subtle.importKey("raw", kekBytes, { name: "AES-GCM" }, false, ["decrypt"]);
    const unwrappedDekRaw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dekIv, additionalData: aad }, kekKey, wrappedDek);
    const dekKey = await crypto.subtle.importKey("raw", unwrappedDekRaw, { name: "AES-GCM" }, false, ["decrypt"]);
    const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: payloadIv, additionalData: aad }, dekKey, payloadCipher);

    wipeMemory(kekBytes);
    wipeMemory(new Uint8Array(unwrappedDekRaw));

    return JSON.parse(new TextDecoder().decode(decryptedBuffer));
  } catch (err) {
    throw new Error("INVALID_PASSWORD");
  }
}



export function isEncryptedPackage(data) {
  return data && (
    data.format === "YMIND_PRO_VAULT_V3_ARGON2ID" ||
    data.format === "YMIND_PRO_VAULT_V3_PBKDF2" ||
    data.format === "YMIND_PRO_VAULT_V2" ||
    data.format === "XMIND_SECURE_V1"
  );
}

export function evaluatePasswordStrength(password) {
  if (!password) return { level: 0, score: 0, label: "请输入密码", color: "#94a3b8", width: "0%" };
  let score = 0;
  if (password.length >= 6) score += 20;
  if (password.length >= 10) score += 25;
  if (password.length >= 14) score += 15;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[a-z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 10;

  if (score < 35) return { level: 1, score, label: "弱 (建议增加长度)", color: "#ff3b30", width: "25%" };
  if (score < 65) return { level: 2, score, label: "中等 (建议混合大小写与符号)", color: "#ff9500", width: "50%" };
  if (score < 85) return { level: 3, score, label: "良好 (具备极高安全性)", color: "#0071e3", width: "75%" };
  return { level: 4, score, label: "极强 (物理抗爆认证)", color: "#34c759", width: "100%" };
}
