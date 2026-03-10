const ROOT_ID = "equation-story-extension-root";
const FRAME_SRC = chrome.runtime.getURL("sandbox_renderer.html");

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
  const selectionText = getSelectedText();
  if (!selectionText) {
    throw new Error("Select some equation text on the page first.");
  }

  const activeSelection = getActiveSelection();
  const surroundingText = activeSelection
    ? collectSurroundingTextFromSelection(activeSelection)
    : selectionText;

  return {
    selectedText: selectionText,
    surroundingText,
    pageTitle: document.title || "",
    pageUrl: window.location.href
  };
}

function getSelectedText() {
  const activeElement = document.activeElement;
  if (isTextInput(activeElement)) {
    const selected = readSelectedTextFromInput(activeElement);
    if (selected) {
      return selected;
    }
  }

  const selection = window.getSelection();
  return selection ? cleanText(selection.toString()) : "";
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
