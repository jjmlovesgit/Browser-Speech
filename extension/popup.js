const STORAGE_KEY = 'pocket-tts-settings';

const statusBadge = document.getElementById('statusBadge');
const statusDot = document.getElementById('statusDot');
const serverStatus = document.getElementById('serverStatus');
const voiceSelect = document.getElementById('voiceSelect');
const speakBtn = document.getElementById('speakBtn');
const stopBtn = document.getElementById('stopBtn');
const stopServerBtn = document.getElementById('stopServerBtn');
const optionsBtn = document.getElementById('optionsBtn');
const clearLogBtn = document.getElementById('clearLogBtn');
const logArea = document.getElementById('logArea');
const extensionId = document.getElementById('extensionId');
const openOptionsLink = document.getElementById('openOptionsLink');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const launchProgress = document.getElementById('launchProgress');
const launchProgressNote = document.getElementById('launchProgressNote');

let settings = {};
let isSpeaking = false;
const DEFAULT_THEME = 'light';
let isRuntimeLaunching = false;

const BUILTIN_VOICE_DEFINITIONS = [
  { key: 'alba', defaultName: 'Pocket Alba', lang: 'en-US' },
  { key: 'michael', defaultName: 'Pocket Michael', lang: 'en-US' },
  { key: 'anna', defaultName: 'Pocket Anna', lang: 'en-GB' }
];
const DEFAULT_BUILTIN_VOICE_KEY = 'alba';
const LEGACY_BUILTIN_VOICE_ALIASES = {
  'Pocket US Female': 'alba',
  'Pocket US Male': 'michael',
  'Pocket UK Female': 'anna',
  'Pocket UK Male': 'michael',
  'Pocket AU Female': 'alba',
  'Pocket AU Male': 'michael',
  'Pocket US Child': 'alba',
  'Pocket UK Child': 'anna'
};

function applyTheme(theme) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  document.body.dataset.theme = normalizedTheme;
  themeToggleBtn.textContent = normalizedTheme === 'dark' ? 'Light' : 'Dark';
}

function sendBackgroundMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!response) {
        reject(new Error('No response from background service worker.'));
        return;
      }

      if (!response.ok) {
        reject(new Error(response.error || 'Unknown background error.'));
        return;
      }

      resolve(response);
    });
  });
}

function getNativeBridgePayload(response) {
  const payload = response?.response;
  if (!payload) {
    throw new Error('No native host response payload was returned.');
  }

  if (payload.ok !== true) {
    const message = payload.error || 'Native host command failed.';
    if (/Unsupported command/i.test(message)) {
      throw new Error(`${message} Reinstall the native bridge to pick up the latest host version.`);
    }
    throw new Error(message);
  }

  return payload;
}

function formatRuntimePathLabel(label) {
  switch (label) {
    case 'serverExePath':
      return 'model path';
    case 'cliExePath':
      return 'cli exe';
    case 'modelPath':
      return 'model path';
    default:
      return label;
  }
}

async function validateRuntimePathsForLaunch() {
  addLog('Validating runtime paths...', 'info');
  const response = await sendBackgroundMessage({ type: 'bridge.validateRuntimePaths' });
  const payload = getNativeBridgePayload(response);
  const checks = Array.isArray(payload.checks) ? payload.checks : [];

  checks.forEach((check) => {
    const label = formatRuntimePathLabel(check.label);
    if (check.exists) {
      addLog(`OK ${label} found: ${check.path}`, 'success');
      return;
    }

    addLog(`Missing ${label}: ${check.path}`, 'error');
  });

  if (payload.ok !== true) {
    addLog('Start aborted because runtime path validation failed', 'error');
    throw new Error(payload.error || 'Runtime path validation failed.');
  }
}

function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const prefix = type === 'error' ? '[error]' : type === 'success' ? '[ok]' : '[info]';
  const className = type === 'error' ? 'log-error' : type === 'success' ? 'log-success' : 'log-info';
  const line = document.createElement('div');
  line.className = className;
  line.textContent = `[${timestamp}] ${prefix} ${message}`;
  logArea.appendChild(line);
  logArea.scrollTop = logArea.scrollHeight;

  while (logArea.children.length > 50) {
    logArea.removeChild(logArea.firstChild);
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDefaultBuiltinVoiceLabels() {
  return Object.fromEntries(BUILTIN_VOICE_DEFINITIONS.map((voice) => [voice.key, voice.defaultName]));
}

function getBuiltinVoiceLabels(source = settings) {
  const storedLabels = source?.builtinVoiceLabels;
  const labels = getDefaultBuiltinVoiceLabels();
  if (!storedLabels || typeof storedLabels !== 'object') {
    return labels;
  }

  BUILTIN_VOICE_DEFINITIONS.forEach((definition) => {
    const candidate = String(storedLabels[definition.key] || '').trim();
    if (candidate) {
      labels[definition.key] = candidate;
    }
  });

  return labels;
}

function getBuiltinVoices(source = settings) {
  const labels = getBuiltinVoiceLabels(source);
  return BUILTIN_VOICE_DEFINITIONS.map((voice) => ({
    key: voice.key,
    voiceName: labels[voice.key] || voice.defaultName,
    lang: voice.lang
  }));
}

function getBuiltinVoiceName(voiceKey, source = settings) {
  const labels = getBuiltinVoiceLabels(source);
  const definition = BUILTIN_VOICE_DEFINITIONS.find((voice) => voice.key === voiceKey);
  return labels[voiceKey] || definition?.defaultName || labels[DEFAULT_BUILTIN_VOICE_KEY];
}

function getBuiltinVoiceKeyFromName(voiceName, source = settings) {
  const normalizedVoiceName = normalizeVoiceNameToken(voiceName);
  if (!normalizedVoiceName) {
    return '';
  }

  if (LEGACY_BUILTIN_VOICE_ALIASES[voiceName]) {
    return LEGACY_BUILTIN_VOICE_ALIASES[voiceName];
  }

  const labels = getBuiltinVoiceLabels(source);
  const matchedDefinition = BUILTIN_VOICE_DEFINITIONS.find((voice) => {
    const configuredName = labels[voice.key] || voice.defaultName;
    return normalizeVoiceNameToken(configuredName) === normalizedVoiceName
      || normalizeVoiceNameToken(voice.defaultName) === normalizedVoiceName;
  });

  return matchedDefinition?.key || '';
}

function getBackendVoiceId(voiceName) {
  const builtinVoiceKey = getBuiltinVoiceKeyFromName(voiceName);
  if (builtinVoiceKey) {
    return builtinVoiceKey;
  }

  if (voiceName.startsWith('Pocket Clone - ')) {
    return `ref:${voiceName.slice('Pocket Clone - '.length)}`;
  }

  return 'unknown';
}

function getBackendVoiceDisplayLabel(voiceName) {
  if (voiceName.startsWith('Pocket Clone - ')) {
    return 'Custom';
  }

  return getBuiltinVoiceKeyFromName(voiceName) ? '' : 'Pocket';
}

function formatVoiceLabel(voiceName) {
  const suffix = getBackendVoiceDisplayLabel(voiceName);
  return suffix ? `${voiceName} (${suffix})` : voiceName;
}

function isPocketVoiceName(voiceName) {
  return !!getBuiltinVoiceKeyFromName(voiceName) || String(voiceName || '').startsWith('Pocket Clone - ');
}

function normalizeVoiceNameToken(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getCanonicalPocketVoiceName(voiceName) {
  const normalizedVoiceName = normalizeVoiceNameToken(voiceName);
  if (!normalizedVoiceName) {
    return '';
  }

  const builtinVoiceKey = getBuiltinVoiceKeyFromName(voiceName);
  if (builtinVoiceKey) {
    return getBuiltinVoiceName(builtinVoiceKey);
  }

  return String(voiceName || '').trim();
}

function setStatus(state, message) {
  statusBadge.textContent = state.toUpperCase();
  statusBadge.className = `status-badge ${state}`;
  serverStatus.textContent = message;

  if (state === 'ready') {
    statusDot.className = 'status-dot green';
  } else if (state === 'loading') {
    statusDot.className = 'status-dot yellow';
  } else {
    statusDot.className = 'status-dot red';
  }
}

function setRuntimeNeedsSetupState() {
  statusBadge.textContent = 'SETUP';
  statusBadge.className = 'status-badge loading';
  serverStatus.textContent = 'Setup needed';
  statusDot.className = 'status-dot red';
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function setLaunchProgress(active, message = 'Checking local Pocket runtime...') {
  isRuntimeLaunching = active;
  launchProgress.classList.toggle('active', active);
  launchProgressNote.classList.toggle('active', active);
  launchProgressNote.textContent = message;
  stopServerBtn.disabled = active;
  speakBtn.disabled = active || isSpeaking;
  stopBtn.disabled = active;
  voiceSelect.disabled = active;
}

async function checkStatus() {
  setStatus('loading', 'Checking...');
  try {
    const response = await sendBackgroundMessage({ type: 'bridge.getStatus' });
    const payload = getNativeBridgePayload(response);
    if (payload.runtimeReady) {
      setStatus('ready', 'Runtime ready');
      addLog(payload.message || 'Pocket runtime ready', 'success');
      return true;
    }

    setRuntimeNeedsSetupState();
    addLog(payload.runtimeError || payload.message || 'Pocket runtime setup is incomplete.', 'info');
    return false;
  } catch (error) {
    setRuntimeNeedsSetupState();
    addLog(`Native runtime unavailable: ${error.message}`, 'error');
    return false;
  }
}

async function loadVoices() {
  try {
    const voices = await new Promise((resolve) => {
      chrome.tts.getVoices(resolve);
    });

    const seenPocketVoiceNames = new Set();
    const pocketVoices = voices.reduce((result, voice) => {
      const rawVoiceName = voice?.voiceName || '';
      if (!rawVoiceName.startsWith('Pocket')) {
        return result;
      }

      const voiceName = getCanonicalPocketVoiceName(rawVoiceName);
      if (!voiceName || seenPocketVoiceNames.has(voiceName)) {
        return result;
      }

      seenPocketVoiceNames.add(voiceName);
      result.push({
        ...voice,
        voiceName
      });
      return result;
    }, []);

    if (pocketVoices.length === 0) {
      voiceSelect.innerHTML = getBuiltinVoices().map((voice) => `
        <option value="${escapeHtml(voice.voiceName)}">${escapeHtml(formatVoiceLabel(voice.voiceName))}</option>
      `).join('');
      if (settings.defaultVoice && voiceSelect.querySelector(`option[value="${settings.defaultVoice}"]`)) {
        voiceSelect.value = settings.defaultVoice;
      }
      addLog('Using fallback voice list', 'info');
      return 0;
    }

    voiceSelect.innerHTML = pocketVoices.map((voice) => `
      <option value="${escapeHtml(voice.voiceName)}">${escapeHtml(formatVoiceLabel(voice.voiceName))}</option>
    `).join('');

    if (settings.defaultVoice && voiceSelect.querySelector(`option[value="${settings.defaultVoice}"]`)) {
      voiceSelect.value = settings.defaultVoice;
    }

    addLog(`Loaded ${pocketVoices.length} Pocket voices`, 'success');
    return pocketVoices.length;
  } catch (error) {
    addLog(`Failed to load voices: ${error.message}`, 'error');
    return 0;
  }
}

function loadSettings() {
  chrome.storage.local.get([STORAGE_KEY], (result) => {
    settings = result[STORAGE_KEY] || {
      defaultVoice: getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, { builtinVoiceLabels: getDefaultBuiltinVoiceLabels() }),
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0,
      theme: DEFAULT_THEME
    };
    settings.builtinVoiceLabels = getBuiltinVoiceLabels(settings);
    settings.defaultVoice = getCanonicalPocketVoiceName(settings.defaultVoice)
      || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY, settings);
    applyTheme(settings.theme || DEFAULT_THEME);
    if (voiceSelect.querySelector(`option[value="${settings.defaultVoice}"]`)) {
      voiceSelect.value = settings.defaultVoice;
    }
  });
}

function speak(text) {
  if (isRuntimeLaunching) {
    addLog('Wait for the runtime check to finish before testing speech.', 'info');
    return;
  }

  if (isSpeaking) {
    chrome.tts.stop();
    isSpeaking = false;
  }

  const voice = voiceSelect.value || getBuiltinVoiceName(DEFAULT_BUILTIN_VOICE_KEY);
  const rate = settings.speed || 1.0;
  const pitch = settings.pitch || 1.0;
  const volume = settings.volume || 1.0;

  if (!text || text.trim() === '') {
    addLog('No text to speak', 'error');
    return;
  }

  speakBtn.disabled = true;
  speakBtn.textContent = 'Speaking...';
  addLog(`Speaking: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`, 'info');

  const speakOptions = {
    voiceName: voice,
    rate,
    pitch,
    volume,
    onEvent: (event) => {
      if (event.type === 'start') {
        isSpeaking = true;
      } else if (event.type === 'end') {
        isSpeaking = false;
        speakBtn.disabled = false;
        speakBtn.textContent = 'Speak';
        if (isRuntimeLaunching) {
          speakBtn.disabled = true;
        }
        addLog('Speech complete', 'success');
      } else if (event.type === 'error') {
        isSpeaking = false;
        speakBtn.disabled = false;
        speakBtn.textContent = 'Speak';
        if (isRuntimeLaunching) {
          speakBtn.disabled = true;
        }
        addLog(`Speech error: ${event.errorMessage}`, 'error');
      } else if (event.type === 'interrupted' || event.type === 'cancelled') {
        isSpeaking = false;
        speakBtn.disabled = false;
        speakBtn.textContent = 'Speak';
        if (isRuntimeLaunching) {
          speakBtn.disabled = true;
        }
        addLog('Speech stopped', 'info');
      }
    }
  };

  if (isPocketVoiceName(voice)) {
    speakOptions.extensionId = chrome.runtime.id;
  }

  chrome.tts.speak(text, speakOptions);
}

function stopSpeech() {
  chrome.tts.stop();
  isSpeaking = false;
  speakBtn.disabled = false;
  speakBtn.textContent = 'Speak';
  addLog('Speech stopped by user', 'info');
}

async function openSidePanel() {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.sidePanel.setOptions({
      path: 'options.html',
      enabled: true
    });
    await chrome.sidePanel.open({
      windowId: currentWindow.id
    });
    window.close();
  } catch (error) {
    addLog(`Failed to open side panel: ${error.message}`, 'error');
  }
}

speakBtn.addEventListener('click', () => {
  const text = prompt('Enter text to speak:', 'Hello, this is a test of the Pocket TTS engine.');
  if (text !== null && text.trim() !== '') {
    speak(text);
  }
});

stopBtn.addEventListener('click', stopSpeech);

stopServerBtn.addEventListener('click', async () => {
  addLog('Refreshing native runtime status...', 'info');
  setLaunchProgress(true, 'Refreshing Pocket runtime status...');

  try {
    await checkStatus();
  } catch (error) {
    addLog(`Refresh failed: ${error.message}`, 'error');
  } finally {
    setLaunchProgress(false);
  }
});

optionsBtn.addEventListener('click', () => {
  openSidePanel();
});

openOptionsLink.addEventListener('click', () => {
  openSidePanel();
});

clearLogBtn.addEventListener('click', () => {
  logArea.innerHTML = '';
  addLog('Log cleared', 'info');
});

themeToggleBtn.addEventListener('click', () => {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
  settings.theme = nextTheme;
  chrome.storage.local.set({ [STORAGE_KEY]: settings });
  addLog(`Theme set to ${nextTheme}`, 'success');
});

voiceSelect.addEventListener('change', () => {
  settings.defaultVoice = voiceSelect.value;
  chrome.storage.local.set({ [STORAGE_KEY]: settings });
});

function init() {
  extensionId.textContent = `v0.1.0 (${chrome.runtime.id.substring(0, 8)}...)`;
  loadSettings();
  addLog('Pocket TTS Engine ready', 'info');

  setTimeout(() => {
    checkStatus();
    loadVoices();
  }, 300);
}

init();
