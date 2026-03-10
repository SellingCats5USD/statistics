const SAVED_TAB_STATE_KEY = "savedEquationCardsByPage";
const LATEST_CARD_STATE_KEY = "latestEquationCardState";
const REGION_JOB_STATE_KEY = "pendingRegionExplainJobs";
const SNIP_SESSION_STATE_KEY = "pendingSnipSession";
const MAX_SAVED_TAB_STATES = 24;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) {
    return false;
  }

  if (message.type === "fetch-equation-card") {
    void fetchEquationCard(message)
      .then((payload) => {
        sendResponse({
          ok: true,
          payload
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "begin-region-explain") {
    void beginRegionExplain(message)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "start-snip-session") {
    void startSnipSession(message)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "complete-snip-session") {
    void completeSnipSession(message)
      .then((payload) => {
        sendResponse({
          ok: true,
          payload
        });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  if (message.type === "complete-region-selection") {
    void completeRegionExplain(message, sender)
      .then(() => {
        sendResponse({ ok: true });
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });

    return true;
  }

  return false;
});

async function beginRegionExplain(message) {
  const tabId = Number(message.tabId);
  if (!Number.isFinite(tabId)) {
    throw new Error("A valid tabId is required to start region capture.");
  }

  const stored = await chrome.storage.local.get({
    [REGION_JOB_STATE_KEY]: {}
  });
  const pendingJobs = stored[REGION_JOB_STATE_KEY] || {};
  pendingJobs[String(tabId)] = {
    backendBaseUrl: normalizeBackendBaseUrl(message.backendBaseUrl),
    includePageContext: message.includePageContext !== false,
    requestedAt: Date.now()
  };

  await chrome.storage.local.set({
    [REGION_JOB_STATE_KEY]: pendingJobs
  });
}

async function completeRegionExplain(message, sender) {
  const tab = sender && sender.tab;
  if (!tab || typeof tab.id !== "number") {
    throw new Error("Region selection did not include a valid sender tab.");
  }

  const stored = await chrome.storage.local.get({
    [REGION_JOB_STATE_KEY]: {}
  });
  const pendingJobs = stored[REGION_JOB_STATE_KEY] || {};
  const jobKey = String(tab.id);
  const job = pendingJobs[jobKey];
  if (!job) {
    throw new Error("No pending region explain job was found for this tab.");
  }

  delete pendingJobs[jobKey];
  await chrome.storage.local.set({
    [REGION_JOB_STATE_KEY]: pendingJobs
  });

  const snapshotDataUrl = await captureVisibleTabRegion(tab.windowId, message.rect);
  const payload = buildRegionExplainPayload({
    selection: message,
    tab,
    includePageContext: job.includePageContext,
    snapshotDataUrl
  });

  const result = await fetchEquationCard({
    backendBaseUrl: job.backendBaseUrl,
    payload
  });

  await saveCardStateForTab(tab, result.card);
  try {
    await chrome.runtime.sendMessage({
      type: "equation-card-updated",
      card: result.card
    });
  } catch (_error) {
    // No popup may be listening, which is fine.
  }
}

async function startSnipSession(message) {
  const windowId = Number(message.windowId);
  if (!Number.isFinite(windowId)) {
    throw new Error("A valid windowId is required to start snip mode.");
  }

  const snapshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: "jpeg",
    quality: 92
  });

  await chrome.storage.local.set({
    [SNIP_SESSION_STATE_KEY]: {
      snapshotDataUrl,
      backendBaseUrl: normalizeBackendBaseUrl(message.backendBaseUrl),
      includePageContext: message.includePageContext !== false,
      pageTitle: message.pageTitle || "",
      pageUrl: message.pageUrl || "",
      tabId: Number(message.tabId) || null,
      windowId,
      createdAt: Date.now()
    }
  });
}

async function completeSnipSession(message) {
  const stored = await chrome.storage.local.get({
    [SNIP_SESSION_STATE_KEY]: null
  });
  const session = stored[SNIP_SESSION_STATE_KEY];
  if (!session || !session.snapshotDataUrl) {
    throw new Error("No pending snip session was found.");
  }

  const croppedDataUrl = await cropExistingDataUrl(session.snapshotDataUrl, message.rect);
  const payload = buildSnipExplainPayload({
    session,
    croppedDataUrl
  });
  const result = await fetchEquationCard({
    backendBaseUrl: session.backendBaseUrl,
    payload
  });

  await saveCardStateForTab({
    id: session.tabId,
    title: session.pageTitle,
    url: session.pageUrl
  }, result.card);
  await chrome.storage.local.remove(SNIP_SESSION_STATE_KEY);

  try {
    await chrome.runtime.sendMessage({
      type: "equation-card-updated",
      card: result.card
    });
  } catch (_error) {
    // No popup may be listening, which is fine.
  }

  return {
    card: result.card
  };
}

async function fetchEquationCard(message) {
  const backendBaseUrl = normalizeBackendBaseUrl(message.backendBaseUrl);
  const candidates = buildBackendCandidates(backendBaseUrl);
  let lastErrorMessage = "Failed to fetch";

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${candidate}/api/explain`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(message.payload)
      });

      if (!response.ok) {
        const details = await readErrorPayload(response);
        throw new Error(details || `Backend request failed with status ${response.status}.`);
      }

      return {
        card: await response.json(),
        backendBaseUrl: candidate
      };
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "Failed to fetch";
    }
  }

  throw new Error(
    `Could not reach ${backendBaseUrl}. Check that the backend is running, then try 127.0.0.1 instead of localhost if needed. Original error: ${lastErrorMessage}`
  );
}

function buildRegionExplainPayload(options) {
  const selection = options.selection || {};
  const selectedText = String(selection.selectedText || "").trim();
  const guessedLatex = String(selection.guessedLatex || selectedText).trim();
  const surroundingParts = [];

  if (selection.surroundingText) {
    surroundingParts.push(String(selection.surroundingText).trim());
  }
  if (options.includePageContext && selection.pageContext) {
    surroundingParts.push(`[Page context]\n${String(selection.pageContext).trim()}`);
  }
  surroundingParts.push("[Equation Story hints]\nmath_source=region-snapshot\nselection_kind=region-snapshot");

  return {
    selected_text: selectedText,
    guessed_latex: guessedLatex,
    surrounding_text: surroundingParts.filter(Boolean).join("\n\n").trim(),
    page_title: selection.pageTitle || options.tab.title || "",
    page_url: selection.pageUrl || options.tab.url || "",
    page_snapshot_data_url: options.snapshotDataUrl || "",
    audience: "undergraduate",
    difficulty: "standard",
    domain_hint: inferDomainHint({
      selectedText,
      surroundingText: surroundingParts.join(" "),
      pageTitle: selection.pageTitle || options.tab.title || ""
    })
  };
}

function buildSnipExplainPayload(options) {
  const session = options.session || {};
  const surroundingParts = [
    "The equation was selected by drawing a snipping box over the page."
  ];

  if (session.includePageContext) {
    const pageContext = buildSnipPageContext(session);
    if (pageContext) {
      surroundingParts.push(`[Page context]\n${pageContext}`);
    }
  }

  surroundingParts.push("[Equation Story hints]\nmath_source=snip-region\nselection_kind=snip-region");

  return {
    selected_text: "",
    guessed_latex: "",
    surrounding_text: surroundingParts.join("\n\n"),
    page_title: session.pageTitle || "",
    page_url: session.pageUrl || "",
    page_snapshot_data_url: options.croppedDataUrl,
    audience: "undergraduate",
    difficulty: "standard",
    domain_hint: inferDomainHint({
      selectedText: "",
      surroundingText: surroundingParts.join(" "),
      pageTitle: session.pageTitle || ""
    })
  };
}

async function captureVisibleTabRegion(windowId, rect) {
  const visibleDataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: "jpeg",
    quality: 92
  });

  if (!visibleDataUrl) {
    throw new Error("Failed to capture the visible tab.");
  }

  if (!rect || rect.width < 8 || rect.height < 8) {
    return visibleDataUrl;
  }

  return cropExistingDataUrl(visibleDataUrl, rect);
}

async function cropExistingDataUrl(dataUrl, rect) {
  if (!rect || rect.width < 8 || rect.height < 8) {
    return dataUrl;
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const viewportWidth = Math.max(1, Number(rect.viewportWidth) || bitmap.width);
  const viewportHeight = Math.max(1, Number(rect.viewportHeight) || bitmap.height);
  const scaleX = bitmap.width / viewportWidth;
  const scaleY = bitmap.height / viewportHeight;

  const sourceX = Math.max(0, Math.floor(Number(rect.left) * scaleX));
  const sourceY = Math.max(0, Math.floor(Number(rect.top) * scaleY));
  const sourceWidth = Math.max(8, Math.floor(Number(rect.width) * scaleX));
  const sourceHeight = Math.max(8, Math.floor(Number(rect.height) * scaleY));

  const safeWidth = Math.min(sourceWidth, bitmap.width - sourceX);
  const safeHeight = Math.min(sourceHeight, bitmap.height - sourceY);

  const canvas = new OffscreenCanvas(safeWidth, safeHeight);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create an image cropping context.");
  }

  context.drawImage(
    bitmap,
    sourceX,
    sourceY,
    safeWidth,
    safeHeight,
    0,
    0,
    safeWidth,
    safeHeight
  );

  const croppedBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: 0.96
  });

  return await blobToDataUrl(croppedBlob);
}

async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return `data:${blob.type || "image/jpeg"};base64,${btoa(binary)}`;
}

async function saveCardStateForTab(tab, card) {
  const stored = await chrome.storage.local.get({
    [SAVED_TAB_STATE_KEY]: {}
  });
  const savedState = stored[SAVED_TAB_STATE_KEY] || {};
  const tabKey = getTabStateKey(tab);

  if (tabKey) {
    savedState[tabKey] = {
      card,
      updatedAt: Date.now(),
      pageTitle: tab.title || "",
      pageUrl: tab.url || ""
    };
  }

  await chrome.storage.local.set({
    [SAVED_TAB_STATE_KEY]: trimSavedTabStates(savedState),
    [LATEST_CARD_STATE_KEY]: {
      card,
      updatedAt: Date.now(),
      pageTitle: tab.title || "",
      pageUrl: tab.url || ""
    }
  });
}

function trimSavedTabStates(savedState) {
  const entries = Object.entries(savedState || {});
  if (entries.length <= MAX_SAVED_TAB_STATES) {
    return savedState;
  }

  entries.sort((left, right) => {
    const leftTime = Number(left[1] && left[1].updatedAt ? left[1].updatedAt : 0);
    const rightTime = Number(right[1] && right[1].updatedAt ? right[1].updatedAt : 0);
    return rightTime - leftTime;
  });

  return Object.fromEntries(entries.slice(0, MAX_SAVED_TAB_STATES));
}

async function readErrorPayload(response) {
  const text = await response.text();
  if (!text.trim()) {
    return "";
  }

  try {
    const payload = JSON.parse(text);
    if (payload && typeof payload === "object") {
      if (typeof payload.message === "string" && payload.message.trim()) {
        return payload.message.trim();
      }
      if (typeof payload.error === "string" && payload.error.trim()) {
        return payload.error.trim();
      }
    }
  } catch (_error) {
    return text.trim();
  }

  return text.trim();
}

function normalizeBackendBaseUrl(value) {
  const trimmed = String(value || "").trim() || "http://127.0.0.1:8787";
  const parsed = new URL(trimmed);
  return parsed.toString().replace(/\/$/, "");
}

function buildBackendCandidates(backendBaseUrl) {
  const candidates = [backendBaseUrl];
  let parsed;

  try {
    parsed = new URL(backendBaseUrl);
  } catch (_error) {
    return candidates;
  }

  if (parsed.hostname === "localhost") {
    parsed.hostname = "127.0.0.1";
    candidates.push(parsed.toString().replace(/\/$/, ""));
  } else if (parsed.hostname === "127.0.0.1") {
    parsed.hostname = "localhost";
    candidates.push(parsed.toString().replace(/\/$/, ""));
  }

  return candidates;
}

function inferDomainHint(context) {
  const combined = `${context.selectedText || ""} ${context.surroundingText || ""} ${context.pageTitle || ""}`.toLowerCase();
  if (combined.includes("fourier") || combined.includes("signal") || combined.includes("frequency")) {
    return "signals";
  }
  if (combined.includes("integral") || combined.includes("derivative")) {
    return "calculus";
  }
  if (combined.includes("activation") || combined.includes("dataset") || combined.includes("loss") || combined.includes("model")) {
    return "machine learning";
  }
  return "general";
}

function getTabStateKey(tab) {
  const url = normalizePageStateUrl(tab && tab.url ? tab.url : "");
  if (url) {
    return `page:${url}`;
  }

  return tab && typeof tab.id === "number" ? `tab:${tab.id}` : "";
}

function normalizePageStateUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return "";
  }

  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch (_error) {
    return url.trim();
  }
}

function buildSnipPageContext(session) {
  const parts = [];
  if (session.pageTitle) {
    parts.push(`Page title: ${session.pageTitle}`);
  }
  if (session.pageUrl) {
    parts.push(`Page URL: ${session.pageUrl}`);
  }
  return parts.join("\n");
}
