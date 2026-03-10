const ROOT_ID = "equation-story-extension-root";
const FRAME_SRC = chrome.runtime.getURL("sandbox_renderer.html");
const REMEMBERED_EQUATION_MAX_AGE_MS = 5 * 60 * 1000;
const READABLE_CONTEXT_SELECTOR = [
  "p",
  "li",
  "dd",
  "dt",
  "div",
  "td",
  "th",
  "article",
  "section",
  "main",
  "figcaption",
  "blockquote",
  "figure",
  ".ltx_para",
  ".ltx_equation"
].join(", ");
const MATH_HOST_SELECTOR = [
  "mjx-container",
  ".MathJax",
  ".MathJax_Display",
  ".katex",
  ".katex-display",
  ".mwe-math-element",
  ".mwe-math-mathml-display",
  ".mwe-math-mathml-inline",
  ".ltx_Math",
  ".ltx_equation",
  ".ltx_equationgroup",
  ".ltx_eqn_row",
  "[role='math']",
  "[data-tex]",
  "[data-latex]",
  "math",
  "annotation[encoding='application/x-tex']",
  "script[type^='math/tex']",
  "img.mwe-math-fallback-image-inline",
  "img.mwe-math-fallback-image-display",
  "img[alt*='displaystyle']"
].join(", ");

let lastEquationMemory = null;
let selectionRememberTimer = null;

document.addEventListener("click", (event) => {
  if (isInsideExtensionRoot(event.target)) {
    return;
  }
  rememberEquationFromNode(event.target);
}, true);

document.addEventListener("mouseup", scheduleRememberEquationFromSelection, true);
document.addEventListener("keyup", scheduleRememberEquationFromSelection, true);
document.addEventListener("selectionchange", scheduleRememberEquationFromSelection, true);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === "show-equation-story") {
    try {
      const root = ensureOverlay();
      dispatchToFrame(root, message.payload);
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message
      });
    }

    return true;
  }

  if (message.type === "equation-story-ping") {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "collect-equation-context") {
    try {
      sendResponse({
        ok: true,
        payload: collectEquationContext()
      });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error.message
      });
    }

    return true;
  }

  return false;
});

function ensureOverlay() {
  let root = document.getElementById(ROOT_ID);
  if (root) {
    return root;
  }

  root = document.createElement("div");
  root.id = ROOT_ID;

  const panel = document.createElement("section");
  panel.className = "equation-story-panel";

  const header = document.createElement("header");
  header.className = "equation-story-header";

  const titleBlock = document.createElement("div");
  titleBlock.className = "equation-story-title";

  const title = document.createElement("strong");
  title.textContent = "Equation Story";

  const subtitle = document.createElement("span");
  subtitle.textContent = "AI-rendered explanation";

  titleBlock.append(title, subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "equation-story-close";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => {
    root.remove();
  });

  header.append(titleBlock, closeButton);

  const frame = document.createElement("iframe");
  frame.className = "equation-story-frame";
  frame.src = FRAME_SRC;
  frame.title = "Equation Story renderer";
  frame.dataset.loaded = "false";

  frame.addEventListener("load", () => {
    frame.dataset.loaded = "true";
    if (root._pendingPayload) {
      frame.contentWindow.postMessage({
        type: "render-equation-card",
        payload: root._pendingPayload
      }, "*");
      root._pendingPayload = null;
    }
  });

  panel.append(header, frame);
  root.appendChild(panel);
  document.documentElement.appendChild(root);
  return root;
}

function dispatchToFrame(root, payload) {
  const frame = root.querySelector(".equation-story-frame");
  if (!frame) {
    throw new Error("Extension frame is missing.");
  }

  if (frame.dataset.loaded === "true" && frame.contentWindow) {
    frame.contentWindow.postMessage({
      type: "render-equation-card",
      payload
    }, "*");
    return;
  }

  root._pendingPayload = payload;
}

function collectEquationContext() {
  const activeSelection = getActiveSelection();
  if (activeSelection && activeSelection.type === "input") {
    const selectedText = readSelectedTextFromInput(document.activeElement);
    if (!selectedText) {
      throw new Error("Select or click an equation on the page first.");
    }

    return {
      selectedText,
      guessedLatex: selectedText,
      selectionKind: "input",
      mathSource: "text-input",
      surroundingText: activeSelection.surroundingText,
      pageContext: collectPageContext(document.activeElement),
      pageTitle: document.title || "",
      pageUrl: window.location.href
    };
  }

  const mathSelection = activeSelection && activeSelection.type === "dom"
    ? extractMathSelection(activeSelection.range)
    : null;
  const selectionText = getSelectedText(mathSelection);
  if (selectionText) {
    return {
      selectedText: selectionText,
      guessedLatex: mathSelection && mathSelection.guessedLatex ? mathSelection.guessedLatex : selectionText,
      selectionKind: mathSelection ? "math-selection" : activeSelection ? activeSelection.type : "text",
      mathSource: mathSelection ? mathSelection.source : "",
      surroundingText: mathSelection && mathSelection.host
        ? collectSurroundingTextFromHost(mathSelection.host)
        : activeSelection
          ? collectSurroundingTextFromSelection(activeSelection)
          : selectionText,
      pageContext: collectPageContext(
        mathSelection && mathSelection.host
          ? mathSelection.host
          : activeSelection && activeSelection.type === "dom"
            ? activeSelection.range.commonAncestorContainer
            : document.body
      ),
      pageTitle: document.title || "",
      pageUrl: window.location.href
    };
  }

  const remembered = getRememberedEquationContext();
  if (remembered) {
    return remembered;
  }

  throw new Error("Select or click an equation on the page first.");
}

function getSelectedText(mathSelection) {
  const activeElement = document.activeElement;
  if (isTextInput(activeElement)) {
    const selected = readSelectedTextFromInput(activeElement);
    if (selected) {
      return selected;
    }
  }

  const selection = window.getSelection();
  const rawSelection = selection ? cleanText(selection.toString()) : "";
  if (mathSelection && mathSelection.selectedText) {
    return preferMathSelectionText(rawSelection, mathSelection.selectedText);
  }
  return rawSelection;
}

function getActiveSelection() {
  const activeElement = document.activeElement;
  if (isTextInput(activeElement)) {
    const context = readSelectionContextFromInput(activeElement);
    return context ? { type: "input", ...context } : null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !cleanText(selection.toString())) {
    return null;
  }

  return {
    type: "dom",
    range: selection.getRangeAt(0)
  };
}

function scheduleRememberEquationFromSelection() {
  if (selectionRememberTimer !== null) {
    window.clearTimeout(selectionRememberTimer);
  }

  selectionRememberTimer = window.setTimeout(() => {
    selectionRememberTimer = null;
    rememberEquationFromSelection();
  }, 0);
}

function rememberEquationFromSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  const mathSelection = extractMathSelection(range);
  if (!mathSelection || !mathSelection.host) {
    return;
  }

  const rawSelection = cleanText(selection.toString());
  const context = buildEquationContextFromHost(mathSelection.host, {
    selectedText: preferMathSelectionText(rawSelection, mathSelection.selectedText),
    guessedLatex: mathSelection.guessedLatex,
    selectionKind: "math-selection",
    mathSource: mathSelection.source
  });

  rememberEquationContext(mathSelection.host, context);
}

function rememberEquationFromNode(node) {
  const host = findEquationHostFromNode(node);
  if (!host) {
    return;
  }

  const context = buildEquationContextFromHost(host, {
    selectionKind: "clicked-math",
    mathSource: describeMathHost(host)
  });

  rememberEquationContext(host, context);
}

function rememberEquationContext(host, context) {
  if (!host || !context || (!context.selectedText && !context.guessedLatex)) {
    return;
  }

  lastEquationMemory = {
    host,
    context,
    rememberedAt: Date.now()
  };
}

function getRememberedEquationContext() {
  if (!lastEquationMemory) {
    return null;
  }

  if (Date.now() - lastEquationMemory.rememberedAt > REMEMBERED_EQUATION_MAX_AGE_MS) {
    lastEquationMemory = null;
    return null;
  }

  if (!(lastEquationMemory.host instanceof Element) || !lastEquationMemory.host.isConnected) {
    lastEquationMemory = null;
    return null;
  }

  const refreshed = buildEquationContextFromHost(lastEquationMemory.host, lastEquationMemory.context);
  if (!refreshed) {
    lastEquationMemory = null;
    return null;
  }

  lastEquationMemory.context = refreshed;
  lastEquationMemory.rememberedAt = Date.now();
  return refreshed;
}

function buildEquationContextFromHost(host, overrides = {}) {
  const guessedLatex = cleanExtractedMath(overrides.guessedLatex || extractMathSource(host));
  const readableText = cleanText(overrides.selectedText || extractReadableMathText(host));
  const selectedText = readableText || guessedLatex;
  if (!selectedText && !guessedLatex) {
    return null;
  }

  return {
    selectedText,
    guessedLatex: guessedLatex || selectedText,
    selectionKind: overrides.selectionKind || "clicked-math",
    mathSource: overrides.mathSource || describeMathHost(host),
    surroundingText: collectSurroundingTextFromHost(host),
    pageContext: collectPageContext(host),
    pageTitle: document.title || "",
    pageUrl: window.location.href
  };
}

function collectSurroundingTextFromSelection(selection) {
  if (selection.type === "input") {
    return selection.surroundingText;
  }

  const container = findReadableContainer(selection.range.commonAncestorContainer);
  if (!container) {
    return cleanText(document.body ? document.body.innerText : "");
  }

  return cleanText(container.innerText || container.textContent || "");
}

function collectSurroundingTextFromHost(host) {
  const container = findReadableContainer(host);
  if (!container) {
    return cleanText(document.body ? document.body.innerText : "");
  }

  return cleanText(container.innerText || container.textContent || "");
}

function collectPageContext(anchor) {
  const parts = [];
  const metaDescription = cleanText(
    document.querySelector("meta[name='description'], meta[property='og:description']")?.getAttribute("content") || ""
  );
  if (metaDescription) {
    parts.push(`Page summary: ${clipText(metaDescription, 320)}`);
  }

  const heading = findNearestHeadingText(anchor);
  if (heading) {
    parts.push(`Nearest heading: ${heading}`);
  }

  const neighboringText = collectNeighboringReadableText(anchor);
  if (neighboringText) {
    parts.push(`Nearby section text: ${neighboringText}`);
  }

  return parts.join("\n");
}

function findReadableContainer(node) {
  let current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (current && current !== document.body) {
    if (current.matches && current.matches(READABLE_CONTEXT_SELECTOR)) {
      return current;
    }
    current = current.parentElement;
  }
  return document.body;
}

function collectNeighboringReadableText(anchor) {
  const container = findReadableContainer(anchor);
  if (!container) {
    return "";
  }

  const fragments = [];
  const previous = findReadableSibling(container, "previous");
  const next = findReadableSibling(container, "next");

  if (previous) {
    fragments.push(cleanText(previous.innerText || previous.textContent || ""));
  }
  fragments.push(cleanText(container.innerText || container.textContent || ""));
  if (next) {
    fragments.push(cleanText(next.innerText || next.textContent || ""));
  }

  return clipText(fragments.filter(Boolean).join(" "), 1600);
}

function findReadableSibling(element, direction) {
  let current = direction === "previous" ? element.previousElementSibling : element.nextElementSibling;
  while (current) {
    if (current.matches && current.matches(READABLE_CONTEXT_SELECTOR)) {
      return current;
    }
    current = direction === "previous" ? current.previousElementSibling : current.nextElementSibling;
  }
  return null;
}

function findNearestHeadingText(anchor) {
  let current = anchor && anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : anchor;
  while (current && current !== document.body) {
    const heading = current.querySelector && current.querySelector("h1, h2, h3, h4, h5, h6, .mw-page-title-main, .ltx_title");
    if (heading) {
      const text = cleanText(heading.textContent || "");
      if (text) {
        return clipText(text, 220);
      }
    }

    let sibling = current.previousElementSibling;
    while (sibling) {
      const siblingHeading = sibling.matches && sibling.matches("h1, h2, h3, h4, h5, h6, .mw-page-title-main, .ltx_title")
        ? sibling
        : sibling.querySelector && sibling.querySelector("h1, h2, h3, h4, h5, h6, .mw-page-title-main, .ltx_title");
      if (siblingHeading) {
        const text = cleanText(siblingHeading.textContent || "");
        if (text) {
          return clipText(text, 220);
        }
      }
      sibling = sibling.previousElementSibling;
    }

    current = current.parentElement;
  }

  const fallback = document.querySelector("h1, .mw-page-title-main, .ltx_title");
  return fallback ? clipText(cleanText(fallback.textContent || ""), 220) : "";
}

function isTextInput(element) {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement && /^(text|search|url|tel|password)$/i.test(element.type))
  );
}

function readSelectedTextFromInput(element) {
  const start = typeof element.selectionStart === "number" ? element.selectionStart : 0;
  const end = typeof element.selectionEnd === "number" ? element.selectionEnd : 0;
  if (end <= start) {
    return "";
  }
  return cleanText(element.value.slice(start, end));
}

function readSelectionContextFromInput(element) {
  const start = typeof element.selectionStart === "number" ? element.selectionStart : 0;
  const end = typeof element.selectionEnd === "number" ? element.selectionEnd : 0;
  if (end <= start) {
    return null;
  }

  const left = Math.max(0, start - 240);
  const right = Math.min(element.value.length, end + 240);
  return {
    surroundingText: cleanText(element.value.slice(left, right))
  };
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function extractMathSelection(range) {
  const host = findEquationHostForRange(range);
  if (!host) {
    return null;
  }

  const guessedLatex = extractMathSource(host);
  const selectedText = extractReadableMathText(host);
  if (!guessedLatex && !selectedText) {
    return null;
  }

  return {
    host,
    source: describeMathHost(host),
    guessedLatex: guessedLatex || selectedText,
    selectedText: selectedText || guessedLatex || ""
  };
}

function findEquationHostForRange(range) {
  const directCandidates = [
    range.startContainer,
    range.endContainer,
    range.commonAncestorContainer
  ];

  for (const candidate of directCandidates) {
    const host = findEquationHostFromNode(candidate);
    if (host) {
      return host;
    }
  }

  const ancestor = range.commonAncestorContainer && range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
    ? range.commonAncestorContainer
    : range.commonAncestorContainer.parentElement;

  if (!ancestor || !(ancestor instanceof Element)) {
    return null;
  }

  const nearbyHosts = ancestor.matches(MATH_HOST_SELECTOR)
    ? [ancestor]
    : Array.from(ancestor.querySelectorAll(MATH_HOST_SELECTOR));

  for (const host of nearbyHosts) {
    if (rangeIntersectsElement(range, host)) {
      return host;
    }
  }

  return null;
}

function findEquationHostFromNode(node) {
  let current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (current && current !== document.body) {
    if (current instanceof Element && current.matches(MATH_HOST_SELECTOR)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function rangeIntersectsElement(range, element) {
  try {
    return range.intersectsNode(element);
  } catch (_error) {
    return false;
  }
}

function extractMathSource(host) {
  if (host.matches("script[type^='math/tex']") && host.textContent) {
    return cleanExtractedMath(host.textContent);
  }

  const annotation = host.matches("annotation[encoding='application/x-tex']")
    ? host
    : host.querySelector("annotation[encoding='application/x-tex']");
  if (annotation && annotation.textContent) {
    return cleanExtractedMath(annotation.textContent);
  }

  const mathWithAltText = host.matches("math[alttext]")
    ? host
    : host.querySelector("math[alttext]");
  if (mathWithAltText) {
    const alttext = mathWithAltText.getAttribute("alttext");
    if (alttext) {
      return cleanExtractedMath(alttext);
    }
  }

  const fallbackImage = host instanceof HTMLImageElement
    ? host
    : host.querySelector("img[alt]");
  if (fallbackImage) {
    const alt = fallbackImage.getAttribute("alt");
    if (looksLikeMath(alt)) {
      return cleanExtractedMath(alt);
    }
  }

  const dataTexSource = findAttributeValue(host, [
    "data-tex",
    "data-latex",
    "data-original-text",
    "data-equation-content",
    "data-mathml",
    "aria-label"
  ]);
  if (looksLikeMath(dataTexSource)) {
    return cleanExtractedMath(dataTexSource);
  }

  const scriptSource = findAdjacentMathScript(host);
  if (scriptSource) {
    return cleanExtractedMath(scriptSource);
  }

  return "";
}

function extractReadableMathText(host) {
  const mathElement = host.matches("math")
    ? host
    : host.querySelector("math");
  if (mathElement) {
    const mathText = cleanText(mathElement.textContent || "");
    if (mathText) {
      return mathText;
    }
  }

  const katexText = host.matches(".katex")
    ? host.querySelector(".katex-html")
    : host.querySelector(".katex-html");
  if (katexText) {
    const text = cleanText(katexText.textContent || "");
    if (text) {
      return text;
    }
  }

  if (host instanceof HTMLImageElement) {
    const alt = cleanText(host.getAttribute("alt") || "");
    if (alt) {
      return cleanExtractedMath(alt);
    }
  }

  const ariaLabel = cleanText(host.getAttribute("aria-label") || "");
  if (looksLikeMath(ariaLabel)) {
    return cleanExtractedMath(ariaLabel);
  }

  return cleanText(host.textContent || "");
}

function findAttributeValue(element, attributeNames) {
  for (const attributeName of attributeNames) {
    const direct = element.getAttribute(attributeName);
    if (direct && direct.trim()) {
      return direct.trim();
    }
  }

  const descendants = element.querySelectorAll("*");
  for (const descendant of descendants) {
    for (const attributeName of attributeNames) {
      const value = descendant.getAttribute(attributeName);
      if (value && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
}

function findAdjacentMathScript(host) {
  const direct = host.matches("script[type^='math/tex']")
    ? host
    : host.querySelector("script[type^='math/tex']");
  if (direct instanceof HTMLScriptElement && direct.textContent) {
    return direct.textContent;
  }

  const candidates = [
    host.previousElementSibling,
    host.nextElementSibling,
    host.parentElement && host.parentElement.previousElementSibling,
    host.parentElement && host.parentElement.nextElementSibling,
    host.parentElement && host.parentElement.querySelector("script[type^='math/tex']")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate instanceof HTMLScriptElement && /^math\/tex/i.test(candidate.type) && candidate.textContent) {
      return candidate.textContent;
    }

    const nested = candidate.querySelector && candidate.querySelector("script[type^='math/tex']");
    if (nested instanceof HTMLScriptElement && nested.textContent) {
      return nested.textContent;
    }
  }

  return "";
}

function cleanExtractedMath(value) {
  let text = String(value || "").trim();
  if (!text) {
    return "";
  }

  text = text.replace(/^\{\s*\\displaystyle\s*/i, "");
  text = text.replace(/^\\displaystyle\s*/i, "");
  text = text.replace(/\s*\}\s*$/i, "");
  text = text.replace(/^\$(.*)\$$/, "$1");
  text = text.replace(/^\\\((.*)\\\)$/s, "$1");
  text = cleanText(text);
  return text;
}

function looksLikeMath(value) {
  const text = cleanText(value);
  if (!text) {
    return false;
  }

  return /[=+\-*/^_\\]|∑|∫|∞|≤|≥|≈|∂|φ|λ|μ|α|β|γ/.test(text);
}

function preferMathSelectionText(rawSelection, mathSelectionText) {
  if (!rawSelection) {
    return mathSelectionText;
  }

  if (!looksLikeMath(rawSelection) && looksLikeMath(mathSelectionText)) {
    return mathSelectionText;
  }

  if (rawSelection.length < 4 && mathSelectionText.length > rawSelection.length) {
    return mathSelectionText;
  }

  return rawSelection;
}

function describeMathHost(host) {
  if (host.matches("mjx-container, .MathJax, .MathJax_Display")) {
    return "mathjax";
  }
  if (host.matches(".katex")) {
    return "katex";
  }
  if (host.matches(".mwe-math-element")) {
    return "wikipedia-math";
  }
  if (host.matches("math")) {
    return "mathml";
  }
  if (host.matches("img")) {
    return "math-image-alt";
  }
  return "math";
}

function looksLikeMath(value) {
  const text = cleanText(value);
  if (!text) {
    return false;
  }

  return /[=+\-*/^_\\]|[∑∫∞≤≥≈∂ϕφλμαβγπΠΔΩ]/u.test(text);
}

function describeMathHost(host) {
  if (host.matches("mjx-container, .MathJax, .MathJax_Display")) {
    return "mathjax";
  }
  if (host.matches(".katex, .katex-display")) {
    return "katex";
  }
  if (host.matches(".mwe-math-element, .mwe-math-mathml-display, .mwe-math-mathml-inline")) {
    return "wikipedia-math";
  }
  if (host.matches(".ltx_Math, .ltx_equation, .ltx_equationgroup, .ltx_eqn_row")) {
    return "paper-math";
  }
  if (host.matches("math, [role='math']")) {
    return "mathml";
  }
  if (host.matches("img")) {
    return "math-image-alt";
  }
  if (host.matches("script[type^='math/tex'], annotation[encoding='application/x-tex']")) {
    return "tex-source";
  }
  return "math";
}

function isInsideExtensionRoot(node) {
  const element = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return Boolean(element && element.closest && element.closest(`#${ROOT_ID}`));
}

function isProbablyUrl(text) {
  return /^(https?:\/\/|www\.)/i.test(String(text || "").trim());
}

function clipText(text, maxLength) {
  const normalized = cleanText(text);
  if (!normalized || normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function looksLikeMath(value) {
  const text = cleanText(value);
  if (!text || isProbablyUrl(text)) {
    return false;
  }

  return /[=+\-*/^_\\]|[\u2211\u222b\u221e\u2264\u2265\u2248\u2202\u03d5\u03c6\u03bb\u03bc\u03b1\u03b2\u03b3\u03c0\u03a0\u0394\u03a9]/u.test(text);
}
