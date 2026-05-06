const ROLE_VALUES = [
  "definition",
  "quantity",
  "dataset",
  "index",
  "operator",
  "normalizer",
  "contrast",
  "positive-term",
  "negative-term",
  "group"
];

const DOMAIN_VALUES = ["general", "ml", "signals", "calculus"];
const ROLE_GUIDE = ROLE_VALUES.join(", ");

const EQUATION_CARD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "version",
    "title",
    "domain",
    "displayLatex",
    "selfDescriptiveSpans",
    "story",
    "summarySpans",
    "summary",
    "intuitionSpans",
    "intuition",
    "legend",
    "highlights",
    "walkthrough",
    "deepContext",
    "useCases",
    "strategyTips",
    "graphSpec",
    "notes"
  ],
  properties: {
    version: { type: "string", enum: ["equation-card/v1"] },
    title: { type: "string" },
    domain: { type: "string", enum: DOMAIN_VALUES },
    displayLatex: { type: "string" },
    selfDescriptiveSpans: { type: "array", items: { $ref: "#/$defs/span" } },
    story: { type: "array", items: { $ref: "#/$defs/span" } },
    summarySpans: { type: "array", items: { $ref: "#/$defs/span" } },
    summary: { type: "string" },
    intuitionSpans: { type: "array", items: { $ref: "#/$defs/span" } },
    intuition: { type: "string" },
    legend: { type: "array", items: { $ref: "#/$defs/legendEntry" } },
    highlights: { type: "array", items: { $ref: "#/$defs/highlight" } },
    walkthrough: { type: "array", items: { type: "string" } },
    deepContext: { type: "array", items: { $ref: "#/$defs/learningBlock" } },
    useCases: { type: "array", items: { type: "string" } },
    strategyTips: { type: "array", items: { $ref: "#/$defs/learningBlock" } },
    graphSpec: { $ref: "#/$defs/graphSpec" },
    notes: { type: "array", items: { type: "string" } }
  },
  $defs: {
    span: {
      type: "object",
      additionalProperties: false,
      required: ["text", "latex", "role"],
      properties: {
        text: { type: "string" },
        latex: { type: "string" },
        role: { type: "string", enum: [...ROLE_VALUES, ""] }
      }
    },
    legendEntry: {
      type: "object",
      additionalProperties: false,
      required: ["role", "label", "color", "meaning", "latex"],
      properties: {
        role: { type: "string", enum: ROLE_VALUES },
        label: { type: "string" },
        color: { type: "string" },
        meaning: { type: "string" },
        latex: { type: "string" }
      }
    },
    highlight: {
      type: "object",
      additionalProperties: false,
      required: ["label", "latex", "role", "explanation"],
      properties: {
        label: { type: "string" },
        latex: { type: "string" },
        role: { type: "string", enum: ROLE_VALUES },
        explanation: { type: "string" }
      }
    },
    learningBlock: {
      type: "object",
      additionalProperties: false,
      required: ["title", "body", "bullets"],
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        bullets: { type: "array", items: { type: "string" } }
      }
    },
    graphPoint: {
      type: "object",
      additionalProperties: false,
      required: ["x", "y"],
      properties: {
        x: { type: "number" },
        y: { type: "number" }
      }
    },
    graphParameter: {
      type: "object",
      additionalProperties: false,
      required: ["id", "label", "min", "max", "step", "defaultValue", "unit", "meaning", "effect"],
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        min: { type: "number" },
        max: { type: "number" },
        step: { type: "number" },
        defaultValue: { type: "number" },
        unit: { type: "string" },
        meaning: { type: "string" },
        effect: { type: "string", enum: ["scale-x", "scale-y", "scale-both", "shift-x", "shift-y", "none"] }
      }
    },
    graphCurve: {
      type: "object",
      additionalProperties: false,
      required: ["label", "role", "points"],
      properties: {
        label: { type: "string" },
        role: { type: "string", enum: [...ROLE_VALUES, ""] },
        points: { type: "array", items: { $ref: "#/$defs/graphPoint" } }
      }
    },
    graphView: {
      type: "object",
      additionalProperties: false,
      required: ["id", "label", "description", "curves"],
      properties: {
        id: { type: "string" },
        label: { type: "string" },
        description: { type: "string" },
        curves: { type: "array", items: { $ref: "#/$defs/graphCurve" } }
      }
    },
    graphSpec: {
      type: "object",
      additionalProperties: false,
      required: ["available", "title", "description", "domainNote", "xLabel", "yLabel", "parameters", "curves", "views"],
      properties: {
        available: { type: "boolean" },
        title: { type: "string" },
        description: { type: "string" },
        domainNote: { type: "string" },
        xLabel: { type: "string" },
        yLabel: { type: "string" },
        parameters: { type: "array", items: { $ref: "#/$defs/graphParameter" } },
        curves: { type: "array", items: { $ref: "#/$defs/graphCurve" } },
        views: { type: "array", items: { $ref: "#/$defs/graphView" } }
      }
    }
  }
};

async function callOpenAIEquationCard(options) {
  const responseInput = buildResponseInput(options.request, options.grounding);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model,
      instructions: buildExplainInstructions(),
      input: responseInput,
      text: {
        format: {
          type: "json_schema",
          name: "equation_card",
          description: "A color-coded equation explanation card for a browser extension.",
          strict: true,
          schema: EQUATION_CARD_JSON_SCHEMA
        }
      }
    })
  });

  const rawText = await response.text();
  let payload = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch (_error) {
      payload = null;
    }
  }

  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || rawText || `HTTP ${response.status}`;
    throw new Error(`OpenAI request failed: ${detail}`);
  }

  const refusal = readRefusal(payload);
  if (refusal) {
    throw new Error(`OpenAI refused the request: ${refusal}`);
  }

  const outputText = readOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI returned an empty response.");
  }

  try {
    return JSON.parse(outputText);
  } catch (error) {
    throw new Error(`OpenAI did not return parseable equation-card JSON: ${error.message}`);
  }
}

function buildExplainInstructions() {
  return [
    "You generate equation-card/v1 JSON for a math explanation UI.",
    "Return JSON only. Do not include markdown fences or extra prose.",
    "Preserve the user's notation as much as possible.",
    "displayLatex must be MathJax-ready and wrapped in \\[ ... \\].",
    "displayLatex must be one valid TeX display expression, not an array, JSON fragment, markdown block, explanation, or quoted string.",
    "Keep displayLatex compact. Prefer a faithful but shorter equation over a huge reconstruction; stay under about 1800 characters whenever possible.",
    "Use only MathJax-compatible TeX commands. Do not use custom macros, unsupported environments, raw HTML, Unicode styling tricks, or unmatched delimiters.",
    "Every \\class wrapper must have exactly this form: \\class{role-ROLE}{valid math body}. Never leave a \\class body unfinished.",
    "If semantic coloring makes displayLatex hard to keep valid, simplify the coloring and keep the equation renderable.",
    "selfDescriptiveSpans must be a polished, single self-descriptive sentence of 5 to 20 spans that sits directly under the equation and reads naturally to a human.",
    "selfDescriptiveSpans must weave in the motivation: what problem the equation is trying to solve or what tradeoff/process it controls, not just a list of parts.",
    "story must be a short self-descriptive caption made of 4 to 16 spans that can reuse the same semantic colors as the equation.",
    "Treat selfDescriptiveSpans as the primary Stuart-Riffle-style explanatory sentence. story can mirror it more compactly for backward compatibility.",
    "summarySpans and intuitionSpans must each be 3 to 12 short spans that color-code the Plain Reading and Intuition text using the same semantic roles as the equation.",
    "summarySpans and intuitionSpans should also mention the purpose of the equation in plain language before or while unpacking the notation.",
    "Each story span must include text, latex, and role. Use empty strings for unused fields.",
    "Each story span may contain text or inline latex, and role-colored spans should line up with the main semantic chunks in the equation.",
    "Write selfDescriptiveSpans as elegant explanatory prose, not as a legend dump, debug list, or key-pieces scaffold.",
    "Make the explanation self-contained for a mathematically literate reader who may not know the paper-specific context.",
    "Always scan the equation for overloaded or multi-definition notation that a reasonable mathematics student may not know yet. Somewhere in the response, explain the intended meaning in this equation and contrast it with common alternative meanings when useful.",
    "This notation-disambiguation rule is especially important for symbols such as \\times, *, \\cdot, \\oplus, \\otimes, /, |, :, :=, \\sim, \\approx, \\propto, \\in, \\subset, brackets around intervals or groups, angle brackets, superscripts that could mean powers or labels, and domain-specific letters like kernels, measures, policies, groups, fields, rings, or transforms.",
    "For example, if \\times appears between sets or intervals, say it is a Cartesian product in that context: the pair must choose one value from the first set and one from the second. If the same symbol could mean a group operation, vector cross product, or ordinary multiplication elsewhere, mention that briefly when it helps prevent confusion.",
    "Do not waste space defining very standard symbols unless there is a likely ambiguity in context, but do define or disambiguate any notation whose meaning controls the interpretation of the equation.",
    "Prefer operational language like average these terms, rotate the sample, or shrink the contour over bland paraphrases like this denotes or this expresses.",
    "Do not assume the reader already knows why the formula matters; explain what the equation is doing from the notation itself before using surrounding context.",
    "Use summary and intuition as compact plain-string fallbacks, but make summarySpans and intuitionSpans the richer explanatory text the UI should display.",
    "Do not dump an entire summary or intuition into one giant colored span. Alternate plain connective text with role-colored semantic chunks.",
    "Always include legend.latex as a string. Use an empty string when a legend entry does not need a specific visible chunk.",
    "Always include notes as an array, even when it is empty.",
    "Use \\class{role-ROLE}{...} wrappers inside displayLatex, for example \\class{role-definition}{X}.",
    "Color semantic chunks, not isolated symbols, unless the symbol itself is the chunk.",
    "When the equation has several visible structural pieces, prefer at least 3 distinct role-coded chunks instead of coloring only one fragment and leaving the rest neutral.",
    "Do not assign the same role to neighboring chunks when they play clearly different mathematical jobs.",
    "Do not wrap an entire expression as one definition chunk when a better structural split exists.",
    "If the input has no explicit left-hand side, do not invent one just to create a definition role.",
    "For sums and averages, prefer separate chunks for the normalizer, summation operator, index, and term body.",
    "For Fourier-style equations, separate the output coefficient, the 1/N factor, the running sum, the sample term, and the complex kernel when those parts are present.",
    "For contrastive ML equations, use positive-term and negative-term for the two sides of a meaningful difference when helpful.",
    "If the equation is underspecified on its own, use surrounding_text, page_title, and page_url as context clues, but do not hallucinate notation that is not supported.",
    "If selected_text or guessed_latex is provided, prioritize that exact equation over any nearby or related equation from the page context.",
    "If selected_text is empty and an image is attached, identify the target equation from the attached material and explain that specific visible equation.",
    "If the attached image is ambiguous and you cannot confidently identify one equation, say so conservatively in notes instead of switching to a different equation from the page.",
    "Use legend.latex when a legend item points to a specific visual chunk worth showing.",
    "Write legend meanings and highlight explanations so they can include inline MathJax like \\(x_i\\) when helpful.",
    `Allowed roles: ${ROLE_GUIDE}.`,
    "legend must contain 3 to 6 entries and only roles used in displayLatex.",
    "highlights must contain 2 to 6 visually meaningful chunks.",
    "walkthrough must contain 2 to 6 short steps.",
    "walkthrough strings must be plain prose. Do not use $, \\(, \\), \\[, \\], or raw TeX delimiters there; use Unicode symbols or words for tiny notation references.",
    "notes strings must also avoid MathJax delimiters unless absolutely necessary.",
    "Use request.focus_prompt as the user's local question, uncertainty, or desired context. If it is nonempty, aim the explanation toward it without ignoring the equation.",
    "Use request.aid_length to control the length of deepContext and strategyTips. For short/brief, use 1 to 2 blocks with 0 to 1 bullet each. For standard, use 2 to 3 blocks with at most 2 bullets each. For deep/exhaustive, use 3 to 4 blocks with at most 3 bullets each.",
    "deepContext should be clear orientation for a returning learner: why this kind of object is used, what mathematical move is happening, what prerequisite idea matters, and what any ambiguous but important notation means in this setting. Do not call the reader rusty. Do not use vague motivational slogans.",
    "useCases must contain 3 to 6 concrete places this equation pattern appears in the field or adjacent applied work.",
    "strategyTips should be practical problem-solving guidance from a master teacher: how to decide what is fixed versus varying, what to average or condition on, what limiting case to check, what notation to disambiguate before manipulating the equation, and what perturbation would reveal. Do not use the phrase 500-mile view.",
    "When it fits the equation, include one strategyTips block that gives easier starting models, analogies, or limiting cases for the same phenomenon. Connect to familiar forms like linearization, scalar one-dimensional cases, no-noise/no-regularization limits, constant-coefficient ODEs, simple averages before weighted averages, Bernoulli/Gaussian toy models before general distributions, or deep/shallow/asymptotic regimes as appropriate.",
    "Do not force a simpler-model block when it would be misleading. When you include it, make clear what the easier model preserves and what it throws away.",
    "graphSpec should be available only when a qualitative plot is honestly meaningful from the equation and context. If unavailable, set available false and all strings empty with empty parameters, curves, and views.",
    "When graphSpec is available, provide a small qualitative graph, not fabricated empirical data. Use 12 to 40 points per curve, 0 to 6 sliders, and parameter ranges that mirror real-world use in the relevant domain.",
    "For graphSpec.parameters, defaultValue should be a realistic baseline or reference value whenever possible, not merely the midpoint. Put concrete baseline context in meaning, such as water at 20 C: rho about 998 kg/m^3 and sigma about 0.072 N/m, PPO epsilon often about 0.1 to 0.3, beta or temperature baseline 1, or whatever is appropriate to the equation.",
    "Graph sliders are safe transforms only: scale-x for characteristic time/length/rate along the horizontal axis, scale-y for gain/temperature/weight strength, scale-both for simple proportional rescaling, shift-x for threshold/location, shift-y for baseline/offset, or none. Explain the approximation and baseline assumptions in graphSpec.domainNote.",
    "When the relationship is multivariable or easily confused, include 2 to 5 graphSpec.views as named slices or views. Each view must use the same axes and show a different fixed-parameter slice, limiting regime, or baseline comparison that helps interpretation. If views are not helpful, use an empty views array.",
    "Use view labels and descriptions to state the baseline or slice, for example deep water vs shallow water, low vs high regularization, fixed temperature, or different initial conditions.",
    "If notation is ambiguous, stay conservative and explain uncertainty in notes instead of inventing facts."
  ].join(" ");
}

function buildExplainInput(request, grounding) {
  const payload = {
    prompt_version: self.PROMPT_EXAMPLES_API?.PROMPT_VERSION || "extension-prompt-2026-04-29-v1",
    task: "Explain the selected equation for a browser extension renderer.",
    request: {
      selected_text: request.selected_text,
      guessed_latex: request.guessed_latex,
      surrounding_text: request.surrounding_text,
      page_title: request.page_title,
      page_url: request.page_url,
      page_snapshot_present: Boolean(request.page_snapshot_data_url),
      page_snapshot_variant_count: request.page_snapshot_variant_data_urls.length,
      audience: request.audience,
      difficulty: request.difficulty,
      aid_length: request.aid_length,
      focus_prompt: request.focus_prompt,
      domain_hint: request.domain_hint,
      normalized_domain: request.domain
    },
    domain_guidance: self.PROMPT_EXAMPLES_API?.getDomainGuidance?.(request.domain) || [],
    grounding: grounding
      ? {
          parser_version: grounding.version,
          token_count: grounding.stats.tokenCount,
          node_count: grounding.stats.nodeCount,
          summary_lines: grounding.summaryLines,
          top_level_nodes: grounding.topLevelNodes,
          semantic_nodes: grounding.semanticNodes
        }
      : {
          parser_version: null,
          note: "No parser grounding was available. Infer structure conservatively."
        },
    style_examples: self.PROMPT_EXAMPLES_API?.getPromptExamples?.(request.domain) || [],
    output_contract: {
      version: "equation-card/v1",
      required_keys: [
        "version",
        "title",
        "domain",
        "displayLatex",
        "selfDescriptiveSpans",
        "story",
        "summarySpans",
        "summary",
        "intuitionSpans",
        "intuition",
        "legend",
        "highlights",
        "walkthrough",
        "deepContext",
        "useCases",
        "strategyTips",
        "graphSpec",
        "notes"
      ]
    }
  };

  return JSON.stringify(payload, null, 2);
}

function buildResponseInput(request, grounding) {
  const content = [
    {
      type: "input_text",
      text: buildExplainInput(request, grounding)
    }
  ];

  if (request.page_snapshot_data_url) {
    content.push({
      type: "input_image",
      image_url: request.page_snapshot_data_url,
      detail: "high"
    });
  }

  return [
    {
      role: "user",
      content
    }
  ];
}

function readOutputText(response) {
  if (typeof response?.output_text === "string") {
    return response.output_text.trim();
  }

  const fragments = [];
  for (const item of response?.output || []) {
    for (const part of item?.content || []) {
      if (typeof part?.text === "string" && part.text.trim()) {
        fragments.push(part.text.trim());
      }
    }
  }
  return fragments.join("\n").trim();
}

function readRefusal(response) {
  for (const item of response?.output || []) {
    for (const part of item?.content || []) {
      if (typeof part?.refusal === "string" && part.refusal.trim()) {
        return part.refusal.trim();
      }
    }
  }
  return "";
}
