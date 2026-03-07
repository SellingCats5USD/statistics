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

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  loadSample();
});

function cacheElements() {
  elements.jsonInput = document.getElementById("json-input");
  elements.sampleButton = document.getElementById("sample-btn");
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

  elements.jsonInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      renderPreview();
    }
  });
}

function loadSample() {
  elements.jsonInput.value = JSON.stringify(SAMPLE_CARD, null, 2);
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

function setStatus(message, tone) {
  elements.statusBar.textContent = message;
  elements.statusBar.className = "status-bar";
  if (tone === "success") {
    elements.statusBar.classList.add("is-success");
  } else if (tone === "error") {
    elements.statusBar.classList.add("is-error");
  }
}
