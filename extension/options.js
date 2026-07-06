const DEFAULT_SERVER_URL = "http://127.0.0.1:53117";
const DEFAULT_RUNTIME_ROOT = "%LOCALAPPDATA%\\PocketTTSEngine\\runtime";
const DEFAULT_SERVER_EXE_PATH = `${DEFAULT_RUNTIME_ROOT}\\bin\\audiocpp_server.exe`;
const DEFAULT_CLI_EXE_PATH = `${DEFAULT_RUNTIME_ROOT}\\bin\\audiocpp_cli.exe`;
const DEFAULT_SERVER_CONFIG_PATH = `${DEFAULT_RUNTIME_ROOT}\\config\\server.json`;
const DEFAULT_POCKET_MODEL_PATH = "%LOCALAPPDATA%\\PocketTTS\\models\\pocket-tts";
const DEFAULT_MODEL_DOWNLOAD_SOURCE = "https://github.com/jjmlovesgit/pocket-tts-companion/releases/latest/download/pocket-tts-model-minimal.json";
const LEGACY_SHARED_POCKET_MODEL_PATH = "C:\\Projects\\audio.cpp\\models\\pocket-tts";
const STORAGE_KEY = "pocket-tts-settings";
const STABLE_EXTENSION_ID = "pifppankjbmkbikobmfmbogeokenkiig";
const CUSTOM_VOICES_STORAGE_KEY = "pocket-tts-custom-voices";
const CUSTOM_VOICE_DB_NAME = "pocket-tts-custom-voices-db";
const CUSTOM_VOICE_STORE_NAME = "voices";
const CUSTOM_VOICE_DB_VERSION = 1;
const CUSTOM_VOICE_FILE_PREFIX = "custom-voice:";
const DEFAULT_THEME = "light";
const VOICE_DISPLAY_NAME_STORAGE_KEY = "voiceDisplayLabels";

const statusDisplay = document.getElementById("statusDisplay");
const statusText = document.getElementById("statusText");
const progressBar = document.getElementById("progressBar");
const progressFill = document.getElementById("progressFill");
const serverUrlDisplay = document.getElementById("serverUrlDisplay");
const serverUrlInput = document.getElementById("serverUrlInput");
const serverExePathInput = document.getElementById("serverExePathInput");
const cliExePathInput = document.getElementById("cliExePathInput");
const serverConfigPathInput = document.getElementById("serverConfigPathInput");
const pocketModelPathInput = document.getElementById("pocketModelPathInput");
const runtimePathsStatus = document.getElementById("runtimePathsStatus");
const extensionIdDisplay = document.getElementById("extensionIdDisplay");
const modelStatusDisplay = document.getElementById("modelStatusDisplay");
const backendDisplay = document.getElementById("backendDisplay");
const bridgeStatusDisplay = document.getElementById("bridgeStatusDisplay");
const modelDownloadSourceDisplay = document.getElementById("modelDownloadSourceDisplay");
const modelInstallStateDisplay = document.getElementById("modelInstallStateDisplay");
const warmupStateDisplay = document.getElementById("warmupStateDisplay");
const downloadPhaseDisplay = document.getElementById("downloadPhaseDisplay");
const downloadProgressDisplay = document.getElementById("downloadProgressDisplay");
const companionConfigPathDisplay = document.getElementById("companionConfigPathDisplay");
const companionManifestPathDisplay = document.getElementById("companionManifestPathDisplay");
const downloadStatePathDisplay = document.getElementById("downloadStatePathDisplay");
const voiceList = document.getElementById("voiceList");
const defaultVoiceSelect = document.getElementById("defaultVoiceSelect");
const speedSlider = document.getElementById("speedSlider");
const speedDisplay = document.getElementById("speedDisplay");
const pitchSlider = document.getElementById("pitchSlider");
const pitchDisplay = document.getElementById("pitchDisplay");
const volumeSlider = document.getElementById("volumeSlider");
const volumeDisplay = document.getElementById("volumeDisplay");
const testVoiceSelect = document.getElementById("testVoiceSelect");
const testLocalOnlyCheckbox = document.getElementById("testLocalOnlyCheckbox");
const testText = document.getElementById("testText");
const testSpeakBtn = document.getElementById("testSpeakBtn");
const testStopBtn = document.getElementById("testStopBtn");
const testStatus = document.getElementById("testStatus");
const logArea = document.getElementById("logArea");
const clearLogBtn = document.getElementById("clearLogBtn");
const refreshLogBtn = document.getElementById("refreshLogBtn");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const installBridgeBtn = document.getElementById("installBridgeBtn");
const startServerBtn = document.getElementById("startServerBtn");
const saveRuntimePathsBtn = document.getElementById("saveRuntimePathsBtn");
const resetRuntimePathsBtn = document.getElementById("resetRuntimePathsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const bridgeExtensionIdInput = document.getElementById("bridgeExtensionIdInput");
const bridgeInstallerPanel = document.getElementById("bridgeInstallerPanel");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const modelDownloadSourceInput = document.getElementById("modelDownloadSourceInput");
const saveModelDownloadSourceBtn = document.getElementById("saveModelDownloadSourceBtn");
const modelDownloadSourceStatus = document.getElementById("modelDownloadSourceStatus");
const setModelInstallStateBtn = document.getElementById("setModelInstallStateBtn");
const resetModelInstallStateBtn = document.getElementById("resetModelInstallStateBtn");
const setWarmupStateBtn = document.getElementById("setWarmupStateBtn");
const resetWarmupStateBtn = document.getElementById("resetWarmupStateBtn");
const cloneNameInput = document.getElementById("cloneNameInput");
const cloneBaseVoiceSelect = document.getElementById("cloneBaseVoiceSelect");
const cloneWavInput = document.getElementById("cloneWavInput");
const cloneVoiceBtn = document.getElementById("cloneVoiceBtn");
const cloneStatus = document.getElementById("cloneStatus");
const cloneRegisteredList = document.getElementById("cloneRegisteredList");
const localOnlyVoicesCheckbox = document.getElementById("localOnlyVoicesCheckbox");
const voiceCountrySelect = document.getElementById("voiceCountrySelect");
const voiceSummary = document.getElementById("voiceSummary");
const builtinVoiceLabelsEditor = document.getElementById("builtinVoiceLabelsEditor");

let settings = {};
let isSpeaking = false;
let allDetectedVoices = [];
let runtimePathsSaveFeedbackTimer = null;
let companionSetupPollTimer = null;
let lastCompanionSetupPayload = null;
let companionWarmupAutoStartInFlight = false;
let companionWarmupResumeAttempted = false;
const editingVoiceKeys = new Set();
const SERVER_START_TIMEOUT_MS = 20000;
const SERVER_START_POLL_MS = 1000;

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

function sendBackgroundMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error("No response from background service worker."));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error || "Unknown background error."));
        return;
      }

      resolve(response);
    });
  });
}

function getNativeBridgePayload(response) {
  const payload = response?.response;
  if (!payload) {
    throw new Error("No native host response payload was returned.");
  }

  if (payload.ok !== true) {
    const message = payload.error || "Native host command failed.";
    if (/Unsupported command/i.test(message)) {
      throw new Error(`${message} Reinstall the native bridge to pick up the latest host version.`);
    }
    throw new Error(message);
  }

  return payload;
}

function formatRuntimePathLabel(label) {
  switch (label) {
    case "serverExePath":
      return "server exe";
    case "serverConfigPath":
      return "server config";
    case "cliExePath":
      return "cli exe";
    case "modelPath":
      return "model path";
    default:
      return label;
  }
}

async function validateRuntimePathsForLaunch() {
  addLog("Validating runtime paths...", "info");
  const response = await sendBackgroundMessage({ type: "bridge.validateRuntimePaths" });
  const payload = getNativeBridgePayload(response);
  const checks = Array.isArray(payload.checks) ? payload.checks : [];

  checks.forEach((check) => {
    const label = formatRuntimePathLabel(check.label);
    if (check.exists) {
      addLog(`OK ${label} found: ${check.path}`, "success");
      return;
    }

    addLog(`Missing ${label}: ${check.path}`, "error");
  });

  if (payload.ok !== true) {
    addLog("Start aborted because runtime path validation failed", "error");
    throw new Error(payload.error || "Runtime path validation failed.");
  }
}

function getStorageLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function getConfiguredServerUrl() {
  return settings.serverUrl || DEFAULT_SERVER_URL;
}

function getRuntimeOwnerLabel() {
  return "Companion-managed local runtime";
}

function getInternalTransportLabel(serverUrl = getConfiguredServerUrl()) {
  return `Internal transport: ${serverUrl}`;
}

function normalizePocketModelPath(value) {
  return !value || value === LEGACY_SHARED_POCKET_MODEL_PATH
    ? DEFAULT_POCKET_MODEL_PATH
    : value;
}

function getConfiguredRuntimePaths() {
  return {
    serverExePath: settings.serverExePath || DEFAULT_SERVER_EXE_PATH,
    cliExePath: settings.cliExePath || DEFAULT_CLI_EXE_PATH,
    serverConfigPath: settings.serverConfigPath || DEFAULT_SERVER_CONFIG_PATH,
    pocketModelPath: normalizePocketModelPath(settings.pocketModelPath)
  };
}

function describeRuntimePaths(runtimePaths) {
  return `Server EXE: ${runtimePaths.serverExePath} | CLI EXE: ${runtimePaths.cliExePath} | Config: ${runtimePaths.serverConfigPath} | Model: ${runtimePaths.pocketModelPath}`;
}

function getDefaultRuntimePaths() {
  return {
    serverExePath: DEFAULT_SERVER_EXE_PATH,
    cliExePath: DEFAULT_CLI_EXE_PATH,
    serverConfigPath: DEFAULT_SERVER_CONFIG_PATH,
    pocketModelPath: DEFAULT_POCKET_MODEL_PATH
  };
}

function removeStorageLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  });
}

function addLog(message, type = "info") {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === "error" ? "[error]" : type === "success" ? "[ok]" : "[info]";
  const className = type === "error" ? "log-error" : type === "success" ? "log-success" : "log-info";
  const line = document.createElement("div");
  line.className = className;
  line.textContent = `[${timestamp}] ${prefix} ${message}`;
  logArea.appendChild(line);
  logArea.scrollTop = logArea.scrollHeight;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "debug.log" || !message.entry) {
    return;
  }

  const detail = message.entry.detail ? ` ${JSON.stringify(message.entry.detail)}` : "";
  addLog(`[worker] ${message.entry.message}${detail}`, "info");
});

function setStatus(state, message) {
  statusDisplay.className = `status-row ${state}`;
  statusText.textContent = message;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function setLaunchProgress(active, message = "Waiting for local server to respond...") {
  progressBar.classList.toggle("active", active);
  progressFill.style.width = active ? "45%" : "0%";
  startServerBtn.disabled = active;
  if (active) {
    setStatus("loading", message);
  }
}

function setCloneStatus(message, type = "info") {
  cloneStatus.textContent = message;
  cloneStatus.style.color = type === "error"
    ? "var(--danger)"
    : type === "success"
      ? "var(--success)"
      : "var(--muted)";
}

function setRuntimePathsStatus(message, type = "info") {
  runtimePathsStatus.textContent = message;
  runtimePathsStatus.style.color = type === "error"
    ? "var(--danger)"
    : type === "success"
      ? "var(--success)"
      : "var(--muted)";
}

function setRuntimePathsButtonState(label, disabled = false) {
  saveRuntimePathsBtn.textContent = label;
  saveRuntimePathsBtn.disabled = disabled;
}

function setModelDownloadSourceStatus(message, type = "info") {
  modelDownloadSourceStatus.textContent = message;
  modelDownloadSourceStatus.style.color = type === "error"
    ? "var(--danger)"
    : type === "success"
      ? "var(--success)"
      : "var(--muted)";
}

function setBridgeUiState({
  bridgeInstalled,
  hostVersion = "",
  needsAttention = false
}) {
  if (bridgeInstalled && !needsAttention) {
    installBridgeBtn.style.display = "none";
    if (bridgeInstallerPanel) {
      bridgeInstallerPanel.style.display = "none";
    }
    return;
  }

  installBridgeBtn.style.display = "";
  installBridgeBtn.textContent = bridgeInstalled
    ? `Repair / Update Companion Bridge${hostVersion ? ` (${hostVersion})` : ""}`
    : "Install Companion Bridge";

  if (bridgeInstallerPanel) {
    bridgeInstallerPanel.style.display = "";
  }
}

function shouldPollCompanionSetup(payload) {
  const downloadPhase = payload?.downloadPhase || "";
  const downloadActive = payload?.modelInstallState === "downloading"
    || (downloadPhase && !["idle", "complete", "error"].includes(downloadPhase));
  return downloadActive || payload?.warmupState === "warming";
}

function stopCompanionSetupPolling() {
  if (!companionSetupPollTimer) {
    return;
  }

  clearInterval(companionSetupPollTimer);
  companionSetupPollTimer = null;
}

function startCompanionSetupPolling() {
  if (companionSetupPollTimer) {
    return;
  }

  companionSetupPollTimer = setInterval(() => {
    checkStatus({ silent: true }).catch((error) => {
      stopCompanionSetupPolling();
      addLog(`Companion setup polling stopped: ${error.message}`, "error");
    });
  }, 1500);
}

function syncCompanionSetupPolling(payload) {
  if (shouldPollCompanionSetup(payload)) {
    startCompanionSetupPolling();
    return;
  }

  stopCompanionSetupPolling();
}

function updateCompanionSetupControls(payload) {
  const sourceReady = !!(payload?.modelDownloadSource || DEFAULT_MODEL_DOWNLOAD_SOURCE);
  const modelInstalled = payload?.modelInstallState === "installed";
  const downloadActive = payload?.downloadPhase === "downloading";
  const warmupActive = payload?.warmupState === "warming";

  setModelInstallStateBtn.disabled = !sourceReady || downloadActive || warmupActive || modelInstalled;
  setModelInstallStateBtn.textContent = modelInstalled && !downloadActive
    ? "Model Already Installed"
    : "Start Model Download";
  resetModelInstallStateBtn.disabled = downloadActive;
  setWarmupStateBtn.disabled = !modelInstalled || downloadActive || warmupActive;
  resetWarmupStateBtn.disabled = downloadActive || warmupActive;
}

function hasCompanionSetupFields(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return [
    "modelDownloadSource",
    "modelInstallState",
    "downloadPhase",
    "downloadProgressPercent",
    "warmupState",
    "configPath",
    "modelManifestPath",
    "downloadStatePath"
  ].some((key) => Object.prototype.hasOwnProperty.call(payload, key));
}

function updateCompanionSetupDisplay(payload) {
  if (!payload) {
    updateCompanionSetupControls(lastCompanionSetupPayload);
    syncCompanionSetupPolling(lastCompanionSetupPayload);
    return;
  }

  const previousPayload = lastCompanionSetupPayload;
  const mergedPayload = hasCompanionSetupFields(payload) || !lastCompanionSetupPayload
    ? payload
    : { ...lastCompanionSetupPayload, ...payload };

  lastCompanionSetupPayload = mergedPayload;
  modelDownloadSourceDisplay.textContent = mergedPayload?.modelDownloadSource || DEFAULT_MODEL_DOWNLOAD_SOURCE;
  modelInstallStateDisplay.textContent = mergedPayload?.modelInstallState || "Unknown";
  warmupStateDisplay.textContent = mergedPayload?.warmupState || "Unknown";
  downloadPhaseDisplay.textContent = mergedPayload?.downloadPhase || "Unknown";
  downloadProgressDisplay.textContent = Number.isFinite(mergedPayload?.downloadProgressPercent)
    ? `${mergedPayload.downloadProgressPercent}%`
    : "Unknown";
  companionConfigPathDisplay.textContent = mergedPayload?.configPath || "Unknown";
  companionManifestPathDisplay.textContent = mergedPayload?.modelManifestPath || "Unknown";
  downloadStatePathDisplay.textContent = mergedPayload?.downloadStatePath || "Unknown";

  if (mergedPayload?.modelDownloadSource) {
    modelDownloadSourceInput.value = mergedPayload.modelDownloadSource;
    setModelDownloadSourceStatus("Hosted model manifest URL saved.", "success");
  } else {
    modelDownloadSourceInput.value = DEFAULT_MODEL_DOWNLOAD_SOURCE;
    setModelDownloadSourceStatus("Using the default GitHub Releases model manifest URL until you save a different one.", "info");
  }

  updateCompanionSetupControls(mergedPayload);
  syncCompanionSetupPolling(mergedPayload);
  maybeAutoStartWarmup(previousPayload, mergedPayload);
  maybeAutoResumeWarmup(mergedPayload);
}

function shouldAutoStartWarmup(previousPayload, currentPayload) {
  if (!currentPayload || companionWarmupAutoStartInFlight) {
    return false;
  }

  const modelInstalled = currentPayload.modelInstallState === "installed";
  const downloadComplete = currentPayload.downloadPhase === "complete";
  const warmupCold = !currentPayload.warmupState || currentPayload.warmupState === "cold";
  const sourceReady = !!(currentPayload.modelDownloadSource || DEFAULT_MODEL_DOWNLOAD_SOURCE);

  if (!modelInstalled || !downloadComplete || !warmupCold || !sourceReady) {
    return false;
  }

  if (!previousPayload) {
    return false;
  }

  const wasDownloading = previousPayload.modelInstallState === "downloading"
    || previousPayload.downloadPhase === "downloading";
  const justFinishedInstall = previousPayload.modelInstallState !== "installed"
    || previousPayload.downloadPhase !== "complete";

  return wasDownloading || justFinishedInstall;
}

function maybeAutoStartWarmup(previousPayload, currentPayload) {
  if (!shouldAutoStartWarmup(previousPayload, currentPayload)) {
    return;
  }

  companionWarmupAutoStartInFlight = true;
  addLog("Model download finished. Starting companion warmup automatically...", "info");

  setCompanionWarmupState("warming", { autoTriggered: true }).catch((error) => {
    if (/404|Not Found/i.test(error.message || "")) {
      addLog("Companion warmup is starting and runtime health is still settling. Rechecking shortly...", "info");
      checkStatus({ silent: true }).catch(() => {});
      return;
    }

    addLog(`Automatic companion warmup failed: ${error.message}`, "error");
  }).finally(() => {
    companionWarmupAutoStartInFlight = false;
  });
}

function shouldAutoResumeWarmup(currentPayload) {
  if (!currentPayload || companionWarmupAutoStartInFlight || companionWarmupResumeAttempted) {
    return false;
  }

  const modelInstalled = currentPayload.modelInstallState === "installed";
  const warmupCold = !currentPayload.warmupState || currentPayload.warmupState === "cold";
  const sourceReady = !!(currentPayload.modelDownloadSource || DEFAULT_MODEL_DOWNLOAD_SOURCE);

  return modelInstalled && warmupCold && sourceReady && !currentPayload.runtimeReady;
}

function maybeAutoResumeWarmup(currentPayload) {
  if (!shouldAutoResumeWarmup(currentPayload)) {
    return;
  }

  companionWarmupResumeAttempted = true;
  companionWarmupAutoStartInFlight = true;
  addLog("Pocket model is installed but the companion is cold. Starting warmup automatically...", "info");

  setCompanionWarmupState("warming", { autoTriggered: true }).catch((error) => {
    if (/404|Not Found/i.test(error.message || "")) {
      addLog("Companion warmup is starting and runtime health is still settling. Rechecking shortly...", "info");
      checkStatus({ silent: true }).catch(() => {});
      return;
    }

    addLog(`Automatic companion warmup restart failed: ${error.message}`, "error");
  }).finally(() => {
    companionWarmupAutoStartInFlight = false;
  });
}

function updateRuntimeDisplay(payload = null) {
  const runtimeReady = !!payload?.runtimeReady;
  const companionInstalled = payload?.companionInstalled !== false;
  const runtimeServerUrl = payload?.serverUrl || getConfiguredServerUrl();

  serverUrlDisplay.textContent = getRuntimeOwnerLabel();
  serverUrlInput.value = companionInstalled
    ? getInternalTransportLabel(runtimeServerUrl)
    : "Companion not installed yet";

  if (runtimeReady) {
    modelStatusDisplay.textContent = "Loaded";
    backendDisplay.textContent = "Companion native runtime";
    return;
  }

  if (payload) {
    modelStatusDisplay.textContent = "Missing";
    backendDisplay.textContent = "Companion native runtime";
    return;
  }

  modelStatusDisplay.textContent = "Unknown";
  backendDisplay.textContent = "Unknown";
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = normalizedTheme;
  themeToggleBtn.textContent = normalizedTheme === "dark" ? "Switch to Light" : "Switch to Dark";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getDefaultBuiltinVoiceLabels() {
  return Object.fromEntries(BUILTIN_VOICE_DEFINITIONS.map((voice) => [voice.key, voice.defaultName]));
}

function getBuiltinVoiceLabels(source = settings) {
  const defaults = getDefaultBuiltinVoiceLabels();
  const configured = source?.builtinVoiceLabels && typeof source.builtinVoiceLabels === "object"
    ? source.builtinVoiceLabels
    : {};

  return BUILTIN_VOICE_DEFINITIONS.reduce((result, voice) => {
    const configuredValue = String(configured[voice.key] || "").trim();
    result[voice.key] = configuredValue || defaults[voice.key];
    return result;
  }, {});
}

function getBuiltinVoices(source = settings) {
  const labels = getBuiltinVoiceLabels(source);
  return BUILTIN_VOICE_DEFINITIONS.map((voice) => ({
    ...voice,
    voiceName: labels[voice.key]
  }));
}

function getBuiltinVoiceName(voiceKey, source = settings) {
  const matchedVoice = getBuiltinVoices(source).find((voice) => voice.key === voiceKey);
  return matchedVoice?.voiceName || getDefaultBuiltinVoiceLabels()[voiceKey] || getDefaultBuiltinVoiceLabels()[DEFAULT_BUILTIN_VOICE_KEY];
}

function getBuiltinVoiceKeyFromName(voiceName, source = settings) {
  const normalizedVoiceName = normalizeVoiceNameToken(voiceName);
  if (!normalizedVoiceName) {
    return "";
  }

  const matchedVoice = getBuiltinVoices(source).find((voice) => {
    const normalizedCandidate = normalizeVoiceNameToken(voice.voiceName);
    return normalizedVoiceName === normalizedCandidate
      || normalizedVoiceName.startsWith(`${normalizedCandidate} (`)
      || normalizedVoiceName.startsWith(`${normalizedCandidate} -`)
      || normalizedVoiceName.includes(`${normalizedCandidate} `);
  });
  if (matchedVoice) {
    return matchedVoice.key;
  }

  return LEGACY_BUILTIN_VOICE_ALIASES[voiceName] || "";
}

function renderBuiltinVoiceLabelEditor() {
  if (!builtinVoiceLabelsEditor) {
    return;
  }

  const labels = getBuiltinVoiceLabels();
  builtinVoiceLabelsEditor.innerHTML = BUILTIN_VOICE_DEFINITIONS.map((voice) => `
    <div>
      <label for="builtinVoiceLabel-${escapeHtml(voice.key)}" class="field-label" style="display:block; margin-bottom:6px;">${escapeHtml(voice.defaultName)}</label>
      <input id="builtinVoiceLabel-${escapeHtml(voice.key)}" data-voice-key="${escapeHtml(voice.key)}" type="text" value="${escapeHtml(labels[voice.key])}">
    </div>
  `).join("");
}

function collectBuiltinVoiceLabelsFromEditor() {
  const defaults = getDefaultBuiltinVoiceLabels();
  const labels = {};

  BUILTIN_VOICE_DEFINITIONS.forEach((voice) => {
    const input = builtinVoiceLabelsEditor?.querySelector(`[data-voice-key="${voice.key}"]`);
    const configuredValue = String(input?.value || "").trim();
    labels[voice.key] = configuredValue || defaults[voice.key];
  });

  return labels;
}

function getVoiceStorageKey(voice) {
  if (typeof voice === "string") {
    return `${voice}::`;
  }

  const voiceName = String(voice?.voiceName || "").trim();
  const voiceLang = String(voice?.lang || "").trim();
  return `${voiceName}::${voiceLang}`;
}

function getVoiceDisplayLabels(source = settings) {
  const configured = source?.[VOICE_DISPLAY_NAME_STORAGE_KEY];
  if (!configured || typeof configured !== "object") {
    return {};
  }

  return Object.entries(configured).reduce((result, [key, value]) => {
    const configuredValue = String(value || "").trim();
    if (configuredValue) {
      result[key] = configuredValue;
    }
    return result;
  }, {});
}

function getVoiceDisplayName(voice, source = settings) {
  const voiceName = typeof voice === "string" ? voice : voice?.voiceName || "";
  const builtinVoiceKey = getBuiltinVoiceKeyFromName(voiceName, source);
  if (builtinVoiceKey) {
    return getBuiltinVoiceName(builtinVoiceKey, source);
  }

  return getVoiceDisplayLabels(source)[getVoiceStorageKey(voice)] || voiceName;
}

function isVoiceEditing(storageKey) {
  return editingVoiceKeys.has(storageKey);
}

function startVoiceEditing(storageKey) {
  if (!storageKey) {
    return;
  }

  editingVoiceKeys.add(storageKey);
  renderAvailableVoices();
}

function stopVoiceEditing(storageKey) {
  if (!storageKey) {
    return;
  }

  editingVoiceKeys.delete(storageKey);
  renderAvailableVoices();
}

function setVoiceDisplayName(voice, nextLabel) {
  const voiceName = typeof voice === "string" ? voice : voice?.voiceName || "";
  if (!voiceName) {
    return { builtinChanged: false };
  }

  const trimmedLabel = String(nextLabel || "").trim();
  const builtinVoiceKey = getBuiltinVoiceKeyFromName(voiceName, settings);
  if (builtinVoiceKey) {
    const nextBuiltinLabels = getBuiltinVoiceLabels(settings);
    const fallbackLabel = BUILTIN_VOICE_DEFINITIONS.find((entry) => entry.key === builtinVoiceKey)?.defaultName || voiceName;
    nextBuiltinLabels[builtinVoiceKey] = trimmedLabel || fallbackLabel;
    settings.builtinVoiceLabels = nextBuiltinLabels;
    renderBuiltinVoiceLabelEditor();
    return { builtinChanged: true };
  }

  const nextDisplayLabels = getVoiceDisplayLabels(settings);
  const storageKey = getVoiceStorageKey(voice);
  if (!trimmedLabel || trimmedLabel === voiceName) {
    delete nextDisplayLabels[storageKey];
  } else {
    nextDisplayLabels[storageKey] = trimmedLabel;
  }
  settings[VOICE_DISPLAY_NAME_STORAGE_KEY] = nextDisplayLabels;
  return { builtinChanged: false };
}

function findDetectedVoiceByStorageKey(storageKey) {
  return allDetectedVoices.find((voice) => getVoiceStorageKey(voice) === storageKey) || null;
}

function getDetectedPocketVoices() {
  const pocketVoices = [];
  const seenVoiceNames = new Set();

  allDetectedVoices.forEach((voice) => {
    const rawVoiceName = typeof voice === "string" ? voice : voice?.voiceName || "";
    if (!rawVoiceName.startsWith("Pocket")) {
      return;
    }

    const voiceName = getCanonicalPocketVoiceName(rawVoiceName);
    if (!voiceName || seenVoiceNames.has(voiceName)) {
      return;
    }

    seenVoiceNames.add(voiceName);
    pocketVoices.push({
      ...(typeof voice === "string" ? { lang: "" } : voice),
      voiceName
    });
  });

  return pocketVoices;
}

async function persistVoiceDisplayName(storageKey, nextLabel) {
  const voice = findDetectedVoiceByStorageKey(storageKey);
  if (!voice) {
    return;
  }

  const { builtinChanged } = setVoiceDisplayName(voice, nextLabel);
  chrome.storage.local.set({ [STORAGE_KEY]: settings });

  if (builtinChanged) {
    try {
      await sendBackgroundMessage({ type: "voices.refresh" });
      await loadVoices();
      editingVoiceKeys.delete(storageKey);
      return;
    } catch (error) {
      addLog(`Voice refresh failed: ${error.message}`, "error");
    }
  }

  const pocketVoices = getDetectedPocketVoices();
  editingVoiceKeys.delete(storageKey);
  renderAvailableVoices();
  renderVoiceSelectOptions(defaultVoiceSelect, pocketVoices.length > 0 ? pocketVoices : getBuiltinVoices());
  renderTestVoiceOptions(settings.defaultVoice);
  renderBaseVoiceOptions((pocketVoices.length > 0 ? pocketVoices : getBuiltinVoices()).filter((voice) => !String(typeof voice === "string" ? voice : voice?.voiceName || "").startsWith("Pocket Clone - ")));
  renderCustomVoiceList();
}

function getBackendVoiceId(voiceName) {
  const builtinVoiceKey = getBuiltinVoiceKeyFromName(voiceName);
  if (builtinVoiceKey) {
    return builtinVoiceKey;
  }

  if (voiceName.startsWith("Pocket Clone - ")) {
    return `ref:${voiceName.slice("Pocket Clone - ".length)}`;
  }

  return "unknown";
}

function getBackendVoiceDisplayLabel(voiceName) {
  if (voiceName.startsWith("Pocket Clone - ")) {
    return "Custom";
  }

  if (getBuiltinVoiceKeyFromName(voiceName)) {
    return "";
  }

  return "Browser";
}

function formatVoiceLabel(voiceName) {
  const label = getBackendVoiceDisplayLabel(voiceName);
  return label ? `${voiceName} (${label})` : voiceName;
}

function isPocketVoiceName(voiceName) {
  const normalizedVoiceName = normalizeVoiceNameToken(voiceName);
  return normalizedVoiceName.startsWith("pocket clone -") || !!getBuiltinVoiceKeyFromName(voiceName);
}

function normalizeVoiceNameToken(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function getCanonicalPocketVoiceName(voiceName) {
  const normalizedVoiceName = normalizeVoiceNameToken(voiceName);
  if (!normalizedVoiceName) {
    return "";
  }

  if (normalizedVoiceName.startsWith("pocket clone - ")) {
    return String(voiceName || "").trim();
  }

  const builtinVoiceKey = getBuiltinVoiceKeyFromName(voiceName);
  if (builtinVoiceKey) {
    return getBuiltinVoiceName(builtinVoiceKey);
  }

  return String(voiceName || "").trim();
}

function classifyVoice(voice) {
  const voiceName = typeof voice === "string" ? voice : voice?.voiceName || "";

  if (voiceName.startsWith("Pocket Clone - ")) {
    return {
      kind: "local-reference",
      badge: "Local Custom",
      detail: "Saved custom voice using native bridge + audiocpp_cli",
      tooltip: "This voice stays local. Text and audio are processed on this device using the native bridge and audiocpp_cli with your saved custom voice WAV.",
      isLocal: true
    };
  }

  if (getBuiltinVoiceKeyFromName(voiceName)) {
    return {
      kind: "local-runtime",
      badge: "Local Runtime",
      detail: "Built-in Pocket voice synthesized by the local Pocket runtime",
      tooltip: "This voice stays local. Text and audio are processed by the native Pocket runtime on this device and are not sent to a cloud TTS API by this extension.",
      isLocal: true
    };
  }

  return {
    kind: "remote-browser",
    badge: "Remote Browser",
    detail: "Non-Pocket browser voice from another engine or provider",
    tooltip: "This is not one of the Pocket local voices. Another browser engine or provider may handle synthesis, so local-only processing is not guaranteed.",
    isLocal: false
  };
}

function getVoiceCountryCode(voice) {
  const source = classifyVoice(voice);
  if (source.kind === "local-reference") {
    return "";
  }

  const voiceLang = typeof voice === "string" ? "" : String(voice?.lang || "").trim();
  if (!voiceLang) {
    return "";
  }

  const segments = voiceLang.split(/[-_]/).filter(Boolean);
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const segment = segments[index];
    if (/^[A-Za-z]{2}$/.test(segment)) {
      return segment.toUpperCase();
    }
  }

  return "";
}

function getCountryLabel(countryCode) {
  if (!countryCode) {
    return "No country";
  }

  try {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
      const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
      const label = displayNames.of(countryCode);
      if (label) {
        return label;
      }
    }
  } catch (error) {
    // Fall through to raw code.
  }

  return countryCode;
}

function renderVoiceCountryOptions() {
  const currentValue = voiceCountrySelect?.value || "";
  const countryMap = new Map();

  allDetectedVoices.forEach((voice) => {
    const countryCode = getVoiceCountryCode(voice);
    if (!countryCode) {
      return;
    }

    if (!countryMap.has(countryCode)) {
      countryMap.set(countryCode, getCountryLabel(countryCode));
    }
  });

  const sortedCountries = Array.from(countryMap.entries()).sort((left, right) => left[1].localeCompare(right[1]));
  voiceCountrySelect.innerHTML = [
    `<option value="">All countries</option>`,
    ...sortedCountries.map(([countryCode, countryLabel]) => (
      `<option value="${escapeHtml(countryCode)}">${escapeHtml(countryLabel)} (${escapeHtml(countryCode)})</option>`
    ))
  ].join("");

  if (currentValue && voiceCountrySelect.querySelector(`option[value="${currentValue}"]`)) {
    voiceCountrySelect.value = currentValue;
    return;
  }

  voiceCountrySelect.value = "";
}

function renderAvailableVoices() {
  const onlyLocal = !!localOnlyVoicesCheckbox?.checked;
  const selectedCountry = voiceCountrySelect?.value || "";
  const visibleVoices = allDetectedVoices.filter((voice) => {
    const source = classifyVoice(voice);

    if (onlyLocal && !source.isLocal) {
      return false;
    }

    if (!selectedCountry) {
      return true;
    }

    if (source.kind === "local-reference") {
      return true;
    }

    return getVoiceCountryCode(voice) === selectedCountry;
  });

  const localCount = allDetectedVoices.filter((voice) => classifyVoice(voice).isLocal).length;
  const remoteCount = allDetectedVoices.length - localCount;
  voiceSummary.textContent = `${visibleVoices.length} shown • ${localCount} local • ${remoteCount} remote`;

  if (visibleVoices.length === 0) {
    voiceList.innerHTML = `<div class="field-note">No voices match the current filter.</div>`;
    return;
  }

  voiceList.innerHTML = visibleVoices.map((voice) => {
    const voiceName = typeof voice === "string" ? voice : voice.voiceName;
    const voiceLang = typeof voice === "string" ? "n/a" : (voice.lang || "n/a");
    const displayName = getVoiceDisplayName(voice);
    const source = classifyVoice(voice);
    const itemClass = source.isLocal ? "voice-item" : "voice-item remote";
    const badgeClass = source.kind === "local-reference"
      ? "voice-badge reference"
      : source.isLocal
        ? "voice-badge"
        : "voice-badge remote";
    const storageKey = getVoiceStorageKey(voice);
    const isEditing = isVoiceEditing(storageKey);

    return `
      <div class="${itemClass}">
        <div class="voice-item-body">
          <span class="check" aria-hidden="true"></span>
          <div class="voice-name-row">
            <span>${escapeHtml(formatVoiceLabel(displayName))}</span>
            <span class="${badgeClass}" title="${escapeHtml(source.tooltip)}">${escapeHtml(source.badge)}</span>
            <div class="voice-name-actions">
              <button type="button" class="voice-edit-btn" data-voice-edit="${escapeHtml(storageKey)}" title="Edit voice display name" aria-label="Edit voice display name">&#9998;</button>
            </div>
          </div>
          <div class="voice-meta">
          ${isEditing ? `
            <div class="voice-edit-row">
              <input type="text" class="voice-display-name-input" data-voice-key="${escapeHtml(storageKey)}" value="${escapeHtml(displayName)}" placeholder="${escapeHtml(voiceName)}">
              <button type="button" class="voice-edit-save-btn" data-voice-save="${escapeHtml(storageKey)}">Save</button>
              <button type="button" class="voice-edit-cancel-btn" data-voice-cancel="${escapeHtml(storageKey)}">Cancel</button>
            </div>
          ` : ""}
          <div class="voice-detail">${escapeHtml(source.detail)} • ${escapeHtml(voiceLang)}</div>
        </div>
        </div>
      </div>
    `;
  }).join("");
}

async function logRuntimeSummary() {
  try {
    const customVoices = await getCustomVoices();
    const runtimePaths = getConfiguredRuntimePaths();
    addLog("Runtime: built-in Pocket voices use the native Pocket runtime", "info");
    addLog("Runtime: custom Pocket voices use the native bridge + audiocpp_cli with --voice-ref", "info");
    addLog(`Runtime: cli exe ${runtimePaths.cliExePath}`, "info");
    addLog(`Runtime: model path ${runtimePaths.pocketModelPath}`, "info");
    addLog(`Runtime: ${customVoices.length} custom voice${customVoices.length === 1 ? "" : "s"} saved locally`, "info");
  } catch (error) {
    addLog(`Runtime summary unavailable: ${error.message}`, "error");
  }
}

function renderVoiceSelectOptions(selectElement, voices) {
  const seenVoiceNames = new Set();
  const uniqueVoices = voices.filter((voice) => {
    const voiceName = typeof voice === "string" ? voice : voice?.voiceName || "";
    if (!voiceName || seenVoiceNames.has(voiceName)) {
      return false;
    }

    seenVoiceNames.add(voiceName);
    return true;
  });

  selectElement.innerHTML = uniqueVoices.map((voice) => {
    const voiceName = typeof voice === "string" ? voice : voice.voiceName;
    return `<option value="${escapeHtml(voiceName)}">${escapeHtml(formatVoiceLabel(getVoiceDisplayName(voice)))}</option>`;
  }).join("");
}

function getFilteredTestVoices() {
  const testVoices = allDetectedVoices.length > 0
    ? allDetectedVoices
    : getBuiltinVoices().map((voice) => ({ voiceName: voice.voiceName, lang: voice.lang }));

  if (testLocalOnlyCheckbox?.checked) {
    return testVoices.filter((voice) => classifyVoice(voice).isLocal);
  }

  return testVoices;
}

function renderTestVoiceOptions(preferredVoiceName) {
  const currentValue = preferredVoiceName || testVoiceSelect.value || settings.defaultVoice || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY);
  const filteredVoices = getFilteredTestVoices();

  renderVoiceSelectOptions(testVoiceSelect, filteredVoices);

  if (testVoiceSelect.querySelector(`option[value="${currentValue}"]`)) {
    testVoiceSelect.value = currentValue;
    return;
  }

  if (settings.defaultVoice && testVoiceSelect.querySelector(`option[value="${settings.defaultVoice}"]`)) {
    testVoiceSelect.value = settings.defaultVoice;
    return;
  }

  if (filteredVoices[0]) {
    testVoiceSelect.value = typeof filteredVoices[0] === "string" ? filteredVoices[0] : filteredVoices[0].voiceName;
  }
}

async function checkStatus({ silent = false } = {}) {
  setStatus("loading", "Checking Pocket runtime...");
  if (!silent) {
    addLog("Checking Pocket runtime status...");
  }

  try {
    const response = await sendBackgroundMessage({ type: "bridge.getStatus" });
    const payload = getNativeBridgePayload(response);
    updateCompanionSetupDisplay(payload);
    updateRuntimeDisplay(payload);

    if (!silent && payload?.serverUrl) {
      addLog(`Runtime transport: ${payload.serverUrl}`, "info");
    }

    if (payload.runtimeReady) {
      setStatus("ready", "Pocket runtime ready");
      if (!silent) {
        if (payload.message) {
          addLog(payload.message, "success");
        }
      }
      if (!silent) {
        await verifyBridgeRegistration();
        addLog("Pocket runtime ready", "success");
      }
      return true;
    }

    if (payload.status === "warming_up" || payload.warmupState === "warming") {
      setStatus("loading", "Pocket runtime starting...");
      if (!silent) {
        addLog(payload.runtimeError || payload.message || "Pocket runtime startup is still in progress.", "info");
      }
      if (!silent) {
        await verifyBridgeRegistration();
      }
      return false;
    }

    setStatus("error", "Pocket runtime needs setup");
    if (!silent) {
      addLog(payload.runtimeError || payload.message || "Pocket runtime setup is incomplete.", "error");
    }
    if (!silent) {
      await verifyBridgeRegistration();
    }
    return false;
  } catch (error) {
    setStatus("error", "Pocket runtime unavailable");
    updateRuntimeDisplay(null);
    modelStatusDisplay.textContent = "Not connected";
    backendDisplay.textContent = "Companion unavailable";
    if (!silent) {
      addLog(`Pocket runtime not reachable: ${error.message}`, "error");
    }
    if (!silent) {
      await verifyBridgeRegistration();
    }
    return false;
  }
}

async function waitForServerHealthy(timeoutMs = SERVER_START_TIMEOUT_MS) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    const healthy = await checkStatus();
    if (healthy) {
      return true;
    }
    await sleep(SERVER_START_POLL_MS);
  }
  return false;
}

function renderBaseVoiceOptions(voices) {
  const normalizedVoices = voices.map((voice) => typeof voice === "string" ? { voiceName: voice } : voice);
  const currentValue = cloneBaseVoiceSelect.value;

  cloneBaseVoiceSelect.innerHTML = normalizedVoices.map((voice) => `
    <option value="${escapeHtml(voice.voiceName)}">${escapeHtml(formatVoiceLabel(voice.voiceName))}</option>
  `).join("");

  if (currentValue && cloneBaseVoiceSelect.querySelector(`option[value="${currentValue}"]`)) {
  cloneBaseVoiceSelect.value = currentValue;
  return;
  }

  cloneBaseVoiceSelect.value = getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY);
}

async function loadVoices() {
  try {
    const voices = await new Promise((resolve) => {
      chrome.tts.getVoices(resolve);
    });

    const sortedVoices = Array.isArray(voices) ? voices.slice().sort((left, right) => {
      const leftName = left?.voiceName || "";
      const rightName = right?.voiceName || "";
      return leftName.localeCompare(rightName);
    }) : [];

    const uniqueVoices = [];
    const seenVoiceKeys = new Set();
    const pocketVoices = [];
    const seenPocketVoiceNames = new Set();
    let duplicatePocketVoiceCount = 0;

    sortedVoices.forEach((voice) => {
      const rawVoiceName = voice?.voiceName || "";
      const voiceName = rawVoiceName.startsWith("Pocket")
        ? getCanonicalPocketVoiceName(rawVoiceName)
        : rawVoiceName;
      const voiceLang = voice?.lang || "";
      const voiceKey = `${voiceName}::${voiceLang}`;

      if (!voiceName) {
        return;
      }

      if (!seenVoiceKeys.has(voiceKey)) {
        seenVoiceKeys.add(voiceKey);
        uniqueVoices.push(voice);
      }

      if (!rawVoiceName || !rawVoiceName.startsWith("Pocket")) {
        return;
      }

      if (seenPocketVoiceNames.has(voiceName)) {
        duplicatePocketVoiceCount += 1;
        return;
      }

      seenPocketVoiceNames.add(voiceName);
      pocketVoices.push({
        ...voice,
        voiceName
      });
    });

    allDetectedVoices = uniqueVoices;
    renderVoiceCountryOptions();

    if (pocketVoices.length === 0) {
      allDetectedVoices = getBuiltinVoices().map((voice) => ({ voiceName: voice.voiceName, lang: voice.lang }));
      renderVoiceCountryOptions();
      renderAvailableVoices();
      renderVoiceSelectOptions(defaultVoiceSelect, getBuiltinVoices());
      renderTestVoiceOptions(settings.defaultVoice);
      renderBaseVoiceOptions(getBuiltinVoices());
      if (settings.defaultVoice && testVoiceSelect.querySelector(`option[value="${settings.defaultVoice}"]`)) {
        testVoiceSelect.value = settings.defaultVoice;
      }
      addLog("No Pocket voices found", "error");
      return;
    }

    renderAvailableVoices();

    renderVoiceSelectOptions(defaultVoiceSelect, pocketVoices);
    renderTestVoiceOptions(settings.defaultVoice);

    renderBaseVoiceOptions(pocketVoices.filter((voice) => !voice.voiceName.startsWith("Pocket Clone - ")));
    if (settings.defaultVoice && defaultVoiceSelect.querySelector(`option[value="${settings.defaultVoice}"]`)) {
      defaultVoiceSelect.value = settings.defaultVoice;
    }
    if (settings.defaultVoice && testVoiceSelect.querySelector(`option[value="${settings.defaultVoice}"]`)) {
      testVoiceSelect.value = settings.defaultVoice;
    }
    addLog(`Loaded ${pocketVoices.length} Pocket voices`, "success");
    if (duplicatePocketVoiceCount > 0) {
      addLog(`Ignored ${duplicatePocketVoiceCount} duplicate Pocket voice registration${duplicatePocketVoiceCount === 1 ? "" : "s"}`, "info");
    }
  } catch (error) {
    allDetectedVoices = getBuiltinVoices().map((voice) => ({ voiceName: voice.voiceName, lang: voice.lang }));
    renderVoiceCountryOptions();
    renderAvailableVoices();
    renderTestVoiceOptions(settings.defaultVoice);
    renderBaseVoiceOptions(getBuiltinVoices());
    addLog(`Failed to load voices: ${error.message}`, "error");
  }
}

function loadSettings() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    settings = result[STORAGE_KEY] || {
      defaultVoice: getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, { builtinVoiceLabels: getDefaultBuiltinVoiceLabels() }),
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      theme: DEFAULT_THEME,
      serverUrl: DEFAULT_SERVER_URL,
      serverExePath: DEFAULT_SERVER_EXE_PATH,
      cliExePath: DEFAULT_CLI_EXE_PATH,
      serverConfigPath: DEFAULT_SERVER_CONFIG_PATH,
      pocketModelPath: DEFAULT_POCKET_MODEL_PATH
    };

    settings.serverUrl = settings.serverUrl || DEFAULT_SERVER_URL;
    settings.serverExePath = settings.serverExePath || DEFAULT_SERVER_EXE_PATH;
    settings.cliExePath = settings.cliExePath || DEFAULT_CLI_EXE_PATH;
    settings.serverConfigPath = settings.serverConfigPath || DEFAULT_SERVER_CONFIG_PATH;
    settings.pocketModelPath = normalizePocketModelPath(settings.pocketModelPath);
    settings.builtinVoiceLabels = getBuiltinVoiceLabels(settings);
    settings[VOICE_DISPLAY_NAME_STORAGE_KEY] = getVoiceDisplayLabels(settings);
    settings.defaultVoice = getCanonicalPocketVoiceName(settings.defaultVoice) || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, settings);

    renderBuiltinVoiceLabelEditor();
    defaultVoiceSelect.value = settings.defaultVoice || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, settings);
    testVoiceSelect.value = settings.defaultVoice || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, settings);
    speedSlider.value = settings.speed || 1.0;
    speedDisplay.textContent = `${(settings.speed || 1.0).toFixed(1)}x`;
    pitchSlider.value = settings.pitch || 1.0;
    pitchDisplay.textContent = `${(settings.pitch || 1.0).toFixed(1)}x`;
    volumeSlider.value = settings.volume || 1.0;
    volumeDisplay.textContent = `${Math.round((settings.volume || 1.0) * 100)}%`;
    bridgeExtensionIdInput.value = STABLE_EXTENSION_ID;
    serverUrlInput.value = getInternalTransportLabel();
    serverUrlDisplay.textContent = getRuntimeOwnerLabel();
    serverExePathInput.value = settings.serverExePath || DEFAULT_SERVER_EXE_PATH;
    cliExePathInput.value = settings.cliExePath || DEFAULT_CLI_EXE_PATH;
    serverConfigPathInput.value = settings.serverConfigPath || DEFAULT_SERVER_CONFIG_PATH;
    pocketModelPathInput.value = normalizePocketModelPath(settings.pocketModelPath);
    setRuntimePathsStatus(describeRuntimePaths(getConfiguredRuntimePaths()), "info");
    applyTheme(settings.theme || DEFAULT_THEME);
  });
}

function saveSettings() {
  settings = {
    ...settings,
    defaultVoice: defaultVoiceSelect.value,
    builtinVoiceLabels: collectBuiltinVoiceLabelsFromEditor(),
    [VOICE_DISPLAY_NAME_STORAGE_KEY]: getVoiceDisplayLabels(settings),
    speed: parseFloat(speedSlider.value),
    pitch: parseFloat(pitchSlider.value),
    volume: parseFloat(volumeSlider.value),
    serverUrl: settings.serverUrl || DEFAULT_SERVER_URL,
    serverExePath: settings.serverExePath || DEFAULT_SERVER_EXE_PATH,
    cliExePath: settings.cliExePath || DEFAULT_CLI_EXE_PATH,
    serverConfigPath: settings.serverConfigPath || DEFAULT_SERVER_CONFIG_PATH,
    pocketModelPath: normalizePocketModelPath(settings.pocketModelPath),
    theme: document.body.dataset.theme || DEFAULT_THEME
  };

  chrome.storage.local.set({ [STORAGE_KEY]: settings }, () => {
    addLog("Settings saved", "success");
    sendBackgroundMessage({ type: "voices.refresh" }).catch((error) => {
      addLog(`Voice refresh failed: ${error.message}`, "error");
    });
    loadVoices();
  });
}

function normalizeServerUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (error) {
    return "";
  }

  if (parsed.protocol !== "http:") {
    return "";
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    return "";
  }

  const port = parsed.port ? `:${parsed.port}` : "";
  return `http://${hostname}${port}`;
}

async function saveServerUrl() {
  const normalized = normalizeServerUrl(serverUrlInput.value);
  if (!normalized) {
    addLog("Server URL must be a local http://127.0.0.1:<port> or http://localhost:<port> endpoint.", "error");
    return;
  }

  settings.serverUrl = normalized;
  serverUrlInput.value = getInternalTransportLabel();
  serverUrlDisplay.textContent = getRuntimeOwnerLabel();
  chrome.storage.local.set({ [STORAGE_KEY]: settings });
  await sendBackgroundMessage({ type: "serverUrl.updated" });
  addLog(`Internal transport endpoint set to ${normalized}`, "success");
}

async function saveRuntimePaths() {
  if (runtimePathsSaveFeedbackTimer) {
    clearTimeout(runtimePathsSaveFeedbackTimer);
    runtimePathsSaveFeedbackTimer = null;
  }

  setRuntimePathsButtonState("Saving...", true);
  setRuntimePathsStatus("Saving runtime paths...", "info");

  settings.serverExePath = serverExePathInput.value.trim() || DEFAULT_SERVER_EXE_PATH;
  settings.cliExePath = cliExePathInput.value.trim() || DEFAULT_CLI_EXE_PATH;
  settings.serverConfigPath = serverConfigPathInput.value.trim() || DEFAULT_SERVER_CONFIG_PATH;
  settings.pocketModelPath = normalizePocketModelPath(pocketModelPathInput.value.trim());

  serverExePathInput.value = settings.serverExePath;
  cliExePathInput.value = settings.cliExePath;
  serverConfigPathInput.value = settings.serverConfigPath;
  pocketModelPathInput.value = settings.pocketModelPath;

  chrome.storage.local.set({ [STORAGE_KEY]: settings });
  await sendBackgroundMessage({ type: "runtimePaths.updated" });
  const savedPathsDescription = describeRuntimePaths(getConfiguredRuntimePaths());
  setRuntimePathsStatus(savedPathsDescription, "success");
  setRuntimePathsButtonState("Saved", true);
  addLog("Runtime paths saved", "success");
  addLog(savedPathsDescription, "info");

  runtimePathsSaveFeedbackTimer = setTimeout(() => {
    setRuntimePathsButtonState("Save Runtime Paths", false);
  }, 1600);
}

async function resetRuntimePaths() {
  if (runtimePathsSaveFeedbackTimer) {
    clearTimeout(runtimePathsSaveFeedbackTimer);
    runtimePathsSaveFeedbackTimer = null;
  }

  const defaultPaths = getDefaultRuntimePaths();
  settings.serverExePath = defaultPaths.serverExePath;
  settings.cliExePath = defaultPaths.cliExePath;
  settings.serverConfigPath = defaultPaths.serverConfigPath;
  settings.pocketModelPath = defaultPaths.pocketModelPath;

  serverExePathInput.value = settings.serverExePath;
  cliExePathInput.value = settings.cliExePath;
  serverConfigPathInput.value = settings.serverConfigPath;
  pocketModelPathInput.value = settings.pocketModelPath;

  chrome.storage.local.set({ [STORAGE_KEY]: settings });
  await sendBackgroundMessage({ type: "runtimePaths.updated" });

  const defaultPathsDescription = describeRuntimePaths(defaultPaths);
  setRuntimePathsStatus(`Reset to defaults. ${defaultPathsDescription}`, "success");
  addLog("Runtime paths reset to defaults", "success");
  addLog(defaultPathsDescription, "info");
}

function getInstallerExtensionId() {
  bridgeExtensionIdInput.value = STABLE_EXTENSION_ID;
  return STABLE_EXTENSION_ID;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
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

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Failed to read WAV file."));
    reader.readAsArrayBuffer(file);
  });
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

async function deleteCustomVoiceRecord(id) {
  const db = await openCustomVoiceDatabase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOM_VOICE_STORE_NAME, "readwrite");
    tx.objectStore(CUSTOM_VOICE_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
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
      baseVoiceName: getCanonicalPocketVoiceName(legacyVoice.baseVoiceName) || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY),
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
}

async function getCustomVoices() {
  await migrateLegacyCustomVoices();
  const voices = await listCustomVoices();
  return voices.map((voice) => ({
    id: voice.id,
    voiceName: voice.voiceName,
    lang: voice.lang || "en-US",
    baseVoiceName: getCanonicalPocketVoiceName(voice.baseVoiceName) || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY),
    filePath: voice.filePath || buildCustomVoiceFilePath(voice.id),
    fileName: voice.fileName || "reference.wav",
    mimeType: voice.mimeType || "audio/wav",
    size: voice.size || 0,
    createdAt: voice.createdAt || 0
  }));
}

async function renderCustomVoiceList() {
  const customVoices = await getCustomVoices();

  if (customVoices.length === 0) {
    cloneRegisteredList.innerHTML = `<div class="field-note">No custom voices added yet.</div>`;
    return;
  }

  cloneRegisteredList.innerHTML = customVoices.map((voice) => `
    <div class="reference-voice-item">
      <div class="reference-voice-meta">
        <strong>${escapeHtml(formatVoiceLabel(voice.voiceName))}</strong>
        <span class="field-note">Base: ${escapeHtml(formatVoiceLabel(voice.baseVoiceName || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY)))} • ${escapeHtml(voice.fileName || "reference.wav")}</span>
      </div>
      <button class="btn btn-secondary remove-reference-voice-btn" data-voice-id="${escapeHtml(voice.id)}">Remove</button>
    </div>
  `).join("");
}

async function createClonedVoice() {
  const cloneName = cloneNameInput.value.trim();
  const file = cloneWavInput.files?.[0];
  const baseVoiceName = cloneBaseVoiceSelect.value || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY);

  if (!cloneName) {
    setCloneStatus("Enter a voice name.", "error");
    return;
  }

  if (!file) {
    setCloneStatus("Select a custom .wav file first.", "error");
    return;
  }

  if (!file.name.toLowerCase().endsWith(".wav")) {
    setCloneStatus("Custom voice file must be a .wav file.", "error");
    return;
  }

  cloneVoiceBtn.disabled = true;
  setCloneStatus("Saving custom voice WAV...", "info");
  addLog(`Saving local custom voice "${cloneName}"`, "info");

  try {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const customVoices = await getCustomVoices();
    const normalizedName = `Pocket Clone - ${cloneName}`;
    const id = `reference-${slugify(cloneName) || "voice"}-${Date.now()}`;

    if (customVoices.some((voice) => voice.voiceName === normalizedName)) {
      throw new Error(`A custom voice named "${normalizedName}" already exists.`);
    }

    await saveCustomVoiceRecord({
      id,
      voiceName: normalizedName,
      lang: "en-US",
      baseVoiceName,
      fileName: file.name,
      mimeType: file.type || "audio/wav",
      size: file.size,
      arrayBuffer,
      createdAt: Date.now(),
      filePath: buildCustomVoiceFilePath(id),
      source: "custom"
    });

    await sendBackgroundMessage({ type: "voices.refresh" });
    await renderCustomVoiceList();
    await loadVoices();

    cloneNameInput.value = "";
    cloneWavInput.value = "";
    setCloneStatus(`Added ${normalizedName}.`, "success");
    addLog(`Registered ${normalizedName} using ${file.name}`, "success");
  } catch (error) {
    setCloneStatus(error.message, "error");
    addLog(`Custom voice save failed: ${error.message}`, "error");
  } finally {
    cloneVoiceBtn.disabled = false;
  }
}

function testSpeak() {
  const text = testText.value || "Hello, this is a test.";
  const voice = testVoiceSelect.value || defaultVoiceSelect.value || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY);
  const rate = parseFloat(speedSlider.value) || 1.0;
  const pitch = parseFloat(pitchSlider.value) || 1.0;
  const volume = parseFloat(volumeSlider.value) || 1.0;

  if (isSpeaking) {
    chrome.tts.stop();
    isSpeaking = false;
  }

  testStatus.textContent = "Speaking...";
  addLog(`Speaking: "${text.substring(0, 50)}..." with ${voice}`, "info");

  const speakOptions = {
    voiceName: voice,
    rate,
    pitch,
    volume,
    onEvent: (event) => {
      if (event.type === "start") {
        testStatus.textContent = "Speaking...";
        isSpeaking = true;
      } else if (event.type === "end") {
        testStatus.textContent = "Done";
        isSpeaking = false;
        addLog("Speech complete", "success");
      } else if (event.type === "error") {
        testStatus.textContent = `Error: ${event.errorMessage}`;
        isSpeaking = false;
        addLog(`Speech error: ${event.errorMessage}`, "error");
      } else if (event.type === "interrupted" || event.type === "cancelled") {
        testStatus.textContent = "Stopped";
        isSpeaking = false;
        addLog("Speech stopped", "info");
      }
    }
  };

  if (isPocketVoiceName(voice)) {
    speakOptions.extensionId = chrome.runtime.id;
  }

  chrome.tts.speak(text, speakOptions);
}

function testStop() {
  chrome.tts.stop();
  isSpeaking = false;
  testStatus.textContent = "Stopped";
  addLog("Speech stopped by user", "info");
}

function loadExtensionInfo() {
  extensionIdDisplay.textContent = chrome.runtime.id || "Unknown";
  serverUrlDisplay.textContent = getRuntimeOwnerLabel();
  serverUrlInput.value = getInternalTransportLabel();
}

async function refreshBridgeStatus() {
  bridgeStatusDisplay.textContent = "Checking...";

  try {
    const response = await sendBackgroundMessage({ type: "bridge.ping" });
    const payload = getNativeBridgePayload(response);
    const hostVersion = payload.hostVersion || "unknown";
    bridgeStatusDisplay.textContent = `Installed (${hostVersion})`;
    addLog(`Bridge ready: ${hostVersion}`, "success");
    setBridgeUiState({
      bridgeInstalled: true,
      hostVersion,
      needsAttention: false
    });
    return true;
  } catch (error) {
    bridgeStatusDisplay.textContent = "Not installed";
    addLog(`Bridge unavailable: ${error.message}`, "info");
    setBridgeUiState({
      bridgeInstalled: false,
      needsAttention: true
    });
    return false;
  }
}

async function waitForBridgeVersionChange(previousVersion, timeoutMs = 15000) {
  const startedAt = Date.now();
  while ((Date.now() - startedAt) < timeoutMs) {
    await sleep(1000);
    try {
      const response = await sendBackgroundMessage({ type: "bridge.ping" });
      const payload = getNativeBridgePayload(response);
      const hostVersion = payload.hostVersion || "unknown";
      if (!previousVersion || hostVersion !== previousVersion) {
        return hostVersion;
      }
    } catch (error) {
      // Wait for the updater to finish and the host to come back.
    }
  }

  return "";
}

async function verifyBridgeRegistration() {
  try {
    const extensionId = getInstallerExtensionId();
    const response = await sendBackgroundMessage({
      type: "bridge.verifyRegistration",
      extensionId
    });
    const payload = getNativeBridgePayload(response);

    const chromeStatus = payload.chrome;
    const edgeStatus = payload.edge;
    const chromeRegistered = !!chromeStatus?.registered;
    const edgeRegistered = !!edgeStatus?.registered;

    if (chromeRegistered || edgeRegistered) {
      const targets = [];
      if (chromeRegistered) {
        targets.push("Chrome");
      }
      if (edgeRegistered) {
        targets.push("Edge");
      }

      addLog(`Bridge registered in ${targets.join(" and ")}`, "success");
    } else {
      addLog("Bridge registry entry not confirmed for Chrome or Edge", "error");
    }

    if (chromeStatus?.manifestPath) {
      addLog(`Chrome HKCU: ${chromeStatus.manifestPath}`, chromeRegistered ? "info" : "error");
    }
    if (edgeStatus?.manifestPath) {
      addLog(`Edge HKCU: ${edgeStatus.manifestPath}`, edgeRegistered ? "info" : "error");
    }

    if (chromeStatus?.error && !chromeRegistered) {
      addLog(`Chrome registration: ${chromeStatus.error}`, "error");
    }
    if (edgeStatus?.error && !edgeRegistered) {
      addLog(`Edge registration: ${edgeStatus.error}`, "error");
    }
  } catch (error) {
    addLog(`Bridge registration check failed: ${error.message}`, "error");
  }
}

async function saveCompanionModelDownloadSource() {
  const modelDownloadSource = modelDownloadSourceInput.value.trim() || DEFAULT_MODEL_DOWNLOAD_SOURCE;
  if (!modelDownloadSource) {
    throw new Error("Paste the hosted PocketTTS model manifest URL first.");
  }

  const response = await sendBackgroundMessage({
    type: "bridge.setModelDownloadSource",
    modelDownloadSource
  });
  const payload = getNativeBridgePayload(response);
  setModelDownloadSourceStatus("Hosted model manifest URL saved.", "success");
  addLog(payload.message || "Companion hosted model source saved.", "success");
  await checkStatus();
}

async function setCompanionModelState(installState) {
  const modelInstalled = lastCompanionSetupPayload?.modelInstallState === "installed";
  const downloadActive = lastCompanionSetupPayload?.downloadPhase === "downloading";
  if (installState === "downloading" && modelInstalled && !downloadActive) {
    addLog("PocketTTS model is already installed. Reset the download state first only if you intentionally want to reinstall it.", "info");
    return;
  }

  const configuredModelDownloadSource = modelDownloadSourceInput.value.trim()
    || lastCompanionSetupPayload?.modelDownloadSource
    || DEFAULT_MODEL_DOWNLOAD_SOURCE
    || "";
  const response = await sendBackgroundMessage({
    type: "bridge.downloadPocketModel",
    modelDownloadSource: configuredModelDownloadSource,
    installState,
    message: installState === "downloading"
      ? "PocketTTS model download has started in the companion runtime."
      : undefined
  });
  const payload = getNativeBridgePayload(response);
  if (installState === "downloading") {
    addLog("Companion model download started.", "success");
  } else if (installState === "not_downloaded") {
    addLog("Companion model download state reset.", "success");
  } else {
    addLog(`Companion model state saved as ${payload.modelInstallState || installState}`, "success");
  }
  await checkStatus();
}

async function setCompanionWarmupState(warmupState, { autoTriggered = false } = {}) {
  const response = await sendBackgroundMessage({
    type: "bridge.warmupRuntime",
    warmupState
  });
  const payload = getNativeBridgePayload(response);
  if (warmupState === "warming") {
    addLog(autoTriggered ? "Companion warmup started automatically." : "Companion warmup started.", "success");
  } else {
    addLog(`Companion warmup state saved as ${payload.warmupState || warmupState}`, "success");
  }
  await checkStatus();
}

speedSlider.addEventListener("input", () => {
  speedDisplay.textContent = `${parseFloat(speedSlider.value).toFixed(1)}x`;
});

pitchSlider.addEventListener("input", () => {
  pitchDisplay.textContent = `${parseFloat(pitchSlider.value).toFixed(1)}x`;
});

volumeSlider.addEventListener("input", () => {
  volumeDisplay.textContent = `${Math.round(parseFloat(volumeSlider.value) * 100)}%`;
});

themeToggleBtn.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  settings.theme = nextTheme;
  chrome.storage.local.set({ [STORAGE_KEY]: settings });
  addLog(`Theme set to ${nextTheme}`, "success");
});

checkStatusBtn.addEventListener("click", checkStatus);
saveSettingsBtn.addEventListener("click", saveSettings);
saveRuntimePathsBtn.addEventListener("click", () => {
  saveRuntimePaths().catch((error) => {
    setRuntimePathsButtonState("Save Runtime Paths", false);
    setRuntimePathsStatus(`Save failed: ${error.message}`, "error");
    addLog(`Failed to save runtime paths: ${error.message}`, "error");
  });
});
resetRuntimePathsBtn.addEventListener("click", () => {
  resetRuntimePaths().catch((error) => {
    setRuntimePathsStatus(`Reset failed: ${error.message}`, "error");
    addLog(`Failed to reset runtime paths: ${error.message}`, "error");
  });
});
saveModelDownloadSourceBtn.addEventListener("click", () => {
  setModelDownloadSourceStatus("Saving hosted PocketTTS model manifest URL...", "info");
  saveCompanionModelDownloadSource().catch((error) => {
    setModelDownloadSourceStatus(`Save failed: ${error.message}`, "error");
    addLog(`Failed to save hosted model source: ${error.message}`, "error");
  });
});
setModelInstallStateBtn.addEventListener("click", () => {
  setCompanionModelState("downloading").catch((error) => {
    addLog(`Failed to start companion model download: ${error.message}`, "error");
  });
});
resetModelInstallStateBtn.addEventListener("click", () => {
  setCompanionModelState("not_downloaded").catch((error) => {
    addLog(`Failed to reset companion model download: ${error.message}`, "error");
  });
});
setWarmupStateBtn.addEventListener("click", () => {
  setCompanionWarmupState("warming").catch((error) => {
    addLog(`Failed to start companion warmup: ${error.message}`, "error");
  });
});
resetWarmupStateBtn.addEventListener("click", () => {
  setCompanionWarmupState("cold").catch((error) => {
    addLog(`Failed to reset companion warmup state: ${error.message}`, "error");
  });
});
testSpeakBtn.addEventListener("click", testSpeak);
testStopBtn.addEventListener("click", testStop);
cloneVoiceBtn.addEventListener("click", createClonedVoice);
localOnlyVoicesCheckbox.addEventListener("change", renderAvailableVoices);
voiceCountrySelect.addEventListener("change", renderAvailableVoices);
voiceList.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const editButton = target.closest("[data-voice-edit]");
  if (editButton instanceof HTMLElement) {
    startVoiceEditing(editButton.dataset.voiceEdit || "");
    return;
  }

  const saveButton = target.closest("[data-voice-save]");
  if (saveButton instanceof HTMLElement) {
    const storageKey = saveButton.dataset.voiceSave || "";
    const input = voiceList.querySelector(`.voice-display-name-input[data-voice-key="${CSS.escape(storageKey)}"]`);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    persistVoiceDisplayName(storageKey, input.value).catch((error) => {
      addLog(`Failed to save voice display name: ${error.message}`, "error");
    });
    return;
  }

  const cancelButton = target.closest("[data-voice-cancel]");
  if (cancelButton instanceof HTMLElement) {
    stopVoiceEditing(cancelButton.dataset.voiceCancel || "");
  }
});
voiceList.addEventListener("keydown", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.classList.contains("voice-display-name-input")) {
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    persistVoiceDisplayName(input.dataset.voiceKey || "", input.value).catch((error) => {
      addLog(`Failed to save voice display name: ${error.message}`, "error");
    });
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    stopVoiceEditing(input.dataset.voiceKey || "");
  }
});
testLocalOnlyCheckbox.addEventListener("change", () => {
  renderTestVoiceOptions();
});

cloneRegisteredList.addEventListener("click", async (event) => {
  const button = event.target.closest(".remove-reference-voice-btn");
  if (!button) {
    return;
  }

  const voiceId = button.dataset.voiceId;
  await deleteCustomVoiceRecord(voiceId);
  await sendBackgroundMessage({ type: "voices.refresh" });
  await renderCustomVoiceList();
  await loadVoices();
  setCloneStatus("Custom voice removed.", "success");
  addLog("Custom voice removed", "success");
});

clearLogBtn.addEventListener("click", () => {
  logArea.innerHTML = "";
  addLog("Log cleared", "info");
});

refreshLogBtn.addEventListener("click", () => {
  addLog("Refreshing...", "info");
  loadVoices();
  renderCustomVoiceList();
  checkStatus();
  refreshBridgeStatus();
  logRuntimeSummary();
});

installBridgeBtn.addEventListener("click", async () => {
  try {
    let previousVersion = "";

    try {
      const pingResponse = await sendBackgroundMessage({ type: "bridge.ping" });
      const pingPayload = getNativeBridgePayload(pingResponse);
      previousVersion = pingPayload.hostVersion || "";
    } catch (error) {
      previousVersion = "";
    }

    try {
      const response = await sendBackgroundMessage({
        type: "bridge.installOrUpdate",
        extensionId: getInstallerExtensionId()
      });
      const payload = getNativeBridgePayload(response);
      addLog(`Bridge repair launched${payload.updaterPid ? ` (pid: ${payload.updaterPid})` : ""}`, "success");
      addLog("Waiting for repaired native bridge...", "info");
      const nextVersion = await waitForBridgeVersionChange(previousVersion);
      if (nextVersion) {
        addLog(`Bridge ready: ${nextVersion}`, "success");
        await refreshBridgeStatus();
      } else {
        addLog("Bridge repair launched, but version confirmation timed out. Reload the extension after the repair finishes.", "info");
        setBridgeUiState({
          bridgeInstalled: true,
          needsAttention: true
        });
      }
      return;
    } catch (error) {
      if (!/Unsupported command|forbidden|Specified native messaging host not found|Native host has exited/i.test(error.message)) {
        throw error;
      }

      const bootstrapReason = /Unsupported command/i.test(error.message)
        ? "Installed bridge is too old for in-place repair."
        : "Native bridge access is not available yet.";
      addLog(bootstrapReason, "info");
      addLog("Run Pocket-tts-Companion Setup.exe again to install or repair the Companion Bridge.", "info");
      setBridgeUiState({
        bridgeInstalled: false,
        needsAttention: true
      });
    }
  } catch (error) {
    addLog(`Bridge install/update failed: ${error.message}`, "error");
    setBridgeUiState({
      bridgeInstalled: true,
      needsAttention: true
    });
  }
});

bridgeExtensionIdInput.value = STABLE_EXTENSION_ID;

startServerBtn.addEventListener("click", async () => {
  addLog("Checking native Pocket runtime...", "info");
  setLaunchProgress(true, "Checking native Pocket runtime...");

  try {
    const statusResponse = await sendBackgroundMessage({ type: "bridge.getStatus" });
    const statusPayload = getNativeBridgePayload(statusResponse);

    if (!statusPayload.companionInstalled) {
      addLog("Pocket companion app is not installed yet. Trying to open setup...", "info");
      const setupResponse = await sendBackgroundMessage({ type: "bridge.openSetup" });
      const setupPayload = getNativeBridgePayload(setupResponse);
      if (setupPayload.launched) {
        addLog("Companion setup launched", "success");
      }
      return;
    }

    await validateRuntimePathsForLaunch();
    progressFill.style.width = "75%";
    const healthy = await waitForServerHealthy();
    if (healthy) {
      addLog("Pocket runtime is ready", "success");
    } else {
      addLog("Pocket runtime still needs setup or a valid local model path", "error");
      setStatus("error", "Setup required");
    }
  } catch (error) {
    addLog(`Pocket runtime check failed: ${error.message}`, "error");
    addLog("Install or update the bridge, then confirm the CLI and model paths.", "info");
  } finally {
    setLaunchProgress(false);
  }
});

function init() {
  loadExtensionInfo();
  loadSettings();
  renderBaseVoiceOptions(getBuiltinVoices());
  renderCustomVoiceList();
  setCloneStatus("Ready", "info");
  addLog("Pocket TTS Engine options loaded", "info");
  addLog(`Extension ID: ${chrome.runtime.id}`, "info");
  logRuntimeSummary();

  progressBar.classList.remove("active");
  progressFill.style.width = "0%";

  loadVoices();
  refreshBridgeStatus();
  checkStatus();
}

document.addEventListener("DOMContentLoaded", init);
