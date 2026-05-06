chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !["collect-equation-context", "start-equation-snip"].includes(message.type)) {
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
        error: error instanceof Error ? error.message : String(error)
      });
    }
    return false;
  }

  if (message.type === "start-equation-snip") {
    try {
      if (document.getElementById("equation-explainer-snip-layer")) {
        throw new Error("Snip mode is already active.");
      }
      startSnipMode().catch((error) => {
        console.warn(`[equation snip] ${error instanceof Error ? error.message : String(error)}`);
      });
      sendResponse({ ok: true, payload: { started: true } });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
    return false;
  }

  return false;
});

function collectEquationContext() {
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : "";
  const inferredLatex = inferNearbyLatex(selection);
  const surroundingText = buildPageContext(selection, selectedText);

  return {
    selected_text: selectedText,
    guessed_latex: inferredLatex || selectedText,
    surrounding_text: surroundingText,
    page_title: document.title || "",
    page_url: window.location.href
  };
}

async function startSnipMode() {
  const pageContext = collectEquationContext();
  const layer = document.createElement("div");
  layer.id = "equation-explainer-snip-layer";
  layer.innerHTML = [
    '<div class="equation-explainer-snip-instructions">',
    "Drag around the equation, then release. Press Esc to cancel.",
    "</div>",
    '<div class="equation-explainer-snip-box"></div>'
  ].join("");

  const style = document.createElement("style");
  style.id = "equation-explainer-snip-style";
  style.textContent = `
    #equation-explainer-snip-layer {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      cursor: crosshair;
      background: rgba(10, 18, 28, 0.18);
      user-select: none;
    }
    .equation-explainer-snip-instructions {
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      max-width: min(640px, calc(100vw - 32px));
      border: 1px solid rgba(255, 255, 255, 0.38);
      border-radius: 999px;
      background: rgba(34, 49, 63, 0.9);
      color: white;
      padding: 10px 16px;
      font: 600 14px/1.35 "Segoe UI", system-ui, sans-serif;
      box-shadow: 0 14px 42px rgba(0, 0, 0, 0.26);
      pointer-events: none;
    }
    .equation-explainer-snip-box {
      position: fixed;
      display: none;
      border: 2px solid #b95c2f;
      border-radius: 10px;
      background: rgba(255, 246, 231, 0.18);
      box-shadow: 0 0 0 9999px rgba(10, 18, 28, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.72);
      pointer-events: none;
    }
  `;

  document.documentElement.append(style, layer);

  const box = layer.querySelector(".equation-explainer-snip-box");
  let startX = 0;
  let startY = 0;
  let active = false;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("keydown", onKeyDown, true);
      layer.removeEventListener("pointerdown", onPointerDown, true);
      layer.removeEventListener("pointermove", onPointerMove, true);
      layer.removeEventListener("pointerup", onPointerUp, true);
      layer.remove();
      style.remove();
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        cleanup();
        reject(new Error("Snip cancelled."));
      }
    };

    const onPointerDown = (event) => {
      active = true;
      startX = event.clientX;
      startY = event.clientY;
      box.style.display = "block";
      updateSnipBox(box, startX, startY, event.clientX, event.clientY);
      layer.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerMove = (event) => {
      if (!active) {
        return;
      }
      updateSnipBox(box, startX, startY, event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerUp = async (event) => {
      if (!active) {
        return;
      }
      active = false;
      const rect = normalizeRect(startX, startY, event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();

      if (rect.width < 12 || rect.height < 12) {
        cleanup();
        reject(new Error("Snip was too small."));
        return;
      }

      try {
        layer.style.visibility = "hidden";
        await nextAnimationFrame();
        const screenshot = await chrome.runtime.sendMessage({ type: "capture-visible-tab" });
        if (!screenshot?.ok || !screenshot.payload?.dataUrl) {
          throw new Error(screenshot?.error || "Screenshot capture failed.");
        }

        const croppedDataUrl = await cropScreenshot(screenshot.payload.dataUrl, rect);
        const snipPayload = {
          ...pageContext,
          selected_text: "",
          guessed_latex: "",
          page_snapshot_data_url: croppedDataUrl,
          snip_created_at: new Date().toISOString(),
          snip_rect: rect
        };

        await chrome.storage.local.set({
          pendingEquationSnip: snipPayload
        });

        cleanup();
        resolve({ captured: true });
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    layer.addEventListener("pointerdown", onPointerDown, true);
    layer.addEventListener("pointermove", onPointerMove, true);
    layer.addEventListener("pointerup", onPointerUp, true);
  });
}

function extractSelectionNeighborhood(selection) {
  if (!selection || selection.rangeCount === 0) {
    return extractPageLeadText();
  }

  const range = selection.getRangeAt(0);
  const container = findContextContainer(range.commonAncestorContainer);
  const text = normalizeWhitespace(container?.innerText || container?.textContent || "");

  if (text) {
    return clampAroundNeedle(text, selection.toString(), 6000);
  }

  return extractPageLeadText();
}

function buildPageContext(selection, selectedText) {
  const parts = [];
  pushContext(parts, "Page title", document.title || "");
  pushContext(parts, "Page URL", window.location.href);
  pushContext(parts, "Meta description", document.querySelector('meta[name="description"]')?.content || "");
  pushContext(parts, "Headings", collectHeadings().join(" | "));

  if (selectedText) {
    pushContext(parts, "Selected equation/text", selectedText);
    pushContext(parts, "Nearby text", extractSelectionNeighborhood(selection));
  }

  pushContext(parts, "Visible page text", extractVisibleText());
  pushContext(parts, "Page lead text", extractPageLeadText());
  return clampContext(parts.join("\n\n"), 12000);
}

function pushContext(parts, label, value) {
  const text = normalizeWhitespace(value);
  if (text) {
    parts.push(`${label}: ${text}`);
  }
}

function collectHeadings() {
  return Array.from(document.querySelectorAll("h1, h2, h3"))
    .map((node) => normalizeWhitespace(node.innerText || node.textContent || ""))
    .filter(Boolean)
    .slice(0, 20);
}

function extractVisibleText() {
  const viewportBottom = window.innerHeight;
  const candidates = Array.from(document.querySelectorAll("p, li, figcaption, article, section, main, h1, h2, h3, [role='main']"));
  const chunks = [];
  for (const node of candidates) {
    const rect = node.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > viewportBottom || rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    const text = normalizeWhitespace(node.innerText || node.textContent || "");
    if (text && !chunks.includes(text)) {
      chunks.push(text);
    }
    if (chunks.join(" ").length > 7000) {
      break;
    }
  }

  return chunks.join(" ");
}

function inferNearbyLatex(selection) {
  if (!selection || selection.rangeCount === 0) {
    return "";
  }

  const container = findContextContainer(selection.getRangeAt(0).commonAncestorContainer);
  const selectedNode = selection.getRangeAt(0).commonAncestorContainer;
  const selectedElement = selectedNode.nodeType === Node.ELEMENT_NODE ? selectedNode : selectedNode.parentElement;
  const localMath = findClosestMathElement(selectedElement);
  const candidates = [
    ...extractLatexCandidates(localMath),
    ...extractLatexCandidates(container),
    ...extractLatexCandidates(document.body)
  ];
  for (const candidate of candidates) {
    const text = normalizeWhitespace(candidate);
    if (text) {
      return text;
    }
  }

  return "";
}

function findClosestMathElement(element) {
  let current = element;
  while (current && current !== document.body) {
    if (
      current.matches?.("math, .mwe-math-element, .mwe-math-fallback-image-inline, .katex, .MathJax, mjx-container, [role='math']")
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function extractLatexCandidates(root) {
  if (!root?.querySelectorAll) {
    return [];
  }

  const candidates = [];
  const selector = [
    "annotation[encoding='application/x-tex']",
    "annotation[encoding='application/tex']",
    "script[type='math/tex']",
    "script[type='math/tex; mode=display']",
    ".katex-mathml annotation",
    "math annotation",
    "img[alt]",
    "[data-mw]",
    "[data-latex]",
    "[aria-label]"
  ].join(",");

  for (const node of root.querySelectorAll(selector)) {
    if (node.matches("img[alt]")) {
      candidates.push(node.getAttribute("alt") || "");
      continue;
    }
    if (node.hasAttribute("data-latex")) {
      candidates.push(node.getAttribute("data-latex") || "");
      continue;
    }
    if (node.hasAttribute("aria-label") && looksMathLike(node.getAttribute("aria-label") || "")) {
      candidates.push(node.getAttribute("aria-label") || "");
      continue;
    }
    if (node.hasAttribute("data-mw")) {
      candidates.push(extractLatexFromDataMw(node.getAttribute("data-mw") || ""));
      continue;
    }
    candidates.push(node.textContent || "");
  }

  return candidates.filter(looksMathLike);
}

function extractLatexFromDataMw(value) {
  try {
    const payload = JSON.parse(value);
    return payload?.body?.extsrc || payload?.parts?.[0]?.template?.target?.wt || "";
  } catch (_error) {
    return "";
  }
}

function looksMathLike(value) {
  const text = normalizeWhitespace(value);
  return Boolean(text && /\\|[_^{}=+\-*/]|sum|prod|int|frac|theta|pi|nabla|mathbb|mathrm/i.test(text));
}

function findContextContainer(node) {
  let current = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (current && current !== document.body) {
    const text = normalizeWhitespace(current.innerText || current.textContent || "");
    if (text.length >= 300 || ["ARTICLE", "SECTION", "MAIN", "P"].includes(current.tagName)) {
      return current;
    }
    current = current.parentElement;
  }

  return document.body;
}

function extractPageLeadText() {
  return normalizeWhitespace(document.body?.innerText || "").slice(0, 12000);
}

function clampAroundNeedle(text, needle, maxLength) {
  const normalizedNeedle = normalizeWhitespace(needle);
  if (!normalizedNeedle || text.length <= maxLength) {
    return text.slice(0, maxLength);
  }

  const index = text.indexOf(normalizedNeedle);
  if (index < 0) {
    return text.slice(0, maxLength);
  }

  const start = Math.max(0, index - Math.floor((maxLength - normalizedNeedle.length) / 2));
  return text.slice(start, start + maxLength);
}

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clampContext(text, maxLength) {
  const normalized = String(text || "").trim();
  return normalized.length <= maxLength ? normalized : normalized.slice(0, maxLength);
}

function updateSnipBox(box, startX, startY, endX, endY) {
  const rect = normalizeRect(startX, startY, endX, endY);
  box.style.left = `${rect.left}px`;
  box.style.top = `${rect.top}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

function normalizeRect(startX, startY, endX, endY) {
  const left = Math.max(0, Math.min(startX, endX));
  const top = Math.max(0, Math.min(startY, endY));
  const right = Math.min(window.innerWidth, Math.max(startX, endX));
  const bottom = Math.min(window.innerHeight, Math.max(startY, endY));
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function cropScreenshot(dataUrl, rect) {
  const image = await loadImage(dataUrl);
  const scaleX = image.naturalWidth / window.innerWidth;
  const scaleY = image.naturalHeight / window.innerHeight;
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
    image.onerror = () => reject(new Error("Could not load screenshot for cropping."));
    image.src = dataUrl;
  });
}
