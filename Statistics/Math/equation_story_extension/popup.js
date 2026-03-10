const SAMPLE_CARD = {
  version: "equation-card/v1",
  title: "Discrete Fourier coefficient",
  domain: "signals",
  displayLatex:
    String.raw`\[\class{role-definition}{X_k}=\class{role-normalizer}{\frac{1}{N}}\class{role-operator}{\sum_{\class{role-index}{n}=0}^{N-1}}\class{role-quantity}{x_n}\class{role-operator}{e^{i 2\pi k n / N}}\]`,
  summary: "This computes the amount of frequency k present in the signal.",
  intuition: "Rotate each sample at frequency k, add the rotated samples, and average the result.",
  legend: [
    {
      role: "definition",
      label: "Output",
      color: "#7f4126",
      meaning: "The Fourier coefficient at frequency k."
    },
    {
      role: "normalizer",
      label: "Average",
      color: "#a16207",
      meaning: "Divide by N so the total becomes an average."
    },
    {
      role: "operator",
      label: "Sweep all samples",
      color: "#c2410c",
      meaning: "Add the contribution from every sample after rotation."
    },
    {
      role: "quantity",
      label: "Signal sample",
      color: "#2b5579",
      meaning: "The nth value of the original signal."
    },
    {
      role: "index",
      label: "Loop variable",
      color: "#8a4fff",
      meaning: "n runs over samples while k selects the frequency."
    }
  ],
  highlights: [
    {
      label: "Coefficient being defined",
      latex: "X_k",
      role: "definition",
      explanation: "This is the answer for the chosen frequency index k."
    },
    {
      label: "Normalization",
      latex: "\\frac{1}{N}",
      role: "normalizer",
      explanation: "This rescales the total by the signal length."
    },
    {
      label: "Running sum",
      latex: "\\sum_{n=0}^{N-1}",
      role: "operator",
      explanation: "This loops over every sample index n."
    }
  ],
  walkthrough: [
    "Pick the frequency index k you want to measure.",
    "Rotate each sample x_n by the matching complex phase.",
    "Add all of the rotated samples together.",
    "Divide by N to turn the total into an average-sized coefficient."
  ],
  notes: [
    "This assumes the standard DFT convention used in signal processing."
  ]
};

const elements = {};
let previewFrameReady = false;
const DEFAULT_BACKEND_URL = "http://127.0.0.1:8787";
const SAVED_TAB_STATE_KEY = "savedEquationCardsByPage";
const MAX_SAVED_TAB_STATES = 24;

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  await loadSettings();
  const restored = await restoreSavedCardForActiveTab();
  if (!restored) {
    loadSample();
  }
  renderPreview();
});

function cacheElements() {
  elements.backendUrlInput = document.getElementById("backend-url-input");
  elements.includePageContextToggle = document.getElementById("include-page-context-toggle");
  elements.jsonInput = document.getElementById("json-input");
  elements.sampleButton = document.getElementById("sample-btn");
  elements.explainButton = document.getElementById("explain-btn");
  elements.previewButton = document.getElementById("preview-btn");
  elements.injectButton = document.getElementById("inject-btn");
  elements.statusBar = document.getElementById("status-bar");
  elements.previewFrame = document.getElementById("preview-frame");
}

function bindEvents() {
  elements.sampleButton.addEventListener("click", () => {
    loadSample();
    renderPreview();
  });

  elements.explainButton.addEventListener("click", async () => {
    await explainSelection();
  });

  elements.previewButton.addEventListener("click", () => {
    renderPreview();
  });

  elements.injectButton.addEventListener("click", async () => {
    await injectIntoPage();
  });

  elements.previewFrame.addEventListener("load", () => {
    previewFrameReady = true;
    renderPreview();
  });

  elements.backendUrlInput.addEventListener("change", async () => {
    await saveSettings();
  });

  elements.includePageContextToggle.addEventListener("change", async () => {
    await saveSettings();
  });

  elements.jsonInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      renderPreview();
    }
  });
}

async function loadSettings() {
  const settings = await chrome.storage.local.get({
    backendBaseUrl: DEFAULT_BACKEND_URL,
    includePageContext: true
  });
  elements.backendUrlInput.value = settings.backendBaseUrl || DEFAULT_BACKEND_URL;
  elements.includePageContextToggle.checked = settings.includePageContext !== false;
}

async function saveSettings() {
  const backendBaseUrl = normalizeBackendBaseUrl(elements.backendUrlInput.value);
  elements.backendUrlInput.value = backendBaseUrl;
  await chrome.storage.local.set({
    backendBaseUrl,
    includePageContext: elements.includePageContextToggle.checked
  });
}

function loadSample() {
  elements.jsonInput.value = JSON.stringify(SAMPLE_CARD, null, 2);
}

async function restoreSavedCardForActiveTab() {
  const tab = await getActiveTab();
  if (!tab) {
    return false;
  }

  const tabKey = getTabStateKey(tab);
  if (!tabKey) {
    return false;
  }

  const stored = await chrome.storage.local.get({
    [SAVED_TAB_STATE_KEY]: {}
  });
  const savedState = stored[SAVED_TAB_STATE_KEY] || {};
  const entry = savedState[tabKey];
  if (!entry || !entry.card) {
    return false;
  }

  elements.jsonInput.value = JSON.stringify(entry.card, null, 2);
  return true;
}

async function saveCardForActiveTab(card) {
  const tab = await getActiveTab();
  if (!tab) {
    return;
  }

  const tabKey = getTabStateKey(tab);
  if (!tabKey) {
    return;
  }

  const stored = await chrome.storage.local.get({
    [SAVED_TAB_STATE_KEY]: {}
  });
  const savedState = stored[SAVED_TAB_STATE_KEY] || {};
  savedState[tabKey] = {
    card,
    updatedAt: Date.now(),
    pageTitle: tab.title || "",
    pageUrl: tab.url || ""
  };

  await chrome.storage.local.set({
    [SAVED_TAB_STATE_KEY]: trimSavedTabStates(savedState)
  });
}

function trimSavedTabStates(savedState) {
  const entries = Object.entries(savedState || {});
  if (entries.length <= MAX_SAVED_TAB_STATES) {
    return savedState;
  }

  entries.sort((left, right) => {
    const leftTime = Number(left[1] && left[1].updatedAt ? left[1].updatedAt : 0);
    const rightTime = Number(right[1] && right[1].updatedAt ? right[1].updatedAt : 0);
    return rightTime - leftTime;
  });

  return Object.fromEntries(entries.slice(0, MAX_SAVED_TAB_STATES));
}

async function explainSelection() {
  try {
    await saveSettings();
    setBusy(true);
    setStatus("Collecting the current selection...", "");

    const pageContext = await getPageContext();
    setStatus("Requesting an explanation from the backend...", "");

    const payload = buildExplainRequest(pageContext);
    const card = await requestEquationCard(payload);

    elements.jsonInput.value = JSON.stringify(card, null, 2);
    await saveCardForActiveTab(card);
    renderPreview();
    setStatus("Explained the current selection and updated the preview.", "success");
  } catch (error) {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError && runtimeError.message) {
      setStatus(`Explain error: ${runtimeError.message}`, "error");
      return;
    }
    setStatus(`Explain error: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

function renderPreview() {
  try {
    const card = parseCurrentCard();
    if (!previewFrameReady || !elements.previewFrame.contentWindow) {
      setStatus("Preview frame is still loading.", "");
      return;
    }
    elements.previewFrame.contentWindow.postMessage({
      type: "render-equation-card",
      payload: card
    }, "*");
    setStatus("Preview updated.", "success");
  } catch (error) {
    setStatus(`Preview error: ${error.message}`, "error");
  }
}

async function injectIntoPage() {
  try {
    const card = parseCurrentCard();
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab || typeof tab.id !== "number") {
      throw new Error("No active tab is available.");
    }

    const response = await sendTabMessageWithRetry(tab, {
      type: "show-equation-story",
      payload: card
    });

    if (!response || response.ok !== true) {
      throw new Error(response && response.error ? response.error : "The page did not accept the overlay.");
    }

    setStatus("Injected the floating equation card into the current page.", "success");
  } catch (error) {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError && runtimeError.message) {
      setStatus(`Inject error: ${runtimeError.message}`, "error");
      return;
    }
    setStatus(`Inject error: ${error.message}`, "error");
  }
}

function parseCurrentCard() {
  let payload;
  try {
    payload = JSON.parse(elements.jsonInput.value);
  } catch (error) {
    throw new Error("Input is not valid JSON.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Top-level JSON value must be an object.");
  }

  if (payload.version !== "equation-card/v1") {
    throw new Error("Expected version equation-card/v1.");
  }

  ["title", "domain", "displayLatex", "summary", "intuition"].forEach((key) => {
    if (typeof payload[key] !== "string" || !payload[key].trim()) {
      throw new Error(`Missing required string field: ${key}`);
    }
  });

  if (!Array.isArray(payload.legend) || !payload.legend.length) {
    throw new Error("legend must be a non-empty array.");
  }

  if (!Array.isArray(payload.highlights) || !payload.highlights.length) {
    throw new Error("highlights must be a non-empty array.");
  }

  if (!Array.isArray(payload.walkthrough) || !payload.walkthrough.length) {
    throw new Error("walkthrough must be a non-empty array.");
  }

  return payload;
}

async function getPageContext() {
  const tab = await getActiveTab();

  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab is available.");
  }

  try {
    const response = await sendTabMessageWithRetry(tab, {
      type: "collect-equation-context"
    });

    if (!response || response.ok !== true || !response.payload) {
      throw new Error(response && response.error ? response.error : "Could not collect the current page selection.");
    }

    return response.payload;
  } catch (error) {
    const pdfContext = await tryPdfEquationFallback(tab, error);
    if (pdfContext) {
      return pdfContext;
    }

    const clipboardContext = await tryClipboardEquationFallback(tab, error);
    if (clipboardContext) {
      return clipboardContext;
    }
    throw error;
  }
}

async function sendTabMessageWithRetry(tab, message) {
  try {
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (!messageText.includes("Receiving end does not exist")) {
      throw error;
    }

    await ensureContentScriptReady(tab);
    return chrome.tabs.sendMessage(tab.id, message);
  }
}

async function ensureContentScriptReady(tab) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab is available.");
  }

  if (!isInjectableUrl(tab.url)) {
    throw new Error("This page does not allow extension scripting. Try a normal http or https page.");
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "equation-story-ping"
    });
    return;
  } catch (_error) {
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["content_overlay.css"]
    }).catch(() => {});

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_script.js"]
    });
  }
}

function isInjectableUrl(url) {
  return typeof url === "string" && /^https?:/i.test(url);
}

async function tryPdfEquationFallback(tab, originalError) {
  if (!isPdfLikeTab(tab)) {
    return null;
  }

  const snapshotDataUrl = await captureVisibleTabSnapshot(tab);
  const clipboardText = await readClipboardTextSafely();
  const selectedText = cleanClipboardMathText(clipboardText);

  if (!selectedText && !snapshotDataUrl) {
    const originalMessage = originalError instanceof Error ? originalError.message : String(originalError || "");
    throw new Error(
      `PDF equation capture needs either copied equation text or a visible page snapshot. Original error: ${originalMessage || "No additional details."}`
    );
  }

  return {
    selectedText,
    guessedLatex: selectedText,
    selectionKind: snapshotDataUrl ? "pdf-snapshot" : "clipboard",
    mathSource: snapshotDataUrl ? "pdf-snapshot" : "clipboard",
    surroundingText: buildPdfSurroundingText(selectedText),
    pageContext: buildClipboardPageContext(tab),
    pageSnapshotDataUrl: snapshotDataUrl,
    pageTitle: tab.title || "",
    pageUrl: tab.url || ""
  };
}

async function tryClipboardEquationFallback(tab, originalError) {
  if (!shouldUseClipboardFallback(tab, originalError)) {
    return null;
  }

  const clipboardText = await readClipboardTextSafely();
  if (clipboardText === null) {
    throw new Error("This page does not expose equation DOM to the extension. Copy the equation text first, then click Explain Selection again.");
  }

  const selectedText = cleanClipboardMathText(clipboardText);
  if (!selectedText) {
    throw new Error("This page does not expose equation DOM to the extension. Copy the equation text first, then click Explain Selection again.");
  }

  return {
    selectedText,
    guessedLatex: selectedText,
    selectionKind: "clipboard",
    mathSource: "clipboard",
    surroundingText: buildClipboardSurroundingText(tab, selectedText),
    pageContext: buildClipboardPageContext(tab),
    pageTitle: tab.title || "",
    pageUrl: tab.url || ""
  };
}

function shouldUseClipboardFallback(tab, originalError) {
  if (isPdfLikeTab(tab) || !isInjectableUrl(tab && tab.url)) {
    return true;
  }

  const message = String(originalError && originalError.message ? originalError.message : originalError || "").toLowerCase();
  return message.includes("does not allow extension scripting");
}

function isPdfLikeTab(tab) {
  const url = String(tab && tab.url ? tab.url : "").toLowerCase();
  const title = String(tab && tab.title ? tab.title : "").toLowerCase();
  return (
    url.includes(".pdf") ||
    url.includes("/pdf/") ||
    url.includes("pdfjs") ||
    title.endsWith(".pdf") ||
    title.includes(" pdf")
  );
}

function cleanClipboardMathText(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  return looksLikeMathText(text) ? text : "";
}

function looksLikeMathText(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }

  return /[=+\-*/^_\\]|[∑∫∞≤≥≈∂ϕφλμαβγπΠΔΩ]/u.test(text);
}

function buildClipboardSurroundingText(tab, selectedText) {
  const hints = [
    "Equation copied from a PDF or another non-scriptable page."
  ];

  return `${selectedText}\n\n${hints.join("\n")}`.trim();
}

function buildExplainRequest(context) {
  const guessedLatex = context.guessedLatex || context.selectedText;
  const surroundingText = buildSurroundingText(context, {
    includePageContext: Boolean(elements.includePageContextToggle && elements.includePageContextToggle.checked)
  });
  return {
    selected_text: context.selectedText,
    guessed_latex: guessedLatex,
    surrounding_text: surroundingText,
    page_title: context.pageTitle,
    page_url: context.pageUrl,
    page_snapshot_data_url: context.pageSnapshotDataUrl || undefined,
    audience: "undergraduate",
    difficulty: "standard",
    domain_hint: inferDomainHint(context)
  };
}

function buildSurroundingText(context, options = {}) {
  const base = String(context.surroundingText || "").trim();
  const pageContext = String(context.pageContext || "").trim();
  const hints = [];

  if (context.mathSource) {
    hints.push(`math_source=${context.mathSource}`);
  }
  if (context.selectionKind) {
    hints.push(`selection_kind=${context.selectionKind}`);
  }
  if (context.guessedLatex && context.guessedLatex !== context.selectedText) {
    hints.push(`extracted_math=${context.guessedLatex}`);
  }

  const sections = [];
  if (base) {
    sections.push(base);
  }
  if (options.includePageContext && pageContext) {
    sections.push(`[Page context]\n${pageContext}`);
  }
  if (hints.length) {
    sections.push(`[Equation Story hints]\n${hints.join("\n")}`);
  }

  return sections.join("\n\n").trim();
}

async function requestEquationCard(payload) {
  const backendBaseUrl = normalizeBackendBaseUrl(elements.backendUrlInput.value);
  const response = await chrome.runtime.sendMessage({
    type: "fetch-equation-card",
    backendBaseUrl,
    payload
  });

  if (!response || response.ok !== true || !response.payload || !response.payload.card) {
    throw new Error(response && response.error ? response.error : "The background worker could not reach the backend.");
  }

  if (response.payload.backendBaseUrl && response.payload.backendBaseUrl !== backendBaseUrl) {
    elements.backendUrlInput.value = response.payload.backendBaseUrl;
    await chrome.storage.local.set({
      backendBaseUrl: response.payload.backendBaseUrl
    });
  }

  return response.payload.card;
}

async function readErrorPayload(response) {
  const text = await response.text();
  if (!text.trim()) {
    return "";
  }

  try {
    const payload = JSON.parse(text);
    if (payload && typeof payload === "object") {
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim();
      }
      if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error.trim();
      }
    }
  } catch (_error) {
    return text.trim();
  }

  return text.trim();
}

function inferDomainHint(context) {
  const combined = `${context.selectedText || ""} ${context.surroundingText || ""} ${context.pageTitle || ""}`.toLowerCase();
  if (combined.includes("fourier") || combined.includes("signal") || combined.includes("frequency")) {
    return "signals";
  }
  if (combined.includes("integral") || combined.includes("derivative")) {
    return "calculus";
  }
  if (combined.includes("activation") || combined.includes("dataset") || combined.includes("loss") || combined.includes("model")) {
    return "machine learning";
  }
  return "general";
}

function normalizeBackendBaseUrl(value) {
  const trimmed = String(value || "").trim() || DEFAULT_BACKEND_URL;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_error) {
    throw new Error("Backend URL is not valid.");
  }

  return parsed.toString().replace(/\/$/, "");
}

function setBusy(isBusy) {
  elements.explainButton.disabled = isBusy;
  elements.explainButton.classList.toggle("is-busy", isBusy);
}

function setStatus(message, tone) {
  elements.statusBar.textContent = message;
  elements.statusBar.className = "status-bar";
  if (tone === "success") {
    elements.statusBar.classList.add("is-success");
  } else if (tone === "error") {
    elements.statusBar.classList.add("is-error");
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  return tab || null;
}

function getTabStateKey(tab) {
  if (!tab) {
    return "";
  }

  const url = normalizePageStateUrl(tab.url);
  if (url) {
    return `page:${url}`;
  }

  return typeof tab.id === "number" ? `tab:${tab.id}` : "";
}

function normalizePageStateUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch (_error) {
    return url.trim();
  }
}

async function readClipboardTextSafely() {
  try {
    return await navigator.clipboard.readText();
  } catch (_error) {
    return null;
  }
}

async function captureVisibleTabSnapshot(tab) {
  if (!tab || typeof tab.windowId !== "number") {
    return "";
  }

  try {
    return await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "jpeg",
      quality: 85
    });
  } catch (_error) {
    return "";
  }
}

function buildPdfSurroundingText(selectedText) {
  const hints = [
    "The selected content came from a PDF page.",
    "If selected_text is empty, infer the target equation from the attached visible page snapshot and the PDF document context."
  ];

  if (selectedText) {
    return `${selectedText}\n\n${hints.join("\n")}`.trim();
  }

  return hints.join("\n");
}

function buildClipboardPageContext(tab) {
  const title = String(tab && tab.title ? tab.title : "").trim();
  const url = String(tab && tab.url ? tab.url : "").trim();
  const parts = [];

  if (title) {
    parts.push(`Page title: ${title}`);
  }
  if (url) {
    parts.push(`Page URL: ${url}`);
  }

  return parts.join("\n");
}

function isProbablyUrl(text) {
  return /^(https?:\/\/|www\.)/i.test(String(text || "").trim());
}

function looksLikeMathText(value) {
  const text = String(value || "").trim();
  if (!text || isProbablyUrl(text)) {
    return false;
  }

  return /[=+\-*/^_\\]|[\u2211\u222b\u221e\u2264\u2265\u2248\u2202\u03d5\u03c6\u03bb\u03bc\u03b1\u03b2\u03b3\u03c0\u03a0\u0394\u03a9]/u.test(text);
}
