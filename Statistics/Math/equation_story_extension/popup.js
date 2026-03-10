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
const DEFAULT_BACKEND_URL = "http://localhost:8787";

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  await loadSettings();
  loadSample();
});

function cacheElements() {
  elements.backendUrlInput = document.getElementById("backend-url-input");
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

  elements.jsonInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      renderPreview();
    }
  });
}

async function loadSettings() {
  const settings = await chrome.storage.local.get({
    backendBaseUrl: DEFAULT_BACKEND_URL
  });
  elements.backendUrlInput.value = settings.backendBaseUrl || DEFAULT_BACKEND_URL;
}

async function saveSettings() {
  const backendBaseUrl = normalizeBackendBaseUrl(elements.backendUrlInput.value);
  elements.backendUrlInput.value = backendBaseUrl;
  await chrome.storage.local.set({
    backendBaseUrl
  });
}

function loadSample() {
  elements.jsonInput.value = JSON.stringify(SAMPLE_CARD, null, 2);
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

    const response = await chrome.tabs.sendMessage(tab.id, {
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
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });

  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab is available.");
  }

  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "collect-equation-context"
  });

  if (!response || response.ok !== true || !response.payload) {
    throw new Error(response && response.error ? response.error : "Could not collect the current page selection.");
  }

  return response.payload;
}

function buildExplainRequest(context) {
  return {
    selected_text: context.selectedText,
    guessed_latex: context.selectedText,
    surrounding_text: context.surroundingText,
    page_title: context.pageTitle,
    page_url: context.pageUrl,
    audience: "undergraduate",
    difficulty: "standard",
    domain_hint: inferDomainHint(context)
  };
}

async function requestEquationCard(payload) {
  const backendBaseUrl = normalizeBackendBaseUrl(elements.backendUrlInput.value);
  const response = await fetch(`${backendBaseUrl}/api/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await readErrorPayload(response);
    throw new Error(details || `Backend request failed with status ${response.status}.`);
  }

  return response.json();
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
