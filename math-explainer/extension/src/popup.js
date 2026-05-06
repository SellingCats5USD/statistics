const elements = {
  optionsButton: document.getElementById("options-button"),
  refreshSelectionButton: document.getElementById("refresh-selection-button"),
  snipButton: document.getElementById("snip-button"),
  manualToggleButton: document.getElementById("manual-toggle-button"),
  historyToggleButton: document.getElementById("history-toggle-button"),
  pasteClipboardButton: document.getElementById("paste-clipboard-button"),
  clearSnipButton: document.getElementById("clear-snip-button"),
  explainButton: document.getElementById("explain-button"),
  manualPanel: document.getElementById("manual-panel"),
  historyPanel: document.getElementById("history-panel"),
  historySearch: document.getElementById("history-search"),
  historyList: document.getElementById("history-list"),
  historyEmpty: document.getElementById("history-empty"),
  clearHistoryButton: document.getElementById("clear-history-button"),
  equationInput: document.getElementById("equation-input"),
  difficulty: document.getElementById("difficulty"),
  aidLength: document.getElementById("aid-length"),
  focusPrompt: document.getElementById("focus-prompt"),
  convertManualLatexButton: document.getElementById("convert-manual-latex-button"),
  includeScreenshot: document.getElementById("include-screenshot"),
  snipPreview: document.getElementById("snip-preview"),
  snipImage: document.getElementById("snip-image"),
  snipCropper: document.getElementById("snip-cropper"),
  snipStage: document.getElementById("snip-stage"),
  snipStageImage: document.getElementById("snip-stage-image"),
  snipSelection: document.getElementById("snip-selection"),
  cancelSnipButton: document.getElementById("cancel-snip-button"),
  useSnipButton: document.getElementById("use-snip-button"),
  status: document.getElementById("status"),
  card: document.getElementById("card"),
  cardDomain: document.getElementById("card-domain"),
  cardTitle: document.getElementById("card-title"),
  mathFallback: document.getElementById("math-fallback"),
  mathCanvas: document.getElementById("math-canvas"),
  latexCode: document.getElementById("latex-code"),
  copyLatexButton: document.getElementById("copy-latex-button"),
  storySection: document.getElementById("story-section"),
  selfDescriptive: document.getElementById("self-descriptive"),
  summary: document.getElementById("summary"),
  intuition: document.getElementById("intuition"),
  legend: document.getElementById("legend"),
  highlights: document.getElementById("highlights"),
  walkthrough: document.getElementById("walkthrough"),
  deepContextSection: document.getElementById("deep-context-section"),
  deepContext: document.getElementById("deep-context"),
  useCasesSection: document.getElementById("use-cases-section"),
  useCases: document.getElementById("use-cases"),
  strategySection: document.getElementById("strategy-section"),
  strategyTips: document.getElementById("strategy-tips"),
  graphSection: document.getElementById("graph-section"),
  graphTitle: document.getElementById("graph-title"),
  graphDescription: document.getElementById("graph-description"),
  graphDomainNote: document.getElementById("graph-domain-note"),
  graphViewStrip: document.getElementById("graph-view-strip"),
  graphViewSelect: document.getElementById("graph-view-select"),
  graphViewNote: document.getElementById("graph-view-note"),
  graphSvg: document.getElementById("graph-svg"),
  graphControls: document.getElementById("graph-controls"),
  notesSection: document.getElementById("notes-section"),
  notes: document.getElementById("notes")
};

let pageContext = {
  selected_text: "",
  guessed_latex: "",
  surrounding_text: "",
  page_title: "",
  page_url: ""
};
let attachedSnip = null;
let latexCopyStyle = "raw";
let highlightOpacity = 12;
let popupWidth = 820;
let mathRendererHighlights = false;
let currentRoleColors = new Map();
let currentGraphSpec = null;
let currentGraphParams = {};
let currentGraphViewId = "";
let equationHistory = [];
let cropState = {
  dataUrl: "",
  dragging: false,
  startX: 0,
  startY: 0,
  rect: null
};
let displayLatexCandidates = [];

document.addEventListener("DOMContentLoaded", init);
elements.optionsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.refreshSelectionButton.addEventListener("click", collectSelection);
elements.snipButton.addEventListener("click", startSnip);
elements.manualToggleButton.addEventListener("click", toggleManualPanel);
elements.historyToggleButton.addEventListener("click", toggleHistoryPanel);
elements.pasteClipboardButton.addEventListener("click", pasteClipboardIntoManual);
elements.historySearch.addEventListener("input", renderHistoryList);
elements.clearHistoryButton.addEventListener("click", clearEquationHistory);
elements.clearSnipButton.addEventListener("click", clearSnip);
elements.cancelSnipButton.addEventListener("click", cancelPopupSnip);
elements.useSnipButton.addEventListener("click", usePopupSnip);
elements.snipStage.addEventListener("pointerdown", beginCropDrag);
elements.snipStage.addEventListener("pointermove", updateCropDrag);
elements.snipStage.addEventListener("pointerup", endCropDrag);
elements.explainButton.addEventListener("click", explainCurrentEquation);
elements.copyLatexButton.addEventListener("click", copyCurrentLatex);
elements.convertManualLatexButton.addEventListener("click", convertManualTextToLatex);
elements.graphViewSelect.addEventListener("change", selectGraphView);
elements.focusPrompt.addEventListener("input", () => autoResizeTextarea(elements.focusPrompt));
elements.difficulty.addEventListener("change", savePopupPrefs);
elements.aidLength.addEventListener("change", savePopupPrefs);

async function init() {
  const configResponse = await chrome.runtime.sendMessage({ type: "get-config" });
  if (configResponse?.ok) {
    elements.difficulty.value = configResponse.payload.difficulty || "standard";
    elements.aidLength.value = configResponse.payload.aidLength || "short";
    latexCopyStyle = configResponse.payload.latexCopyStyle || "raw";
    highlightOpacity = configResponse.payload.highlightOpacity || 12;
    popupWidth = configResponse.payload.popupWidth || 820;
    mathRendererHighlights = Boolean(configResponse.payload.mathRendererHighlights);
    elements.includeScreenshot.checked = configResponse.payload.includeScreenshotByDefault !== false;
    applyHighlightOpacity(highlightOpacity);
    applyPopupWidth(popupWidth);
    applyMathRendererHighlights(mathRendererHighlights);
  } else {
    elements.includeScreenshot.checked = true;
  }

  const stored = await chrome.storage.local.get(["lastEquationCard", "pendingEquationSnip"]);
  if (stored.lastEquationCard) {
    await renderCard(stored.lastEquationCard);
  }
  if (stored.pendingEquationSnip) {
    attachSnip(stored.pendingEquationSnip);
  }

  await loadEquationHistory();
  await collectSelection();
}

async function collectSelection() {
  setStatus("Reading the current tab selection.", "pending");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      throw new Error("No active tab found.");
    }

    let response = await sendCollectMessage(tab.id).catch(() => null);
    if (!response?.ok && chrome.scripting) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["src/content.js"]
      });
      response = await sendCollectMessage(tab.id).catch(() => null);
    }

    if (!response?.ok) {
      pageContext = fallbackTabContext(tab);
      setStatus("Could not read page selection here. Paste LaTeX or use Snip Equation.", "pending");
      return;
    }

    pageContext = response.payload;
    if (attachedSnip) {
      pageContext = mergeContext(pageContext, attachedSnip);
    }
    if (pageContext.selected_text) {
      elements.equationInput.value = pageContext.selected_text;
      setStatus("Selection loaded.", "success");
    } else if (pageContext.guessed_latex) {
      elements.equationInput.value = pageContext.guessed_latex;
      setStatus("Equation markup found near the selection.", "success");
    } else {
      setStatus("No selected equation found. Use Snip Equation or open Manual Entry.", "pending");
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
}

async function explainCurrentEquation() {
  const equation = elements.equationInput.value.trim();
  const snipDataUrl = attachedSnip?.page_snapshot_data_url || "";
  if (!equation && !snipDataUrl) {
    setStatus("Select, paste, or snip an equation first.", "error");
    return;
  }

  setLoading(true);
  setStatus("Asking OpenAI for a structured equation card.", "pending");

  const payload = {
    ...pageContext,
    selected_text: equation,
    guessed_latex: equation,
    difficulty: elements.difficulty.value,
    aid_length: elements.aidLength.value,
    focus_prompt: elements.focusPrompt.value.trim(),
    page_snapshot_data_url: snipDataUrl || await captureScreenshotIfNeeded()
  };

  const response = await chrome.runtime.sendMessage({
    type: "explain-equation",
    payload
  });

  setLoading(false);

  if (!response?.ok) {
    setStatus(response?.error || "Explanation failed.", "error");
    return;
  }

  let saved = false;
  let historySaveError = "";
  try {
    saved = await ensureCardInHistory(response.payload, payload);
  } catch (error) {
    historySaveError = error instanceof Error ? error.message : String(error);
  }
  await renderCard(response.payload);
  try {
    await loadEquationHistory();
  } catch (error) {
    setStatus(`Explanation ready, but history could not be refreshed: ${error instanceof Error ? error.message : String(error)}`, "pending");
    return;
  }
  if (historySaveError) {
    setStatus(`Explanation ready. History save check failed: ${historySaveError}`, "pending");
    return;
  }
  setStatus(saved ? "Explanation ready and saved to history." : "Explanation ready. It was already in history.", "success");
}

async function convertManualTextToLatex() {
  const rawMath = elements.equationInput.value.trim();
  if (!rawMath) {
    setStatus("Paste raw math into Manual first.", "error");
    return;
  }

  setLatexConversionLoading(true);
  setStatus("Converting manual math to LaTeX.", "pending");

  try {
    const response = await chrome.runtime.sendMessage({
      type: "convert-raw-math",
      payload: {
        text: rawMath,
        focus_prompt: elements.focusPrompt.value.trim()
      }
    });

    if (!response?.ok) {
      setStatus(response?.error || "LaTeX conversion failed. Reload the extension if this persists.", "error");
      return;
    }

    elements.equationInput.value = response.payload.formattedLatex || response.payload.latexBody || "";
    await copyTextToClipboard(elements.equationInput.value);
    setStatus(response.payload.localEditApplied ? "Converted, applied Focus/context edit, and copied." : "Converted to LaTeX and copied.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    setLatexConversionLoading(false);
  }
}

async function startSnip() {
  setStatus("Capturing the visible tab for snipping.", "pending");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.windowId) {
      throw new Error("No active tab found.");
    }

    pageContext = pageContext.page_url ? pageContext : fallbackTabContext(tab);
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    openPopupCropper(dataUrl);
    setStatus("Drag a rectangle around the equation in the screenshot.", "pending");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
}

function sendCollectMessage(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "collect-equation-context" });
}

async function loadEquationHistory() {
  const stored = await chrome.storage.local.get(["equationHistory", "lastEquationCard", "lastExplainInput", "lastExplainAt", "historyMigratedFromLast", "historyClearedAt"]);
  equationHistory = Array.isArray(stored.equationHistory) ? stored.equationHistory : [];
  const shouldRepairLast = shouldMigrateLastCard(stored.lastEquationCard, stored.lastExplainAt, stored.historyClearedAt);
  const repaired = shouldRepairLast && migrateLastCardIntoHistory(stored.lastEquationCard, stored.lastExplainInput, stored.lastExplainAt);
  if (repaired || !stored.historyMigratedFromLast) {
    await chrome.storage.local.set({
      equationHistory,
      historyMigratedFromLast: true
    });
  }
  renderHistoryList();
}

function shouldMigrateLastCard(card, lastExplainAt, historyClearedAt) {
  if (!card?.title || !card?.displayLatex) {
    return false;
  }
  if (!historyClearedAt) {
    return true;
  }
  const lastTime = new Date(lastExplainAt || card.generatedAt || 0).getTime();
  const clearedTime = new Date(historyClearedAt).getTime();
  return Number.isFinite(lastTime) && Number.isFinite(clearedTime) && lastTime > clearedTime;
}

async function ensureCardInHistory(card, input) {
  if (!card?.title || !card?.displayLatex) {
    return false;
  }
  const stored = await chrome.storage.local.get("equationHistory");
  const existing = Array.isArray(stored.equationHistory) ? stored.equationHistory : [];
  const existingEntry = findExistingGeneration(existing, card);
  if (existingEntry) {
    equationHistory = existing;
    return false;
  }

  const entry = buildHistoryEntry(card, input, card.generatedAt || new Date().toISOString());
  card.historyId = card.historyId || entry.id;
  card.generatedAt = card.generatedAt || entry.createdAt;
  entry.id = card.historyId;
  entry.createdAt = card.generatedAt;
  entry.card = card;
  equationHistory = [entry, ...existing].slice(0, 50);
  await chrome.storage.local.set({
    equationHistory,
    historyMigratedFromLast: true
  });
  return true;
}

function migrateLastCardIntoHistory(card, input, createdAt) {
  if (!card?.title || !card?.displayLatex) {
    return false;
  }
  if (findExistingGeneration(equationHistory, card, createdAt)) {
    return false;
  }
  const entry = buildHistoryEntry(card, input, createdAt || card.generatedAt || new Date().toISOString(), "last");
  card.historyId = card.historyId || entry.id;
  card.generatedAt = card.generatedAt || entry.createdAt;
  entry.id = card.historyId;
  entry.createdAt = card.generatedAt;
  entry.card = card;
  equationHistory = [entry, ...equationHistory].slice(0, 50);
  return true;
}

function buildHistoryEntry(card, input, createdAt, suffix = "") {
  const id = card.historyId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${suffix ? `-${suffix}` : ""}`;
  return {
    id,
    title: String(card.title || "Untitled equation").slice(0, 140),
    domain: String(card.domain || "general").slice(0, 40),
    displayLatex: String(card.displayLatex || "").slice(0, 4000),
    pageTitle: String(input?.page_title || pageContext.page_title || "").slice(0, 180),
    pageUrl: String(input?.page_url || pageContext.page_url || "").slice(0, 2000),
    selectedText: String(input?.selected_text || input?.guessed_latex || "").slice(0, 800),
    createdAt,
    card
  };
}

function findExistingGeneration(history, card, createdAt = "") {
  const historyId = String(card?.historyId || "").trim();
  if (historyId) {
    return history.find((entry) => entry?.id === historyId || entry?.card?.historyId === historyId);
  }
  const generatedAt = String(card?.generatedAt || createdAt || "").trim();
  if (generatedAt) {
    const latexKey = historyKey(card?.displayLatex || "");
    return history.find((entry) => {
      return String(entry?.createdAt || "") === generatedAt
        && historyKey(entry?.displayLatex || entry?.card?.displayLatex || "") === latexKey;
    });
  }
  return null;
}

function toggleHistoryPanel() {
  const shouldOpen = elements.historyPanel.hidden;
  elements.historyPanel.hidden = !shouldOpen;
  elements.historyToggleButton.classList.toggle("is-active", shouldOpen);
  if (shouldOpen) {
    elements.manualPanel.hidden = true;
    elements.manualToggleButton.classList.remove("is-active");
    loadEquationHistory();
    elements.historySearch.focus();
  }
}

function renderHistoryList() {
  elements.historyList.replaceChildren();
  const query = collapseWhitespace(elements.historySearch.value).toLowerCase();
  const visible = equationHistory.filter((entry) => historyEntryMatches(entry, query)).slice(0, 50);
  elements.historyEmpty.hidden = visible.length > 0;
  elements.historyEmpty.textContent = equationHistory.length ? "No matching equations." : "No equation history yet.";

  for (const entry of visible) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "history-item";
    item.addEventListener("click", () => restoreHistoryEntry(entry));

    const header = document.createElement("div");
    header.className = "history-item-header";

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = entry.title || "Untitled equation";

    const time = document.createElement("span");
    time.className = "history-item-time";
    time.textContent = formatHistoryTime(entry.createdAt);

    const meta = document.createElement("div");
    meta.className = "history-item-meta";
    meta.textContent = [entry.domain || "general", entry.pageTitle || ""].filter(Boolean).join(" · ");

    const latex = document.createElement("div");
    latex.className = "history-item-latex";
    latex.textContent = compactLatexPreview(entry.displayLatex || entry.selectedText || "");

    header.append(title, time);
    item.append(header, meta, latex);
    elements.historyList.append(item);
  }
}

function historyEntryMatches(entry, query) {
  if (!query) {
    return true;
  }
  const haystack = [
    entry?.title,
    entry?.domain,
    entry?.pageTitle,
    entry?.pageUrl,
    entry?.displayLatex,
    entry?.selectedText
  ].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query);
}

function historyKey(value) {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/\\class\{role-[a-z-]+\}\{/g, "\\class{role}{")
    .slice(0, 1000);
}

async function restoreHistoryEntry(entry) {
  if (!entry?.card) {
    setStatus("That history item is missing its saved card.", "error");
    return;
  }
  elements.equationInput.value = entry.displayLatex || entry.selectedText || "";
  pageContext = {
    selected_text: entry.selectedText || entry.displayLatex || "",
    guessed_latex: entry.displayLatex || entry.selectedText || "",
    surrounding_text: "",
    page_title: entry.pageTitle || "",
    page_url: entry.pageUrl || ""
  };
  await chrome.storage.local.set({
    lastEquationCard: entry.card,
    lastExplainInput: pageContext,
    lastExplainAt: entry.createdAt || new Date().toISOString()
  });
  await renderCard(entry.card);
  setStatus(`Restored ${entry.title || "history item"}.`, "success");
}

async function clearEquationHistory() {
  equationHistory = [];
  await chrome.storage.local.set({
    equationHistory: [],
    historyMigratedFromLast: true,
    historyClearedAt: new Date().toISOString()
  });
  renderHistoryList();
  setStatus("Equation history cleared.", "pending");
}

async function clearSnip() {
  attachedSnip = null;
  await chrome.storage.local.remove("pendingEquationSnip");
  renderSnipPreview();
  setStatus("Screen snip cleared.", "pending");
}

function attachSnip(snip) {
  attachedSnip = snip;
  pageContext = mergeContext(pageContext, snip);
  renderSnipPreview();
  if (!elements.equationInput.value.trim()) {
    elements.equationInput.placeholder = "Screen snip attached. You can leave this blank or add a hint.";
  }
  setStatus("Screen snip loaded. Add an optional hint or click Explain.", "success");
}

function mergeContext(base, extra) {
  return {
    ...base,
    surrounding_text: [extra.surrounding_text, base.surrounding_text].filter(Boolean).join("\n\n").slice(0, 12000),
    page_title: base.page_title || extra.page_title || "",
    page_url: base.page_url || extra.page_url || ""
  };
}

function renderSnipPreview() {
  const hasSnip = Boolean(attachedSnip?.page_snapshot_data_url);
  elements.snipPreview.hidden = !hasSnip;
  elements.snipImage.src = hasSnip ? attachedSnip.page_snapshot_data_url : "";
}

function openPopupCropper(dataUrl) {
  cropState = {
    dataUrl,
    dragging: false,
    startX: 0,
    startY: 0,
    rect: null
  };
  elements.snipStageImage.src = dataUrl;
  elements.snipSelection.hidden = true;
  elements.snipCropper.hidden = false;
}

function cancelPopupSnip() {
  cropState = {
    dataUrl: "",
    dragging: false,
    startX: 0,
    startY: 0,
    rect: null
  };
  elements.snipCropper.hidden = true;
  elements.snipStageImage.src = "";
  elements.snipSelection.hidden = true;
  setStatus("Snip cancelled.", "pending");
}

function beginCropDrag(event) {
  if (!cropState.dataUrl) {
    return;
  }
  const point = stagePointFromEvent(event);
  cropState.dragging = true;
  cropState.startX = point.x;
  cropState.startY = point.y;
  cropState.rect = { left: point.x, top: point.y, width: 0, height: 0 };
  elements.snipStage.setPointerCapture(event.pointerId);
  renderCropRect(cropState.rect);
  event.preventDefault();
}

function updateCropDrag(event) {
  if (!cropState.dragging) {
    return;
  }
  const point = stagePointFromEvent(event);
  cropState.rect = normalizeStageRect(cropState.startX, cropState.startY, point.x, point.y);
  renderCropRect(cropState.rect);
  event.preventDefault();
}

function endCropDrag(event) {
  if (!cropState.dragging) {
    return;
  }
  cropState.dragging = false;
  const point = stagePointFromEvent(event);
  cropState.rect = normalizeStageRect(cropState.startX, cropState.startY, point.x, point.y);
  renderCropRect(cropState.rect);
  event.preventDefault();
}

async function usePopupSnip() {
  if (!cropState.dataUrl) {
    setStatus("Capture a screenshot first.", "error");
    return;
  }
  if (!cropState.rect || cropState.rect.width < 8 || cropState.rect.height < 8) {
    setStatus("Drag a rectangle around the equation first.", "error");
    return;
  }

  try {
    const croppedDataUrl = await cropStageScreenshot(cropState.dataUrl, cropState.rect);
    const snipPayload = {
      ...pageContext,
      selected_text: "",
      guessed_latex: "",
      page_snapshot_data_url: croppedDataUrl,
      snip_created_at: new Date().toISOString(),
      snip_rect: cropState.rect
    };
    await chrome.storage.local.set({ pendingEquationSnip: snipPayload });
    attachSnip(snipPayload);
    elements.snipCropper.hidden = true;
    setStatus("Screen snip attached. Add an optional hint or click Explain.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  }
}

function stagePointFromEvent(event) {
  const imageRect = elements.snipStageImage.getBoundingClientRect();
  return {
    x: clamp(event.clientX - imageRect.left, 0, imageRect.width),
    y: clamp(event.clientY - imageRect.top, 0, imageRect.height)
  };
}

function normalizeStageRect(startX, startY, endX, endY) {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  return {
    left,
    top,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };
}

function renderCropRect(rect) {
  const stageRect = elements.snipStage.getBoundingClientRect();
  const imageRect = elements.snipStageImage.getBoundingClientRect();
  elements.snipSelection.hidden = false;
  elements.snipSelection.style.left = `${rect.left + imageRect.left - stageRect.left}px`;
  elements.snipSelection.style.top = `${rect.top + imageRect.top - stageRect.top}px`;
  elements.snipSelection.style.width = `${rect.width}px`;
  elements.snipSelection.style.height = `${rect.height}px`;
}

async function cropStageScreenshot(dataUrl, rect) {
  const image = await loadImage(dataUrl);
  const rendered = elements.snipStageImage.getBoundingClientRect();
  const scaleX = image.naturalWidth / rendered.width;
  const scaleY = image.naturalHeight / rendered.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(rect.width * scaleX));
  canvas.height = Math.max(1, Math.round(rect.height * scaleY));
  const context = canvas.getContext("2d");
  context.drawImage(
    image,
    Math.round(rect.left * scaleX),
    Math.round(rect.top * scaleY),
    canvas.width,
    canvas.height,
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas.toDataURL("image/png");
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load screenshot."));
    image.src = dataUrl;
  });
}

async function renderCard(card) {
  elements.card.hidden = false;
  elements.cardDomain.textContent = card.domain || "general";
  elements.cardTitle.textContent = card.title || "Equation";
  applyRolePalette(card);
  renderDisplayMath(card.displayLatex || "");
  renderLatexCode(card.displayLatex || "");

  const storySpans = card.selfDescriptiveSpans?.length ? card.selfDescriptiveSpans : card.story;
  elements.storySection.hidden = !storySpans?.length;
  renderSpans(elements.selfDescriptive, storySpans);
  renderSpans(elements.summary, card.summarySpans?.length ? card.summarySpans : [{ text: card.summary || "", latex: "", role: "" }]);
  renderSpans(elements.intuition, card.intuitionSpans?.length ? card.intuitionSpans : [{ text: card.intuition || "", latex: "", role: "" }]);
  renderLegend(card.legend || []);
  renderHighlights(card.highlights || []);
  renderWalkthrough(card.walkthrough || []);
  renderLearningBlocks(elements.deepContextSection, elements.deepContext, card.deepContext || []);
  renderUseCases(card.useCases || []);
  renderLearningBlocks(elements.strategySection, elements.strategyTips, card.strategyTips || [], "strategy-card");
  renderGraphSpec(card.graphSpec);
  renderNotes(card.notes || []);
  await typesetCardMath();
  const scale = await fitDisplayMath();
  if (scale < 0.72) {
    await useSemanticBreakIfHelpful();
  }
}

function renderSpans(target, spans) {
  target.replaceChildren();
  for (const span of spans || []) {
    const role = normalizeRoleName(span.role);
    if (span.text) {
      const text = document.createElement("span");
      text.className = role ? `rich-span role-${role}` : "rich-span";
      text.textContent = span.text;
      target.append(text);
    }
    if (span.latex) {
      const math = document.createElement("span");
      math.className = role ? `rich-inline-math role-${role}` : "rich-inline-math";
      math.textContent = `\\(${span.latex}\\)`;
      target.append(math);
    }
  }
}

function renderLegend(entries) {
  elements.legend.replaceChildren();
  for (const entry of entries) {
    const item = document.createElement("article");
    item.className = "legend-card";
    item.style.setProperty("--entry-color", roleColorFromName(entry.role, entry.color));

    const label = document.createElement("strong");
    label.textContent = entry.label;

    const meaning = document.createElement("p");
    meaning.textContent = entry.meaning || "";

    const latex = document.createElement("div");
    latex.className = "legend-math";
    latex.textContent = entry.latex ? `\\(${entry.latex}\\)` : entry.role;

    item.append(label, latex, meaning, createRoleTag(entry));
    elements.legend.append(item);
  }
}

function renderHighlights(entries) {
  elements.highlights.replaceChildren();
  for (const entry of entries) {
    const item = document.createElement("article");
    item.className = "highlight-card";
    item.style.setProperty("--entry-color", roleColorFromName(entry.role));

    const title = document.createElement("strong");
    title.textContent = entry.label || entry.role;
    const header = document.createElement("div");
    header.className = "highlight-card-header";
    header.append(title, createRoleTag(entry));

    const body = document.createElement("p");
    body.textContent = entry.explanation || "";

    const latex = document.createElement("div");
    latex.className = "highlight-math";
    latex.textContent = `\\(${entry.latex || ""}\\)`;

    item.append(header, latex, body);
    elements.highlights.append(item);
  }
}

function renderWalkthrough(steps) {
  elements.walkthrough.replaceChildren();
  for (const step of steps) {
    const item = document.createElement("li");
    item.className = "no-mathjax";
    item.textContent = stripMathDelimiters(step);
    elements.walkthrough.append(item);
  }
}

function renderLearningBlocks(section, target, blocks, className = "learning-card") {
  target.replaceChildren();
  section.hidden = !blocks?.length;
  for (const block of blocks || []) {
    const item = document.createElement("article");
    item.className = className;

    const title = document.createElement("strong");
    title.textContent = block.title || "Reminder";

    const body = document.createElement("p");
    body.textContent = block.body || "";

    const bullets = document.createElement("ul");
    bullets.className = "compact-bullets";
    for (const text of block.bullets || []) {
      const bullet = document.createElement("li");
      bullet.textContent = text;
      bullets.append(bullet);
    }

    item.append(title, body);
    if (bullets.children.length) {
      item.append(bullets);
    }
    target.append(item);
  }
}

function renderUseCases(useCases) {
  elements.useCases.replaceChildren();
  elements.useCasesSection.hidden = !useCases?.length;
  for (const text of useCases || []) {
    const item = document.createElement("li");
    item.textContent = text;
    elements.useCases.append(item);
  }
}

function renderGraphSpec(spec) {
  currentGraphSpec = normalizeGraphSpec(spec);
  currentGraphParams = {};
  currentGraphViewId = "";
  elements.graphSvg.replaceChildren();
  elements.graphControls.replaceChildren();
  hideGraphSection();
  if (!currentGraphSpec.available || !hasDrawableGraph(currentGraphSpec)) {
    return;
  }

  if (!graphCurvesDrawable(currentGraphSpec.curves) && currentGraphSpec.views.length) {
    currentGraphViewId = currentGraphSpec.views[0].id;
  }

  elements.graphSection.hidden = false;
  elements.graphTitle.textContent = currentGraphSpec.title || "Qualitative Graph";
  elements.graphDescription.textContent = currentGraphSpec.description || "";
  elements.graphDomainNote.textContent = currentGraphSpec.domainNote || "";
  renderGraphViewControls();

  for (const parameter of currentGraphSpec.parameters) {
    currentGraphParams[parameter.id] = parameter.defaultValue;
    renderGraphSlider(parameter);
  }
  drawGraph();
}

function normalizeGraphSpec(spec) {
  if (!spec || spec.available !== true) {
    return {
      available: false,
      title: "",
      description: "",
      domainNote: "",
      xLabel: "",
      yLabel: "",
      parameters: [],
      curves: [],
      views: []
    };
  }

  const parameters = (spec.parameters || []).map((parameter, index) => {
    const id = normalizeParameterId(parameter.id || `p${index + 1}`);
    const min = finiteNumber(parameter.min, 0);
    const max = finiteNumber(parameter.max, 1);
    const defaultValue = clamp(finiteNumber(parameter.defaultValue, (min + max) / 2), Math.min(min, max), Math.max(min, max));
    return {
      id,
      label: String(parameter.label || id),
      min: Math.min(min, max),
      max: Math.max(min, max),
      step: Math.max(Math.abs(finiteNumber(parameter.step, (Math.max(min, max) - Math.min(min, max)) / 50)) || 0.01, 0.0001),
      defaultValue,
      unit: String(parameter.unit || ""),
      meaning: String(parameter.meaning || ""),
      effect: ["scale-x", "scale-y", "scale-both", "shift-x", "shift-y", "none"].includes(parameter.effect) ? parameter.effect : "none"
    };
  }).slice(0, 6);

  const curves = normalizeGraphCurves(spec.curves);
  const views = (spec.views || []).map((view, index) => ({
    id: normalizeParameterId(view.id || `view-${index + 1}`),
    label: String(view.label || `View ${index + 1}`),
    description: String(view.description || ""),
    curves: normalizeGraphCurves(view.curves)
  })).filter((view) => graphCurvesDrawable(view.curves)).slice(0, 5);

  return {
    available: curves.length > 0 || views.length > 0,
    title: String(spec.title || "Qualitative Graph"),
    description: String(spec.description || ""),
    domainNote: String(spec.domainNote || ""),
    xLabel: String(spec.xLabel || "x"),
    yLabel: String(spec.yLabel || "y"),
    parameters,
    curves,
    views
  };
}

function normalizeGraphCurves(curves) {
  return (curves || []).map((curve) => ({
    label: String(curve.label || "curve"),
    role: normalizeRoleName(curve.role || ""),
    points: (curve.points || [])
      .map((point) => ({ x: finiteNumber(point.x, NaN), y: finiteNumber(point.y, NaN) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
      .slice(0, 80)
  })).filter((curve) => curve.points.length >= 2 && graphCurveHasRange(curve)).slice(0, 6);
}

function renderGraphViewControls() {
  elements.graphViewSelect.replaceChildren();
  const choices = [];
  if (graphCurvesDrawable(currentGraphSpec.curves)) {
    choices.push({ id: "", label: "Baseline", description: currentGraphSpec.description || "" });
  }
  for (const view of currentGraphSpec.views) {
    choices.push(view);
  }

  if (choices.length <= 1) {
    elements.graphViewStrip.hidden = true;
    elements.graphViewNote.textContent = "";
    return;
  }

  for (const choice of choices) {
    const option = document.createElement("option");
    option.value = choice.id;
    option.textContent = choice.label;
    elements.graphViewSelect.append(option);
  }
  elements.graphViewSelect.value = currentGraphViewId;
  elements.graphViewStrip.hidden = false;
  updateGraphViewNote();
}

function selectGraphView() {
  currentGraphViewId = elements.graphViewSelect.value;
  updateGraphViewNote();
  drawGraph();
}

function updateGraphViewNote() {
  const view = currentGraphSpec?.views?.find((item) => item.id === currentGraphViewId);
  elements.graphViewNote.textContent = view?.description || (currentGraphViewId ? "" : "Baseline slice using the default parameter values.");
}

function renderGraphSlider(parameter) {
  const control = document.createElement("label");
  control.className = "graph-control";

  const header = document.createElement("span");
  header.className = "graph-control-header";
  const name = document.createElement("strong");
  name.textContent = parameter.label;
  const value = document.createElement("span");
  value.textContent = formatParameterValue(parameter.defaultValue, parameter.unit);
  header.append(name, value);

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(parameter.min);
  input.max = String(parameter.max);
  input.step = String(parameter.step);
  input.value = String(parameter.defaultValue);
  input.addEventListener("input", () => {
    currentGraphParams[parameter.id] = Number(input.value);
    value.textContent = formatParameterValue(Number(input.value), parameter.unit);
    drawGraph();
  });

  const meaning = document.createElement("span");
  meaning.className = "graph-control-meaning";
  meaning.textContent = [`Baseline ${formatParameterValue(parameter.defaultValue, parameter.unit)}.`, parameter.meaning]
    .filter(Boolean)
    .join(" ");

  control.append(header, input, meaning);
  elements.graphControls.append(control);
}

function drawGraph() {
  const spec = currentGraphSpec;
  const activeCurves = activeGraphCurves(spec);
  if (!spec?.available || !graphCurvesDrawable(activeCurves)) {
    hideGraphSection();
    return;
  }

  const width = 640;
  const height = 360;
  const margin = { left: 54, right: 22, top: 24, bottom: 46 };
  const transformedCurves = activeCurves.map((curve) => ({
    ...curve,
    points: curve.points.map((point) => transformGraphPoint(point, spec.parameters))
  }));
  const allPoints = [
    ...transformedCurves.flatMap((curve) => curve.points),
    ...graphBoundaryPoints(spec, activeCurves)
  ].filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!allPoints.length) {
    hideGraphSection();
    return;
  }
  const extent = graphExtent(allPoints);
  if (!Number.isFinite(extent.minX) || !Number.isFinite(extent.maxX) || !Number.isFinite(extent.minY) || !Number.isFinite(extent.maxY)) {
    hideGraphSection();
    return;
  }
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xScale = (x) => margin.left + ((x - extent.minX) / (extent.maxX - extent.minX || 1)) * plotWidth;
  const yScale = (y) => margin.top + plotHeight - ((y - extent.minY) / (extent.maxY - extent.minY || 1)) * plotHeight;

  elements.graphSvg.replaceChildren();
  appendSvg("rect", { x: 0, y: 0, width, height, rx: 16, class: "graph-bg" });
  appendGrid(width, height, margin);
  appendSvg("line", { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom, class: "graph-axis" });
  appendSvg("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom, class: "graph-axis" });
  appendSvg("text", { x: width / 2, y: height - 12, class: "graph-label" }, spec.xLabel);
  appendSvg("text", { x: 16, y: 20, class: "graph-label" }, spec.yLabel);

  for (const curve of transformedCurves) {
    const path = curve.points.map((point, index) => `${index === 0 ? "M" : "L"} ${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)}`).join(" ");
    const color = roleColorFromName(curve.role || "quantity");
    appendSvg("path", { d: path, fill: "none", stroke: color, "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" });
    const last = curve.points[curve.points.length - 1];
    appendSvg("text", { x: Math.min(width - margin.right - 88, xScale(last.x) + 8), y: yScale(last.y) - 6, class: "graph-curve-label", fill: color }, curve.label);
  }
}

function activeGraphCurves(spec) {
  if (!spec) {
    return [];
  }
  const view = spec.views?.find((item) => item.id === currentGraphViewId);
  if (view?.curves?.length) {
    return view.curves;
  }
  return spec.curves || [];
}

function transformGraphPoint(point, parameters) {
  let x = point.x;
  let y = point.y;
  for (const parameter of parameters) {
    const value = currentGraphParams[parameter.id] ?? parameter.defaultValue;
    const delta = value - parameter.defaultValue;
    if (parameter.effect === "scale-x") {
      x *= value / (parameter.defaultValue || 1);
    } else if (parameter.effect === "scale-y") {
      y *= value / (parameter.defaultValue || 1);
    } else if (parameter.effect === "scale-both") {
      const ratio = value / (parameter.defaultValue || 1);
      x *= ratio;
      y *= ratio;
    } else if (parameter.effect === "shift-x") {
      x += delta;
    } else if (parameter.effect === "shift-y") {
      y += delta;
    }
  }
  return { x, y };
}

function graphBoundaryPoints(spec, curves) {
  const saved = { ...currentGraphParams };
  const points = [];
  const parameterSets = [{}];
  for (const parameter of spec.parameters) {
    parameterSets.push({ [parameter.id]: parameter.min });
    parameterSets.push({ [parameter.id]: parameter.max });
  }

  for (const parameterSet of parameterSets) {
    currentGraphParams = { ...saved, ...parameterSet };
    for (const curve of curves) {
      for (const point of curve.points) {
        points.push(transformGraphPoint(point, spec.parameters));
      }
    }
  }

  currentGraphParams = saved;
  return points;
}

function hasDrawableGraph(spec) {
  return graphCurvesDrawable(spec?.curves) || (spec?.views || []).some((view) => graphCurvesDrawable(view.curves));
}

function graphCurvesDrawable(curves) {
  return Array.isArray(curves) && curves.some((curve) => graphCurveHasRange(curve));
}

function graphCurveHasRange(curve) {
  const points = Array.isArray(curve?.points) ? curve.points : [];
  if (points.length < 2) {
    return false;
  }
  const xs = points.map((point) => point.x).filter(Number.isFinite);
  const ys = points.map((point) => point.y).filter(Number.isFinite);
  return xs.length >= 2 && ys.length >= 2 && (Math.min(...xs) !== Math.max(...xs) || Math.min(...ys) !== Math.max(...ys));
}

function hideGraphSection() {
  elements.graphSection.hidden = true;
  elements.graphSvg.replaceChildren();
  elements.graphControls.replaceChildren();
  elements.graphTitle.textContent = "Qualitative Graph";
  elements.graphDescription.textContent = "";
  elements.graphDomainNote.textContent = "";
  elements.graphViewStrip.hidden = true;
  elements.graphViewSelect.replaceChildren();
  elements.graphViewNote.textContent = "";
}

function appendGrid(width, height, margin) {
  for (let index = 1; index < 5; index += 1) {
    const x = margin.left + ((width - margin.left - margin.right) * index) / 5;
    const y = margin.top + ((height - margin.top - margin.bottom) * index) / 5;
    appendSvg("line", { x1: x, y1: margin.top, x2: x, y2: height - margin.bottom, class: "graph-grid-line" });
    appendSvg("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "graph-grid-line" });
  }
}

function appendSvg(tag, attrs, text = "") {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    node.setAttribute(key, String(value));
  }
  if (text) {
    node.textContent = text;
  }
  elements.graphSvg.append(node);
  return node;
}

function graphExtent(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = Math.max((maxX - minX) * 0.06, 0.1);
  const padY = Math.max((maxY - minY) * 0.12, 0.1);
  return {
    minX: minX - padX,
    maxX: maxX + padX,
    minY: minY - padY,
    maxY: maxY + padY
  };
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeParameterId(value) {
  return String(value || "p")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "p";
}

function formatParameterValue(value, unit) {
  const formatted = Number(value).toFixed(2).replace(/\.?0+$/g, "");
  return unit ? `${formatted} ${unit}` : formatted;
}

function renderNotes(notes) {
  elements.notesSection.hidden = notes.length === 0;
  elements.notes.replaceChildren();
  for (const note of notes) {
    const item = document.createElement("li");
    item.className = "no-mathjax";
    item.textContent = stripMathDelimiters(note);
    elements.notes.append(item);
  }
}

function stripMathDelimiters(value) {
  return String(value || "")
    .replace(/\\\((.*?)\\\)/g, "$1")
    .replace(/\\\[(.*?)\\\]/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\\[()[\]]/g, "")
    .trim();
}

async function captureScreenshotIfNeeded() {
  if (!elements.includeScreenshot.checked) {
    return "";
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.windowId) {
    return "";
  }

  try {
    return await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  } catch (error) {
    setStatus(`Screenshot skipped: ${error instanceof Error ? error.message : String(error)}`, "pending");
    return "";
  }
}

function renderDisplayMath(displayLatex) {
  elements.mathCanvas.replaceChildren();
  elements.mathCanvas.classList.remove("is-invalid", "is-scaled");
  elements.mathCanvas.style.setProperty("--math-scale", "1");
  elements.mathCanvas.style.setProperty("--math-offset-x", "0px");
  elements.mathCanvas.style.height = "";
  elements.mathFallback.hidden = true;
  elements.mathFallback.textContent = "";
  displayLatexCandidates = buildDisplayLatexCandidates(displayLatex);
  if (!displayLatexCandidates.length) {
    showMathFallback("The model returned LaTeX that is too long to render safely. Use Copy LaTeX or try again.");
    return;
  }
  elements.mathCanvas.textContent = displayLatexCandidates[0];
}

function renderLatexCode(displayLatex) {
  elements.latexCode.textContent = normalizeDisplayLatex(displayLatex);
}

function applyHighlightOpacity(value) {
  const opacity = clamp(Number(value) || 12, 0, 35);
  document.documentElement.style.setProperty("--highlight-strength", `${opacity}%`);
  document.documentElement.style.setProperty("--highlight-math-strength", `${Math.min(opacity + 2, 42)}%`);
  document.documentElement.style.setProperty("--highlight-card-strength", `${Math.max(4, Math.round(opacity * 0.75))}%`);
}

function applyPopupWidth(value) {
  const number = Number(value);
  const width = !Number.isFinite(number) || number < 300
    ? 820
    : clamp(Math.round(number / 20) * 20, 300, 1000);
  document.documentElement.style.setProperty("--popup-width", `${width}px`);
  try {
    localStorage.setItem("equationExplainer.popupWidth", String(width));
  } catch (_error) {
    // The popup can still use the current CSS variable for this session.
  }
}

function applyMathRendererHighlights(enabled) {
  document.body.classList.toggle("math-renderer-highlights", Boolean(enabled));
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  const maxHeight = Math.max(120, Math.round(window.innerHeight * 0.75));
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.classList.toggle("is-scrollable", textarea.scrollHeight > maxHeight);
}

const CONTRAST_ROLE_COLORS = [
  "#6d28d9",
  "#0f766e",
  "#dc4a1d",
  "#2563eb",
  "#be185d",
  "#9a6a00",
  "#15803d",
  "#7c3aed",
  "#b91c1c",
  "#087ea4",
  "#a21caf",
  "#4d7c0f"
];

function applyRolePalette(card) {
  currentRoleColors = buildRolePalette(card);
  const vars = [
    "definition",
    "quantity",
    "dataset",
    "index",
    "operator",
    "normalizer",
    "contrast",
    "positive-term",
    "negative-term",
    "group"
  ];
  for (const name of vars) {
    elements.card.style.removeProperty(`--${name}`);
  }
  for (const [role, color] of currentRoleColors.entries()) {
    elements.card.style.setProperty(`--${role}`, color);
  }
}

function buildRolePalette(card) {
  const roles = collectCardRoles(card);
  const colors = new Map();
  roles.forEach((role, index) => {
    colors.set(role, CONTRAST_ROLE_COLORS[index % CONTRAST_ROLE_COLORS.length]);
  });
  return colors;
}

function collectCardRoles(card) {
  const roles = [];
  const addRole = (value) => {
    const role = normalizeRoleName(value);
    if (role && !roles.includes(role)) {
      roles.push(role);
    }
  };

  const latex = String(card.displayLatex || "");
  for (const match of latex.matchAll(/\\class\{role-([^}]+)\}/g)) {
    addRole(match[1]);
  }

  const spanGroups = [
    card.selfDescriptiveSpans,
    card.story,
    card.summarySpans,
    card.intuitionSpans,
    card.legend,
    card.highlights
  ];
  for (const group of spanGroups) {
    for (const item of group || []) {
      addRole(item.role);
    }
  }
  for (const curve of card.graphSpec?.curves || []) {
    addRole(curve.role);
  }
  for (const view of card.graphSpec?.views || []) {
    for (const curve of view.curves || []) {
      addRole(curve.role);
    }
  }
  return roles;
}

function normalizeRoleName(value) {
  return String(value || "")
    .trim()
    .replace(/^role[-_ ]?/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toggleManualPanel() {
  const nextHidden = !elements.manualPanel.hidden;
  elements.manualPanel.hidden = nextHidden;
  elements.manualToggleButton.classList.toggle("is-active", !nextHidden);
  if (!nextHidden) {
    elements.historyPanel.hidden = true;
    elements.historyToggleButton.classList.remove("is-active");
    elements.equationInput.focus();
  }
}

async function pasteClipboardIntoManual() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      setStatus("Clipboard is empty.", "error");
      return;
    }
    elements.equationInput.value = text.trim();
    elements.manualPanel.hidden = false;
    elements.manualToggleButton.classList.add("is-active");
    elements.historyPanel.hidden = true;
    elements.historyToggleButton.classList.remove("is-active");
    setStatus("Clipboard pasted into manual entry.", "success");
  } catch (_error) {
    setStatus("Could not read clipboard. Paste manually with Ctrl+V.", "error");
  }
}

async function copyCurrentLatex() {
  const latex = formatLatexForClipboard(elements.latexCode.textContent, latexCopyStyle);
  if (!latex) {
    setStatus("No LaTeX is available to copy.", "error");
    return;
  }

  try {
    await copyTextToClipboard(latex);
    setStatus("LaTeX copied to clipboard.", "success");
  } catch (_error) {
    fallbackCopyText(latex);
    setStatus("LaTeX copied to clipboard.", "success");
  }
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (_error) {
    fallbackCopyText(text);
  }
}

function savePopupPrefs() {
  chrome.runtime.sendMessage({
    type: "save-config",
    payload: {
      difficulty: elements.difficulty.value,
      aidLength: elements.aidLength.value
    }
  }).catch(() => {});
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function typesetCardMath() {
  const mathJax = await waitForMathJax();
  if (!mathJax?.typesetPromise) {
    showMathFallback("MathJax did not load. Reload the extension from edge://extensions.");
    return;
  }

  if (mathJax.typesetClear) {
    mathJax.typesetClear([elements.card]);
  }

  try {
    await mathJax.typesetPromise([elements.card]);
    await recoverDisplayMathIfNeeded(mathJax);
  } catch (error) {
    const recovered = await recoverDisplayMathIfNeeded(mathJax);
    if (!recovered) {
      showMathFallback(error instanceof Error ? error.message : String(error));
    }
  }
}

async function recoverDisplayMathIfNeeded(mathJax) {
  if (!renderedMathHasProblem()) {
    return true;
  }

  for (let index = 1; index < displayLatexCandidates.length; index += 1) {
    elements.mathCanvas.replaceChildren();
    elements.mathCanvas.classList.remove("is-invalid", "is-scaled");
    elements.mathCanvas.style.setProperty("--math-scale", "1");
    elements.mathCanvas.style.setProperty("--math-offset-x", "0px");
    elements.mathCanvas.textContent = displayLatexCandidates[index];

    if (mathJax.typesetClear) {
      mathJax.typesetClear([elements.mathCanvas]);
    }

    try {
      await mathJax.typesetPromise([elements.mathCanvas]);
      if (!renderedMathHasProblem()) {
        return true;
      }
    } catch (_error) {
      // Try the next, more conservative rendering candidate.
    }
  }

  elements.mathCanvas.replaceChildren();
  elements.mathCanvas.classList.add("is-invalid");
  showMathFallback("The model returned invalid LaTeX, so the rendered equation was hidden to keep the app usable. Use Copy LaTeX or try again.");
  return false;
}

async function fitDisplayMath() {
  const container = elements.mathCanvas.querySelector("mjx-container");
  if (!container) {
    return 1;
  }

  elements.mathCanvas.style.setProperty("--math-scale", "1");
  elements.mathCanvas.style.setProperty("--math-offset-x", "0px");
  elements.mathCanvas.style.height = "";
  await nextFrame();

  const maxWidth = elements.mathCanvas.clientWidth - 4;
  if (maxWidth <= 0) {
    return 1;
  }

  const naturalWidth = container.scrollWidth;
  const naturalHeight = container.scrollHeight;
  const scale = Math.max(0.18, Math.min(1, maxWidth / naturalWidth));
  elements.mathCanvas.style.setProperty("--math-scale", String(scale));
  elements.mathCanvas.classList.toggle("is-scaled", scale < 0.99);
  if (scale < 0.99) {
    elements.mathCanvas.style.height = `${Math.ceil(naturalHeight * scale + 8)}px`;
  }
  await centerScaledMath(container);
  return scale;
}

async function centerScaledMath(container) {
  await nextFrame();
  const canvasRect = elements.mathCanvas.getBoundingClientRect();
  const mathRect = container.getBoundingClientRect();
  const offset = (canvasRect.left + canvasRect.width / 2) - (mathRect.left + mathRect.width / 2);
  if (Math.abs(offset) > 0.5) {
    elements.mathCanvas.style.setProperty("--math-offset-x", `${offset}px`);
  }
}

async function useSemanticBreakIfHelpful() {
  const candidate = displayLatexCandidates.find((latex) => /\\begin\{aligned\}/.test(latex));
  if (!candidate || elements.mathCanvas.textContent === candidate) {
    return false;
  }

  const mathJax = await waitForMathJax();
  if (!mathJax?.typesetPromise) {
    return false;
  }

  elements.mathCanvas.replaceChildren();
  elements.mathCanvas.classList.remove("is-invalid", "is-scaled");
  elements.mathCanvas.style.setProperty("--math-scale", "1");
  elements.mathCanvas.style.setProperty("--math-offset-x", "0px");
  elements.mathCanvas.style.height = "";
  elements.mathCanvas.textContent = candidate;

  if (mathJax.typesetClear) {
    mathJax.typesetClear([elements.mathCanvas]);
  }

  try {
    await mathJax.typesetPromise([elements.mathCanvas]);
    if (renderedMathHasProblem()) {
      return false;
    }
    await fitDisplayMath();
    return true;
  } catch (_error) {
    return false;
  }
}

async function waitForMathJax() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (window.MathJax?.typesetPromise) {
      return window.MathJax;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return null;
}

function normalizeDisplayLatex(value) {
  let latex = String(value || "").trim();
  if (!latex) {
    return "\\[\\]";
  }

  latex = stripOuterMathWrapper(latex);

  const displayMatch = latex.match(/\\\[[\s\S]*?\\\]/);
  if (displayMatch) {
    latex = displayMatch[0];
  }

  latex = latex
    .replace(/,\s*""\s*\]$/g, "\\]")
    .replace(/,\s*"\s*\]$/g, "\\]")
    .replace(/,\s*\]\s*$/g, "\\]");

  if (!latex.startsWith("\\[")) {
    latex = `\\[${latex}`;
  }
  if (!latex.endsWith("\\]")) {
    latex = `${latex}\\]`;
  }
  return latex;
}

function stripOuterMathWrapper(value) {
  let latex = String(value || "").trim();
  let changed = true;
  while (changed) {
    changed = false;
    if (latex.startsWith("$$") && latex.endsWith("$$") && latex.length > 4) {
      latex = latex.slice(2, -2).trim();
      changed = true;
    } else if (latex.startsWith("$") && latex.endsWith("$") && latex.length > 2) {
      latex = latex.slice(1, -1).trim();
      changed = true;
    }
  }
  return latex;
}

function displayLatexBody(value) {
  const latex = normalizeDisplayLatex(value);
  return latex.slice(2, -2).trim();
}

function formatLatexForClipboard(value, style) {
  const body = displayLatexBody(value);
  if (!body) {
    return "";
  }
  if (style === "display") {
    return `\\[${body}\\]`;
  }
  if (style === "obsidian-dollar") {
    return `$${body}$`;
  }
  return body;
}

function prepareDisplayLatex(value) {
  return normalizeDisplayLatex(value);
}

function buildDisplayLatexCandidates(value) {
  const original = prepareDisplayLatex(value);
  const repaired = repairDisplayLatex(original);
  const lineBroken = semanticallyBreakDisplayLatex(repaired);
  const stripped = stripClassCommands(repaired);
  const normalizedStripped = normalizeDisplayLatex(stripped);
  const strippedLineBroken = semanticallyBreakDisplayLatex(normalizedStripped);
  return uniqueStrings([
    original,
    repaired,
    lineBroken,
    strippedLineBroken,
    normalizedStripped
  ]).filter((latex) => latex && !isDisplayLatexTooRisky(latex));
}

function repairDisplayLatex(value) {
  let latex = normalizeDisplayLatex(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\\class\{([^}]+)\}\{/g, (_match, role) => `\\class{${normalizeRoleClass(role)}}{`)
    .replace(/\s+/g, " ")
    .trim();

  const inner = latex.slice(2, -2);
  const balance = braceBalance(inner);
  if (balance > 0 && balance <= 4) {
    latex = `\\[${inner}${"}".repeat(balance)}\\]`;
  }
  return latex;
}

function normalizeRoleClass(role) {
  const clean = normalizeRoleName(role);
  return `role-${clean || "quantity"}`;
}

function stripClassCommands(value) {
  const latex = normalizeDisplayLatex(value);
  const inner = latex.slice(2, -2);
  return `\\[${stripClassCommandsInner(inner)}\\]`;
}

function stripClassCommandsInner(value) {
  let output = "";
  let index = 0;
  while (index < value.length) {
    const commandIndex = value.indexOf("\\class", index);
    if (commandIndex === -1) {
      output += value.slice(index);
      break;
    }

    output += value.slice(index, commandIndex);
    const roleStart = commandIndex + "\\class".length;
    if (value[roleStart] !== "{") {
      output += "\\class";
      index = roleStart;
      continue;
    }

    const roleGroup = readLatexGroup(value, roleStart);
    const bodyStart = roleGroup ? roleGroup.end + 1 : -1;
    if (!roleGroup || value[bodyStart] !== "{") {
      output += "\\class";
      index = roleStart;
      continue;
    }

    const bodyGroup = readLatexGroup(value, bodyStart);
    if (!bodyGroup) {
      output += value.slice(commandIndex);
      break;
    }

    output += `{${stripClassCommandsInner(bodyGroup.content)}}`;
    index = bodyGroup.end + 1;
  }
  return output;
}

function semanticallyBreakDisplayLatex(value) {
  const body = displayLatexBody(value);
  if (body.length < 150 || /\\begin\{(?:aligned|split|gathered)\}/.test(body)) {
    return "";
  }

  const equalsIndex = findTopLevelToken(body, "=");
  if (equalsIndex === -1) {
    return "";
  }

  const lhs = body.slice(0, equalsIndex).trim();
  const rhs = body.slice(equalsIndex + 1).trim();
  if (!lhs || !rhs) {
    return "";
  }

  const rhsForRows = softenAutoDelimiters(rhs);
  const rows = splitRhsRows(rhsForRows);
  if (rows.length < 2) {
    return "";
  }

  const alignedRows = [
    `${softenAutoDelimiters(lhs)} &= ${rows[0]}`,
    ...rows.slice(1).map((row) => `&\\quad ${row}`)
  ];
  return `\\[\\begin{aligned}${alignedRows.join("\\\\[0.35em]")}\\end{aligned}\\]`;
}

function splitRhsRows(rhs) {
  const rows = [];
  let rest = rhs.trim();

  for (let attempt = 0; attempt < 2 && rest.length > 130; attempt += 1) {
    const bracket = findSemanticOpeningBracket(rest);
    if (!bracket || bracket.end < 36 || bracket.end > 180) {
      break;
    }
    rows.push(rest.slice(0, bracket.end).trim());
    rest = rest.slice(bracket.end).trim();
  }

  if (rest.length > 210) {
    const product = findReadableProductBreak(rest);
    if (product > 80 && product < rest.length - 50) {
      rows.push(rest.slice(0, product).trim());
      rest = rest.slice(product).trim();
    }
  }

  if (rest) {
    rows.push(rest);
  }

  return rows
    .map((row) => row.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
}

function findSemanticOpeningBracket(value) {
  const tokens = ["\\bigl[", "\\Bigl[", "\\big[", "\\Big[", "\\["];
  let best = null;
  for (const token of tokens) {
    for (const match of findTopLevelTokenMatches(value, token)) {
      if (!best || match.index < best.index) {
        best = {
          index: match.index,
          end: match.index + token.length
        };
      }
      break;
    }
  }
  return best;
}

function findReadableProductBreak(value) {
  const productTokens = ["\\cdot", "\\,", "\\;"];
  let best = -1;
  for (const token of productTokens) {
    for (const match of findTopLevelTokenMatches(value, token)) {
      if (match.index > 80) {
        best = best === -1 ? match.index : Math.min(best, match.index);
        break;
      }
    }
  }
  return best;
}

function softenAutoDelimiters(value) {
  return String(value || "")
    .replace(/\\left\s*\[/g, "\\bigl[")
    .replace(/\\right\s*\]/g, "\\bigr]")
    .replace(/\\left\s*\(/g, "\\bigl(")
    .replace(/\\right\s*\)/g, "\\bigr)")
    .replace(/\\left\s*\\\{/g, "\\bigl\\{")
    .replace(/\\right\s*\\\}/g, "\\bigr\\}")
    .replace(/\\left\s*\|/g, "\\bigl|")
    .replace(/\\right\s*\|/g, "\\bigr|")
    .replace(/\\left\s*\./g, "")
    .replace(/\\right\s*\./g, "");
}

function findTopLevelToken(value, token) {
  const match = findTopLevelTokenMatches(value, token).next().value;
  return match ? match.index : -1;
}

function* findTopLevelTokenMatches(value, token) {
  let depth = 0;
  for (let index = 0; index <= value.length - token.length; index += 1) {
    const char = value[index];
    if (char === "\\") {
      if (depth === 0 && value.startsWith(token, index)) {
        yield { index };
      }
      index += 1;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0 && value.startsWith(token, index)) {
      yield { index };
    }
  }
}

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function compactLatexPreview(value) {
  const preview = collapseWhitespace(value)
    .replace(/^\\\[/, "")
    .replace(/\\\]$/, "")
    .replace(/\\class\{role-[a-z-]+\}\{/g, "")
    .replace(/[{}]/g, "");
  return preview.length > 160 ? `${preview.slice(0, 157)}...` : preview;
}

function formatHistoryTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const ageMinutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (ageMinutes < 1) {
    return "now";
  }
  if (ageMinutes < 60) {
    return `${ageMinutes}m`;
  }
  const ageHours = Math.round(ageMinutes / 60);
  if (ageHours < 48) {
    return `${ageHours}h`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function readLatexGroup(value, start) {
  if (value[start] !== "{") {
    return null;
  }

  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          content: value.slice(start + 1, index),
          end: index
        };
      }
    }
  }
  return null;
}

function uniqueStrings(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = String(value || "");
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function isDisplayLatexTooRisky(latex) {
  const inner = String(latex || "").slice(2, -2);
  return inner.length > 3200 || hasSeverelyUnbalancedBraces(inner);
}

function hasSeverelyUnbalancedBraces(value) {
  const depth = braceBalance(value, 80);
  return Number.isNaN(depth) || Math.abs(depth) > 8;
}

function braceBalance(value, maxDepth = Infinity) {
  let depth = 0;
  for (const char of String(value || "")) {
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    }
    if (depth < -3 || depth > maxDepth) {
      return NaN;
    }
  }
  return depth;
}

function renderedMathHasProblem() {
  const hasError = Boolean(elements.mathCanvas.querySelector("mjx-merror"));
  const rawText = elements.mathCanvas.textContent || "";
  const hasRawLatex = /\\class|\\frac|\\left|\\right|\\sum|\\begin/.test(rawText);
  const tooWide = elements.mathCanvas.scrollWidth > elements.mathCanvas.clientWidth * 8;
  return hasError || hasRawLatex || tooWide;
}

function showMathFallback(message) {
  elements.mathFallback.hidden = false;
  elements.mathFallback.textContent = `Math rendering issue: ${message}`;
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function createRoleTag(entry) {
  const tag = document.createElement("div");
  tag.className = "role-tag";
  tag.style.setProperty("--entry-color", roleColorFromName(entry.role, entry.color));

  const dot = document.createElement("span");
  dot.className = "role-dot";

  const text = document.createElement("span");
  text.textContent = entry.role || "role";

  tag.append(dot, text);
  return tag;
}

function roleColorFromName(role, fallback = "") {
  const normalized = normalizeRoleName(role || "quantity");
  return currentRoleColors.get(normalized)
    || fallback
    || getComputedStyle(document.documentElement).getPropertyValue(`--${normalized || "quantity"}`).trim()
    || "#22313f";
}

function fallbackTabContext(tab) {
  return {
    selected_text: "",
    guessed_latex: "",
    surrounding_text: [
      tab.title ? `Page title: ${tab.title}` : "",
      tab.url ? `Page URL: ${tab.url}` : ""
    ].filter(Boolean).join("\n"),
    page_title: tab.title || "",
    page_url: tab.url || ""
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setStatus(message, tone) {
  elements.status.textContent = message;
  elements.status.className = `status is-${tone}`;
}

function setLoading(isLoading) {
  elements.explainButton.disabled = isLoading;
  elements.refreshSelectionButton.disabled = isLoading;
  elements.snipButton.disabled = isLoading;
  elements.manualToggleButton.disabled = isLoading;
  elements.historyToggleButton.disabled = isLoading;
  elements.convertManualLatexButton.disabled = isLoading;
  elements.explainButton.textContent = isLoading ? "Explaining..." : "Explain";
}

function setLatexConversionLoading(isLoading) {
  elements.convertManualLatexButton.disabled = isLoading;
  elements.explainButton.disabled = isLoading;
  elements.refreshSelectionButton.disabled = isLoading;
  elements.snipButton.disabled = isLoading;
  elements.manualToggleButton.disabled = isLoading;
  elements.historyToggleButton.disabled = isLoading;
  elements.convertManualLatexButton.textContent = isLoading ? "Converting..." : "Convert to LaTeX";
}
