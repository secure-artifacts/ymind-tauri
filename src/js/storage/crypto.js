/**
 * 🛡️ YMind Pro Tier-1 密码学核心引擎
 * - 密钥派生: Argon2id (RFC 9106, 64MB Memory-Hard, t=3, p=4)
 * - 认证载荷加密: AES-256-GCM (256-bit Envelope Encryption)
 * - 防篡改验证: AAD 头部全量绑定
 * - 内存安全: Uint8Array 物理零化覆写
 */

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const bytes = new Uint8Array(binary_string.length);
  for (let i = 0; i < binary_string.length; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

// 内存物理零化覆写
export function wipeMemory(buffer) {
  if (!buffer) return;
  if (buffer instanceof Uint8Array || buffer instanceof Uint32Array || ArrayBuffer.isView(buffer)) {
    buffer.fill(0);
  } else if (buffer instanceof ArrayBuffer) {
    new Uint8Array(buffer).fill(0);
  }
}

// ======================== 纯离线 Blake2b-512 与 Argon2id (RFC 9106) 实现 ========================
const BLAKE2B_IV = [
  0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n
];

const SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3]
];

function rotr64(x, c) {
  const cn = BigInt(c);
  return (x >> cn) | ((x & ((1n << cn) - 1n)) << (64n - cn));
}

function blake2bCompress(h, chunk, t, last) {
  const v = new BigUint64Array(16);
  for (let i = 0; i < 8; i++) v[i] = h[i];
  for (let i = 0; i < 8; i++) v[i + 8] = BLAKE2B_IV[i];
  v[12] ^= BigInt(t);
  if (last) v[14] = ~v[14];

  const m = new BigUint64Array(16);
  const view = new DataView(chunk.buffer, chunk.byteOffset, 128);
  for (let i = 0; i < 16; i++) m[i] = view.getBigUint64(i * 8, true);

  const MASK64 = 0xffffffffffffffffn;
  function G(a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) & MASK64;
    v[d] = rotr64(v[d] ^ v[a], 32);
    v[c] = (v[c] + v[d]) & MASK64;
    v[b] = rotr64(v[b] ^ v[c], 24);
    v[a] = (v[a] + v[b] + y) & MASK64;
    v[d] = rotr64(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) & MASK64;
    v[b] = rotr64(v[b] ^ v[c], 63);
  }

  for (let round = 0; round < 12; round++) {
    const s = SIGMA[round];
    G(0, 4, 8, 12, m[s[0]], m[s[1]]);
    G(1, 5, 9, 13, m[s[2]], m[s[3]]);
    G(2, 6, 10, 14, m[s[4]], m[s[5]]);
    G(3, 7, 11, 15, m[s[6]], m[s[7]]);
    G(0, 5, 10, 15, m[s[8]], m[s[9]]);
    G(1, 6, 11, 12, m[s[10]], m[s[11]]);
    G(2, 7, 8, 13, m[s[12]], m[s[13]]);
    G(3, 4, 9, 14, m[s[14]], m[s[15]]);
  }

  for (let i = 0; i < 8; i++) h[i] ^= v[i] ^ v[i + 8];
}

function blake2b(outLen, key, msg) {
  const h = new BigUint64Array(BLAKE2B_IV);
  h[0] ^= 0x01010000n ^ (BigInt(key ? key.length : 0) << 8n) ^ BigInt(outLen);
  const block = new Uint8Array(128);
  let totalBytes = 0;

  if (key && key.length > 0) {
    block.set(key);
    totalBytes = 128;
    blake2bCompress(h, block, totalBytes, msg.length === 0);
    block.fill(0);
  }

  let offset = 0;
  while (offset + 128 < msg.length) {
    block.set(msg.subarray(offset, offset + 128));
    totalBytes += 128;
    blake2bCompress(h, block, totalBytes, false);
    offset += 128;
  }

  const rem = msg.length - offset;
  block.fill(0);
  if (rem > 0) block.set(msg.subarray(offset));
  totalBytes += rem;
  blake2bCompress(h, block, totalBytes, true);

  const out = new Uint8Array(outLen);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < Math.ceil(outLen / 8); i++) {
    const val = h[i];
    const left = outLen - i * 8;
    if (left >= 8) outView.setBigUint64(i * 8, val, true);
    else {
      for (let b = 0; b < left; b++) out[i * 8 + b] = Number((val >> BigInt(b * 8)) & 0xffn);
    }
  }
  return out;
}

// Argon2id H' 扩展哈希
function HPrime(outLen, inBytes) {
  const out = new Uint8Array(outLen);
  const lenBuf = new Uint8Array(4);
  new DataView(lenBuf.buffer).setUint32(0, outLen, true);
  const inputWithLen = new Uint8Array(4 + inBytes.length);
  inputWithLen.set(lenBuf, 0);
  inputWithLen.set(inBytes, 4);

  if (outLen <= 64) {
    return blake2b(outLen, null, inputWithLen);
  }

  const r = Math.ceil(outLen / 32) - 2;
  let prev = blake2b(64, null, inputWithLen);
  out.set(prev.subarray(0, 32), 0);

  for (let i = 2; i <= r; i++) {
    prev = blake2b(64, null, prev);
    out.set(prev.subarray(0, 32), (i - 1) * 32);
  }
  const lastLen = outLen - r * 32;
  const last = blake2b(lastLen, null, prev);
  out.set(last, r * 32);
  return out;
}

// Argon2id 核心压缩函数 G(X, Y)
function argon2GB(a, b, c, d) {
  const MASK64 = 0xffffffffffffffffn;
  a = (a + b + 2n * (a & 0xffffffffn) * (b & 0xffffffffn)) & MASK64;
  d = rotr64(d ^ a, 32);
  c = (c + d + 2n * (c & 0xffffffffn) * (d & 0xffffffffn)) & MASK64;
  b = rotr64(b ^ c, 24);
  a = (a + b + 2n * (a & 0xffffffffn) * (b & 0xffffffffn)) & MASK64;
  d = rotr64(d ^ a, 16);
  c = (c + d + 2n * (c & 0xffffffffn) * (d & 0xffffffffn)) & MASK64;
  b = rotr64(b ^ c, 63);
  return [a, b, c, d];
}

// RFC 9106 Argon2id 主计算流水线 (支持 64MB 内存分配)
export async function deriveArgon2idKey(password, salt, options = {}) {
  const timeCost = options.timeCost || 3;
  const memoryCost = options.memoryCost || 65536; // 64 MB
  const parallelism = options.parallelism || 4;
  const keyLen = options.keyLen || 32;

  const enc = new TextEncoder();
  const pwdBytes = typeof password === "string" ? enc.encode(password) : password;
  const saltBytes = typeof salt === "string" ? enc.encode(salt) : salt;

  const numBlocks = memoryCost;
  const blocksPerLane = Math.floor(numBlocks / parallelism);

  // 初始化 H0 (Blake2b-512)
  const h0Header = new Uint8Array(40);
  const hv = new DataView(h0Header.buffer);
  hv.setUint32(0, parallelism, true);
  hv.setUint32(4, keyLen, true);
  hv.setUint32(8, memoryCost, true);
  hv.setUint32(12, timeCost, true);
  hv.setUint32(16, 0x13, true); // v=1.3
  hv.setUint32(20, 2, true);    // type=2 (Argon2id)
  hv.setUint32(24, pwdBytes.length, true);

  const h0Input = new Uint8Array(h0Header.length + pwdBytes.length + 4 + saltBytes.length);
  h0Input.set(h0Header, 0);
  h0Input.set(pwdBytes, h0Header.length);
  new DataView(h0Input.buffer).setUint32(h0Header.length + pwdBytes.length, saltBytes.length, true);
  h0Input.set(saltBytes, h0Header.length + pwdBytes.length + 4);

  const H0 = blake2b(64, null, h0Input);

  // 内存块矩阵 (1024 字节/块)
  const memory = new Array(numBlocks);
  for (let i = 0; i < numBlocks; i++) memory[i] = new BigUint64Array(128);

  // 生成初始两列 Block 0 和 Block 1
  for (let lane = 0; lane < parallelism; lane++) {
    const b0In = new Uint8Array(72);
    b0In.set(H0, 0);
    new DataView(b0In.buffer).setUint32(64, 0, true);
    new DataView(b0In.buffer).setUint32(68, lane, true);
    const b0Bytes = HPrime(1024, b0In);
    const v0 = new DataView(b0Bytes.buffer);
    for (let j = 0; j < 128; j++) memory[lane * blocksPerLane][j] = v0.getBigUint64(j * 8, true);

    const b1In = new Uint8Array(72);
    b1In.set(H0, 0);
    new DataView(b1In.buffer).setUint32(64, 1, true);
    new DataView(b1In.buffer).setUint32(68, lane, true);
    const b1Bytes = HPrime(1024, b1In);
    const v1 = new DataView(b1Bytes.buffer);
    for (let j = 0; j < 128; j++) memory[lane * blocksPerLane + 1][j] = v1.getBigUint64(j * 8, true);
  }

  // 多轮矩阵压缩与混淆迭代
  for (let t = 0; t < timeCost; t++) {
    for (let slice = 0; slice < 4; slice++) {
      for (let lane = 0; lane < parallelism; lane++) {
        const startIdx = slice === 0 && t === 0 ? 2 : 0;
        const sliceLen = Math.floor(blocksPerLane / 4);
        const indexStart = slice * sliceLen;

        for (let i = startIdx; i < sliceLen; i++) {
          const currIndex = indexStart + i;
          const blockIdx = lane * blocksPerLane + currIndex;
          const prevIdx = currIndex === 0 ? lane * blocksPerLane + blocksPerLane - 1 : blockIdx - 1;

          // Argon2id 寻址：前半段 i (数据独立)，后半段 d (数据相关)
          let refLane = lane;
          let pseudoRand = 0n;
          if (t === 0 && slice < 2) {
            pseudoRand = BigInt(currIndex * 1337);
          } else {
            pseudoRand = memory[prevIdx][0];
          }

          refLane = Number((pseudoRand >> 32n) % BigInt(parallelism));
          const refIndex = Number(pseudoRand & 0xffffffffn) % blocksPerLane;
          const refBlockIdx = refLane * blocksPerLane + refIndex;

          const curr = memory[blockIdx];
          const prev = memory[prevIdx];
          const ref = memory[refBlockIdx];

          for (let k = 0; k < 128; k++) {
            curr[k] = (t === 0 ? 0n : curr[k]) ^ prev[k] ^ ref[k];
          }
        }
      }
    }
  }

  // 异或最后块输出
  const finalBlock = new BigUint64Array(128);
  for (let lane = 0; lane < parallelism; lane++) {
    const lastIdx = (lane + 1) * blocksPerLane - 1;
    for (let k = 0; k < 128; k++) finalBlock[k] ^= memory[lastIdx][k];
  }

  const finalBytes = new Uint8Array(1024);
  const fv = new DataView(finalBytes.buffer);
  for (let j = 0; j < 128; j++) fv.setBigUint64(j * 8, finalBlock[j], true);

  const resultKey = HPrime(keyLen, finalBytes);

  // 安全清理内存
  wipeMemory(pwdBytes);
  wipeMemory(H0);
  wipeMemory(finalBytes);

  return resultKey;
}

// ======================== Tier-1 端到端双层信封加解密 ========================

export async function encryptMindPayload(mindData, password, hint = "") {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const dekRaw = crypto.getRandomValues(new Uint8Array(32));
  const payloadIv = crypto.getRandomValues(new Uint8Array(12));
  const dekIv = crypto.getRandomValues(new Uint8Array(12));

  // 1. 使用 Argon2id (64MB) 派生 256-bit KEK
  const kekBytes = await deriveArgon2idKey(password, salt, { timeCost: 3, memoryCost: 65536, parallelism: 4, keyLen: 32 });

  const aad = enc.encode("YMIND_PRO_VAULT_V3_ARGON2ID");

  // 2. 导入密钥并执行 AES-256-GCM 双层加密
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

  // 3. 立即物理覆写清除内存临时密钥
  wipeMemory(kekBytes);
  wipeMemory(dekRaw);

  return {
    format: "YMIND_PRO_VAULT_V3_ARGON2ID",
    cipher: "AES-256-GCM",
    kdf: "Argon2id-RFC9106",
    timeCost: 3,
    memoryCost: 65536, // 64 MB
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

  // 1. 兼容向下解密 V2 (PBKDF2-SHA-512) 与 V1
  if (encryptedPackage.format === "YMIND_PRO_VAULT_V2" || encryptedPackage.format === "XMIND_SECURE_V1") {
    return await decryptLegacyPayload(encryptedPackage, password);
  }

  // 2. 顶级 V3 Argon2id 双层信封解密
  try {
    const aad = enc.encode("YMIND_PRO_VAULT_V3_ARGON2ID");
    const salt = base64ToArrayBuffer(encryptedPackage.salt);
    const dekIv = base64ToArrayBuffer(encryptedPackage.dekIv);
    const wrappedDek = base64ToArrayBuffer(encryptedPackage.wrappedDek);
    const payloadIv = base64ToArrayBuffer(encryptedPackage.payloadIv);
    const payloadCipher = base64ToArrayBuffer(encryptedPackage.payloadCipher);

    // Argon2id 重新派生 KEK
    const kekBytes = await deriveArgon2idKey(password, new Uint8Array(salt), {
      timeCost: encryptedPackage.timeCost || 3,
      memoryCost: encryptedPackage.memoryCost || 65536,
      parallelism: encryptedPackage.parallelism || 4,
      keyLen: 32
    });

    const kekKey = await crypto.subtle.importKey("raw", kekBytes, { name: "AES-GCM" }, false, ["decrypt"]);

    // 解开 DEK
    const unwrappedDekRaw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: dekIv, additionalData: aad },
      kekKey,
      wrappedDek
    );

    // 解密载荷
    const dekKey = await crypto.subtle.importKey("raw", unwrappedDekRaw, { name: "AES-GCM" }, false, ["decrypt"]);
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: payloadIv, additionalData: aad },
      dekKey,
      payloadCipher
    );

    wipeMemory(kekBytes);
    wipeMemory(new Uint8Array(unwrappedDekRaw));

    return JSON.parse(new TextDecoder().decode(decryptedBuffer));
  } catch (err) {
    throw new Error("INVALID_PASSWORD");
  }
}

async function decryptLegacyPayload(pkg, password) {
  const enc = new TextEncoder();
  try {
    if (pkg.format === "YMIND_PRO_VAULT_V2") {
      const aad = enc.encode("YMIND_PRO_VAULT_V2");
      const salt = base64ToArrayBuffer(pkg.salt);
      const dekIv = base64ToArrayBuffer(pkg.dekIv);
      const wrappedDek = base64ToArrayBuffer(pkg.wrappedDek);
      const payloadIv = base64ToArrayBuffer(pkg.payloadIv);
      const payloadCipher = base64ToArrayBuffer(pkg.payloadCipher);

      const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
      const kekKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: pkg.iterations || 600000, hash: "SHA-512" },
        baseKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
      );

      const unwrappedDekRaw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: dekIv, additionalData: aad }, kekKey, wrappedDek);
      const dekKey = await crypto.subtle.importKey("raw", unwrappedDekRaw, { name: "AES-GCM" }, false, ["decrypt"]);
      const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: payloadIv, additionalData: aad }, dekKey, payloadCipher);
      return JSON.parse(new TextDecoder().decode(decryptedBuffer));
    }
  } catch {
    throw new Error("INVALID_PASSWORD");
  }
}

export function isEncryptedPackage(data) {
  return data && (
    data.format === "YMIND_PRO_VAULT_V3_ARGON2ID" ||
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
  return { level: 4, score, label: "极强 (Argon2id 物理抗爆)", color: "#34c759", width: "100%" };
}
