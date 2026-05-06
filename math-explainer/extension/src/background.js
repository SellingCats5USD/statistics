self.window = self;
self.document = {
  addEventListener() {},
  getElementById() {
    return null;
  },
  createElement() {
    return {};
  }
};

importScripts("equation_explainer_v1.js");

self.exports = {};
importScripts("promptExamples.js");
self.PROMPT_EXAMPLES_API = self.exports;
self.exports = undefined;

importScripts("equation_openai.js");

const CONFIG_KEYS = ["apiKey", "model", "latexConverterModel", "audience", "difficulty", "domainHint", "latexCopyStyle", "highlightOpacity", "aidLength", "popupWidth", "mathRendererHighlights"];
const PREF_KEYS = CONFIG_KEYS.filter((key) => key !== "apiKey");
const HISTORY_KEY = "equationHistory";
const HISTORY_LIMIT = 50;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") {
    return false;
  }

  if (message.type === "explain-equation") {
    explainEquation(message.payload)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: toErrorMessage(error) }));
    return true;
  }

  if (message.type === "convert-raw-math") {
    convertRawMath(message.payload)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: toErrorMessage(error) }));
    return true;
  }

  if (message.type === "get-config") {
    readConfig()
      .then((payload) => sendResponse({ ok: true, payload: maskConfig(payload) }))
      .catch((error) => sendResponse({ ok: false, error: toErrorMessage(error) }));
    return true;
  }

  if (message.type === "save-config") {
    saveConfig(message.payload)
      .then((payload) => sendResponse({ ok: true, payload: maskConfig(payload) }))
      .catch((error) => sendResponse({ ok: false, error: toErrorMessage(error) }));
    return true;
  }

  if (message.type === "test-openai") {
    testOpenAI()
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: toErrorMessage(error) }));
    return true;
  }

  if (message.type === "capture-visible-tab") {
    captureVisibleTabForSender(sender)
      .then((payload) => sendResponse({ ok: true, payload }))
      .catch((error) => sendResponse({ ok: false, error: toErrorMessage(error) }));
    return true;
  }

  return false;
});

async function explainEquation(payload) {
  const config = await readConfig();
  if (!config.apiKey) {
    throw new Error("Set your OpenAI API key in extension options first.");
  }

  const requestBody = normalizeExplainPayload(payload, config);
  const grounding = analyzeEquationForPrompt(requestBody.guessed_latex, requestBody.domain);
  const card = await callOpenAIEquationCard({
    apiKey: config.apiKey,
    model: config.model,
    request: requestBody,
    grounding
  });

  const normalizedCard = validateEquationCard(normalizeEquationCard(card));
  const historySave = await addEquationHistoryEntry(normalizedCard, requestBody);

  await chrome.storage.local.set({
    lastEquationCard: normalizedCard,
    lastExplainInput: withoutLargeFields(requestBody),
    lastExplainAt: historySave.entry.createdAt,
    [HISTORY_KEY]: historySave.history
  });

  return normalizedCard;
}

async function addEquationHistoryEntry(card, requestBody) {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  const existing = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
  const now = new Date().toISOString();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  card.historyId = id;
  card.generatedAt = now;
  const entry = {
    id,
    title: trimTo(card.title || "Untitled equation", 140),
    domain: trimTo(card.domain || "general", 40),
    displayLatex: trimTo(card.displayLatex || "", 4000),
    pageTitle: trimTo(requestBody.page_title || "", 180),
    pageUrl: trimTo(requestBody.page_url || "", 2000),
    selectedText: trimTo(requestBody.selected_text || requestBody.guessed_latex || "", 800),
    createdAt: now,
    card
  };
  return {
    entry,
    history: [entry, ...existing].slice(0, HISTORY_LIMIT)
  };
}

async function convertRawMath(payload) {
  const config = await readConfig();
  if (!config.apiKey) {
    throw new Error("Set your OpenAI API key in extension options first.");
  }

  const input = trimTo(String(payload?.text || ""), 6000);
  if (!input) {
    throw new Error("Paste raw math into Manual first.");
  }
  const focusPrompt = trimTo(String(payload?.focus_prompt || ""), 2000);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.latexConverterModel,
      instructions: buildLatexConversionInstructions(),
      input: JSON.stringify({
        raw_math: input,
        copy_style: config.latexCopyStyle,
        focus_prompt: focusPrompt,
        user_edit_instructions: focusPrompt,
        priority: focusPrompt ? "Apply user_edit_instructions before deciding output formatting." : "No extra edits requested."
      }),
      text: {
        format: {
          type: "json_schema",
          name: "latex_conversion",
          description: "Copy-ready LaTeX converted from pasted raw math.",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["latex_body", "copy_text"],
            properties: {
              latex_body: { type: "string" },
              copy_text: { type: "string" }
            }
          }
        }
      }
    })
  });

  const rawText = await response.text();
  let payloadJson = null;
  if (rawText) {
    try {
      payloadJson = JSON.parse(rawText);
    } catch (_error) {
      payloadJson = null;
    }
  }

  if (!response.ok) {
    const detail = payloadJson?.error?.message || payloadJson?.message || rawText || `HTTP ${response.status}`;
    throw new Error(`OpenAI LaTeX conversion failed: ${detail}`);
  }

  const refusal = readRefusal(payloadJson);
  if (refusal) {
    throw new Error(`OpenAI refused the conversion: ${refusal}`);
  }

  const outputText = readOutputText(payloadJson);
  if (!outputText) {
    throw new Error("OpenAI returned an empty LaTeX conversion.");
  }

  let converted = null;
  try {
    converted = JSON.parse(outputText);
  } catch (error) {
    throw new Error(`OpenAI did not return parseable LaTeX JSON: ${error.message}`);
  }

  const modelLatexBody = normalizeLatexBody(converted?.latex_body);
  const modelCopyText = normalizeConvertedCopyText(converted?.copy_text);
  const edited = applyDeterministicLatexEdits({
    latexBody: modelLatexBody,
    copyText: modelCopyText,
    focusPrompt,
    copyStyle: config.latexCopyStyle
  });
  const latexBody = normalizeLatexBody(edited.latexBody);
  if (!latexBody) {
    throw new Error("OpenAI did not return a LaTeX body.");
  }
  const copyText = normalizeConvertedCopyText(edited.copyText);
  const formattedLatex = focusPrompt && focusPromptNeedsCopyText(focusPrompt) && copyText
    ? copyText
    : formatLatexForCopyStyle(latexBody, config.latexCopyStyle);

  return {
    latexBody,
    formattedLatex,
    model: config.latexConverterModel,
    copyStyle: config.latexCopyStyle,
    focusPromptApplied: Boolean(focusPrompt),
    localEditApplied: edited.localEditApplied
  };
}

async function captureVisibleTabForSender(sender) {
  const windowId = sender?.tab?.windowId;
  if (typeof windowId !== "number") {
    throw new Error("Could not identify the tab window for screenshot capture.");
  }

  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: "png"
  });

  return {
    dataUrl
  };
}

async function testOpenAI() {
  const config = await readConfig();
  if (!config.apiKey) {
    throw new Error("Set your OpenAI API key first.");
  }

  await assertModelAvailable(config.model, config.apiKey, "Explanation model");
  await assertModelAvailable(config.latexConverterModel, config.apiKey, "LaTeX converter model");

  return {
    model: config.model,
    latexConverterModel: config.latexConverterModel,
    ready: true
  };
}

async function assertModelAvailable(model, apiKey, label) {
  const normalized = String(model || "").trim();
  if (!normalized) {
    throw new Error(`${label} is empty.`);
  }

  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(normalized)}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    const detail = await readErrorDetail(response);
    throw new Error(`${label} "${normalized}" is not available: ${detail}`);
  }
}

async function readConfig() {
  const [localStored, syncedStored] = await Promise.all([
    chrome.storage.local.get(CONFIG_KEYS),
    readSyncedPrefs()
  ]);
  const stored = {
    ...localStored,
    ...syncedStored,
    apiKey: localStored.apiKey
  };
  return {
    apiKey: String(stored.apiKey || "").trim(),
    model: String(stored.model || "gpt-5.4-mini").trim() || "gpt-5.4-mini",
    latexConverterModel: String(stored.latexConverterModel || "gpt-5.4-mini").trim() || "gpt-5.4-mini",
    audience: String(stored.audience || "undergraduate").trim() || "undergraduate",
    difficulty: String(stored.difficulty || "standard").trim() || "standard",
    domainHint: String(stored.domainHint || "general").trim() || "general",
    latexCopyStyle: normalizeLatexCopyStyle(stored.latexCopyStyle),
    highlightOpacity: normalizeHighlightOpacity(stored.highlightOpacity),
    aidLength: String(stored.aidLength || "short").trim() || "short",
    popupWidth: normalizePopupWidth(stored.popupWidth),
    mathRendererHighlights: normalizeBoolean(stored.mathRendererHighlights)
  };
}

async function saveConfig(payload) {
  const existing = await readConfig();
  const incomingKey = String(payload?.apiKey || "").trim();
  const nextConfig = {
    apiKey: incomingKey || existing.apiKey,
    model: configString(payload, "model", existing.model, "gpt-5.4-mini"),
    latexConverterModel: configString(payload, "latexConverterModel", existing.latexConverterModel, "gpt-5.4-mini"),
    audience: configString(payload, "audience", existing.audience, "undergraduate"),
    difficulty: configString(payload, "difficulty", existing.difficulty, "standard"),
    domainHint: configString(payload, "domainHint", existing.domainHint, "general"),
    latexCopyStyle: normalizeLatexCopyStyle(payload?.latexCopyStyle || existing.latexCopyStyle),
    highlightOpacity: normalizeHighlightOpacity(payload?.highlightOpacity ?? existing.highlightOpacity),
    aidLength: configString(payload, "aidLength", existing.aidLength, "short"),
    popupWidth: normalizePopupWidth(payload?.popupWidth ?? existing.popupWidth),
    mathRendererHighlights: normalizeBoolean(payload?.mathRendererHighlights ?? existing.mathRendererHighlights)
  };

  if (payload?.clearApiKey) {
    nextConfig.apiKey = "";
  }

  await chrome.storage.local.set(nextConfig);
  await writeSyncedPrefs(nextConfig);
  return nextConfig;
}

function configString(payload, key, existingValue, fallback) {
  const value = Object.prototype.hasOwnProperty.call(payload || {}, key) ? payload[key] : existingValue;
  return String(value || fallback).trim() || fallback;
}

async function readSyncedPrefs() {
  try {
    if (!chrome.storage.sync) {
      return {};
    }
    return await chrome.storage.sync.get(PREF_KEYS);
  } catch (_error) {
    return {};
  }
}

async function writeSyncedPrefs(config) {
  try {
    if (!chrome.storage.sync) {
      return;
    }
    const prefs = {};
    for (const key of PREF_KEYS) {
      prefs[key] = config[key];
    }
    await chrome.storage.sync.set(prefs);
  } catch (_error) {
    // Local storage is still the source of truth if sync is unavailable.
  }
}

function normalizeLatexCopyStyle(value) {
  const normalized = String(value || "").trim();
  if (normalized === "display" || normalized === "obsidian-dollar") {
    return normalized;
  }
  return "raw";
}

function buildLatexConversionInstructions() {
  return [
    "Convert pasted raw math or mixed math/prose into clean copy-ready LaTeX.",
    "Return JSON only.",
    "The focus_prompt / user_edit_instructions field is a command, not a hint. If it is nonempty, apply it before producing latex_body and copy_text.",
    "If user_edit_instructions says switch x for y, replace x by y. If it says replace x with y, rename x to y. If it says substitute y for x, replace x by y. If it says swap x and y, exchange both symbols.",
    "Output latex_body as the best standalone mathematical LaTeX body: no display delimiters, no dollar signs, no markdown fences, no explanatory prose.",
    "Output copy_text as the final text the user should paste, following copy_style and focus_prompt.",
    "Preserve the user's symbols and structure when possible.",
    "Use standard MathJax-compatible LaTeX.",
    "If the input is already LaTeX, clean obvious wrapper/delimiter noise and return the best body.",
    "If focus_prompt is empty and the input contains prose plus one equation, put only the equation-like mathematical content in latex_body and make copy_text the latex_body formatted according to copy_style.",
    "If focus_prompt gives editing instructions, follow them carefully: remove requested variables or terms, rename variables, change signs, simplify parts, expand or factor, or keep/drop surrounding prose as requested.",
    "If focus_prompt asks for prose outside math, put that prose outside dollar/display delimiters in copy_text and wrap only the mathematical pieces according to copy_style.",
    "If focus_prompt asks for prose inside math, put words inside proper \\text{...} blocks in latex_body and copy_text.",
    "For copy_style raw, copy_text should usually be plain LaTeX without outer math delimiters unless focus_prompt explicitly requests mixed prose with inline math.",
    "For copy_style obsidian-dollar, copy_text should use single dollar signs around mathematical pieces. If there is mixed prose, do not wrap the entire prose paragraph in one dollar pair; wrap only the math snippets.",
    "For copy_style display, copy_text should use \\[...\\] for a standalone display equation unless focus_prompt asks for inline or mixed prose.",
    "Examples: raw_math '$\\phi_{\\#} p(x)$' with focus_prompt 'switch x for y' should return latex_body '\\phi_{\\#} p(y)'. raw_math 'loss equals L(x)' with focus_prompt 'keep the text outside dollars' and copy_style obsidian-dollar should return copy_text 'loss equals $L(x)$'. raw_math 'loss equals L(x)' with focus_prompt 'put the words inside math' should return latex_body '\\text{loss equals } L(x)'.",
    "Never invent extra mathematical content not requested by the user. If an edit would be ambiguous, make the most conservative syntax-preserving edit.",
    "Do not add semantic \\class wrappers, colors, comments, or labels unless they are part of the pasted math.",
    "Use \\frac{}{}, _{}, ^{}, \\sqrt{}, \\sum, \\int, \\nabla, \\partial, \\mathbb{}, and aligned subscripts/superscripts where appropriate."
  ].join(" ");
}

function normalizeLatexBody(value) {
  let latex = String(value || "").trim();
  if (!latex) {
    return "";
  }
  latex = latex
    .replace(/^```(?:latex|tex)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  let changed = true;
  while (changed) {
    changed = false;
    if (latex.startsWith("\\[") && latex.endsWith("\\]")) {
      latex = latex.slice(2, -2).trim();
      changed = true;
    } else if (latex.startsWith("$$") && latex.endsWith("$$")) {
      latex = latex.slice(2, -2).trim();
      changed = true;
    } else if (latex.startsWith("$") && latex.endsWith("$")) {
      latex = latex.slice(1, -1).trim();
      changed = true;
    } else if (latex.startsWith("\\(") && latex.endsWith("\\)")) {
      latex = latex.slice(2, -2).trim();
      changed = true;
    }
  }
  return latex;
}

function normalizeConvertedCopyText(value) {
  return String(value || "")
    .replace(/^```(?:latex|tex|markdown|md)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function applyDeterministicLatexEdits(options) {
  const edit = parseSimpleRenameInstruction(options.focusPrompt);
  if (!edit) {
    return {
      latexBody: options.latexBody,
      copyText: options.copyText,
      localEditApplied: false
    };
  }

  const latexBody = applyRenameEdit(options.latexBody, edit);
  const copyText = applyRenameEdit(options.copyText || formatLatexForCopyStyle(options.latexBody, options.copyStyle), edit);
  return {
    latexBody,
    copyText,
    localEditApplied: latexBody !== options.latexBody || copyText !== options.copyText
  };
}

function parseSimpleRenameInstruction(value) {
  const prompt = collapseWhitespaceLocal(value);
  if (!prompt) {
    return null;
  }

  let match = prompt.match(/^swap\s+(.+?)\s+(?:and|with)\s+(.+?)\.?$/i);
  if (match) {
    return {
      type: "swap",
      from: normalizeEditSymbol(match[1]),
      to: normalizeEditSymbol(match[2])
    };
  }

  match = prompt.match(/^(?:switch|replace|change|rename)\s+(.+?)\s+(?:for|with|to|into)\s+(.+?)\.?$/i);
  if (match) {
    return {
      type: "replace",
      from: normalizeEditSymbol(match[1]),
      to: normalizeEditSymbol(match[2])
    };
  }

  match = prompt.match(/^substitute\s+(.+?)\s+for\s+(.+?)\.?$/i);
  if (match) {
    return {
      type: "replace",
      from: normalizeEditSymbol(match[2]),
      to: normalizeEditSymbol(match[1])
    };
  }

  return null;
}

function normalizeEditSymbol(value) {
  let symbol = String(value || "")
    .trim()
    .replace(/^["'`$]+|["'`$.,;:]+$/g, "")
    .replace(/^\\\((.*)\\\)$/g, "$1")
    .replace(/^\\\[(.*)\\\]$/g, "$1")
    .trim();
  const greek = {
    alpha: "\\alpha",
    beta: "\\beta",
    gamma: "\\gamma",
    delta: "\\delta",
    epsilon: "\\epsilon",
    theta: "\\theta",
    lambda: "\\lambda",
    mu: "\\mu",
    sigma: "\\sigma",
    phi: "\\phi",
    psi: "\\psi",
    omega: "\\omega"
  };
  return greek[symbol] || symbol;
}

function applyRenameEdit(value, edit) {
  if (!value || !edit?.from || !edit?.to || edit.from === edit.to) {
    return value;
  }
  if (edit.type === "swap") {
    const marker = "@@SWAP@@";
    return replaceLatexSymbol(
      replaceLatexSymbol(
        replaceLatexSymbol(String(value), edit.from, marker),
        edit.to,
        edit.from
      ),
      marker,
      edit.to
    );
  }
  return replaceLatexSymbol(String(value), edit.from, edit.to);
}

function replaceLatexSymbol(value, from, to) {
  if (!from || from.length > 40) {
    return value;
  }
  const source = String(value || "");
  if (/^[A-Za-z]$/.test(from)) {
    return source.replace(new RegExp(`(^|[^\\\\A-Za-z])${escapeRegExp(from)}(?![A-Za-z])`, "g"), `$1${to}`);
  }
  if (/^\\[A-Za-z]+$/.test(from)) {
    return source.replace(new RegExp(`${escapeRegExp(from)}(?![A-Za-z])`, "g"), to);
  }
  return source.split(from).join(to);
}

function focusPromptNeedsCopyText(value) {
  return /\b(text|prose|words?|sentence|outside|inside|dollar|dollars|inline|paragraph|free[- ]?standing|keep.*text|include.*text)\b/i
    .test(String(value || ""));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatLatexForCopyStyle(latexBody, style) {
  const body = normalizeLatexBody(latexBody);
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

function normalizeHighlightOpacity(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 12;
  }
  return Math.min(35, Math.max(0, Math.round(number)));
}

function normalizePopupWidth(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 300) {
    return 820;
  }
  return Math.min(1000, Math.max(300, Math.round(number / 20) * 20));
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function maskConfig(config) {
  return {
    ...config,
    apiKey: "",
    hasApiKey: Boolean(config.apiKey)
  };
}

function normalizeExplainPayload(payload, config) {
  const selectedText = trimTo(String(payload?.selected_text || ""), 8000);
  const guessedLatex = trimTo(String(payload?.guessed_latex || selectedText), 8000);
  const snapshot = trimTo(String(payload?.page_snapshot_data_url || ""), 4_000_000);

  if (!selectedText && !guessedLatex && !snapshot) {
    throw new Error("Select or paste an equation first.");
  }

  const domainHint = String(payload?.domain_hint || config.domainHint).trim() || "general";
  return {
    selected_text: selectedText,
    guessed_latex: guessedLatex || selectedText,
    surrounding_text: trimTo(String(payload?.surrounding_text || ""), 12000),
    page_title: trimTo(String(payload?.page_title || ""), 500),
    page_url: trimTo(String(payload?.page_url || ""), 2000),
    page_snapshot_data_url: snapshot,
    page_snapshot_variant_data_urls: [],
    audience: trimTo(String(payload?.audience || config.audience), 100) || "undergraduate",
    difficulty: trimTo(String(payload?.difficulty || config.difficulty), 100) || "standard",
    aid_length: trimTo(String(payload?.aid_length || config.aidLength), 120) || "short",
    focus_prompt: trimTo(String(payload?.focus_prompt || ""), 2000),
    domain_hint: trimTo(domainHint, 100),
    domain: normalizeDomainHint(domainHint)
  };
}

function analyzeEquationForPrompt(latex, domain) {
  if (!latex || typeof self.analyzeLatex !== "function") {
    return null;
  }

  try {
    const analysis = self.analyzeLatex(latex, domain);
    return {
      version: "equation-analysis/v1",
      input: {
        latex,
        domain
      },
      stats: {
        tokenCount: analysis.tokenCount,
        nodeCount: analysis.nodeCount
      },
      summaryLines: Array.isArray(analysis.summaryLines) ? analysis.summaryLines.slice(0, 4) : [],
      topLevelNodes: Array.isArray(analysis.topLevelNodes) ? analysis.topLevelNodes.slice(0, 6).map(summarizeAnalyzerNode) : [],
      semanticNodes: Array.isArray(analysis.semanticNodes) ? analysis.semanticNodes.slice(0, 6).map(summarizeAnalyzerNode) : []
    };
  } catch (error) {
    console.warn(`[parser] grounding unavailable: ${toErrorMessage(error)}`);
    return null;
  }
}

function summarizeAnalyzerNode(node) {
  const latex = collapseWhitespaceLocal(self.nodeToLatex(node, { decorate: false })).trim();
  return {
    id: node.id,
    type: node.type,
    role: node.role || "quantity",
    roleLabel: self.humanizeRole(node.role),
    semanticType: node.semanticType || null,
    title: node.title || "",
    description: node.description || "",
    depth: typeof node.depth === "number" ? node.depth : null,
    childCount: self.getChildNodes(node).length,
    latex
  };
}

function normalizeEquationCard(card) {
  return {
    ...card,
    deepContext: Array.isArray(card.deepContext) ? card.deepContext : [],
    useCases: Array.isArray(card.useCases) ? card.useCases : [],
    strategyTips: Array.isArray(card.strategyTips) ? card.strategyTips : [],
    graphSpec: normalizeGraphSpec(card.graphSpec),
    displayLatex: String(card.displayLatex || "").replace(/\\class\{([a-z][a-z-]*)\}\{/gi, (_match, roleName) => {
      return roleName.startsWith("role-") ? `\\class{${roleName}}{` : `\\class{role-${roleName}}{`;
    })
  };
}

function normalizeGraphSpec(spec) {
  if (!spec || typeof spec !== "object") {
    return emptyGraphSpec();
  }
  return {
    available: spec.available === true,
    title: String(spec.title || ""),
    description: String(spec.description || ""),
    domainNote: String(spec.domainNote || ""),
    xLabel: String(spec.xLabel || ""),
    yLabel: String(spec.yLabel || ""),
    parameters: Array.isArray(spec.parameters) ? spec.parameters : [],
    curves: Array.isArray(spec.curves) ? spec.curves : [],
    views: Array.isArray(spec.views) ? spec.views : []
  };
}

function emptyGraphSpec() {
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

function validateEquationCard(card) {
  const requiredStrings = ["version", "title", "domain", "displayLatex", "summary", "intuition"];
  for (const key of requiredStrings) {
    if (typeof card[key] !== "string" || !card[key].trim()) {
      throw new Error(`OpenAI returned an invalid card: missing ${key}.`);
    }
  }
  if (card.version !== "equation-card/v1") {
    throw new Error("OpenAI returned an unsupported card version.");
  }
  for (const key of ["selfDescriptiveSpans", "story", "summarySpans", "intuitionSpans", "legend", "highlights", "walkthrough", "deepContext", "useCases", "strategyTips", "notes"]) {
    if (!Array.isArray(card[key])) {
      throw new Error(`OpenAI returned an invalid card: ${key} must be an array.`);
    }
  }
  if (!card.graphSpec || typeof card.graphSpec !== "object") {
    throw new Error("OpenAI returned an invalid card: graphSpec must be an object.");
  }
  return card;
}

function normalizeDomainHint(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ml" || normalized.includes("machine learning")) {
    return "ml";
  }
  if (normalized === "signals" || normalized.includes("signal") || normalized.includes("fourier")) {
    return "signals";
  }
  if (normalized === "calculus" || normalized.includes("integral") || normalized.includes("derivative")) {
    return "calculus";
  }
  return "general";
}

function withoutLargeFields(payload) {
  return {
    ...payload,
    page_snapshot_data_url: payload.page_snapshot_data_url ? "[captured image omitted]" : "",
    page_snapshot_variant_data_urls: []
  };
}

function trimTo(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function collapseWhitespaceLocal(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeHistoryKey(value) {
  return collapseWhitespaceLocal(value)
    .toLowerCase()
    .replace(/\\class\{role-[a-z-]+\}\{/g, "\\class{role}{")
    .slice(0, 1000);
}

async function readErrorDetail(response) {
  const text = await response.text();
  if (!text) {
    return `HTTP ${response.status}`;
  }
  try {
    const payload = JSON.parse(text);
    return payload?.error?.message || payload?.message || text;
  } catch (_error) {
    return text;
  }
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
