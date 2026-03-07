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

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  loadSample();
  renderFromInput();
});

function cacheElements() {
  elements.jsonInput = document.getElementById("json-input");
  elements.sampleButton = document.getElementById("sample-btn");
  elements.renderButton = document.getElementById("render-btn");
  elements.statusBar = document.getElementById("status-bar");
  elements.cardTitle = document.getElementById("card-title");
  elements.mathCanvas = document.getElementById("math-canvas");
  elements.summaryCopy = document.getElementById("summary-copy");
  elements.intuitionCopy = document.getElementById("intuition-copy");
  elements.legendGrid = document.getElementById("legend-grid");
  elements.highlightGrid = document.getElementById("highlight-grid");
  elements.walkthroughList = document.getElementById("walkthrough-list");
  elements.notesSection = document.getElementById("notes-section");
  elements.notesList = document.getElementById("notes-list");
}

function bindEvents() {
  elements.sampleButton.addEventListener("click", () => {
    loadSample();
    renderFromInput();
  });

  elements.renderButton.addEventListener("click", () => {
    renderFromInput();
  });

  elements.jsonInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      renderFromInput();
    }
  });
}

function loadSample() {
  elements.jsonInput.value = JSON.stringify(SAMPLE_CARD, null, 2);
}

async function renderFromInput() {
  try {
    const payload = JSON.parse(elements.jsonInput.value);
    const card = normalizeCard(payload);
    renderCard(card);
    await typesetMath(card.displayLatex);
    setStatus("Rendered the current equation card JSON.", "success");
  } catch (error) {
    setStatus(`Render error: ${error.message}`, "error");
  }
}

function normalizeCard(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Top-level JSON value must be an object.");
  }

  const requiredStrings = ["version", "title", "domain", "displayLatex", "summary", "intuition"];
  requiredStrings.forEach((key) => {
    if (typeof payload[key] !== "string" || !payload[key].trim()) {
      throw new Error(`Missing required string field: ${key}`);
    }
  });

  if (payload.version !== "equation-card/v1") {
    throw new Error("Unsupported version. Expected equation-card/v1.");
  }

  if (!Array.isArray(payload.legend) || !payload.legend.length) {
    throw new Error("legend must be a non-empty array.");
  }

  if (!Array.isArray(payload.highlights) || !payload.highlights.length) {
    throw new Error("highlights must be a non-empty array.");
  }

  if (!Array.isArray(payload.walkthrough) || !payload.walkthrough.length) {
    throw new Error("walkthrough must be a non-empty array.");
  }

  return {
    ...payload,
    notes: Array.isArray(payload.notes) ? payload.notes.filter(Boolean) : []
  };
}

function renderCard(card) {
  elements.cardTitle.textContent = card.title;
  elements.summaryCopy.textContent = card.summary;
  elements.intuitionCopy.textContent = card.intuition;

  renderLegend(card.legend);
  renderHighlights(card.highlights);
  renderWalkthrough(card.walkthrough);
  renderNotes(card.notes);
}

function renderLegend(entries) {
  elements.legendGrid.replaceChildren();

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "legend-card";
    applyEntryColor(card, entry);

    const title = document.createElement("strong");
    title.textContent = entry.label || entry.role || "Legend item";

    const body = document.createElement("small");
    body.textContent = entry.meaning || "";

    const tag = createRoleTag(entry);
    card.append(title, body, tag);
    elements.legendGrid.appendChild(card);
  });
}

function renderHighlights(entries) {
  elements.highlightGrid.replaceChildren();

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "highlight-card";
    applyEntryColor(card, entry);

    const title = document.createElement("strong");
    title.textContent = entry.label || entry.role || "Highlight";

    const code = document.createElement("code");
    code.textContent = entry.latex || "";

    const body = document.createElement("p");
    body.textContent = entry.explanation || "";

    const tag = createRoleTag(entry);
    card.append(title, code, body, tag);
    elements.highlightGrid.appendChild(card);
  });
}

function renderWalkthrough(steps) {
  elements.walkthroughList.replaceChildren();

  steps.forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    elements.walkthroughList.appendChild(item);
  });
}

function renderNotes(notes) {
  elements.notesList.replaceChildren();
  elements.notesSection.hidden = notes.length === 0;

  notes.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    elements.notesList.appendChild(item);
  });
}

function createRoleTag(entry) {
  const tag = document.createElement("div");
  tag.className = "role-tag";
  tag.style.setProperty("--entry-color", entry.color || roleColorFromName(entry.role));

  const dot = document.createElement("span");
  dot.className = "role-dot";

  const text = document.createElement("span");
  text.textContent = entry.role || "role";

  tag.append(dot, text);
  return tag;
}

function applyEntryColor(node, entry) {
  node.style.setProperty("--entry-color", entry.color || roleColorFromName(entry.role));
}

function roleColorFromName(role) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--${role || "quantity"}`).trim() || "#22313f";
}

async function typesetMath(displayLatex) {
  elements.mathCanvas.replaceChildren();
  elements.mathCanvas.textContent = displayLatex;

  if (!window.MathJax || !window.MathJax.typesetPromise) {
    throw new Error("MathJax did not load.");
  }

  if (window.MathJax.typesetClear) {
    window.MathJax.typesetClear([elements.mathCanvas]);
  }

  await window.MathJax.typesetPromise([elements.mathCanvas]);
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
