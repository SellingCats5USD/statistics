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

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  bindEvents();
  loadSample();
  renderFromInput();
});

function cacheElements() {
  elements.previewRoot = document.getElementById("preview-root");
  elements.jsonInput = document.getElementById("json-input");
  elements.sampleButton = document.getElementById("sample-btn");
  elements.renderButton = document.getElementById("render-btn");
  elements.statusBar = document.getElementById("status-bar");
  elements.cardTitle = document.getElementById("card-title");
  elements.mathCanvas = document.getElementById("math-canvas");
  elements.storySection = document.getElementById("story-section");
  elements.storyLine = document.getElementById("story-line");
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
    selfDescriptiveSpans: normalizeSentenceSpans(payload.selfDescriptiveSpans, payload.story),
    story: Array.isArray(payload.story) ? payload.story.map(normalizeStorySpan) : [],
    summarySpans: normalizeCopySpans(payload.summarySpans, payload, "summary"),
    intuitionSpans: normalizeCopySpans(payload.intuitionSpans, payload, "intuition"),
    notes: Array.isArray(payload.notes) ? payload.notes.filter(Boolean) : []
  };
}

function renderCard(card) {
  elements.cardTitle.textContent = card.title;
  renderStory(card.selfDescriptiveSpans.length ? card.selfDescriptiveSpans : card.story);
  renderRichCopy(elements.summaryCopy, card.summarySpans, card.summary);
  renderRichCopy(elements.intuitionCopy, card.intuitionSpans, card.intuition);

  renderLegend(card.legend);
  renderHighlights(card.highlights);
  renderWalkthrough(card.walkthrough);
  renderNotes(card.notes);
}

function normalizeStorySpan(span) {
  if (!span || typeof span !== "object" || Array.isArray(span)) {
    throw new Error("story entries must be objects.");
  }

  const text = typeof span.text === "string" ? span.text : "";
  const latex = typeof span.latex === "string" ? span.latex : "";
  if (!text.trim() && !latex.trim()) {
    throw new Error("Each story span must include text or latex.");
  }

  return {
    text,
    latex,
    role: typeof span.role === "string" ? span.role : ""
  };
}

function normalizeSentenceSpans(primarySpans, fallbackSpans) {
  const primary = Array.isArray(primarySpans) ? primarySpans.map(normalizeStorySpan) : [];
  if (primary.length) {
    return primary;
  }

  return Array.isArray(fallbackSpans) ? fallbackSpans.map(normalizeStorySpan) : [];
}

function normalizeCopySpans(spans, payload, fieldName) {
  const normalized = Array.isArray(spans) ? spans.map(normalizeStorySpan) : [];
  if (normalized.filter((span) => span.role).length >= 2) {
    return normalized;
  }

  return synthesizeCopySpans(payload, fieldName, normalized);
}

function synthesizeCopySpans(payload, fieldName, existingSpans) {
  if (existingSpans.length >= 2) {
    return existingSpans;
  }

  const semanticMap = collectSemanticEntriesByRole(payload);
  if (!semanticMap.size) {
    return existingSpans;
  }

  return fieldName === "summary" ? buildSummaryFallback(semanticMap) : buildIntuitionFallback(semanticMap);
}

function collectSemanticEntries(payload) {
  const highlights = Array.isArray(payload.highlights) ? payload.highlights.map(normalizeSemanticEntry).filter(Boolean) : [];
  if (highlights.length) {
    return highlights;
  }

  return Array.isArray(payload.legend) ? payload.legend.map(normalizeSemanticEntry).filter(Boolean) : [];
}

function collectSemanticEntriesByRole(payload) {
  const semanticEntries = collectSemanticEntries(payload);
  const map = new Map();
  semanticEntries.forEach((entry) => {
    if (!map.has(entry.role)) {
      map.set(entry.role, entry);
    }
  });
  return map;
}

function normalizeSemanticEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const role = typeof entry.role === "string" ? entry.role.trim() : "";
  const label = typeof entry.label === "string" ? entry.label.trim() : "";
  const latex = typeof entry.latex === "string" ? entry.latex.trim() : "";
  if (!role || (!label && !latex)) {
    return null;
  }

  return { role, label, latex };
}

function buildSummaryFallback(entriesByRole) {
  const definition = entriesByRole.get("definition");
  const operator = entriesByRole.get("operator");
  const normalizer = entriesByRole.get("normalizer");
  const quantity = entriesByRole.get("quantity");

  const spans = [{ text: "Read this as " }];
  pushEntryPhrase(spans, definition || quantity || operator, true);

  if (operator && operator !== definition) {
    spans.push({ text: ", obtained through " });
    pushEntryPhrase(spans, operator, true);
  }

  if (normalizer) {
    spans.push({ text: ", scaled by " });
    pushEntryPhrase(spans, normalizer, true);
  }

  if (quantity && quantity !== definition) {
    spans.push({ text: ", acting on " });
    pushEntryPhrase(spans, quantity, true);
  }

  spans.push({ text: "." });
  return spans;
}

function buildIntuitionFallback(entriesByRole) {
  const definition = entriesByRole.get("definition");
  const operator = entriesByRole.get("operator");
  const normalizer = entriesByRole.get("normalizer");
  const quantity = entriesByRole.get("quantity");

  const spans = [{ text: "Think of " }];
  pushEntryPhrase(spans, operator || quantity || definition, true);

  if (quantity && quantity !== operator) {
    spans.push({ text: " gathering " });
    pushEntryPhrase(spans, quantity, true);
  }

  if (normalizer) {
    spans.push({ text: ", then rescaling by " });
    pushEntryPhrase(spans, normalizer, true);
  }

  if (definition) {
    spans.push({ text: " to recover " });
    pushEntryPhrase(spans, definition, true);
  }

  spans.push({ text: "." });
  return spans;
}

function pushEntryPhrase(target, entry, includeLatex) {
  if (!entry) {
    return;
  }

  if (entry.label) {
    target.push({ text: entry.label.toLowerCase(), role: entry.role });
  }

  if (includeLatex && entry.latex) {
    target.push({ text: entry.label ? " " : "", role: entry.role });
    target.push({ latex: entry.latex, role: entry.role });
  }
}

function renderStory(spans) {
  elements.storyLine.replaceChildren();
  elements.storySection.hidden = !spans.length;

  spans.forEach((span) => {
    elements.storyLine.appendChild(createRichSpanNode(span, "story-span", "story-inline-math"));
  });
}

function renderRichCopy(element, spans, fallbackText) {
  element.replaceChildren();
  const hasRichSpans = Array.isArray(spans) && spans.length > 0;
  element.classList.toggle("rich-copy", hasRichSpans);

  if (!hasRichSpans) {
    element.textContent = fallbackText || "";
    return;
  }

  spans.forEach((span) => {
    element.appendChild(createRichSpanNode(span, "rich-span", "rich-inline-math"));
  });
}

function createRichSpanNode(span, spanClassName, mathClassName) {
  const node = document.createElement("span");
  node.className = spanClassName;
  if (span.role) {
    node.classList.add(`role-${span.role}`);
  }

  if (span.text) {
    node.appendChild(document.createTextNode(span.text));
  }

  if (span.latex) {
    const math = document.createElement("span");
    math.className = mathClassName;
    math.textContent = `\\(${span.latex}\\)`;
    node.appendChild(math);
  }

  return node;
}

function renderLegend(entries) {
  elements.legendGrid.replaceChildren();

  entries.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "legend-card";
    applyEntryColor(card, entry);

    const title = document.createElement("strong");
    title.textContent = entry.label || entry.role || "Legend item";

    const math = entry.latex ? document.createElement("div") : null;
    if (math) {
      math.className = "legend-math";
      math.textContent = `\\(${entry.latex}\\)`;
    }

    const body = document.createElement("small");
    body.textContent = entry.meaning || "";

    const tag = createRoleTag(entry);
    if (math) {
      card.append(title, math, body, tag);
    } else {
      card.append(title, body, tag);
    }
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

    const math = document.createElement("div");
    math.className = "highlight-math";
    math.textContent = `\\(${entry.latex || ""}\\)`;

    const body = document.createElement("p");
    body.textContent = entry.explanation || "";

    const tag = createRoleTag(entry);
    card.append(title, math, body, tag);
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
    window.MathJax.typesetClear([elements.previewRoot]);
  }

  await window.MathJax.typesetPromise([elements.previewRoot]);
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
