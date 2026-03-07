const elements = {};

window.addEventListener("DOMContentLoaded", () => {
  cacheElements();
});

window.addEventListener("message", async (event) => {
  if (!event.data || event.data.type !== "render-equation-card") {
    return;
  }

  try {
    const card = normalizeCard(event.data.payload);
    renderCard(card);
    await typesetMath(card.displayLatex);
    elements.statusCopy.textContent = "Rendered the current equation card.";
  } catch (error) {
    elements.statusCopy.textContent = `Render error: ${error.message}`;
  }
});

function cacheElements() {
  elements.cardTitle = document.getElementById("card-title");
  elements.statusCopy = document.getElementById("status-copy");
  elements.mathCanvas = document.getElementById("math-canvas");
  elements.summaryCopy = document.getElementById("summary-copy");
  elements.intuitionCopy = document.getElementById("intuition-copy");
  elements.legendGrid = document.getElementById("legend-grid");
  elements.highlightGrid = document.getElementById("highlight-grid");
  elements.walkthroughList = document.getElementById("walkthrough-list");
  elements.notesSection = document.getElementById("notes-section");
  elements.notesList = document.getElementById("notes-list");
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
