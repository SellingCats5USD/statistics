const ROOT_ID = "equation-story-extension-root";
const FRAME_SRC = chrome.runtime.getURL("sandbox_renderer.html");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "show-equation-story") {
    return false;
  }

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
