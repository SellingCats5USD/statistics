chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "fetch-equation-card") {
    return false;
  }

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
});

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
