const SAMPLE_CARD = {
  version: "equation-card/v1",
  title: "Discrete Fourier coefficient",
  domain: "signals",
  displayLatex:
    String.raw`\[\class{role-definition}{X_k}=\class{role-normalizer}{\frac{1}{N}}\class{role-operator}{\sum_{\class{role-index}{n}=0}^{N-1}}\class{role-quantity}{x_n}\class{role-operator}{e^{i 2\pi k n / N}}\]`,
  selfDescriptiveSpans: [
    { text: "To recover the " },
    { text: "Fourier coefficient ", role: "definition" },
    { latex: "X_k", role: "definition" },
    { text: ", average " },
    { latex: "\\frac{1}{N}", role: "normalizer" },
    { text: " the " },
    { text: "phase-rotated samples ", role: "operator" },
    { latex: "x_n e^{i 2\\pi k n / N}", role: "operator" },
    { text: " as " },
    { latex: "n", role: "index" },
    { text: " runs through the signal." }
  ],
  story: [
    { text: "To find " },
    { text: "the coefficient ", role: "definition" },
    { latex: "X_k", role: "definition" },
    { text: ", average ", role: "normalizer" },
    { latex: "\\frac{1}{N}", role: "normalizer" },
    { text: " the rotated sample contributions from each ", role: "operator" },
    { latex: "x_n", role: "quantity" },
    { text: " as the sample ", role: "index" },
    { latex: "n", role: "index" },
    { text: " runs." }
  ],
  summarySpans: [
    { text: "This computes the " },
    { text: "Fourier coefficient ", role: "definition" },
    { latex: "X_k", role: "definition" },
    { text: " by averaging the rotated " },
    { latex: "x_n", role: "quantity" },
    { text: " contributions." }
  ],
  summary: "This computes the amount of frequency k present in the signal.",
  intuitionSpans: [
    { text: "Rotate each " },
    { latex: "x_n", role: "quantity" },
    { text: " by " },
    { latex: "e^{i 2\\pi k n / N}", role: "operator" },
    { text: ", add them, and scale by " },
    { latex: "\\frac{1}{N}", role: "normalizer" },
    { text: "." }
  ],
  intuition: "Rotate each sample at frequency k, add the rotated samples, and average the result.",
  legend: [
    {
      role: "definition",
      label: "Output",
      color: "#6a00ff",
      meaning: "The Fourier coefficient at frequency \\(k\\).",
      latex: "X_k"
    },
    {
      role: "normalizer",
      label: "Average",
      color: "#d633ff",
      meaning: "Divide by \\(N\\) so the total becomes an average.",
      latex: "\\frac{1}{N}"
    },
    {
      role: "operator",
      label: "Sweep all samples",
      color: "#ff4d1a",
      meaning: "Add the contribution from every sample after rotation.",
      latex: "e^{i 2\\pi k n / N}"
    },
    {
      role: "quantity",
      label: "Signal sample",
      color: "#0057ff",
      meaning: "The \\(n\\)th value of the original signal.",
      latex: "x_n"
    },
    {
      role: "index",
      label: "Loop variable",
      color: "#c99500",
      meaning: "\\(n\\) runs over samples while \\(k\\) selects the frequency.",
      latex: "n"
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
const LATEST_CARD_STATE_KEY = "latestEquationCardState";
const SNIP_SESSION_STATE_KEY = "pendingSnipSession";
const MAX_SAVED_TAB_STATES = 24;
const MIN_SNIP_SELECTION_SIZE = 10;

const snipState = {
  active: false,
  dragging: false,
  session: null,
  startX: 0,
  startY: 0,
  rect: null
};

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);
  await loadSettings();
  await restorePendingSnipSession();
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
  elements.snipButton = document.getElementById("snip-btn");
  elements.previewButton = document.getElementById("preview-btn");
  elements.injectButton = document.getElementById("inject-btn");
  elements.statusBar = document.getElementById("status-bar");
  elements.previewFrame = document.getElementById("preview-frame");
  elements.snipPanel = document.getElementById("snip-panel");
  elements.snipPageLabel = document.getElementById("snip-page-label");
  elements.snipSurface = document.getElementById("snip-surface");
  elements.snipImage = document.getElementById("snip-image");
  elements.snipSelection = document.getElementById("snip-selection");
  elements.snipConfirmButton = document.getElementById("snip-confirm-btn");
  elements.snipCancelButton = document.getElementById("snip-cancel-btn");
}

function bindEvents() {
  elements.sampleButton.addEventListener("click", () => {
    loadSample();
    renderPreview();
  });

  elements.explainButton.addEventListener("click", async () => {
    await explainSelection();
  });

  elements.snipButton.addEventListener("click", async () => {
    await startSnipMode();
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

  elements.snipConfirmButton.addEventListener("click", async () => {
    await explainSnipSelection();
  });

  elements.snipCancelButton.addEventListener("click", async () => {
    await cancelSnipMode();
  });

  bindSnipSurfaceEvents();

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

function handleRuntimeMessage(message) {
  if (!message || message.type !== "equation-card-updated" || !message.card) {
    return false;
  }

  elements.jsonInput.value = JSON.stringify(message.card, null, 2);
  hideSnipPanel();
  renderPreview();
  setStatus("Updated from the latest saved explanation card.", "success");
  return false;
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
  const stored = await chrome.storage.local.get({
    [SAVED_TAB_STATE_KEY]: {},
    [LATEST_CARD_STATE_KEY]: null
  });
  const savedState = stored[SAVED_TAB_STATE_KEY] || {};

  if (tab) {
    const tabKey = getTabStateKey(tab);
    const entry = tabKey ? savedState[tabKey] : null;
    if (entry && entry.card) {
      elements.jsonInput.value = JSON.stringify(entry.card, null, 2);
      return true;
    }
  }

  const latest = stored[LATEST_CARD_STATE_KEY];
  if (latest && latest.card) {
    elements.jsonInput.value = JSON.stringify(latest.card, null, 2);
    return true;
  }

  return false;
}

async function saveCardForActiveTab(card) {
  const tab = await getActiveTab();
  const stored = await chrome.storage.local.get({
    [SAVED_TAB_STATE_KEY]: {}
  });
  const savedState = stored[SAVED_TAB_STATE_KEY] || {};

  if (tab) {
    const tabKey = getTabStateKey(tab);
    if (tabKey) {
      savedState[tabKey] = {
        card,
        updatedAt: Date.now(),
        pageTitle: tab.title || "",
        pageUrl: tab.url || ""
      };
    }
  }

  await chrome.storage.local.set({
    [SAVED_TAB_STATE_KEY]: trimSavedTabStates(savedState),
    [LATEST_CARD_STATE_KEY]: {
      card,
      updatedAt: Date.now(),
      pageTitle: tab && tab.title ? tab.title : "",
      pageUrl: tab && tab.url ? tab.url : ""
    }
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

function bindSnipSurfaceEvents() {
  elements.snipSurface.addEventListener("pointerdown", (event) => {
    if (!snipState.active || !elements.snipImage.src) {
      return;
    }

    const point = getSnipSurfacePoint(event);
    if (!point) {
      return;
    }

    snipState.dragging = true;
    snipState.startX = point.x;
    snipState.startY = point.y;
    snipState.rect = {
      left: point.x,
      top: point.y,
      width: 0,
      height: 0
    };
    updateSnipSelectionBox(snipState.rect);
    elements.snipSurface.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  elements.snipSurface.addEventListener("pointermove", (event) => {
    if (!snipState.active || !snipState.dragging) {
      return;
    }

    const point = getSnipSurfacePoint(event);
    if (!point) {
      return;
    }

    snipState.rect = buildSnipRect(snipState.startX, snipState.startY, point.x, point.y);
    updateSnipSelectionBox(snipState.rect);
    event.preventDefault();
  });

  const finishSelection = (event) => {
    if (!snipState.active || !snipState.dragging) {
      return;
    }

    snipState.dragging = false;
    const point = getSnipSurfacePoint(event);
    if (!point) {
      clearSnipSelection();
      return;
    }

    const rect = buildSnipRect(snipState.startX, snipState.startY, point.x, point.y);
    if (rect.width < MIN_SNIP_SELECTION_SIZE || rect.height < MIN_SNIP_SELECTION_SIZE) {
      clearSnipSelection();
      return;
    }

    snipState.rect = rect;
    updateSnipSelectionBox(rect);
  };

  elements.snipSurface.addEventListener("pointerup", finishSelection);
  elements.snipSurface.addEventListener("pointercancel", finishSelection);
}

async function restorePendingSnipSession() {
  const stored = await chrome.storage.local.get({
    [SNIP_SESSION_STATE_KEY]: null
  });
  const session = stored[SNIP_SESSION_STATE_KEY];
  if (!session || !session.snapshotDataUrl) {
    hideSnipPanel();
    return false;
  }

  showSnipPanel(session);
  return true;
}

async function startSnipMode() {
  try {
    await saveSettings();
    setBusy(true);

    const tab = await getActiveTab();
    if (!tab || typeof tab.id !== "number") {
      throw new Error("No active tab is available.");
    }

    const response = await chrome.runtime.sendMessage({
      type: "start-snip-session",
      tabId: tab.id,
      windowId: tab.windowId,
      pageTitle: tab.title || "",
      pageUrl: tab.url || "",
      backendBaseUrl: normalizeBackendBaseUrl(elements.backendUrlInput.value),
      includePageContext: Boolean(elements.includePageContextToggle && elements.includePageContextToggle.checked)
    });

    if (!response || response.ok !== true || !response.payload || !response.payload.snapshotDataUrl) {
      throw new Error(response && response.error ? response.error : "Could not start snip mode for this page.");
    }

    showSnipPanel(response.payload);
    setStatus("Draw a box around one equation in the screenshot below, then click Explain Snip.", "success");
  } catch (error) {
    setStatus(`Snip error: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

async function explainSnipSelection() {
  try {
    if (!snipState.active || !snipState.session || !snipState.session.snapshotDataUrl) {
      throw new Error("Start Snip Equation first.");
    }
    if (!snipState.rect) {
      throw new Error("Draw a box around one equation first.");
    }

    setBusy(true);
    setStatus("Explaining the snipped equation...", "");

    const response = await chrome.runtime.sendMessage({
      type: "complete-snip-session",
      rect: {
        left: snipState.rect.left,
        top: snipState.rect.top,
        width: snipState.rect.width,
        height: snipState.rect.height,
        viewportWidth: Math.max(1, elements.snipImage.clientWidth),
        viewportHeight: Math.max(1, elements.snipImage.clientHeight)
      }
    });

    if (!response || response.ok !== true || !response.payload || !response.payload.card) {
      throw new Error(response && response.error ? response.error : "The background worker could not explain the snipped equation.");
    }

    if (response.payload.backendBaseUrl && response.payload.backendBaseUrl !== elements.backendUrlInput.value) {
      elements.backendUrlInput.value = response.payload.backendBaseUrl;
      await chrome.storage.local.set({
        backendBaseUrl: response.payload.backendBaseUrl
      });
    }

    elements.jsonInput.value = JSON.stringify(response.payload.card, null, 2);
    hideSnipPanel();
    renderPreview();
    setStatus("Explained the snipped equation and updated the preview.", "success");
  } catch (error) {
    setStatus(`Snip error: ${error.message}`, "error");
  } finally {
    setBusy(false);
  }
}

async function cancelSnipMode() {
  await chrome.storage.local.remove(SNIP_SESSION_STATE_KEY);
  hideSnipPanel();
  setStatus("Snip canceled.", "");
}

function showSnipPanel(session) {
  snipState.active = true;
  snipState.session = session;
  snipState.dragging = false;
  snipState.rect = null;

  document.body.classList.add("snip-active");
  elements.snipPanel.classList.remove("is-hidden");
  elements.snipImage.src = session.snapshotDataUrl;
  elements.snipPageLabel.textContent = buildSnipSessionLabel(session);
  clearSnipSelection();
}

function hideSnipPanel() {
  snipState.active = false;
  snipState.dragging = false;
  snipState.session = null;
  snipState.rect = null;

  document.body.classList.remove("snip-active");
  elements.snipPanel.classList.add("is-hidden");
  elements.snipImage.removeAttribute("src");
  elements.snipPageLabel.textContent = "";
  clearSnipSelection();
}

function clearSnipSelection() {
  snipState.rect = null;
  elements.snipSelection.classList.add("is-hidden");
  elements.snipSelection.style.left = "";
  elements.snipSelection.style.top = "";
  elements.snipSelection.style.width = "";
  elements.snipSelection.style.height = "";
}

function updateSnipSelectionBox(rect) {
  if (!rect) {
    clearSnipSelection();
    return;
  }

  elements.snipSelection.classList.remove("is-hidden");
  elements.snipSelection.style.left = `${rect.left}px`;
  elements.snipSelection.style.top = `${rect.top}px`;
  elements.snipSelection.style.width = `${rect.width}px`;
  elements.snipSelection.style.height = `${rect.height}px`;
}

function buildSnipRect(startX, startY, currentX, currentY) {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY)
  };
}

function getSnipSurfacePoint(event) {
  const imageRect = elements.snipImage.getBoundingClientRect();
  if (!imageRect.width || !imageRect.height) {
    return null;
  }

  const x = clamp(event.clientX - imageRect.left, 0, imageRect.width);
  const y = clamp(event.clientY - imageRect.top, 0, imageRect.height);
  return {
    x,
    y
  };
}

function buildSnipSessionLabel(session) {
  const pageTitle = String(session && session.pageTitle ? session.pageTitle : "").trim();
  const pageUrl = String(session && session.pageUrl ? session.pageUrl : "").trim();
  if (pageTitle && pageUrl) {
    return `${pageTitle}\n${pageUrl}`;
  }
  return pageTitle || pageUrl || "Captured page";
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

  const clipboardText = await readClipboardTextSafely();
  const selectedText = cleanClipboardMathText(clipboardText);

  if (!selectedText) {
    throw new Error("PDF selection capture is unreliable here. Use Snip Equation in this popup to draw a box around the target equation, or copy the equation text first.");
  }

  return {
    selectedText,
    guessedLatex: selectedText,
    selectionKind: "clipboard",
    mathSource: "clipboard",
    surroundingText: buildPdfSurroundingText(selectedText),
    pageContext: buildClipboardPageContext(tab),
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

function looksLikeMathTextLegacy(value) {
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
  elements.snipButton.disabled = isBusy;
  elements.snipButton.classList.toggle("is-busy", isBusy);
  elements.snipConfirmButton.disabled = isBusy;
  elements.snipConfirmButton.classList.toggle("is-busy", isBusy);
  elements.snipCancelButton.disabled = isBusy;
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

function buildPdfSurroundingText(selectedText) {
  const hints = [
    "The selected content came from a PDF page.",
    "Use the PDF page title and URL as document context when the copied equation is standalone."
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
