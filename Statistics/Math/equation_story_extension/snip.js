const SNIP_SESSION_STATE_KEY = "pendingSnipSession";

const elements = {};
let currentSelection = null;

document.addEventListener("DOMContentLoaded", async () => {
  cacheElements();
  bindEvents();
  await loadSnipSession();
});

function cacheElements() {
  elements.confirmButton = document.getElementById("confirm-btn");
  elements.resetButton = document.getElementById("reset-btn");
  elements.statusBar = document.getElementById("status-bar");
  elements.stage = document.getElementById("snip-stage");
  elements.image = document.getElementById("snip-image");
  elements.selectionBox = document.getElementById("selection-box");
}

function bindEvents() {
  elements.resetButton.addEventListener("click", () => {
    currentSelection = null;
    renderSelection();
    setStatus("Draw a new box around the equation.", "");
  });

  elements.confirmButton.addEventListener("click", async () => {
    await submitSelection();
  });
}

async function loadSnipSession() {
  const stored = await chrome.storage.local.get({
    [SNIP_SESSION_STATE_KEY]: null
  });
  const session = stored[SNIP_SESSION_STATE_KEY];
  if (!session || !session.snapshotDataUrl) {
    setStatus("No pending snip session was found. Start again from the popup.", "error");
    return;
  }

  elements.image.src = session.snapshotDataUrl;
  elements.image.addEventListener("load", () => {
    installSelectionHandlers();
    setStatus("Drag a box around the target equation, then click Explain Snip.", "");
  }, { once: true });
}

function installSelectionHandlers() {
  let dragging = false;
  let startX = 0;
  let startY = 0;

  elements.stage.addEventListener("pointerdown", (event) => {
    const rect = elements.image.getBoundingClientRect();
    if (!pointInsideRect(event.clientX, event.clientY, rect)) {
      return;
    }

    dragging = true;
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;
    currentSelection = {
      left: startX,
      top: startY,
      width: 0,
      height: 0
    };
    renderSelection();
    event.preventDefault();
  });

  elements.stage.addEventListener("pointermove", (event) => {
    if (!dragging) {
      return;
    }

    const rect = elements.image.getBoundingClientRect();
    const currentX = clamp(event.clientX - rect.left, 0, rect.width);
    const currentY = clamp(event.clientY - rect.top, 0, rect.height);

    currentSelection = {
      left: Math.min(startX, currentX),
      top: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY)
    };
    renderSelection();
  });

  elements.stage.addEventListener("pointerup", () => {
    if (!dragging) {
      return;
    }

    dragging = false;
    if (!currentSelection || currentSelection.width < 8 || currentSelection.height < 8) {
      currentSelection = null;
    }
    renderSelection();
  });
}

async function submitSelection() {
  if (!currentSelection || currentSelection.width < 8 || currentSelection.height < 8) {
    setStatus("Draw a larger box around one equation first.", "error");
    return;
  }

  try {
    elements.confirmButton.disabled = true;
    setStatus("Sending the selected equation region to the backend...", "");

    const response = await chrome.runtime.sendMessage({
      type: "complete-snip-session",
      rect: {
        ...currentSelection,
        viewportWidth: elements.image.clientWidth,
        viewportHeight: elements.image.clientHeight
      }
    });

    if (!response || response.ok !== true) {
      throw new Error(response && response.error ? response.error : "Snip explanation failed.");
    }

    setStatus("Equation saved. You can close this tab and open the popup anywhere to reuse the result.", "success");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), "error");
  } finally {
    elements.confirmButton.disabled = false;
  }
}

function renderSelection() {
  if (!currentSelection || currentSelection.width < 8 || currentSelection.height < 8) {
    elements.selectionBox.hidden = true;
    elements.confirmButton.disabled = true;
    return;
  }

  elements.selectionBox.hidden = false;
  elements.selectionBox.style.left = `${currentSelection.left}px`;
  elements.selectionBox.style.top = `${currentSelection.top}px`;
  elements.selectionBox.style.width = `${currentSelection.width}px`;
  elements.selectionBox.style.height = `${currentSelection.height}px`;
  elements.confirmButton.disabled = false;
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

function pointInsideRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
