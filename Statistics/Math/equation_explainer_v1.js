const ROLE_STYLES = {
  definition: { label: "Definition" },
  quantity: { label: "Quantity" },
  dataset: { label: "Dataset / set" },
  index: { label: "Index / binder" },
  operator: { label: "Operator" },
  normalizer: { label: "Normalizer" },
  contrast: { label: "Contrast" },
  "positive-term": { label: "Positive term" },
  "negative-term": { label: "Negative term" },
  group: { label: "Grouping" }
};

const DOMAIN_PROFILES = {
  general: {
    key: "general",
    label: "General math",
    symbolGloss: {
      f: "a function",
      p: "a probability mass or density",
      E: "an expectation operator",
      X: "a quantity or random variable",
      x: "a scalar or value"
    },
    slotGloss: {
      subscript: {},
      superscript: {},
      argument: {}
    },
    datasetGloss: {}
  },
  ml: {
    key: "ml",
    label: "ML paper notation",
    symbolGloss: {
      v: "a derived feature, direction, or contrast vector",
      x: "an activation or representation value",
      D: "a dataset or prompt collection",
      p: "a prompt instance",
      i: "a position index",
      l: "a layer index"
    },
    slotGloss: {
      subscript: {
        i: "position i",
        j: "position j",
        k: "feature index k"
      },
      superscript: {
        l: "layer l",
        "(l)": "layer l"
      },
      argument: {
        p: "prompt p",
        "p'": "prompt p prime"
      }
    },
    datasetGloss: {
      harm: "harmful prompts",
      harmful: "harmful prompts",
      safe: "safe prompts",
      good: "harmless prompts",
      benign: "benign prompts"
    }
  },
  signals: {
    key: "signals",
    label: "Signals / Fourier",
    symbolGloss: {
      X: "a frequency-domain coefficient",
      x: "a time-domain sample",
      N: "the signal length or normalizing count",
      n: "the sample index",
      k: "the frequency index",
      e: "the complex exponential base"
    },
    slotGloss: {
      subscript: {
        n: "sample n",
        k: "frequency k"
      },
      superscript: {},
      argument: {}
    },
    datasetGloss: {}
  },
  calculus: {
    key: "calculus",
    label: "Calculus",
    symbolGloss: {
      f: "a function",
      F: "an antiderivative or accumulated quantity",
      x: "the input variable",
      dx: "the integration variable"
    },
    slotGloss: {
      subscript: {},
      superscript: {},
      argument: {
        x: "input x"
      }
    },
    datasetGloss: {}
  }
};

const PRESETS = [
  {
    id: "ml-contrast",
    label: "ML Contrast",
    domain: "ml",
    note: "Difference of harmful and safe averages.",
    latex: String.raw`v_i^{(l)} = \frac{1}{|D_{harm}|}\sum_{p' \in D_{harm}} x_i^{(l)}(p') - \frac{1}{|D_{safe}|}\sum_{p \in D_{safe}} x_i^{(l)}(p)`
  },
  {
    id: "dft",
    label: "DFT",
    domain: "signals",
    note: "A Fourier-style summation with a rotating phase term.",
    latex: String.raw`X_k = \frac{1}{N}\sum_{n=0}^{N-1} x_n e^{i 2\pi k n / N}`
  },
  {
    id: "expectation",
    label: "Expectation",
    domain: "general",
    note: "Expectation as a weighted sum over a set.",
    latex: String.raw`\mathbb{E}[X] = \sum_{x \in \mathcal{X}} x p(x)`
  },
  {
    id: "integral",
    label: "Integral",
    domain: "calculus",
    note: "A definite integral linked to endpoint evaluations.",
    latex: String.raw`\int_{0}^{1} f(x) dx = F(1) - F(0)`
  }
];

const RELATION_COMMANDS = new Set(["in", "approx", "leq", "geq", "neq", "to", "mapsto"]);
const ADDITIVE_COMMANDS = new Set(["pm"]);
const MULTIPLY_COMMANDS = new Set(["cdot", "times"]);
const KNOWN_FUNCTIONS = new Set(["sin", "cos", "tan", "log", "ln", "exp"]);

const state = {
  analysis: null,
  selectedNodeId: null,
  selectedPresetId: null,
  activeRoles: new Set(Object.keys(ROLE_STYLES)),
  renderEpoch: 0,
  autoRenderTimer: null
};

const elements = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  buildPresetButtons();
  buildLayerButtons();
  bindEvents();
  loadPreset(PRESETS[0].id);
});

function cacheElements() {
  elements.latexInput = document.getElementById("latex-input");
  elements.domainSelect = document.getElementById("domain-select");
  elements.renderButton = document.getElementById("render-btn");
  elements.resetSelectionButton = document.getElementById("reset-selection-btn");
  elements.statusBar = document.getElementById("status-bar");
  elements.presetGrid = document.getElementById("preset-grid");
  elements.layerToggles = document.getElementById("layer-toggles");
  elements.mathOutput = document.getElementById("math-output");
  elements.mathFallback = document.getElementById("math-fallback");
  elements.summaryCards = document.getElementById("summary-cards");
  elements.termCards = document.getElementById("term-cards");
  elements.selectionCard = document.getElementById("selection-card");
  elements.treeRoot = document.getElementById("tree-root");
  elements.semanticList = document.getElementById("semantic-list");
}

function bindEvents() {
  elements.renderButton.addEventListener("click", () => {
    state.selectedPresetId = null;
    syncPresetButtons();
    renderFromInput();
  });

  elements.domainSelect.addEventListener("change", () => {
    state.selectedPresetId = null;
    syncPresetButtons();
    renderFromInput();
  });

  elements.latexInput.addEventListener("input", () => {
    state.selectedPresetId = null;
    syncPresetButtons();
    window.clearTimeout(state.autoRenderTimer);
    state.autoRenderTimer = window.setTimeout(() => {
      renderFromInput();
    }, 350);
  });

  elements.latexInput.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      renderFromInput();
    }
  });

  elements.resetSelectionButton.addEventListener("click", () => {
    if (!state.analysis) {
      return;
    }
    state.selectedNodeId = state.analysis.root.id;
    renderSelectionDrivenViews();
  });

  elements.mathOutput.addEventListener("click", (event) => {
    const nodeId = findNodeIdFromTarget(event.target, elements.mathOutput);
    if (nodeId) {
      selectNode(nodeId);
    }
  });
}

function buildPresetButtons() {
  elements.presetGrid.replaceChildren();

  PRESETS.forEach((preset) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-button";
    button.dataset.presetId = preset.id;

    const label = document.createElement("strong");
    label.textContent = preset.label;

    const note = document.createElement("small");
    note.textContent = preset.note;

    button.append(label, note);
    button.addEventListener("click", () => loadPreset(preset.id));
    elements.presetGrid.appendChild(button);
  });
}

function syncPresetButtons() {
  Array.from(elements.presetGrid.querySelectorAll(".preset-button")).forEach((button) => {
    button.classList.toggle("is-active", button.dataset.presetId === state.selectedPresetId);
  });
}

function loadPreset(presetId) {
  const preset = PRESETS.find((entry) => entry.id === presetId);
  if (!preset) {
    return;
  }

  state.selectedPresetId = preset.id;
  elements.latexInput.value = preset.latex;
  elements.domainSelect.value = preset.domain;
  syncPresetButtons();
  renderFromInput();
}

function buildLayerButtons() {
  elements.layerToggles.replaceChildren();

  Object.keys(ROLE_STYLES).forEach((role) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `layer-toggle role-${role}`;
    button.dataset.role = role;
    button.addEventListener("click", () => {
      if (state.activeRoles.has(role)) {
        state.activeRoles.delete(role);
      } else {
        state.activeRoles.add(role);
      }
      updateLayerButtons();
      renderMathExpression();
    });
    elements.layerToggles.appendChild(button);
  });
}

function updateLayerButtons() {
  const roleCounts = {};
  Object.keys(ROLE_STYLES).forEach((role) => {
    roleCounts[role] = 0;
  });

  if (state.analysis) {
    walkTree(state.analysis.root, (node) => {
      const role = node.role || "quantity";
      roleCounts[role] = (roleCounts[role] || 0) + 1;
    });
  }

  Array.from(elements.layerToggles.querySelectorAll(".layer-toggle")).forEach((button) => {
    const role = button.dataset.role;
    const label = ROLE_STYLES[role].label;
    const count = roleCounts[role] || 0;
    button.textContent = `${label} (${count})`;
    button.classList.toggle("is-off", !state.activeRoles.has(role));
  });
}

function renderFromInput() {
  const latex = elements.latexInput.value.trim();
  const domainKey = elements.domainSelect.value;

  if (!latex) {
    state.analysis = null;
    state.selectedNodeId = null;
    clearAnalysisView();
    setStatus("Paste LaTeX to begin.", "");
    return;
  }

  try {
    const analysis = analyzeLatex(latex, domainKey);
    state.analysis = analysis;
    if (!analysis.nodesById[state.selectedNodeId]) {
      state.selectedNodeId = analysis.root.id;
    }
    renderCurrentView();
    setStatus(
      `Parsed ${analysis.tokenCount} tokens into ${analysis.nodeCount} nodes. Click the rendered math or the tree to inspect a subexpression.`,
      "success"
    );
  } catch (error) {
    state.analysis = null;
    state.selectedNodeId = null;
    clearAnalysisView(latex);
    setStatus(`Parse error: ${error.message}`, "error");
  }
}

function renderCurrentView() {
  updateLayerButtons();
  renderMathExpression();
  renderSummaryCards();
  renderTermCards();
  renderSelectionCard();
  renderTree();
  renderSemanticList();
}

function renderSelectionDrivenViews() {
  renderMathExpression();
  renderTermCards();
  renderSelectionCard();
  renderTree();
  renderSemanticList();
}

async function renderMathExpression() {
  if (!state.analysis) {
    elements.mathOutput.replaceChildren();
    elements.mathFallback.hidden = true;
    return;
  }

  const displayLatex = `\\[${nodeToLatex(state.analysis.root, {
    decorate: true,
    selectedNodeId: state.selectedNodeId
  })}\\]`;

  const epoch = ++state.renderEpoch;
  elements.mathOutput.className = "math-output";
  Object.keys(ROLE_STYLES).forEach((role) => {
    if (!state.activeRoles.has(role)) {
      elements.mathOutput.classList.add(`mask-role-${role}`);
    }
  });

  elements.mathFallback.hidden = true;
  elements.mathOutput.innerHTML = displayLatex;

  if (!window.MathJax || !window.MathJax.typesetPromise) {
    elements.mathFallback.hidden = false;
    elements.mathFallback.textContent = elements.latexInput.value;
    return;
  }

  try {
    if (window.MathJax.typesetClear) {
      window.MathJax.typesetClear([elements.mathOutput]);
    }
    await window.MathJax.typesetPromise([elements.mathOutput]);
    if (epoch !== state.renderEpoch) {
      return;
    }
  } catch (error) {
    elements.mathFallback.hidden = false;
    elements.mathFallback.textContent = `MathJax render failed.\n\n${elements.latexInput.value}`;
  }
}

function renderSummaryCards() {
  elements.summaryCards.replaceChildren();

  if (!state.analysis || !state.analysis.summaryLines.length) {
    elements.summaryCards.appendChild(createEmptyState("No summary is available yet."));
    return;
  }

  state.analysis.summaryLines.forEach((line, index) => {
    const card = document.createElement("article");
    card.className = "summary-card";

    const label = document.createElement("strong");
    label.textContent = index === 0 ? "Core reading" : `Detail ${index}`;

    const body = document.createElement("p");
    body.textContent = line;

    card.append(label, body);
    elements.summaryCards.appendChild(card);
  });
}

function renderTermCards() {
  elements.termCards.replaceChildren();

  if (!state.analysis || !state.analysis.topLevelNodes.length) {
    elements.termCards.appendChild(createEmptyState("No top-level terms were detected."));
    return;
  }

  state.analysis.topLevelNodes.forEach((node) => {
    const card = document.createElement("article");
    card.className = "term-card";

    const title = document.createElement("strong");
    title.textContent = node.title;

    const code = document.createElement("code");
    code.textContent = shortLatex(node, 96);

    const body = document.createElement("p");
    body.textContent = node.description;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-action";
    button.textContent = node.id === state.selectedNodeId ? "Selected" : "Inspect term";
    button.disabled = node.id === state.selectedNodeId;
    button.addEventListener("click", () => selectNode(node.id));

    card.append(title, code, body, button);
    elements.termCards.appendChild(card);
  });
}

function renderSelectionCard() {
  elements.selectionCard.replaceChildren();

  const node = getSelectedNode();
  if (!node) {
    elements.selectionCard.appendChild(createEmptyState("Select a node to see a term-level explanation."));
    return;
  }

  const header = document.createElement("div");
  header.className = "selection-header";

  const titleBlock = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = node.title;
  titleBlock.appendChild(title);

  const rolePill = document.createElement("span");
  rolePill.className = `role-pill role-${node.role || "quantity"}`;
  rolePill.textContent = humanizeRole(node.role);

  header.append(titleBlock, rolePill);

  const code = document.createElement("code");
  code.textContent = shortLatex(node, 180);

  const description = document.createElement("p");
  description.textContent = node.description;

  const meta = document.createElement("div");
  meta.className = "selection-meta";

  [
    `Type: ${node.type}`,
    `Semantic: ${node.semanticType || "none"}`,
    `Children: ${getChildNodes(node).length}`
  ].forEach((text) => {
    const pill = document.createElement("span");
    pill.className = "meta-pill";
    pill.textContent = text;
    meta.appendChild(pill);
  });

  elements.selectionCard.append(header, code, description, meta);
}

function renderTree() {
  elements.treeRoot.replaceChildren();

  if (!state.analysis) {
    elements.treeRoot.appendChild(createEmptyState("The parse tree will appear here."));
    return;
  }

  elements.treeRoot.appendChild(renderTreeBranch(state.analysis.root));
}

function renderTreeBranch(node) {
  const branch = document.createElement("div");
  branch.className = "tree-branch";

  const row = document.createElement("div");
  row.className = "tree-row";

  const button = document.createElement("button");
  button.type = "button";
  button.classList.toggle("is-selected", node.id === state.selectedNodeId);
  button.addEventListener("click", () => selectNode(node.id));

  const title = document.createElement("strong");
  title.textContent = node.title;

  const meta = document.createElement("small");
  meta.textContent = `${humanizeRole(node.role)} | ${shortLatex(node, 80)}`;

  button.append(title, meta);
  row.appendChild(button);
  branch.appendChild(row);

  const children = getChildNodes(node);
  if (children.length) {
    const childContainer = document.createElement("div");
    childContainer.className = "tree-children";
    children.forEach((child) => {
      childContainer.appendChild(renderTreeBranch(child));
    });
    branch.appendChild(childContainer);
  }

  return branch;
}

function renderSemanticList() {
  elements.semanticList.replaceChildren();

  if (!state.analysis || !state.analysis.semanticNodes.length) {
    elements.semanticList.appendChild(createEmptyState("No higher-level semantic patterns were inferred."));
    return;
  }

  state.analysis.semanticNodes.forEach((node) => {
    const card = document.createElement("article");
    card.className = "semantic-card";

    const title = document.createElement("strong");
    title.textContent = node.title;

    const code = document.createElement("code");
    code.textContent = shortLatex(node, 100);

    const body = document.createElement("p");
    body.textContent = node.description;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "card-action";
    button.textContent = node.id === state.selectedNodeId ? "Selected" : "Inspect pattern";
    button.disabled = node.id === state.selectedNodeId;
    button.addEventListener("click", () => selectNode(node.id));

    card.append(title, code, body, button);
    elements.semanticList.appendChild(card);
  });
}

function clearAnalysisView(rawLatex = "") {
  updateLayerButtons();
  elements.mathOutput.replaceChildren();
  elements.mathFallback.hidden = !rawLatex;
  elements.mathFallback.textContent = rawLatex;
  elements.summaryCards.replaceChildren(createEmptyState("No summary yet."));
  elements.termCards.replaceChildren(createEmptyState("No term breakdown yet."));
  elements.selectionCard.replaceChildren(createEmptyState("No selection yet."));
  elements.treeRoot.replaceChildren(createEmptyState("No parse tree yet."));
  elements.semanticList.replaceChildren(createEmptyState("No semantic patterns yet."));
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

function createEmptyState(text) {
  const box = document.createElement("div");
  box.className = "empty-state";
  box.textContent = text;
  return box;
}

function selectNode(nodeId) {
  if (!state.analysis || !state.analysis.nodesById[nodeId]) {
    return;
  }
  state.selectedNodeId = nodeId;
  renderSelectionDrivenViews();
}

function getSelectedNode() {
  if (!state.analysis) {
    return null;
  }
  return state.analysis.nodesById[state.selectedNodeId] || state.analysis.root;
}

function findNodeIdFromTarget(target, boundary) {
  let current = target;
  while (current && current !== boundary) {
    if (current.classList) {
      const match = Array.from(current.classList).find((entry) => entry.startsWith("node-"));
      if (match) {
        return match.replace("node-", "");
      }
    }
    current = current.parentElement;
  }
  return null;
}

function analyzeLatex(latex, domainKey) {
  const tokens = tokenize(latex);
  const parser = new LatexParser(tokens);
  const root = parser.parse();
  const profile = DOMAIN_PROFILES[domainKey] || DOMAIN_PROFILES.general;

  annotateTree(root, profile, null, 0);

  const nodesById = {};
  walkTree(root, (node) => {
    nodesById[node.id] = node;
  });

  return {
    latex,
    profile,
    root,
    nodesById,
    tokenCount: tokens.length,
    nodeCount: Object.keys(nodesById).length,
    summaryLines: buildSummary(root, profile),
    topLevelNodes: computeTopLevelNodes(root),
    semanticNodes: collectSemanticNodes(root)
  };
}

function annotateTree(node, profile, parent, depth) {
  node.parentId = parent ? parent.id : null;
  node.depth = depth;

  getChildNodes(node).forEach((child) => annotateTree(child, profile, node, depth + 1));

  if (node.type === "summation" || node.type === "integral") {
    node.bindingInfo = analyzeBounds(node);
  }

  if (node.type === "absolute") {
    const datasetNode = extractCardinalityDataset(node);
    if (datasetNode) {
      node.semanticType = "dataset_cardinality";
      node.datasetNode = datasetNode;
      node.role = "normalizer";
    }
  }

  if (node.type === "summation") {
    node.semanticType = "summation";
    node.role = "operator";
  }

  const meanMatch = detectMeanOverSet(node);
  if (meanMatch) {
    node.semanticType = "mean_over_set";
    node.normalizerNode = meanMatch.normalizerNode;
    node.sumNode = meanMatch.sumNode;
    node.datasetNode = meanMatch.datasetNode;
    node.binderNode = meanMatch.binderNode;
    node.bodyNode = meanMatch.bodyNode;
    node.role = node.role || "quantity";

    if (node.normalizerNode) {
      node.normalizerNode.role = node.normalizerNode.role || "normalizer";
    }
    if (node.sumNode) {
      node.sumNode.role = node.sumNode.role || "operator";
    }
    if (node.datasetNode) {
      node.datasetNode.role = node.datasetNode.role || "dataset";
    }
    if (node.binderNode) {
      node.binderNode.role = node.binderNode.role || "index";
    }
  }

  if (node.type === "additive" && node.operators.some((operator) => operator === "-")) {
    node.semanticType = node.terms.every((term) => resolveMeanNode(term)) ? "contrast_of_means" : "difference";
    node.role = "contrast";
    if (node.terms[0]) {
      node.terms[0].role = node.terms[0].role || "positive-term";
    }
    if (node.terms[1]) {
      node.terms[1].role = node.terms[1].role || "negative-term";
    }
  }

  if (node.type === "relation" && node.op === "=") {
    node.semanticType = "definition";
    node.role = "definition";
  }

  if (node.type === "call") {
    const symbolInfo = inspectSymbolForm(node);
    if (symbolInfo) {
      node.semanticType = "evaluation";
    }
  }

  if (!node.semanticType && looksLikeDataset(node)) {
    node.semanticType = "dataset";
    node.role = "dataset";
  }

  if (!node.role) {
    node.role = inferRole(node, profile);
  }

  node.title = labelNode(node, profile);
  node.description = describeNode(node, profile);
}

function computeTopLevelNodes(root) {
  if (!root) {
    return [];
  }

  if (root.type === "relation") {
    const nodes = [root.left];
    if (root.right && root.right.type === "additive") {
      return uniqueNodes(nodes.concat(root.right.terms.slice(0, 4)));
    }
    if (root.right) {
      nodes.push(root.right);
    }
    return uniqueNodes(nodes);
  }

  if (root.type === "additive") {
    return uniqueNodes(root.terms.slice(0, 5));
  }

  if (root.type === "product") {
    return uniqueNodes(root.factors.slice(0, 5));
  }

  return uniqueNodes(getChildNodes(root).slice(0, 5));
}

function collectSemanticNodes(root) {
  const nodes = [];
  walkTree(root, (node) => {
    if (
      node.semanticType &&
      !["dataset", "evaluation"].includes(node.semanticType)
    ) {
      nodes.push(node);
    } else if (node.semanticType === "evaluation" && complexityScore(node) >= 2) {
      nodes.push(node);
    }
  });

  nodes.sort((left, right) => left.depth - right.depth);
  return uniqueNodes(nodes).slice(0, 10);
}

function buildSummary(root, profile) {
  const lines = [];

  const mlContrast = matchMlContrastDefinition(root, profile);
  if (mlContrast) {
    lines.push(
      `This defines ${briefNode(root.left, profile)} as a harmful average minus a safe average.`
    );
    lines.push(
      `The first term averages ${briefNode(mlContrast.bodyNode, profile)} over ${briefNode(mlContrast.positive.datasetNode, profile)}.`
    );
    lines.push(
      `The second term averages the same quantity over ${briefNode(mlContrast.negative.datasetNode, profile)}.`
    );
    lines.push("The outer indices stay fixed while the prompt variable changes inside each summation.");
    return uniqueStrings(lines).slice(0, 4);
  }

  const dftSummary = matchDiscreteFourierDefinition(root, profile);
  if (dftSummary) {
    lines.push(
      `This defines ${briefNode(root.left, profile)} as a frequency coefficient assembled from all samples in the signal.`
    );
    if (dftSummary.normalizerNode) {
      lines.push(`The factor ${shortLatex(dftSummary.normalizerNode, 30)} rescales the sum by the signal length.`);
    }
    lines.push(`The summation walks through ${describeBoundsText(dftSummary.sumNode.bindingInfo, profile)}.`);
    lines.push("The exponential term rotates each sample according to the chosen frequency index k.");
    return uniqueStrings(lines).slice(0, 4);
  }

  if (root.type === "relation" && root.op === "=") {
    lines.push(`This equation defines ${briefNode(root.left, profile)}.`);
    lines.push(describeNode(root.right, profile));
  } else {
    lines.push(describeNode(root, profile));
  }

  const interestingEvaluation = findFirstNode(root, (node) => node.semanticType === "evaluation" && complexityScore(node) >= 2);
  if (interestingEvaluation) {
    lines.push(describeNode(interestingEvaluation, profile));
  }

  const interestingSum = findFirstNode(root, (node) => node.type === "summation");
  if (interestingSum && interestingSum !== interestingEvaluation) {
    lines.push(describeNode(interestingSum, profile));
  }

  return uniqueStrings(lines).slice(0, 4);
}

function matchMlContrastDefinition(root, profile) {
  if (!root || root.type !== "relation" || root.op !== "=" || profile.key !== "ml") {
    return null;
  }

  if (!root.right || root.right.semanticType !== "contrast_of_means" || root.right.terms.length < 2) {
    return null;
  }

  const positive = resolveMeanNode(root.right.terms[0]);
  const negative = resolveMeanNode(root.right.terms[1]);
  if (!positive || !negative) {
    return null;
  }

  return {
    positive,
    negative,
    bodyNode: positive.bodyNode || negative.bodyNode
  };
}

function matchDiscreteFourierDefinition(root, profile) {
  if (!root || root.type !== "relation" || root.op !== "=" || profile.key !== "signals") {
    return null;
  }

  const leftInfo = inspectSymbolForm(root.left);
  if (!leftInfo || leftInfo.base !== "X") {
    return null;
  }

  const sumNode = findFirstNode(root.right, (node) => node.type === "summation");
  if (!sumNode) {
    return null;
  }

  const normalizerNode = findFirstNode(root.right, (node) => node.type === "fraction" && isLiteralOne(node.numerator));

  return {
    sumNode,
    normalizerNode
  };
}

function resolveMeanNode(node) {
  if (!node) {
    return null;
  }
  if (node.semanticType === "mean_over_set") {
    return node;
  }
  const unwrapped = unwrapStructural(node);
  return unwrapped && unwrapped.semanticType === "mean_over_set" ? unwrapped : null;
}

function detectMeanOverSet(node) {
  const target = unwrapStructural(node);
  if (!target || target.type !== "product" || target.factors.length < 2) {
    return null;
  }

  const normalizerNode = unwrapStructural(target.factors[0]);
  const sumNode = findSummationNode(target.factors[1]);

  if (!normalizerNode || !sumNode || !isUnitCardinalityFactor(normalizerNode)) {
    return null;
  }

  const cardinalityDataset = extractCardinalityDataset(normalizerNode.denominator);
  const binding = analyzeBounds(sumNode);
  const sumDataset = binding.datasetNode || null;
  const leftKey = normalizeBareKey(cardinalityDataset ? toBareText(cardinalityDataset) : "");
  const rightKey = normalizeBareKey(sumDataset ? toBareText(sumDataset) : "");

  if (leftKey && rightKey && leftKey !== rightKey) {
    return null;
  }

  return {
    normalizerNode,
    sumNode,
    datasetNode: sumDataset || cardinalityDataset,
    binderNode: binding.variableNode || null,
    bodyNode: sumNode.body
  };
}

function findSummationNode(node) {
  const target = unwrapStructural(node);
  if (!target) {
    return null;
  }
  return target.type === "summation" ? target : null;
}

function analyzeBounds(node) {
  if (!node) {
    return { kind: "implicit" };
  }

  if (node.lower && node.lower.type === "relation" && node.lower.op === "in") {
    return {
      kind: "membership",
      variableNode: node.lower.left,
      datasetNode: node.lower.right
    };
  }

  if (node.lower && node.lower.type === "relation" && node.lower.op === "=") {
    return {
      kind: "range",
      variableNode: node.lower.left,
      startNode: node.lower.right,
      endNode: node.upper || null
    };
  }

  if (node.lower || node.upper) {
    return {
      kind: "generic",
      lowerNode: node.lower || null,
      upperNode: node.upper || null
    };
  }

  return { kind: "implicit" };
}

function inferRole(node, profile) {
  if (!node) {
    return "quantity";
  }

  if (node.semanticType === "definition") {
    return "definition";
  }
  if (node.semanticType === "dataset" || node.semanticType === "dataset_cardinality") {
    return node.semanticType === "dataset" ? "dataset" : "normalizer";
  }
  if (node.semanticType === "summation") {
    return "operator";
  }

  switch (node.type) {
    case "relation":
      return "definition";
    case "additive":
      return node.operators.some((operator) => operator === "-") ? "contrast" : "operator";
    case "fraction":
      return isLiteralOne(node.numerator) ? "normalizer" : "quantity";
    case "summation":
    case "integral":
    case "sum-operator":
    case "integral-operator":
      return "operator";
    case "group":
    case "absolute":
      return "group";
    case "number":
      return "quantity";
    case "call":
    case "scripted":
    case "styled":
    case "symbol":
      return inferSymbolRole(node, profile);
    default:
      return "quantity";
  }
}

function inferSymbolRole(node, profile) {
  const info = inspectSymbolForm(node);
  if (!info) {
    return "quantity";
  }

  if (looksLikeDataset(node)) {
    return "dataset";
  }

  if (KNOWN_FUNCTIONS.has(info.base) || info.base === "exp") {
    return "operator";
  }

  if (
    ["i", "j", "k", "l", "m", "n", "p", "q", "t"].includes(info.base) &&
    !info.subscript &&
    !info.superscript &&
    info.args.length === 0
  ) {
    return "index";
  }

  if (profile.key === "signals" && ["n", "k"].includes(info.base) && info.args.length === 0) {
    return "index";
  }

  return "quantity";
}

function labelNode(node, profile) {
  switch (node.semanticType) {
    case "definition":
      return "Definition";
    case "contrast_of_means":
      return "Difference of averages";
    case "difference":
      return "Difference";
    case "mean_over_set":
      return `Average over ${briefNode(node.datasetNode, profile)}`;
    case "dataset_cardinality":
      return `Set size ${briefNode(node.datasetNode, profile)}`;
    case "summation":
      return "Summation";
    case "dataset":
      return `Dataset ${briefNode(node, profile)}`;
    case "evaluation":
      return `Evaluation ${briefNode(node, profile)}`;
    default:
      break;
  }

  switch (node.type) {
    case "relation":
      return `Relation ${formatOperatorLabel(node.op)}`;
    case "relation_chain":
      return "Relation chain";
    case "additive":
      return "Additive expression";
    case "product":
      return "Product / sequence";
    case "fraction":
      return "Fraction";
    case "summation":
      return "Summation";
    case "integral":
      return "Integral";
    case "group":
      return `Group ${node.open}${node.close}`;
    case "absolute":
      return "Absolute value / size";
    case "sqrt":
      return "Square root";
    case "call":
    case "scripted":
    case "styled":
    case "symbol":
      return `Symbol ${shortHuman(node, 36)}`;
    case "number":
      return `Number ${node.value}`;
    case "unary":
      return "Unary expression";
    default:
      return sentenceCase(node.type.replace(/-/g, " "));
  }
}

function describeNode(node, profile) {
  if (!node) {
    return "No description available.";
  }

  switch (node.semanticType) {
    case "definition":
      return `Defines ${briefNode(node.left, profile)} in terms of ${briefNode(node.right, profile)}.`;
    case "contrast_of_means":
      return "Subtract the second average from the first average.";
    case "difference":
      return "Combine the terms by subtraction.";
    case "mean_over_set":
      return `Average ${briefNode(node.bodyNode, profile)} over ${briefNode(node.datasetNode, profile)} by dividing the sum by the size of the set.`;
    case "dataset_cardinality":
      return `Take the size of ${briefNode(node.datasetNode, profile)}.`;
    case "summation":
      return `Add ${briefNode(node.body, profile)} ${describeBoundsText(node.bindingInfo, profile)}.`;
    case "dataset":
      return describeDataset(node, profile);
    case "evaluation":
      return describeEvaluation(node, profile);
    default:
      break;
  }

  switch (node.type) {
    case "fraction":
      return `Divide ${briefNode(node.numerator, profile)} by ${briefNode(node.denominator, profile)}.`;
    case "product":
      return `Read this as a product or juxtaposition of ${node.factors.length} factors.`;
    case "relation":
      return `Relate ${briefNode(node.left, profile)} to ${briefNode(node.right, profile)} with ${formatOperatorLabel(node.op)}.`;
    case "relation_chain":
      return "Chain several relation operators together.";
    case "group":
      return `Group ${briefNode(node.body, profile)} inside ${node.open} ... ${node.close}.`;
    case "absolute":
      return `Take the absolute value or magnitude-like wrapper around ${briefNode(node.body, profile)}.`;
    case "sqrt":
      return `Take the square root of ${briefNode(node.radicand, profile)}.`;
    case "call":
    case "scripted":
    case "styled":
    case "symbol":
      return describeEvaluation(node, profile);
    case "number":
      return `Literal number ${node.value}.`;
    case "unary":
      return `Apply a leading ${node.operator} sign to ${briefNode(node.operand, profile)}.`;
    default:
      return `This node is parsed as ${node.type}.`;
  }
}

function describeDataset(node, profile) {
  const raw = shortHuman(node, 48);
  const key = normalizeBareKey(raw);
  const glossEntry = Object.entries(profile.datasetGloss || {}).find(([needle]) => key.includes(needle));

  if (glossEntry) {
    return `${raw} denotes a set or dataset of ${glossEntry[1]}.`;
  }

  if (looksLikeSet(node)) {
    return `${raw} behaves like a named set or collection.`;
  }

  return `${raw} is being treated as a dataset- or set-like symbol.`;
}

function describeEvaluation(node, profile) {
  const info = inspectSymbolForm(node);
  const raw = shortHuman(node, 72);

  if (!info) {
    return `${raw} is a symbol-like term.`;
  }

  const baseGloss = profile.symbolGloss[info.base] || DOMAIN_PROFILES.general.symbolGloss[info.base] || `the symbol ${info.base}`;
  const qualifiers = [];

  if (info.subscript) {
    qualifiers.push(describeSlot("subscript", info.subscript, profile));
  }

  if (info.superscript) {
    qualifiers.push(describeSlot("superscript", info.superscript, profile));
  }

  info.args.forEach((argument) => {
    qualifiers.push(describeSlot("argument", argument, profile));
  });

  if (info.primes) {
    qualifiers.push(`${info.primes === 1 ? "one prime mark" : `${info.primes} prime marks`}`);
  }

  if (!qualifiers.length) {
    return `${raw} denotes ${baseGloss}.`;
  }

  return `${raw} denotes ${baseGloss} with ${qualifiers.join(", ")}.`;
}

function describeSlot(kind, node, profile) {
  const raw = shortHuman(node, 24);
  const key = normalizeBareKey(raw);
  const entry = profile.slotGloss && profile.slotGloss[kind] ? profile.slotGloss[kind][key] : null;

  if (entry) {
    return entry;
  }

  if (kind === "subscript") {
    return `subscript ${raw}`;
  }
  if (kind === "superscript") {
    return `superscript ${raw}`;
  }
  return `argument ${raw}`;
}

function describeBoundsText(bindingInfo, profile) {
  if (!bindingInfo || bindingInfo.kind === "implicit") {
    return "over the implied index range";
  }

  if (bindingInfo.kind === "membership") {
    return `while ${briefNode(bindingInfo.variableNode, profile)} ranges over ${briefNode(bindingInfo.datasetNode, profile)}`;
  }

  if (bindingInfo.kind === "range") {
    const start = bindingInfo.startNode ? briefNode(bindingInfo.startNode, profile) : "the lower bound";
    const end = bindingInfo.endNode ? briefNode(bindingInfo.endNode, profile) : "the upper bound";
    return `for ${briefNode(bindingInfo.variableNode, profile)} from ${start} to ${end}`;
  }

  if (bindingInfo.kind === "generic") {
    if (bindingInfo.lowerNode && bindingInfo.upperNode) {
      return `between ${briefNode(bindingInfo.lowerNode, profile)} and ${briefNode(bindingInfo.upperNode, profile)}`;
    }
    if (bindingInfo.lowerNode) {
      return `with lower bound ${briefNode(bindingInfo.lowerNode, profile)}`;
    }
    if (bindingInfo.upperNode) {
      return `with upper bound ${briefNode(bindingInfo.upperNode, profile)}`;
    }
  }

  return "with explicit bounds";
}

function briefNode(node, profile) {
  if (!node) {
    return "this part of the equation";
  }

  if (node.semanticType === "mean_over_set") {
    return `the average of ${briefNode(node.bodyNode, profile)} over ${briefNode(node.datasetNode, profile)}`;
  }

  if (node.semanticType === "dataset_cardinality") {
    return `the size of ${briefNode(node.datasetNode, profile)}`;
  }

  if (node.semanticType === "dataset") {
    return shortHuman(node, 28);
  }

  if (node.semanticType === "evaluation") {
    return shortHuman(node, 32);
  }

  if (node.type === "summation") {
    return `the sum of ${briefNode(node.body, profile)}`;
  }

  return shortHuman(node, 36);
}

function shortHuman(node, maxLength) {
  const text = collapseWhitespace(toBareText(node)).trim();
  if (!text) {
    return shortLatex(node, maxLength);
  }
  return truncate(text, maxLength);
}

function shortLatex(node, maxLength) {
  const latex = collapseWhitespace(nodeToLatex(node, { decorate: false })).trim();
  return truncate(latex, maxLength);
}

function humanizeRole(role) {
  return ROLE_STYLES[role || "quantity"] ? ROLE_STYLES[role || "quantity"].label : "Quantity";
}

function complexityScore(node) {
  let score = 0;
  walkTree(node, () => {
    score += 1;
  });
  return score;
}

function looksLikeDataset(node) {
  const info = inspectSymbolForm(node);
  if (!info) {
    return false;
  }
  return info.base === "D" || (info.styledWith === "mathcal" && /^[A-Z]$/.test(info.base));
}

function looksLikeSet(node) {
  const info = inspectSymbolForm(node);
  if (!info) {
    return false;
  }
  return info.styledWith === "mathcal" && /^[A-Z]$/.test(info.base);
}

function inspectSymbolForm(node) {
  if (!node) {
    return null;
  }

  if (node.type === "call") {
    const info = inspectSymbolForm(node.callee);
    if (!info) {
      return null;
    }
    return {
      ...info,
      args: info.args.concat(node.args)
    };
  }

  if (node.type === "scripted") {
    const info = inspectSymbolForm(node.base);
    if (!info) {
      return null;
    }
    return {
      ...info,
      subscript: node.subscript || info.subscript,
      superscript: node.superscript || info.superscript,
      primes: (info.primes || 0) + (node.primes || 0)
    };
  }

  if (node.type === "styled") {
    const info = inspectSymbolForm(node.body);
    if (!info) {
      return null;
    }
    return {
      ...info,
      styledWith: node.style
    };
  }

  if (node.type === "symbol") {
    return {
      base: node.command ? node.value : node.value,
      styledWith: null,
      subscript: null,
      superscript: null,
      primes: 0,
      args: []
    };
  }

  if (node.type === "group" && node.transparent) {
    return inspectSymbolForm(node.body);
  }

  return null;
}

function unwrapStructural(node) {
  let current = node;
  while (current && (current.type === "group" || current.type === "styled") && current.body) {
    current = current.body;
  }
  return current;
}

function extractCardinalityDataset(node) {
  const target = unwrapStructural(node);
  if (!target) {
    return null;
  }
  if (target.type === "absolute" && looksLikeDataset(target.body)) {
    return target.body;
  }
  if (target.type === "group") {
    return extractCardinalityDataset(target.body);
  }
  return null;
}

function isUnitCardinalityFactor(node) {
  return node && node.type === "fraction" && isLiteralOne(node.numerator) && Boolean(extractCardinalityDataset(node.denominator));
}

function isLiteralOne(node) {
  const target = unwrapStructural(node);
  return Boolean(target && target.type === "number" && target.value === "1");
}

function findFirstNode(node, predicate) {
  let found = null;
  walkTree(node, (candidate) => {
    if (!found && predicate(candidate)) {
      found = candidate;
    }
  });
  return found;
}

function uniqueNodes(nodes) {
  const seen = new Set();
  return nodes.filter((node) => {
    if (!node || seen.has(node.id)) {
      return false;
    }
    seen.add(node.id);
    return true;
  });
}

function uniqueStrings(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = collapseWhitespace(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function walkTree(node, visitor) {
  if (!node) {
    return;
  }
  visitor(node);
  getChildNodes(node).forEach((child) => walkTree(child, visitor));
}

function getChildNodes(node) {
  if (!node) {
    return [];
  }

  switch (node.type) {
    case "relation":
      return [node.left, node.right].filter(Boolean);
    case "relation_chain":
      return (node.sides || []).filter(Boolean);
    case "additive":
      return (node.terms || []).filter(Boolean);
    case "product":
      return (node.factors || []).filter(Boolean);
    case "fraction":
      return [node.numerator, node.denominator].filter(Boolean);
    case "summation":
    case "integral":
      return [node.lower, node.upper, node.body].filter(Boolean);
    case "sqrt":
      return [node.index, node.radicand].filter(Boolean);
    case "group":
    case "absolute":
    case "styled":
      return [node.body].filter(Boolean);
    case "scripted":
      return [node.base, node.subscript, node.superscript].filter(Boolean);
    case "call":
      return [node.callee].concat(node.args || []).filter(Boolean);
    case "unary":
      return [node.operand].filter(Boolean);
    default:
      return [];
  }
}

function nodeToLatex(node, options = {}) {
  if (!node) {
    return "";
  }
  const raw = nodeToLatexRaw(node, options);
  if (!options.decorate || node.type === "empty") {
    return raw;
  }
  return wrapLatexNode(node, raw, options);
}

function nodeToLatexRaw(node, options) {
  switch (node.type) {
    case "number":
      return node.value;
    case "symbol":
      return node.command ? `\\${node.value}` : node.value;
    case "fraction":
      return `\\frac{${nodeToLatex(node.numerator, options)}}{${nodeToLatex(node.denominator, options)}}`;
    case "sqrt": {
      const indexLatex = node.index
        ? node.index.type === "group"
          ? nodeToLatex(node.index.body, options)
          : nodeToLatex(node.index, options)
        : "";
      return node.index
        ? `\\sqrt[${indexLatex}]{${nodeToLatex(node.radicand, options)}}`
        : `\\sqrt{${nodeToLatex(node.radicand, options)}}`;
    }
    case "group":
      if (node.transparent) {
        return `{${nodeToLatex(node.body, options)}}`;
      }
      if (node.stretchy) {
        return `\\left${delimiterToLatex(node.open)}${nodeToLatex(node.body, options)}\\right${delimiterToLatex(node.close)}`;
      }
      return `${delimiterToLatex(node.open)}${nodeToLatex(node.body, options)}${delimiterToLatex(node.close)}`;
    case "absolute":
      return `\\left|${nodeToLatex(node.body, options)}\\right|`;
    case "styled":
      return `\\${node.style}{${nodeToLatex(node.body, options)}}`;
    case "scripted": {
      let latex = nodeToLatex(node.base, options);
      if (node.subscript) {
        latex += `_{${nodeToLatex(node.subscript, options)}}`;
      }
      if (node.superscript) {
        latex += `^{${nodeToLatex(node.superscript, options)}}`;
      }
      if (node.primes) {
        latex += "'".repeat(node.primes);
      }
      return latex;
    }
    case "call":
      return `${nodeToLatex(node.callee, options)}${(node.args || []).map((arg) => nodeToLatex(arg, options)).join("")}`;
    case "sum-operator":
      return serializeLargeOperator("sum", node, options);
    case "integral-operator":
      return serializeLargeOperator("int", node, options);
    case "summation":
      return `${serializeLargeOperator("sum", node, options)} ${nodeToLatex(node.body, options)}`;
    case "integral":
      return `${serializeLargeOperator("int", node, options)} ${nodeToLatex(node.body, options)}`;
    case "product": {
      let latex = nodeToLatex(node.factors[0], options);
      for (let index = 1; index < node.factors.length; index += 1) {
        const operator = node.operators[index - 1];
        const operatorLatex = operator === "implicit" ? " " : ` ${formatProductOperator(operator)} `;
        latex += `${operatorLatex}${nodeToLatex(node.factors[index], options)}`;
      }
      return latex;
    }
    case "additive": {
      let latex = nodeToLatex(node.terms[0], options);
      for (let index = 1; index < node.terms.length; index += 1) {
        latex += ` ${formatOperatorLatex(node.operators[index - 1])} ${nodeToLatex(node.terms[index], options)}`;
      }
      return latex;
    }
    case "relation":
      return `${nodeToLatex(node.left, options)} ${formatOperatorLatex(node.op)} ${nodeToLatex(node.right, options)}`;
    case "relation_chain":
      return node.sides
        .map((side, index) => {
          if (index === 0) {
            return nodeToLatex(side, options);
          }
          return `${formatOperatorLatex(node.operators[index - 1])} ${nodeToLatex(side, options)}`;
        })
        .join(" ");
    case "unary":
      return `${node.operator}${nodeToLatex(node.operand, options)}`;
    default:
      return "";
  }
}

function wrapLatexNode(node, raw, options) {
  const role = sanitizeClassToken(node.role || "quantity");
  const classes = [
    "math-node",
    `node-${sanitizeClassToken(node.id)}`,
    `role-${role}`
  ];

  if (options.selectedNodeId === node.id) {
    classes.push("selected-node");
  }

  return `\\class{${classes.join(" ")}}{${raw}}`;
}

function serializeLargeOperator(kind, node, options) {
  let latex = kind === "sum" ? "\\sum" : "\\int";

  if (node.lower) {
    latex += `_{${nodeToLatex(node.lower, options)}}`;
  }
  if (node.upper) {
    latex += `^{${nodeToLatex(node.upper, options)}}`;
  }
  if (node.primes) {
    latex += "'".repeat(node.primes);
  }

  return latex;
}

function delimiterToLatex(delimiter) {
  if (delimiter === "{") {
    return "{";
  }
  if (delimiter === "}") {
    return "}";
  }
  return delimiter;
}

function formatOperatorLatex(operator) {
  if (operator === "=") {
    return "=";
  }
  if (operator === "-") {
    return "-";
  }
  if (operator === "+") {
    return "+";
  }
  if (operator === "pm") {
    return "\\pm";
  }
  return `\\${operator}`;
}

function formatProductOperator(operator) {
  if (operator === "/" || operator === "*") {
    return operator;
  }
  if (operator === "cdot" || operator === "times") {
    return `\\${operator}`;
  }
  return operator;
}

function formatOperatorLabel(operator) {
  const labels = {
    "=": "equality",
    "-": "subtraction",
    "+": "addition",
    pm: "plus-minus",
    in: "membership",
    approx: "approximation",
    to: "mapping",
    mapsto: "maps to"
  };
  return labels[operator] || operator;
}

function sanitizeClassToken(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function tokenize(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "%") {
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }
      continue;
    }

    if (char === "\\") {
      let cursor = index + 1;
      if (cursor < source.length && /[A-Za-z*]/.test(source[cursor])) {
        while (cursor < source.length && /[A-Za-z*]/.test(source[cursor])) {
          cursor += 1;
        }
      } else if (cursor < source.length) {
        cursor += 1;
      }
      tokens.push({ type: "command", value: source.slice(index + 1, cursor) });
      index = cursor;
      continue;
    }

    if (/[0-9]/.test(char)) {
      let cursor = index + 1;
      while (cursor < source.length && /[0-9.]/.test(source[cursor])) {
        cursor += 1;
      }
      tokens.push({ type: "number", value: source.slice(index, cursor) });
      index = cursor;
      continue;
    }

    if (/[A-Za-z]/.test(char)) {
      let cursor = index + 1;
      while (cursor < source.length && /[A-Za-z0-9]/.test(source[cursor])) {
        cursor += 1;
      }
      tokens.push({ type: "identifier", value: source.slice(index, cursor) });
      index = cursor;
      continue;
    }

    if ("{}[]()_^+-=*/|,&".includes(char)) {
      tokens.push({ type: "symbol", value: char });
      index += 1;
      continue;
    }

    if (char === "'") {
      tokens.push({ type: "prime", value: "'" });
      index += 1;
      continue;
    }

    tokens.push({ type: "symbol", value: char });
    index += 1;
  }

  return tokens;
}

class LatexParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
    this.nodeCounter = 0;
  }

  createNode(type, props = {}) {
    return {
      id: `n${++this.nodeCounter}`,
      type,
      ...props
    };
  }

  parse() {
    const expression = this.parseRelation(() => false);
    if (!expression) {
      return this.createNode("empty");
    }
    if (!this.atEnd()) {
      throw new Error(`Unexpected token ${tokenToText(this.peek())}`);
    }
    return expression;
  }

  atEnd() {
    return this.index >= this.tokens.length;
  }

  peek(offset = 0) {
    return this.tokens[this.index + offset] || null;
  }

  consume() {
    const token = this.peek();
    this.index += 1;
    return token;
  }

  matchSymbol(value) {
    const token = this.peek();
    if (token && token.type === "symbol" && token.value === value) {
      this.consume();
      return true;
    }
    return false;
  }

  matchCommand(value) {
    const token = this.peek();
    if (token && token.type === "command" && token.value === value) {
      this.consume();
      return true;
    }
    return false;
  }

  parseRelation(stopCondition) {
    let left = this.parseAdditive(stopCondition);
    if (!left) {
      return null;
    }

    const sides = [left];
    const operators = [];

    while (!this.atEnd() && !stopCondition(this.peek()) && isRelationToken(this.peek())) {
      operators.push(tokenValue(this.consume()));
      const right = this.parseAdditive(stopCondition);
      if (!right) {
        throw new Error("Expected an expression after a relation operator.");
      }
      sides.push(right);
    }

    if (!operators.length) {
      return left;
    }

    if (operators.length === 1) {
      return this.createNode("relation", {
        op: operators[0],
        left: sides[0],
        right: sides[1]
      });
    }

    return this.createNode("relation_chain", {
      operators,
      sides
    });
  }

  parseAdditive(stopCondition) {
    const first = this.parseMultiplicative(stopCondition);
    if (!first) {
      return null;
    }

    const terms = [first];
    const operators = [];

    while (!this.atEnd() && !stopCondition(this.peek()) && isAdditiveToken(this.peek())) {
      operators.push(tokenValue(this.consume()));
      const next = this.parseMultiplicative(stopCondition);
      if (!next) {
        throw new Error("Expected an expression after an additive operator.");
      }
      terms.push(next);
    }

    return operators.length ? this.createNode("additive", { operators, terms }) : first;
  }

  parseMultiplicative(stopCondition) {
    const first = this.parseFactor(stopCondition);
    if (!first) {
      return null;
    }

    const factors = [first];
    const operators = [];

    while (!this.atEnd() && !stopCondition(this.peek())) {
      if (isExplicitMultiplyToken(this.peek())) {
        operators.push(tokenValue(this.consume()));
        const next = this.parseFactor(stopCondition);
        if (!next) {
          throw new Error("Expected a factor after a multiplicative operator.");
        }
        factors.push(next);
        continue;
      }

      if (canStartImplicitFactor(this.peek())) {
        operators.push("implicit");
        factors.push(this.parseFactor(stopCondition));
        continue;
      }

      break;
    }

    return composeProductNode(this, factors, operators);
  }

  parseFactor(stopCondition) {
    if (this.atEnd() || stopCondition(this.peek())) {
      return null;
    }

    if (this.matchSymbol("+")) {
      return this.parseFactor(stopCondition);
    }

    if (this.matchSymbol("-")) {
      const operand = this.parseFactor(stopCondition);
      if (!operand) {
        throw new Error("Expected an expression after unary -.");
      }
      return this.createNode("unary", { operator: "-", operand });
    }

    let node = this.parsePrimary(stopCondition);
    if (!node) {
      return null;
    }

    while (!this.atEnd() && !stopCondition(this.peek())) {
      if (this.matchSymbol("_")) {
        const subscript = this.parseScriptArgument();
        node = applyScript(this, node, "subscript", subscript);
        continue;
      }

      if (this.matchSymbol("^")) {
        const superscript = this.parseScriptArgument();
        node = applyScript(this, node, "superscript", superscript);
        continue;
      }

      if (this.peek() && this.peek().type === "prime") {
        this.consume();
        node = applyPrime(this, node);
        continue;
      }

      if (canStartCallArgument(this.peek()) && isCallableNode(node)) {
        const arg = this.parseCallArgument();
        node = this.createNode("call", {
          callee: node,
          args: [arg]
        });
        continue;
      }

      break;
    }

    return node;
  }

  parsePrimary(stopCondition) {
    if (this.atEnd() || stopCondition(this.peek())) {
      return null;
    }

    const token = this.peek();
    if (!token) {
      return null;
    }

    if (token.type === "number") {
      this.consume();
      return this.createNode("number", { value: token.value });
    }

    if (token.type === "identifier") {
      this.consume();
      return this.createNode("symbol", { value: token.value, command: false });
    }

    if (token.type === "command") {
      return this.parseCommandPrimary();
    }

    if (token.type === "symbol") {
      if (token.value === "{") {
        return this.parseBraceGroup();
      }
      if (token.value === "(") {
        return this.parseDelimitedGroup("(", ")");
      }
      if (token.value === "[") {
        return this.parseDelimitedGroup("[", "]");
      }
      if (token.value === "|") {
        return this.parseAbsolute();
      }

      this.consume();
      return this.createNode("symbol", { value: token.value, command: false });
    }

    return null;
  }

  parseCommandPrimary() {
    const token = this.consume();
    const name = token.value;

    if (name === "frac") {
      const numerator = this.parseRequiredGroup("numerator");
      const denominator = this.parseRequiredGroup("denominator");
      return this.createNode("fraction", { numerator, denominator });
    }

    if (name === "sqrt") {
      let indexNode = null;
      if (this.peek() && this.peek().type === "symbol" && this.peek().value === "[") {
        indexNode = this.parseDelimitedGroup("[", "]");
      }
      const radicand = this.parseRequiredGroup("radicand");
      return this.createNode("sqrt", { index: indexNode, radicand });
    }

    if (name === "left") {
      return this.parseLeftRightGroup();
    }

    if (name === "sum") {
      return this.createNode("sum-operator", {
        lower: null,
        upper: null,
        primes: 0
      });
    }

    if (name === "int") {
      return this.createNode("integral-operator", {
        lower: null,
        upper: null,
        primes: 0
      });
    }

    if (
      [
        "mathrm",
        "mathbf",
        "mathbb",
        "mathcal",
        "operatorname",
        "operatorname*",
        "text",
        "overline",
        "hat",
        "bar",
        "vec"
      ].includes(name)
    ) {
      const body = this.parseRequiredGroup(name);
      return this.createNode("styled", { style: name, body });
    }

    return this.createNode("symbol", { value: name, command: true });
  }

  parseRequiredGroup(label) {
    const token = this.peek();
    if (!token) {
      throw new Error(`Expected ${label}.`);
    }

    if (token.type === "symbol" && token.value === "{") {
      return this.parseBraceGroup();
    }

    return this.parsePrimary(() => false);
  }

  parseBraceGroup() {
    this.expectSymbol("{");
    const body = this.parseRelation((token) => token.type === "symbol" && token.value === "}");
    this.expectSymbol("}");
    return this.createNode("group", {
      open: "{",
      close: "}",
      body,
      transparent: true
    });
  }

  parseDelimitedGroup(open, close) {
    this.expectSymbol(open);
    const body = this.parseRelation((token) => token.type === "symbol" && token.value === close);
    this.expectSymbol(close);
    return this.createNode("group", {
      open,
      close,
      body,
      transparent: false
    });
  }

  parseAbsolute() {
    this.expectSymbol("|");
    const body = this.parseRelation((token) => token.type === "symbol" && token.value === "|");
    this.expectSymbol("|");
    return this.createNode("absolute", { body });
  }

  parseCallArgument() {
    const token = this.peek();
    if (!token) {
      throw new Error("Expected a function argument.");
    }

    if (token.type === "symbol" && token.value === "(") {
      return this.parseDelimitedGroup("(", ")");
    }

    if (token.type === "symbol" && token.value === "[") {
      return this.parseDelimitedGroup("[", "]");
    }

    if (token.type === "command" && token.value === "left") {
      return this.parseLeftRightGroup();
    }

    return this.parsePrimary(() => false);
  }

  parseLeftRightGroup() {
    const openToken = this.consumeDelimiterToken("opening delimiter after \\left");
    const open = tokenToDelimiter(openToken);
    const body = this.parseRelation((token) => token.type === "command" && token.value === "right");
    if (!this.matchCommand("right")) {
      throw new Error("Missing \\right for a \\left group.");
    }
    const closeToken = this.consumeDelimiterToken("closing delimiter after \\right");
    const close = tokenToDelimiter(closeToken);
    return this.createNode("group", {
      open,
      close,
      body,
      transparent: false,
      stretchy: true
    });
  }

  consumeDelimiterToken(label) {
    const token = this.peek();
    if (!token) {
      throw new Error(`Expected ${label}.`);
    }
    return this.consume();
  }

  parseScriptArgument() {
    const token = this.peek();
    if (!token) {
      throw new Error("Expected a script argument.");
    }

    if (token.type === "symbol" && token.value === "{") {
      return this.parseBraceGroup();
    }

    return this.parsePrimary(() => false);
  }

  expectSymbol(value) {
    const token = this.peek();
    if (!token || token.type !== "symbol" || token.value !== value) {
      throw new Error(`Expected ${value}.`);
    }
    return this.consume();
  }
}

function composeProductNode(parser, factors, operators) {
  if (factors.length === 1) {
    return factors[0];
  }

  const head = factors[0];
  if (head.type === "sum-operator" && factors.length >= 2) {
    return parser.createNode("summation", {
      lower: head.lower || null,
      upper: head.upper || null,
      primes: head.primes || 0,
      body: factors.length === 2
        ? factors[1]
        : parser.createNode("product", {
            factors: factors.slice(1),
            operators: operators.slice(1)
          })
    });
  }

  if (head.type === "integral-operator" && factors.length >= 2) {
    return parser.createNode("integral", {
      lower: head.lower || null,
      upper: head.upper || null,
      primes: head.primes || 0,
      body: factors.length === 2
        ? factors[1]
        : parser.createNode("product", {
            factors: factors.slice(1),
            operators: operators.slice(1)
          })
    });
  }

  return parser.createNode("product", { factors, operators });
}

function applyScript(parser, node, slot, scriptValue) {
  if (node.type === "sum-operator" || node.type === "integral-operator") {
    node[slot === "subscript" ? "lower" : "upper"] = scriptValue;
    return node;
  }

  if (node.type === "scripted") {
    node[slot] = scriptValue;
    return node;
  }

  return parser.createNode("scripted", {
    base: node,
    subscript: slot === "subscript" ? scriptValue : null,
    superscript: slot === "superscript" ? scriptValue : null,
    primes: 0
  });
}

function applyPrime(parser, node) {
  if (node.type === "sum-operator" || node.type === "integral-operator") {
    node.primes = (node.primes || 0) + 1;
    return node;
  }

  if (node.type === "scripted") {
    node.primes = (node.primes || 0) + 1;
    return node;
  }

  return parser.createNode("scripted", {
    base: node,
    subscript: null,
    superscript: null,
    primes: 1
  });
}

function canStartImplicitFactor(token) {
  if (!token) {
    return false;
  }
  if (token.type === "number" || token.type === "identifier") {
    return true;
  }
  if (token.type === "symbol") {
    return ["{", "(", "[", "|"].includes(token.value);
  }
  if (token.type === "command") {
    return !RELATION_COMMANDS.has(token.value) && !ADDITIVE_COMMANDS.has(token.value) && token.value !== "right";
  }
  return false;
}

function canStartCallArgument(token) {
  if (!token) {
    return false;
  }
  return (
    (token.type === "symbol" && (token.value === "(" || token.value === "[")) ||
    (token.type === "command" && token.value === "left")
  );
}

function isCallableNode(node) {
  return ["symbol", "scripted", "styled", "call"].includes(node.type);
}

function isRelationToken(token) {
  return Boolean(
    token &&
    (
      (token.type === "symbol" && token.value === "=") ||
      (token.type === "command" && RELATION_COMMANDS.has(token.value))
    )
  );
}

function isAdditiveToken(token) {
  return Boolean(
    token &&
    (
      (token.type === "symbol" && (token.value === "+" || token.value === "-")) ||
      (token.type === "command" && ADDITIVE_COMMANDS.has(token.value))
    )
  );
}

function isExplicitMultiplyToken(token) {
  return Boolean(
    token &&
    (
      (token.type === "symbol" && (token.value === "*" || token.value === "/")) ||
      (token.type === "command" && MULTIPLY_COMMANDS.has(token.value))
    )
  );
}

function tokenValue(token) {
  return token.type === "command" ? token.value : token.value;
}

function tokenToText(token) {
  if (!token) {
    return "end of input";
  }
  return token.type === "command" ? `\\${token.value}` : token.value;
}

function tokenToDelimiter(token) {
  if (token.type === "symbol") {
    return token.value;
  }
  if (token.type === "command") {
    const map = {
      lbrace: "\\{",
      rbrace: "\\}",
      langle: "\\langle",
      rangle: "\\rangle",
      lvert: "|",
      rvert: "|",
      ".": "."
    };
    return map[token.value] || `\\${token.value}`;
  }
  return token.value;
}

function toBareText(node) {
  if (!node) {
    return "";
  }

  switch (node.type) {
    case "number":
      return node.value;
    case "symbol":
      return node.command ? node.value : node.value;
    case "fraction":
      return `${toBareText(node.numerator)}/${toBareText(node.denominator)}`;
    case "sqrt":
      return `sqrt(${toBareText(node.radicand)})`;
    case "group":
      return node.transparent ? toBareText(node.body) : `${node.open}${toBareText(node.body)}${node.close}`;
    case "absolute":
      return `|${toBareText(node.body)}|`;
    case "styled":
      return toBareText(node.body);
    case "scripted": {
      let text = toBareText(node.base);
      if (node.subscript) {
        text += `_${toBareText(node.subscript)}`;
      }
      if (node.superscript) {
        text += `^${toBareText(node.superscript)}`;
      }
      if (node.primes) {
        text += "'".repeat(node.primes);
      }
      return text;
    }
    case "call":
      return `${toBareText(node.callee)}${(node.args || []).map((arg) => toBareText(arg)).join("")}`;
    case "sum-operator":
    case "summation":
      return `sum ${toBareText(node.body || null)}`.trim();
    case "integral-operator":
    case "integral":
      return `int ${toBareText(node.body || null)}`.trim();
    case "product":
      return (node.factors || []).map((factor) => toBareText(factor)).join(" ");
    case "additive": {
      let text = toBareText(node.terms[0]);
      for (let index = 1; index < node.terms.length; index += 1) {
        text += ` ${node.operators[index - 1]} ${toBareText(node.terms[index])}`;
      }
      return text;
    }
    case "relation":
      return `${toBareText(node.left)} ${node.op} ${toBareText(node.right)}`;
    case "relation_chain":
      return (node.sides || []).map((side) => toBareText(side)).join(" ");
    case "unary":
      return `${node.operator}${toBareText(node.operand)}`;
    default:
      return "";
  }
}

function collapseWhitespace(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalizeBareKey(text) {
  return collapseWhitespace(text)
    .toLowerCase()
    .replace(/[{}]/g, "")
    .replace(/^\((.*)\)$/, "$1");
}

function truncate(text, maxLength) {
  const value = String(text || "");
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}...`;
}

function sentenceCase(text) {
  if (!text) {
    return "";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}
