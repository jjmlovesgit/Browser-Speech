const HIGHLIGHT_NAME = "browser-speech-selection";
const STYLE_ID = "browser-speech-selection-style";

let highlightedRanges = [];

function ensureHighlightStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    ::highlight(${HIGHLIGHT_NAME}) {
      background: rgba(45, 166, 153, 0.18);
      text-decoration: underline;
      text-decoration-thickness: 0.18em;
      text-decoration-color: rgba(45, 166, 153, 0.95);
      text-underline-offset: 0.18em;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function snapshotSelectionRanges() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return [];
  }

  const ranges = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const range = selection.getRangeAt(index);
    if (range && !range.collapsed) {
      ranges.push(range.cloneRange());
    }
  }
  return ranges;
}

function applyHighlight(ranges) {
  clearHighlight();
  if (!Array.isArray(ranges) || ranges.length === 0 || !globalThis.CSS?.highlights || typeof globalThis.Highlight !== "function") {
    return;
  }

  ensureHighlightStyle();
  highlightedRanges = ranges.map((range) => range.cloneRange());
  const highlight = new Highlight(...highlightedRanges);
  CSS.highlights.set(HIGHLIGHT_NAME, highlight);
}

function clearHighlight() {
  highlightedRanges = [];
  if (globalThis.CSS?.highlights) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message?.type) {
    return false;
  }

  switch (message.type) {
    case "selectionReader.prepare":
      highlightedRanges = snapshotSelectionRanges();
      sendResponse({
        ok: true,
        rangeCount: highlightedRanges.length
      });
      return true;
    case "selectionReader.playbackState":
      if (message.state === "start") {
        applyHighlight(highlightedRanges);
      } else if (message.state === "end" || message.state === "error" || message.state === "stop") {
        clearHighlight();
      }
      sendResponse({ ok: true });
      return true;
    default:
      return false;
  }
});
