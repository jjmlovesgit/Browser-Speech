const DEFAULT_SERVER_URL = "http://127.0.0.1:53117";
const BRIDGE_HOST_NAME = "com.pockettts.engine";
const STORAGE_KEY = "pocket-tts-settings";
const DEFAULT_RUNTIME_ROOT = "%LOCALAPPDATA%\\PocketTTSEngine\\runtime";
const DEFAULT_SERVER_EXE_PATH = `${DEFAULT_RUNTIME_ROOT}\\bin\\audiocpp_server.exe`;
const DEFAULT_CLI_EXE_PATH = `${DEFAULT_RUNTIME_ROOT}\\bin\\audiocpp_cli.exe`;
const DEFAULT_SERVER_CONFIG_PATH = `${DEFAULT_RUNTIME_ROOT}\\config\\server.json`;
const DEFAULT_POCKET_MODEL_PATH = "%LOCALAPPDATA%\\PocketTTS\\models\\pocket-tts";
const LEGACY_SHARED_POCKET_MODEL_PATH = "C:\\Projects\\audio.cpp\\models\\pocket-tts";
const DEFAULT_POCKET_FAMILY = "pocket_tts";
const DEFAULT_POCKET_BACKEND = "cuda";
const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
const CUSTOM_VOICES_STORAGE_KEY = "pocket-tts-custom-voices";
const CUSTOM_VOICE_DB_NAME = "pocket-tts-custom-voices-db";
const CUSTOM_VOICE_STORE_NAME = "voices";
const CUSTOM_VOICE_DB_VERSION = 1;
const CUSTOM_VOICE_FILE_PREFIX = "custom-voice:";
const SUPPORTED_TTS_EVENT_TYPES = ["start", "end", "error"];

const BUILTIN_VOICE_DEFINITIONS = [
  { key: "alba", defaultName: "Pocket Alba", lang: "en-US" },
  { key: "michael", defaultName: "Pocket Michael", lang: "en-US" },
  { key: "anna", defaultName: "Pocket Anna", lang: "en-GB" }
];
const DEFAULT_BUILTIN_VOICE_KEY = "alba";
const LEGACY_BUILTIN_VOICE_ALIASES = {
  "Pocket US Female": "alba",
  "Pocket US Male": "michael",
  "Pocket UK Female": "anna",
  "Pocket UK Male": "michael",
  "Pocket AU Female": "alba",
  "Pocket AU Male": "michael",
  "Pocket US Child": "alba",
  "Pocket UK Child": "anna"
};

let activeRequestId = 0;
let activeAbortController = null;
let creatingOffscreenDocument = null;
let fallbackQueue = Promise.resolve();
let fallbackGeneration = 0;
let supportedMappedVoicesCache = null;
let lastFallbackUtteranceMeta = null;
const pendingFallbackUtteranceKeys = new Set();

const VOICE_PROBE_TEXT = "Pocket voice probe.";
const FALLBACK_DUPLICATE_WINDOW_MS = 4000;

function emitDebugLog(message, detail = null) {
  const entry = {
    message,
    detail,
    timestamp: new Date().toISOString()
  };

  console.log("[Pocket TTS]", message, detail ?? "");
  chrome.runtime.sendMessage({ type: "debug.log", entry }, () => {
    void chrome.runtime.lastError;
  });
}

async function getConfiguredServerUrl() {
  const stored = await getStorageLocal([STORAGE_KEY]);
  return stored?.[STORAGE_KEY]?.serverUrl || DEFAULT_SERVER_URL;
}

async function getRuntimeConfig() {
  const stored = await getStorageLocal([STORAGE_KEY]);
  const runtimeSettings = stored?.[STORAGE_KEY] || {};
  return {
    serverUrl: runtimeSettings.serverUrl || DEFAULT_SERVER_URL,
    serverExePath: runtimeSettings.serverExePath || DEFAULT_SERVER_EXE_PATH,
    cliExePath: runtimeSettings.cliExePath || DEFAULT_CLI_EXE_PATH,
    serverConfigPath: runtimeSettings.serverConfigPath || DEFAULT_SERVER_CONFIG_PATH,
    pocketModelPath: !runtimeSettings.pocketModelPath || runtimeSettings.pocketModelPath === LEGACY_SHARED_POCKET_MODEL_PATH
      ? DEFAULT_POCKET_MODEL_PATH
      : runtimeSettings.pocketModelPath,
    pocketFamily: DEFAULT_POCKET_FAMILY,
    pocketBackend: DEFAULT_POCKET_BACKEND
  };
}

function getDefaultBuiltinVoiceLabels() {
  return Object.fromEntries(BUILTIN_VOICE_DEFINITIONS.map((voice) => [voice.key, voice.defaultName]));
}

function normalizeVoiceNameToken(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getBuiltinVoiceLabelsFromSettings(settingsObj = {}) {
  const storedLabels = settingsObj?.builtinVoiceLabels;
  const labels = getDefaultBuiltinVoiceLabels();
  if (!storedLabels || typeof storedLabels !== "object") {
    return labels;
  }

  for (const definition of BUILTIN_VOICE_DEFINITIONS) {
    const candidate = String(storedLabels[definition.key] || "").trim();
    if (candidate) {
      labels[definition.key] = candidate;
    }
  }

  return labels;
}

async function getBuiltinVoiceLabels() {
  const stored = await getStorageLocal([STORAGE_KEY]);
  return getBuiltinVoiceLabelsFromSettings(stored?.[STORAGE_KEY]);
}

function getBuiltinVoices(labels = getDefaultBuiltinVoiceLabels()) {
  return BUILTIN_VOICE_DEFINITIONS.map((voice) => ({
    voiceName: labels[voice.key] || voice.defaultName,
    lang: voice.lang,
    eventTypes: SUPPORTED_TTS_EVENT_TYPES
  }));
}

function getBuiltinVoiceName(voiceKey, labels = getDefaultBuiltinVoiceLabels()) {
  const definition = BUILTIN_VOICE_DEFINITIONS.find((voice) => voice.key === voiceKey);
  return labels[voiceKey] || definition?.defaultName || labels[DEFAULT_BUILTIN_VOICE_KEY];
}

function getBuiltinVoiceKeyFromName(voiceName, labels = getDefaultBuiltinVoiceLabels()) {
  const normalizedVoiceName = normalizeVoiceNameToken(voiceName);
  if (!normalizedVoiceName) {
    return "";
  }

  if (LEGACY_BUILTIN_VOICE_ALIASES[voiceName]) {
    return LEGACY_BUILTIN_VOICE_ALIASES[voiceName];
  }

  const matchedDefinition = BUILTIN_VOICE_DEFINITIONS.find((voice) => {
    const configuredName = labels[voice.key] || voice.defaultName;
    return normalizeVoiceNameToken(configuredName) === normalizedVoiceName
      || normalizeVoiceNameToken(voice.defaultName) === normalizedVoiceName;
  });
  return matchedDefinition?.key || "";
}

function getMappedVoiceIdByName(voiceName, labels = getDefaultBuiltinVoiceLabels()) {
  const voiceKey = getBuiltinVoiceKeyFromName(voiceName, labels);
  return voiceKey || DEFAULT_BUILTIN_VOICE_KEY;
}

function getUtterancePreview(utterance) {
  const normalized = String(utterance || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= 120) {
    return normalized;
  }
  return `${normalized.slice(0, 117)}...`;
}

function getNormalizedUtterance(utterance) {
  return String(utterance || "").replace(/\s+/g, " ").trim();
}

function buildFallbackUtteranceKey(utterance, options) {
  const normalizedUtterance = getNormalizedUtterance(utterance);
  const voiceName = String(options?.voiceName || "");
  const rate = clamp(options?.rate, 0.1, 10, 1);
  const pitch = clamp(options?.pitch, 0, 2, 1);
  const volume = clamp(options?.volume, 0, 1, 1);
  return JSON.stringify({
    normalizedUtterance,
    voiceName,
    rate,
    pitch,
    volume
  });
}

function shouldSuppressFallbackDuplicate(utterance, options) {
  const key = buildFallbackUtteranceKey(utterance, options);
  const now = Date.now();
  if (pendingFallbackUtteranceKeys.has(key)) {
    lastFallbackUtteranceMeta = {
      key,
      timestampMs: now
    };
    return { suppress: true, key, reason: "already-pending" };
  }

  const isDuplicate = !!lastFallbackUtteranceMeta
    && lastFallbackUtteranceMeta.key === key
    && (now - lastFallbackUtteranceMeta.timestampMs) <= FALLBACK_DUPLICATE_WINDOW_MS;

  lastFallbackUtteranceMeta = {
    key,
    timestampMs: now
  };

  return {
    suppress: isDuplicate,
    key,
    reason: isDuplicate ? "recent-duplicate" : ""
  };
}

function isNativeHostCommunicationError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /native messaging host/i.test(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitLongSegment(segment, maxLength) {
  const normalized = getNormalizedUtterance(segment);
  if (!normalized) {
    return [];
  }

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const parts = [];
  let remaining = normalized;
  while (remaining.length > maxLength) {
    let splitIndex = Math.max(
      remaining.lastIndexOf(". ", maxLength),
      remaining.lastIndexOf("? ", maxLength),
      remaining.lastIndexOf("! ", maxLength),
      remaining.lastIndexOf("; ", maxLength),
      remaining.lastIndexOf(", ", maxLength),
      remaining.lastIndexOf(": ", maxLength),
      remaining.lastIndexOf(" ", maxLength)
    );

    if (splitIndex < Math.floor(maxLength * 0.5)) {
      splitIndex = maxLength;
    } else {
      splitIndex += 1;
    }

    const chunk = remaining.slice(0, splitIndex).trim();
    if (chunk) {
      parts.push(chunk);
    }
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) {
    parts.push(remaining);
  }

  return parts;
}

function splitUtteranceForNativeSpeech(utterance, maxLength = 220) {
  const normalized = getNormalizedUtterance(utterance);
  if (!normalized) {
    return [];
  }

  const sentenceLikeSegments = normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (sentenceLikeSegments.length === 0) {
    return splitLongSegment(normalized, maxLength);
  }

  const chunks = [];
  let current = "";

  for (const segment of sentenceLikeSegments) {
    if (!current) {
      if (segment.length <= maxLength) {
        current = segment;
      } else {
        chunks.push(...splitLongSegment(segment, maxLength));
      }
      continue;
    }

    const candidate = `${current} ${segment}`.trim();
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }

    chunks.push(current);
    if (segment.length <= maxLength) {
      current = segment;
    } else {
      chunks.push(...splitLongSegment(segment, maxLength));
      current = "";
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function sendNativeCommand(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendNativeMessage(BRIDGE_HOST_NAME, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function getBridgeInstallCommand() {
  return "Run Pocket-tts-Companion Setup.exe again to install or repair the Companion Bridge.";
}

function clamp(value, min, max, fallback) {
  const numeric = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, numeric));
}

function arrayBufferToBase64(arrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function getStorageLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function setStorageLocal(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, resolve);
  });
}

function removeStorageLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function openCustomVoiceDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CUSTOM_VOICE_DB_NAME, CUSTOM_VOICE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CUSTOM_VOICE_STORE_NAME)) {
        db.createObjectStore(CUSTOM_VOICE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function buildCustomVoiceFilePath(id) {
  return `${CUSTOM_VOICE_FILE_PREFIX}${id}`;
}

function isCustomVoiceFilePath(value) {
  return String(value || "").startsWith(CUSTOM_VOICE_FILE_PREFIX);
}

function getCustomVoiceIdFromFilePath(value) {
  if (!isCustomVoiceFilePath(value)) {
    return "";
  }
  return String(value).slice(CUSTOM_VOICE_FILE_PREFIX.length);
}

async function listCustomVoices() {
  const db = await openCustomVoiceDatabase();
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_VOICE_STORE_NAME, "readonly");
    const request = tx.objectStore(CUSTOM_VOICE_STORE_NAME).getAll();
    request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return records.sort((left, right) => Number(left?.createdAt || 0) - Number(right?.createdAt || 0));
}

async function getCustomVoiceRecord(filePath) {
  const id = getCustomVoiceIdFromFilePath(filePath);
  if (!id) {
    return null;
  }

  const db = await openCustomVoiceDatabase();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_VOICE_STORE_NAME, "readonly");
    const request = tx.objectStore(CUSTOM_VOICE_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return record;
}

async function saveCustomVoiceRecord(record) {
  const db = await openCustomVoiceDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_VOICE_STORE_NAME, "readwrite");
    tx.objectStore(CUSTOM_VOICE_STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

function dataUrlToArrayBuffer(dataUrl) {
  const commaIndex = String(dataUrl).indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Invalid data URL.");
  }
  const base64 = String(dataUrl).slice(commaIndex + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function migrateLegacyCustomVoices() {
  const result = await getStorageLocal([CUSTOM_VOICES_STORAGE_KEY]);
  const legacyVoices = Array.isArray(result[CUSTOM_VOICES_STORAGE_KEY]) ? result[CUSTOM_VOICES_STORAGE_KEY] : [];
  if (legacyVoices.length === 0) {
    return;
  }

  const existingVoices = await listCustomVoices();
  const existingIds = new Set(existingVoices.map((voice) => voice.id));

  for (const legacyVoice of legacyVoices) {
    if (!legacyVoice?.id || existingIds.has(legacyVoice.id)) {
      continue;
    }

    await saveCustomVoiceRecord({
      id: legacyVoice.id,
      voiceName: legacyVoice.voiceName,
      lang: legacyVoice.lang || "en-US",
      baseVoiceName: legacyVoice.baseVoiceName || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY),
      fileName: legacyVoice.referenceSample?.name || "reference.wav",
      mimeType: legacyVoice.referenceSample?.type || "audio/wav",
      size: legacyVoice.referenceSample?.size || 0,
      arrayBuffer: dataUrlToArrayBuffer(legacyVoice.referenceSample?.dataUrl || ""),
      createdAt: legacyVoice.createdAt || Date.now(),
      filePath: buildCustomVoiceFilePath(legacyVoice.id),
      source: "custom"
    });
  }

  await removeStorageLocal([CUSTOM_VOICES_STORAGE_KEY]);
  emitDebugLog("Legacy custom voices migrated", {
    migratedCount: legacyVoices.length
  });
}

async function loadCustomVoices() {
  await migrateLegacyCustomVoices();
  const labels = await getBuiltinVoiceLabels();
  const customVoices = await listCustomVoices();
  return customVoices.map((voice) => ({
    id: voice.id,
    voiceName: voice.voiceName,
    lang: voice.lang || "en-US",
    baseVoiceName: voice.baseVoiceName || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, labels),
    filePath: voice.filePath || buildCustomVoiceFilePath(voice.id),
    fileName: voice.fileName || "reference.wav",
    mimeType: voice.mimeType || "audio/wav",
    size: voice.size || 0
  }));
}

async function refreshRegisteredVoices() {
  const labels = await getBuiltinVoiceLabels();
  const customVoices = await loadCustomVoices();
  const supportedMappedVoices = await getSupportedMappedVoices();
  const builtinVoices = getBuiltinVoices(labels).filter((voice) => supportedMappedVoices.has(getMappedVoiceIdByName(voice.voiceName, labels)));
  const registeredCustomVoices = customVoices.filter((voice) => supportedMappedVoices.has(getMappedVoiceIdByName(voice.baseVoiceName || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, labels), labels)));

  chrome.ttsEngine.updateVoices([
    ...builtinVoices,
    ...registeredCustomVoices.map((voice) => ({
      voiceName: voice.voiceName,
      lang: voice.lang || "en-US",
      eventTypes: SUPPORTED_TTS_EVENT_TYPES
    }))
  ]);
  emitDebugLog("Voices updated", {
    builtinCount: builtinVoices.length,
    customCount: registeredCustomVoices.length
  });
}

async function getSupportedMappedVoices() {
  if (supportedMappedVoicesCache) {
    return supportedMappedVoicesCache;
  }

  const mappedVoices = BUILTIN_VOICE_DEFINITIONS.map((voice) => voice.key);
  const supported = new Set(mappedVoices);

  supportedMappedVoicesCache = supported;
  emitDebugLog("Mapped voice support assumed for native runtime", {
    supported: [...supported],
    note: "Built-in Pocket voices are now synthesized through the native runtime."
  });
  return supportedMappedVoicesCache;
}

async function getVoiceProfile(voiceName) {
  const labels = await getBuiltinVoiceLabels();
  const builtinVoiceKey = getBuiltinVoiceKeyFromName(voiceName, labels);
  if (builtinVoiceKey) {
    const resolvedVoiceName = getBuiltinVoiceName(builtinVoiceKey, labels);
    return {
      type: "builtin",
      voiceName: resolvedVoiceName,
      mappedVoice: builtinVoiceKey
    };
  }

  const customVoices = await loadCustomVoices();
  const customVoice = customVoices.find((voice) => voice.voiceName === voiceName);
  if (customVoice) {
    return {
      type: "reference",
      voiceName: customVoice.voiceName,
      mappedVoice: getMappedVoiceIdByName(customVoice.baseVoiceName || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, labels), labels),
      filePath: customVoice.filePath || null,
      fileName: customVoice.fileName || "reference.wav",
      mimeType: customVoice.mimeType || "audio/wav"
    };
  }

  const fallbackVoiceName = getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, labels);
  return {
    type: "builtin",
    voiceName: fallbackVoiceName,
    mappedVoice: DEFAULT_BUILTIN_VOICE_KEY
  };
}

async function buildSpeechRequest(utterance, options) {
  const runtimeConfig = await getRuntimeConfig();
  const voiceProfile = await getVoiceProfile(options.voiceName);
  const cliRequest = {
    cliExePath: runtimeConfig.cliExePath,
    modelPath: runtimeConfig.pocketModelPath,
    backend: runtimeConfig.pocketBackend,
    family: runtimeConfig.pocketFamily,
    text: utterance,
    voiceId: voiceProfile.mappedVoice
  };

  if (voiceProfile.type !== "reference" || !voiceProfile.filePath) {
    return {
      mode: "native-cli",
      cliRequest,
      debug: {
        mode: "builtin",
        mappedVoice: voiceProfile.mappedVoice,
        synthesisPath: "native-bridge-cli"
      }
    };
  }

  const customVoice = await getCustomVoiceRecord(voiceProfile.filePath);
  if (!customVoice?.arrayBuffer) {
    throw new Error("Custom Pocket voice data was not found.");
  }

  return {
    mode: "native-cli",
    cliRequest: {
      ...cliRequest,
      voiceRefBase64: arrayBufferToBase64(customVoice.arrayBuffer),
      voiceRefFileName: customVoice.fileName || voiceProfile.fileName || "reference.wav"
    },
    debug: {
      mode: "reference",
      mappedVoice: voiceProfile.mappedVoice,
      referenceFile: customVoice.fileName || voiceProfile.fileName || "reference.wav",
      referenceBytes: customVoice.size || customVoice.arrayBuffer.byteLength || 0,
      synthesisPath: "native-bridge-cli"
    }
  };
}

async function requestNativeSpeech(cliRequest) {
  const message = {
    command: "synthesizeSpeech",
    cliExePath: cliRequest.cliExePath,
    modelPath: cliRequest.modelPath,
    backend: cliRequest.backend,
    family: cliRequest.family,
    text: cliRequest.text,
    voiceId: cliRequest.voiceId,
    voiceRefBase64: cliRequest.voiceRefBase64,
    voiceRefFileName: cliRequest.voiceRefFileName
  };

  let nativeResponse;
  try {
    nativeResponse = await sendNativeCommand(message);
  } catch (error) {
    if (!isNativeHostCommunicationError(error)) {
      throw error;
    }

    emitDebugLog("Native host communication issue during synthesis, retrying once", {
      voiceId: cliRequest.voiceId || "",
      textPreview: getUtterancePreview(cliRequest.text || "")
    });

    await sleep(150);
    nativeResponse = await sendNativeCommand(message);
  }

  if (!nativeResponse?.ok || !nativeResponse?.wavBase64) {
    throw new Error(nativeResponse?.error || "Native Pocket synthesis failed.");
  }

  return {
    wavData: base64ToArrayBuffer(nativeResponse.wavBase64),
    byteLength: nativeResponse?.byteLength || 0
  };
}

async function hasOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);

  if ("getContexts" in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
  }

  const matchedClients = await clients.matchAll();
  return matchedClients.some((client) => client.url === offscreenUrl);
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument(OFFSCREEN_DOCUMENT_PATH)) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["AUDIO_PLAYBACK", "BLOBS"],
      justification: "Play Pocket TTS audio for chrome.ttsEngine onSpeak requests."
    }).finally(() => {
      creatingOffscreenDocument = null;
    });
  }

  await creatingOffscreenDocument;
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

function readAscii(view, start, length) {
  let text = "";
  for (let i = 0; i < length; i += 1) {
    text += String.fromCharCode(view.getUint8(start + i));
  }
  return text;
}

function decodePcmSample(view, offset, bytesPerSample, audioFormat) {
  if (audioFormat === 3 && bytesPerSample === 4) {
    return view.getFloat32(offset, true);
  }

  if (audioFormat !== 1) {
    throw new Error(`Unsupported WAV audio format: ${audioFormat}`);
  }

  if (bytesPerSample === 1) {
    return (view.getUint8(offset) - 128) / 128;
  }

  if (bytesPerSample === 2) {
    return view.getInt16(offset, true) / 32768;
  }

  if (bytesPerSample === 3) {
    const byte0 = view.getUint8(offset);
    const byte1 = view.getUint8(offset + 1);
    const byte2 = view.getUint8(offset + 2);
    let value = byte0 | (byte1 << 8) | (byte2 << 16);
    if (value & 0x800000) {
      value |= ~0xffffff;
    }
    return value / 8388608;
  }

  if (bytesPerSample === 4) {
    return view.getInt32(offset, true) / 2147483648;
  }

  throw new Error(`Unsupported sample width: ${bytesPerSample * 8} bits`);
}

function decodeWavToMonoFloat32(arrayBuffer) {
  const view = new DataView(arrayBuffer);

  if (readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    throw new Error("Server returned an invalid WAV file.");
  }

  let offset = 12;
  let audioFormat = 0;
  let channelCount = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(chunkDataOffset, true);
      channelCount = view.getUint16(chunkDataOffset + 2, true);
      sampleRate = view.getUint32(chunkDataOffset + 4, true);
      bitsPerSample = view.getUint16(chunkDataOffset + 14, true);
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (!dataOffset || !sampleRate || !channelCount || !bitsPerSample) {
    throw new Error("WAV file is missing required audio metadata.");
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameSize = bytesPerSample * channelCount;
  const frameCount = Math.floor(dataSize / frameSize);
  const samples = new Float32Array(frameCount);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    let sum = 0;
    const frameOffset = dataOffset + (frameIndex * frameSize);

    for (let channel = 0; channel < channelCount; channel += 1) {
      sum += decodePcmSample(
        view,
        frameOffset + (channel * bytesPerSample),
        bytesPerSample,
        audioFormat
      );
    }

    samples[frameIndex] = Math.max(-1, Math.min(1, sum / channelCount));
  }

  return { sampleRate, samples };
}

function resampleLinear(samples, sourceRate, targetRate) {
  if (sourceRate === targetRate) {
    return samples;
  }

  const outputLength = Math.max(1, Math.round(samples.length * targetRate / sourceRate));
  const output = new Float32Array(outputLength);
  const ratio = sourceRate / targetRate;

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio;
    const indexFloor = Math.floor(sourceIndex);
    const indexCeil = Math.min(indexFloor + 1, samples.length - 1);
    const mix = sourceIndex - indexFloor;
    output[i] = samples[indexFloor] + ((samples[indexCeil] - samples[indexFloor]) * mix);
  }

  return output;
}

function applyVolume(samples, volume) {
  if (volume === 1) {
    return samples;
  }

  const scaled = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i += 1) {
    scaled[i] = Math.max(-1, Math.min(1, samples[i] * volume));
  }

  return scaled;
}

function sendAudioChunks(samples, audioStreamOptions, utteranceLength, sendTtsAudio) {
  const chunkSize = audioStreamOptions.bufferSize;
  let chunkCount = 0;

  for (let offset = 0; offset < samples.length; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, samples.length);
    const chunk = new Float32Array(chunkSize);
    chunk.set(samples.subarray(offset, end));

    const progress = end / samples.length;
    const charIndex = Math.min(utteranceLength, Math.floor(progress * utteranceLength));

    sendTtsAudio({
      audioBuffer: chunk.buffer,
      charIndex,
      isLastBuffer: end >= samples.length
    });
    chunkCount += 1;
  }

  emitDebugLog("Audio chunks sent", {
    chunkCount,
    chunkSize,
    sampleCount: samples.length,
    targetSampleRate: audioStreamOptions.sampleRate
  });
}

async function synthesizeSpeech(utterance, options, audioStreamOptions, sendTtsAudio) {
  activeRequestId += 1;
  const requestId = activeRequestId;
  const speechRequest = await buildSpeechRequest(utterance, options);

  emitDebugLog("Speech request received", {
    requestId,
    utteranceLength: utterance.length,
    voiceName: options.voiceName,
    ...speechRequest.debug,
    rate: options.rate,
    pitch: options.pitch,
    volume: options.volume,
    sampleRate: audioStreamOptions.sampleRate,
    bufferSize: audioStreamOptions.bufferSize
  });

  if (activeAbortController) {
    activeAbortController.abort();
  }

  activeAbortController = new AbortController();

  const { wavData, byteLength } = await requestNativeSpeech(speechRequest.cliRequest);
  emitDebugLog("Speech native synthesis completed", {
    requestId,
    ok: true,
    byteLength
  });

  emitDebugLog("WAV payload received", {
    requestId,
    byteLength: wavData.byteLength
  });

  if (requestId !== activeRequestId) {
    emitDebugLog("Speech request superseded", { requestId });
    return;
  }

  const decoded = decodeWavToMonoFloat32(wavData);
  emitDebugLog("WAV decoded", {
    requestId,
    sourceSampleRate: decoded.sampleRate,
    sampleCount: decoded.samples.length
  });

  const resampled = resampleLinear(
    decoded.samples,
    decoded.sampleRate,
    audioStreamOptions.sampleRate
  );
  emitDebugLog("Audio resampled", {
    requestId,
    targetSampleRate: audioStreamOptions.sampleRate,
    sampleCount: resampled.length
  });

  const finalSamples = applyVolume(
    resampled,
    clamp(options.volume, 0, 1, 1)
  );

  sendAudioChunks(finalSamples, audioStreamOptions, utterance.length, sendTtsAudio);
  emitDebugLog("Speech synthesis finished", { requestId });
}

async function synthesizeWavAudio(utterance, options) {
  const speechRequest = await buildSpeechRequest(utterance, options);

  emitDebugLog("Fallback speech request received", {
    utteranceLength: utterance.length,
    voiceName: options.voiceName,
    ...speechRequest.debug,
    rate: options.rate,
    pitch: options.pitch,
    volume: options.volume
  });

  const { wavData, byteLength } = await requestNativeSpeech(speechRequest.cliRequest);
  emitDebugLog("Fallback speech native synthesis completed", {
    ok: true,
    byteLength
  });

  return wavData;
}

async function fallbackSpeakListener(utterance, options, sendTtsEvent) {
  const enqueue = options.enqueue !== false;
  const utterancePreview = getUtterancePreview(utterance);
  const duplicateCheck = enqueue
    ? shouldSuppressFallbackDuplicate(utterance, options)
    : { suppress: false, key: "", reason: "" };

  emitDebugLog("onSpeak fallback invoked", {
    utteranceLength: utterance.length,
    utterancePreview,
    voiceName: options.voiceName,
    enqueue,
    note: "Using offscreen playback path."
  });

  if (enqueue && duplicateCheck.suppress) {
    emitDebugLog("Fallback duplicate utterance suppressed", {
      utteranceLength: utterance.length,
      utterancePreview,
      voiceName: options.voiceName,
      windowMs: FALLBACK_DUPLICATE_WINDOW_MS,
      reason: duplicateCheck.reason
    });

    sendTtsEvent({
      type: "start",
      charIndex: 0
    });
    sendTtsEvent({
      type: "end",
      charIndex: utterance.length
    });
    return;
  }

  if (!enqueue) {
    fallbackGeneration += 1;
    lastFallbackUtteranceMeta = null;
    pendingFallbackUtteranceKeys.clear();
    sendRuntimeMessage({ type: "offscreen.stopAudio" }).catch(() => {});
  }

  const requestGeneration = fallbackGeneration;
  const utteranceKey = duplicateCheck.key || buildFallbackUtteranceKey(utterance, options);
  pendingFallbackUtteranceKeys.add(utteranceKey);

  const task = async () => {
    try {
      if (requestGeneration !== fallbackGeneration && enqueue) {
        emitDebugLog("Fallback speech skipped", {
          utteranceLength: utterance.length,
          utterancePreview,
          reason: "queue invalidated before start"
        });
        return;
      }

      sendTtsEvent({
        type: "start",
        charIndex: 0
      });

      const utteranceChunks = splitUtteranceForNativeSpeech(utterance);
      if (utteranceChunks.length > 1) {
        emitDebugLog("Fallback utterance chunked for synthesis", {
          utteranceLength: utterance.length,
          chunkCount: utteranceChunks.length
        });
      }

      for (const utteranceChunk of utteranceChunks) {
        if (requestGeneration !== fallbackGeneration && enqueue) {
          emitDebugLog("Fallback speech skipped", {
            utteranceLength: utterance.length,
            utterancePreview,
            reason: "queue invalidated before chunk fetch"
          });
          return;
        }

        const wavBuffer = await synthesizeWavAudio(utteranceChunk, options);

        if (requestGeneration !== fallbackGeneration && enqueue) {
          emitDebugLog("Fallback speech skipped", {
            utteranceLength: utterance.length,
            utterancePreview,
            reason: "queue invalidated after fetch"
          });
          return;
        }

        await ensureOffscreenDocument();

        const playbackResponse = await sendRuntimeMessage({
          type: "offscreen.playAudio",
          wavBytes: Array.from(new Uint8Array(wavBuffer)),
          volume: clamp(options.volume, 0, 1, 1)
        });

        if (!playbackResponse?.ok) {
          throw new Error(playbackResponse?.error || "Offscreen audio playback failed.");
        }
      }

      emitDebugLog("Offscreen playback completed", {
        utterancePreview,
        chunkCount: utteranceChunks.length
      });

      sendTtsEvent({
        type: "end",
        charIndex: utterance.length
      });
    } catch (error) {
      emitDebugLog("Fallback speech failed", {
        utterancePreview,
        error: error instanceof Error ? error.message : String(error)
      });

      sendTtsEvent({
        type: "error",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
    } finally {
      pendingFallbackUtteranceKeys.delete(utteranceKey);
    }
  };

  fallbackQueue = fallbackQueue
    .catch(() => {})
    .then(task);

  return fallbackQueue;
}

chrome.ttsEngine.onSpeak.addListener(fallbackSpeakListener);

chrome.ttsEngine.onSpeakWithAudioStream.addListener(
  async (utterance, options, audioStreamOptions, sendTtsAudio, sendError) => {
    try {
      await synthesizeSpeech(
        utterance,
        options,
        audioStreamOptions,
        sendTtsAudio
      );
    } catch (error) {
      if (error?.name === "AbortError") {
        emitDebugLog("Speech aborted", { reason: "AbortError" });
        return;
      }

      console.error("Pocket TTS stream failed:", error);
      emitDebugLog("Speech stream failed", {
        error: error instanceof Error ? error.message : String(error)
      });
      sendError(error instanceof Error ? error.message : String(error));
    }
  }
);

chrome.ttsEngine.onStop.addListener(() => {
  activeRequestId += 1;
  fallbackGeneration += 1;
  fallbackQueue = Promise.resolve();
  lastFallbackUtteranceMeta = null;
  pendingFallbackUtteranceKeys.clear();
  emitDebugLog("TTS stop received", { activeRequestId });

  if (activeAbortController) {
    activeAbortController.abort();
    activeAbortController = null;
  }

  sendRuntimeMessage({ type: "offscreen.stopAudio" }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) {
    return false;
  }

  (async () => {
    switch (message.type) {
      case "bridge.installCommand":
        sendResponse({
          ok: true,
          command: getBridgeInstallCommand()
        });
        return;
      case "bridge.installOrUpdate": {
        const response = await sendNativeCommand({
          command: "installOrUpdateBridge",
          extensionId: message.extensionId || chrome.runtime.id
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.ping": {
        const response = await sendNativeCommand({ command: "ping" });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.getStatus": {
        const runtimeConfig = await getRuntimeConfig();
        const response = await sendNativeCommand({
          command: "getStatus",
          serverExePath: runtimeConfig.serverExePath,
          cliExePath: runtimeConfig.cliExePath,
          modelPath: runtimeConfig.pocketModelPath
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.openSetup": {
        const response = await sendNativeCommand({ command: "openSetup" });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.setModelDownloadSource": {
        const runtimeConfig = await getRuntimeConfig();
        const response = await sendNativeCommand({
          command: "setModelDownloadSource",
          cliExePath: runtimeConfig.cliExePath,
          modelPath: runtimeConfig.pocketModelPath,
          modelDownloadSource: message.modelDownloadSource || ""
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.downloadPocketModel": {
        const runtimeConfig = await getRuntimeConfig();
        const response = await sendNativeCommand({
          command: "downloadPocketModel",
          cliExePath: runtimeConfig.cliExePath,
          modelPath: runtimeConfig.pocketModelPath,
          modelDownloadSource: message.modelDownloadSource || "",
          installState: message.installState || "installed",
          progressPercent: Number.isFinite(message.progressPercent) ? message.progressPercent : null,
          message: message.message || "",
          lastError: message.lastError || ""
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.warmupRuntime": {
        const runtimeConfig = await getRuntimeConfig();
        const response = await sendNativeCommand({
          command: "warmupRuntime",
          serverExePath: runtimeConfig.serverExePath,
          cliExePath: runtimeConfig.cliExePath,
          modelPath: runtimeConfig.pocketModelPath,
          warmupState: message.warmupState || "ready"
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.verifyRegistration": {
        const response = await sendNativeCommand({
          command: "verifyRegistration",
          extensionId: message.extensionId || chrome.runtime.id
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.startServer": {
        const runtimeConfig = await getRuntimeConfig();
        const response = await sendNativeCommand({
          command: "startServer",
          serverExePath: message.serverExePath || runtimeConfig.serverExePath,
          serverConfigPath: message.serverConfigPath || runtimeConfig.serverConfigPath
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.validateRuntimePaths": {
        const runtimeConfig = await getRuntimeConfig();
        const response = await sendNativeCommand({
          command: "validateRuntimePaths",
          serverExePath: message.serverExePath || runtimeConfig.serverExePath,
          serverConfigPath: message.serverConfigPath || runtimeConfig.serverConfigPath,
          cliExePath: message.cliExePath || runtimeConfig.cliExePath,
          modelPath: message.modelPath || runtimeConfig.pocketModelPath
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "bridge.stopServer": {
        const runtimeConfig = await getRuntimeConfig();
        const response = await sendNativeCommand({
          command: "stopServer",
          serverExePath: message.serverExePath || runtimeConfig.serverExePath
        });
        sendResponse({ ok: true, response });
        return;
      }
      case "voices.refresh":
        await refreshRegisteredVoices();
        sendResponse({ ok: true });
        return;
      case "runtimePaths.updated":
        supportedMappedVoicesCache = null;
        sendResponse({ ok: true });
        return;
      default:
        sendResponse({
          ok: false,
          error: `Unsupported message type: ${message.type}`
        });
    }
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  });

  return true;
});

sendNativeCommand({ command: "ping" })
  .then((response) => console.log("Pocket TTS native runtime reachable:", response))
  .catch((error) => console.warn("Pocket TTS native runtime unavailable:", error.message));

refreshRegisteredVoices().catch((error) => {
  console.warn("Pocket TTS voice registration failed:", error.message);
});

console.log(`Pocket TTS extension loaded: ${chrome.runtime.id}`);
