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

  if (message.type === "probe-backend-health") {
    void probeBackendHealth(message)
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
    backendAccessKey: String(message.backendAccessKey || ""),
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
    backendAccessKey: job.backendAccessKey,
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
    quality: 94
  });

  const session = {
    snapshotDataUrl,
    backendBaseUrl: normalizeBackendBaseUrl(message.backendBaseUrl),
    backendAccessKey: String(message.backendAccessKey || ""),
    includePageContext: message.includePageContext !== false,
    pageTitle: message.pageTitle || "",
    pageUrl: message.pageUrl || "",
    tabId: Number(message.tabId) || null,
    windowId,
    createdAt: Date.now()
  };

  await chrome.storage.local.set({
    [SNIP_SESSION_STATE_KEY]: session
  });

  return session;
}

async function completeSnipSession(message) {
  const stored = await chrome.storage.local.get({
    [SNIP_SESSION_STATE_KEY]: null
  });
  const session = stored[SNIP_SESSION_STATE_KEY];
  if (!session || !session.snapshotDataUrl) {
    throw new Error("No pending snip session was found.");
  }

  const imageBundle = await buildSnipImageBundle(session.snapshotDataUrl, message.rect);
  const selectionContext = await tryCollectSnipContext(session, message.rect);
  const payload = buildSnipExplainPayload({
    session,
    pageSnapshotDataUrl: imageBundle.primaryDataUrl,
    pageSnapshotVariantDataUrls: imageBundle.variantDataUrls,
    selectionContext
  });
  const result = await fetchEquationCard({
    backendBaseUrl: session.backendBaseUrl,
    backendAccessKey: session.backendAccessKey,
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
    card: result.card,
    backendBaseUrl: result.backendBaseUrl
  };
}

async function fetchEquationCard(message) {
  const backendBaseUrl = normalizeBackendBaseUrl(message.backendBaseUrl);
  const backendAccessKey = String(message.backendAccessKey || "").trim();
  const candidates = buildBackendCandidates(backendBaseUrl);
  let lastErrorMessage = "Failed to fetch";

  for (const candidate of candidates) {
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (backendAccessKey) {
        headers["x-equation-story-key"] = backendAccessKey;
      }

      const response = await fetch(`${candidate}/api/explain`, {
        method: "POST",
        headers,
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

async function probeBackendHealth(message) {
  const backendBaseUrl = normalizeBackendBaseUrl(message.backendBaseUrl);
  const backendAccessKey = String(message.backendAccessKey || "").trim();
  const candidates = buildBackendCandidates(backendBaseUrl);
  let lastErrorMessage = "Failed to fetch";

  for (const candidate of candidates) {
    try {
      const headers = {};
      if (backendAccessKey) {
        headers["x-equation-story-key"] = backendAccessKey;
      }

      const response = await fetch(`${candidate}/health`, {
        method: "GET",
        headers
      });

      if (!response.ok) {
        const details = await readErrorPayload(response);
        throw new Error(details || `Health request failed with status ${response.status}.`);
      }

      return {
        backendBaseUrl: candidate,
        health: await response.json()
      };
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "Failed to fetch";
    }
  }

  throw new Error(
    `Could not reach ${backendBaseUrl}. Original error: ${lastErrorMessage}`
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
  const selectionContext = options.selectionContext || null;
  const surroundingParts = [
    "The equation was selected by drawing a snipping box over the page."
  ];

  if (selectionContext && selectionContext.surroundingText) {
    surroundingParts.push(selectionContext.surroundingText);
  }

  if (session.includePageContext) {
    const pageContext = buildSnipPageContext(session, selectionContext);
    if (pageContext) {
      surroundingParts.push(`[Page context]\n${pageContext}`);
    }
  }

  const hintLines = [
    "math_source=snip-region",
    "selection_kind=snip-region"
  ];
  if (selectionContext && selectionContext.mathSource) {
    hintLines.push(`resolved_math_source=${selectionContext.mathSource}`);
  }
  if (selectionContext && selectionContext.selectedText) {
    hintLines.push("resolved_from_dom=true");
  }

  surroundingParts.push(`[Equation Story hints]\n${hintLines.join("\n")}`);

  return {
    selected_text: selectionContext && selectionContext.selectedText ? selectionContext.selectedText : "",
    guessed_latex: selectionContext && selectionContext.guessedLatex
      ? selectionContext.guessedLatex
      : selectionContext && selectionContext.selectedText
        ? selectionContext.selectedText
        : "",
    surrounding_text: surroundingParts.join("\n\n"),
    page_title: selectionContext && selectionContext.pageTitle ? selectionContext.pageTitle : session.pageTitle || "",
    page_url: selectionContext && selectionContext.pageUrl ? selectionContext.pageUrl : session.pageUrl || "",
    page_snapshot_data_url: options.pageSnapshotDataUrl,
    page_snapshot_variant_data_urls: options.pageSnapshotVariantDataUrls || [],
    audience: "undergraduate",
    difficulty: "standard",
    domain_hint: inferDomainHint({
      selectedText: selectionContext && selectionContext.selectedText ? selectionContext.selectedText : "",
      surroundingText: surroundingParts.join(" "),
      pageTitle: selectionContext && selectionContext.pageTitle ? selectionContext.pageTitle : session.pageTitle || ""
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

  const imageBundle = await buildSnipImageBundle(dataUrl, rect, {
    includeVariants: false
  });
  return imageBundle.primaryDataUrl;
}

async function buildSnipImageBundle(dataUrl, rect, options = {}) {
  const blob = dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);
  const primaryDataUrl = await renderCropVariant(bitmap, rect, {
    paddingScale: 1,
    upscaleMinWidth: 1200,
    maxOutputWidth: 1800,
    maxOutputHeight: 1400,
    format: "image/png"
  });

  if (options.includeVariants === false) {
    return {
      primaryDataUrl,
      variantDataUrls: []
    };
  }

  const zoomedDataUrl = await renderCropVariant(bitmap, rect, {
    paddingScale: 1,
    upscaleMinWidth: 1600,
    maxOutputWidth: 2200,
    maxOutputHeight: 1600,
    format: "image/png",
    applyLegibilityFilter: true
  });

  const contextDataUrl = await renderCropVariant(bitmap, rect, {
    paddingScale: 1.65,
    upscaleMinWidth: 1100,
    maxOutputWidth: 1800,
    maxOutputHeight: 1400,
    format: "image/png"
  });

  return {
    primaryDataUrl,
    variantDataUrls: Array.from(new Set([zoomedDataUrl, contextDataUrl].filter(Boolean))).filter((value) => value !== primaryDataUrl)
  };
}

async function renderCropVariant(bitmap, rect, options) {
  const sourceRect = computeSourceCropRect(bitmap, rect, options.paddingScale || 1);
  const targetSize = computeTargetImageSize(sourceRect.width, sourceRect.height, {
    upscaleMinWidth: options.upscaleMinWidth || 0,
    maxOutputWidth: options.maxOutputWidth || sourceRect.width,
    maxOutputHeight: options.maxOutputHeight || sourceRect.height
  });

  const canvas = new OffscreenCanvas(targetSize.width, targetSize.height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not create an image cropping context.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, targetSize.width, targetSize.height);

  if ("filter" in context && options.applyLegibilityFilter) {
    context.filter = "grayscale(1) contrast(1.35) brightness(1.04)";
  }
  if ("imageSmoothingEnabled" in context) {
    context.imageSmoothingEnabled = true;
  }
  if ("imageSmoothingQuality" in context) {
    context.imageSmoothingQuality = "high";
  }

  context.drawImage(
    bitmap,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    0,
    0,
    targetSize.width,
    targetSize.height
  );

  if ("filter" in context) {
    context.filter = "none";
  }

  const croppedBlob = await canvas.convertToBlob({
    type: options.format || "image/png"
  });

  return await blobToDataUrl(croppedBlob);
}

function computeSourceCropRect(bitmap, rect, paddingScale) {
  const viewportWidth = Math.max(1, Number(rect.viewportWidth) || bitmap.width);
  const viewportHeight = Math.max(1, Number(rect.viewportHeight) || bitmap.height);
  const scaleX = bitmap.width / viewportWidth;
  const scaleY = bitmap.height / viewportHeight;

  const rawX = Number(rect.left) * scaleX;
  const rawY = Number(rect.top) * scaleY;
  const rawWidth = Math.max(8, Number(rect.width) * scaleX);
  const rawHeight = Math.max(8, Number(rect.height) * scaleY);

  const centerX = rawX + rawWidth / 2;
  const centerY = rawY + rawHeight / 2;
  const paddedWidth = rawWidth * Math.max(1, paddingScale || 1);
  const paddedHeight = rawHeight * Math.max(1, paddingScale || 1);

  const x = clamp(Math.floor(centerX - paddedWidth / 2), 0, bitmap.width - 8);
  const y = clamp(Math.floor(centerY - paddedHeight / 2), 0, bitmap.height - 8);
  const width = Math.min(Math.max(8, Math.floor(paddedWidth)), bitmap.width - x);
  const height = Math.min(Math.max(8, Math.floor(paddedHeight)), bitmap.height - y);

  if (width < 8 || height < 8) {
    throw new Error("The snip selection was too small to crop reliably.");
  }

  return { x, y, width, height };
}

function computeTargetImageSize(width, height, options) {
  let scale = 1;
  if (width < options.upscaleMinWidth) {
    scale = Math.max(scale, options.upscaleMinWidth / width);
  }

  scale = Math.min(
    scale,
    options.maxOutputWidth / width,
    options.maxOutputHeight / height
  );

  scale = Math.max(1, scale);

  return {
    width: Math.max(8, Math.round(width * scale)),
    height: Math.max(8, Math.round(height * scale))
  };
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ""));
  if (!match) {
    throw new Error("The captured snip image was not a valid data URL.");
  }

  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], {
    type: mimeType
  });
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
  const candidates = [];
  const seen = new Set();

  function addCandidate(value) {
    if (!value) {
      return;
    }

    let normalized;
    try {
      normalized = normalizeBackendBaseUrl(value);
    } catch (_error) {
      return;
    }

    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    candidates.push(normalized);
  }

  addCandidate(backendBaseUrl);

  let parsed;

  try {
    parsed = new URL(backendBaseUrl);
  } catch (_error) {
    return candidates;
  }

  if (parsed.hostname === "localhost") {
    parsed.hostname = "127.0.0.1";
    addCandidate(parsed.toString().replace(/\/$/, ""));
  } else if (parsed.hostname === "127.0.0.1") {
    parsed.hostname = "localhost";
    addCandidate(parsed.toString().replace(/\/$/, ""));
  } else {
    addCandidate("http://127.0.0.1:8787");
    addCandidate("http://localhost:8787");
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

async function tryCollectSnipContext(session, rect) {
  const tabId = Number(session && session.tabId);
  if (!Number.isFinite(tabId)) {
    return null;
  }

  try {
    const request = {
      type: "collect-equation-context-in-rect",
      rect: normalizeRectForContentScript(rect)
    };

    let response;
    try {
      response = await chrome.tabs.sendMessage(tabId, request);
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      if (!errorText.includes("Receiving end does not exist") || !isInjectableUrl(session && session.pageUrl)) {
        throw error;
      }

      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content_overlay.css"]
      }).catch(() => {});

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content_script.js"]
      });

      response = await chrome.tabs.sendMessage(tabId, request);
    }

    if (response && response.ok === true && response.payload) {
      return response.payload;
    }
  } catch (_error) {
    // PDF viewers and non-scriptable pages will land here.
  }

  return null;
}

function normalizeRectForContentScript(rect) {
  const viewportWidth = Math.max(1, Number(rect && rect.viewportWidth) || 1);
  const viewportHeight = Math.max(1, Number(rect && rect.viewportHeight) || 1);

  return {
    leftRatio: clamp(Number(rect && rect.left) / viewportWidth, 0, 1),
    topRatio: clamp(Number(rect && rect.top) / viewportHeight, 0, 1),
    widthRatio: clamp(Number(rect && rect.width) / viewportWidth, 0, 1),
    heightRatio: clamp(Number(rect && rect.height) / viewportHeight, 0, 1)
  };
}

function isInjectableUrl(url) {
  return typeof url === "string" && /^https?:/i.test(url);
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

function buildSnipPageContext(session, selectionContext) {
  const parts = [];
  const pageTitle = selectionContext && selectionContext.pageTitle ? selectionContext.pageTitle : session.pageTitle;
  const pageUrl = selectionContext && selectionContext.pageUrl ? selectionContext.pageUrl : session.pageUrl;
  const extraPageContext = selectionContext && selectionContext.pageContext ? selectionContext.pageContext : "";

  if (pageTitle) {
    parts.push(`Page title: ${pageTitle}`);
  }
  if (pageUrl) {
    parts.push(`Page URL: ${pageUrl}`);
  }
  if (extraPageContext) {
    parts.push(extraPageContext);
  }
  return parts.join("\n");
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
