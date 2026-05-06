const form = document.getElementById("options-form");
const apiKeyInput = document.getElementById("api-key");
const modelInput = document.getElementById("model");
const latexConverterModelInput = document.getElementById("latex-converter-model");
const audienceInput = document.getElementById("audience");
const difficultyInput = document.getElementById("difficulty");
const latexCopyStyleInput = document.getElementById("latex-copy-style");
const highlightOpacityInput = document.getElementById("highlight-opacity");
const highlightOpacityValue = document.getElementById("highlight-opacity-value");
const popupWidthInput = document.getElementById("popup-width");
const popupWidthValue = document.getElementById("popup-width-value");
const mathRendererHighlightsInput = document.getElementById("math-renderer-highlights");
const testButton = document.getElementById("test-button");
const clearKeyButton = document.getElementById("clear-key-button");
const statusElement = document.getElementById("status");

document.addEventListener("DOMContentLoaded", loadOptions);
form.addEventListener("submit", saveOptions);
testButton.addEventListener("click", testOpenAI);
clearKeyButton.addEventListener("click", clearApiKey);
highlightOpacityInput.addEventListener("input", updateHighlightOpacityLabel);
popupWidthInput.addEventListener("input", updatePopupWidthLabel);

async function loadOptions() {
  const response = await chrome.runtime.sendMessage({ type: "get-config" });
  if (!response?.ok) {
    setStatus(response?.error || "Could not load options.", "error");
    return;
  }

  apiKeyInput.value = "";
  apiKeyInput.placeholder = response.payload.hasApiKey ? "Saved API key is set" : "sk-...";
  modelInput.value = response.payload.model || "gpt-5.4-mini";
  latexConverterModelInput.value = response.payload.latexConverterModel || "gpt-5.4-mini";
  audienceInput.value = response.payload.audience || "undergraduate";
  difficultyInput.value = response.payload.difficulty || "standard";
  latexCopyStyleInput.value = response.payload.latexCopyStyle || "raw";
  highlightOpacityInput.value = response.payload.highlightOpacity ?? 12;
  popupWidthInput.value = response.payload.popupWidth ?? 820;
  mathRendererHighlightsInput.checked = Boolean(response.payload.mathRendererHighlights);
  cachePopupWidth(popupWidthInput.value);
  updateHighlightOpacityLabel();
  updatePopupWidthLabel();
}

async function saveOptions(event) {
  event.preventDefault();

  const payload = readForm();
  const response = await chrome.runtime.sendMessage({
    type: "save-config",
    payload
  });

  if (!response?.ok) {
    setStatus(response?.error || "Could not save options.", "error");
    return;
  }

  apiKeyInput.value = "";
  apiKeyInput.placeholder = response.payload.hasApiKey ? "Saved API key is set" : "sk-...";
  cachePopupWidth(response.payload.popupWidth);
  setStatus("Saved.", "success");
}

async function testOpenAI() {
  const saveResponse = await chrome.runtime.sendMessage({
    type: "save-config",
    payload: readForm()
  });
  if (saveResponse?.ok) {
    cachePopupWidth(saveResponse.payload.popupWidth);
  }

  const response = await chrome.runtime.sendMessage({ type: "test-openai" });
  if (!response?.ok) {
    setStatus(response?.error || "OpenAI test failed.", "error");
    return;
  }

  setStatus(`OpenAI works. Explanation model: ${response.payload.model}. LaTeX converter model: ${response.payload.latexConverterModel}.`, "success");
}

function readForm() {
  return {
    apiKey: apiKeyInput.value,
    model: modelInput.value,
    latexConverterModel: latexConverterModelInput.value,
    audience: audienceInput.value,
    difficulty: difficultyInput.value,
    latexCopyStyle: latexCopyStyleInput.value,
    highlightOpacity: Number(highlightOpacityInput.value),
    popupWidth: Number(popupWidthInput.value),
    mathRendererHighlights: mathRendererHighlightsInput.checked
  };
}

async function clearApiKey() {
  const response = await chrome.runtime.sendMessage({
    type: "save-config",
    payload: {
      ...readForm(),
      apiKey: "",
      clearApiKey: true
    }
  });

  if (!response?.ok) {
    setStatus(response?.error || "Could not clear key.", "error");
    return;
  }

  apiKeyInput.value = "";
  apiKeyInput.placeholder = "sk-...";
  cachePopupWidth(response.payload.popupWidth);
  setStatus("API key cleared.", "success");
}

function setStatus(message, tone) {
  statusElement.textContent = message;
  statusElement.className = `status is-${tone}`;
}

function updateHighlightOpacityLabel() {
  highlightOpacityValue.textContent = `${highlightOpacityInput.value}%`;
}

function updatePopupWidthLabel() {
  popupWidthValue.textContent = `${popupWidthInput.value}px`;
}

function cachePopupWidth(value) {
  try {
    localStorage.setItem("equationExplainer.popupWidth", String(value || 820));
  } catch (_error) {
    // The stored extension config remains the source of truth.
  }
}
