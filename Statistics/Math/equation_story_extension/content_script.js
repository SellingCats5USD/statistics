const ROOT_ID = "equation-story-extension-root";
const FRAME_SRC = chrome.runtime.getURL("sandbox_renderer.html");
const MATH_HOST_SELECTOR = [
  "mjx-container",
  ".MathJax",
  ".MathJax_Display",
  ".katex",
  ".mwe-math-element",
  "math",
  "img.mwe-math-fallback-image-inline",
  "img.mwe-math-fallback-image-display",
  "img[alt*='displaystyle']"
].join(", ");

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
  const mathSelection = activeSelection && activeSelection.type === "dom"
    ? extractMathSelection(activeSelection.range)
    : null;
  const selectionText = getSelectedText(mathSelection);
  if (!selectionText) {
    throw new Error("Select some equation text on the page first.");
  }

  const surroundingText = activeSelection
    ? collectSurroundingTextFromSelection(activeSelection)
    : selectionText;

  return {
    selectedText: selectionText,
    guessedLatex: mathSelection && mathSelection.guessedLatex ? mathSelection.guessedLatex : selectionText,
    selectionKind: mathSelection ? mathSelection.kind : activeSelection ? activeSelection.type : "text",
    mathSource: mathSelection ? mathSelection.source : "",
    surroundingText,
    pageTitle: document.title || "",
    pageUrl: window.location.href
  };
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

function findReadableContainer(node) {
  let current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (current && current !== document.body) {
    if (current.matches && current.matches("p, li, div, td, th, article, section, main, figcaption, blockquote")) {
      return current;
    }
    current = current.parentElement;
  }
  return document.body;
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
    kind: "math",
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
  const candidates = [
    host.previousElementSibling,
    host.nextElementSibling,
    host.parentElement && host.parentElement.previousElementSibling,
    host.parentElement && host.parentElement.querySelector("script[type^='math/tex']")
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate instanceof HTMLScriptElement && /^math\/tex/i.test(candidate.type) && candidate.textContent) {
      return candidate.textContent;
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
