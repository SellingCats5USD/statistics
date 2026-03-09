import type { EquationCard, EquationDomain, EquationRole } from "./types";

const ROLE_COLORS: Record<EquationRole, string> = {
  definition: "#7f4126",
  quantity: "#2b5579",
  dataset: "#0f766e",
  index: "#8a4fff",
  operator: "#c2410c",
  normalizer: "#a16207",
  contrast: "#b91c1c",
  "positive-term": "#b45309",
  "negative-term": "#0f766e",
  group: "#64748b"
};

export const PROMPT_VERSION = "backend-prompt-2026-03-09-v2";

export interface PromptStyleExample {
  id: string;
  domains: EquationDomain[];
  takeaways: string[];
  requestExample: {
    selected_text: string;
    guessed_latex: string;
    surrounding_text: string;
    page_title: string;
    domain_hint: string;
  };
  outputExample: EquationCard;
}

const SHARED_SUM_EXAMPLE: PromptStyleExample = {
  id: "shared_sample_mean",
  domains: ["general", "ml", "signals", "calculus"],
  takeaways: [
    "If there is no explicit left-hand side, do not invent one.",
    "Split an average into normalizer, operator, quantity, and index roles instead of wrapping the whole expression as one definition chunk."
  ],
  requestExample: {
    selected_text: "\\frac{1}{n}\\sum_i x_i",
    guessed_latex: "\\frac{1}{n}\\sum_i x_i",
    surrounding_text: "We define the mean feature activation as the average over samples.",
    page_title: "Mean feature activation",
    domain_hint: "machine learning"
  },
  outputExample: {
    version: "equation-card/v1",
    title: "Sample mean / average",
    domain: "ml",
    displayLatex: String.raw`\[\class{role-normalizer}{\frac{1}{n}}\class{role-operator}{\sum_{\class{role-index}{i}}}\class{role-quantity}{x_i}\]`,
    summary: "This expression computes the average of the values x_i over the indexed items.",
    intuition: "Add all the x_i values together and divide by how many items there are.",
    legend: [
      buildLegend("normalizer", "Divide by n", "This rescales the total sum into an average."),
      buildLegend("operator", "Summation", "This adds the terms over the running index i."),
      buildLegend("quantity", "Value term", "This is the quantity being averaged."),
      buildLegend("index", "Running index", "This marks which item contributes to the sum.")
    ],
    highlights: [
      buildHighlight("Average factor", "\\frac{1}{n}", "normalizer", "This turns the total into a mean."),
      buildHighlight("Sum over items", "\\sum_i", "operator", "This collects all indexed terms."),
      buildHighlight("One item value", "x_i", "quantity", "This is the ith contribution to the average.")
    ],
    walkthrough: [
      "Start with the indexed values x_i.",
      "Use the summation to add all of those values together.",
      "Track which value is being added with the index i.",
      "Multiply by 1/n so the result is an average instead of a raw total."
    ],
    notes: [
      "The notation leaves the sum bounds implicit, so the explanation stays conservative about the exact index range."
    ]
  }
};

const SIGNALS_DFT_EXAMPLE: PromptStyleExample = {
  id: "signals_dft",
  domains: ["signals"],
  takeaways: [
    "For DFT-style formulas, keep the coefficient being defined separate from the averaging factor, the running sum, the sample term, and the complex kernel.",
    "Treat the exponential phase factor as an operator-like rotation kernel instead of a generic quantity."
  ],
  requestExample: {
    selected_text: "X_k = \\frac{1}{N}\\sum_{n=0}^{N-1} x_n e^{i 2\\pi k n / N}",
    guessed_latex: "X_k = \\frac{1}{N}\\sum_{n=0}^{N-1} x_n e^{i 2\\pi k n / N}",
    surrounding_text: "This is the discrete Fourier transform coefficient at frequency k.",
    page_title: "Discrete Fourier transform",
    domain_hint: "signals"
  },
  outputExample: {
    version: "equation-card/v1",
    title: "Discrete Fourier coefficient",
    domain: "signals",
    displayLatex:
      String.raw`\[\class{role-definition}{X_k}=\class{role-normalizer}{\frac{1}{N}}\class{role-operator}{\sum_{\class{role-index}{n}=0}^{N-1}}\class{role-quantity}{x_n}\class{role-operator}{e^{i 2\pi k n / N}}\]`,
    summary: "This computes how much of frequency k is present in the signal.",
    intuition: "Rotate each sample at frequency k, add the rotated samples, and average the result.",
    legend: [
      buildLegend("definition", "Coefficient", "This is the Fourier coefficient for the chosen frequency k."),
      buildLegend("normalizer", "Average factor", "This divides by N so the total has the scale of an average."),
      buildLegend("operator", "Rotation-and-sum", "This sweeps across the signal and applies the complex phase kernel."),
      buildLegend("quantity", "Signal sample", "This is the nth sample from the input signal."),
      buildLegend("index", "Loop index", "This tracks which sample n is currently contributing.")
    ],
    highlights: [
      buildHighlight("Coefficient being defined", "X_k", "definition", "This is the answer for the chosen frequency index k."),
      buildHighlight("Normalization", "\\frac{1}{N}", "normalizer", "This rescales the accumulated total by the signal length."),
      buildHighlight("Running sum", "\\sum_{n=0}^{N-1}", "operator", "This adds the contribution from every sample index n."),
      buildHighlight("Sample term", "x_n", "quantity", "This is the nth input sample before the complex rotation.")
    ],
    walkthrough: [
      "Choose the frequency index k you want to measure.",
      "For each sample index n, take the sample x_n and rotate it by the matching complex phase.",
      "Add all of those rotated contributions together.",
      "Divide by N so the result is an average-sized Fourier coefficient."
    ],
    notes: [
      "This uses the common signal-processing DFT convention with 1/N as the normalization factor."
    ]
  }
};

const ML_CONTRAST_EXAMPLE: PromptStyleExample = {
  id: "ml_mean_difference",
  domains: ["ml"],
  takeaways: [
    "For contrastive ML equations, use positive-term and negative-term when two averaged groups are being compared.",
    "Highlight datasets separately from the averaged quantity when group membership matters."
  ],
  requestExample: {
    selected_text: "\\Delta\\mu = \\frac{1}{|D_{safe}|}\\sum_{x \\in D_{safe}} a(x) - \\frac{1}{|D_{harm}|}\\sum_{x \\in D_{harm}} a(x)",
    guessed_latex: "\\Delta\\mu = \\frac{1}{|D_{safe}|}\\sum_{x \\in D_{safe}} a(x) - \\frac{1}{|D_{harm}|}\\sum_{x \\in D_{harm}} a(x)",
    surrounding_text: "We subtract the harmful mean activation from the safe mean activation.",
    page_title: "Mean activation contrast",
    domain_hint: "machine learning"
  },
  outputExample: {
    version: "equation-card/v1",
    title: "Mean activation contrast",
    domain: "ml",
    displayLatex:
      String.raw`\[\class{role-definition}{\Delta \mu}=\class{role-positive-term}{\frac{1}{|D_{safe}|}\sum_{x \in \class{role-dataset}{D_{safe}}} a(x)}-\class{role-negative-term}{\frac{1}{|D_{harm}|}\sum_{x \in \class{role-dataset}{D_{harm}}} a(x)}\]`,
    summary: "This computes the difference between the average activation on the safe set and the average activation on the harmful set.",
    intuition: "Average the activation over each group, then subtract the harmful-group average from the safe-group average.",
    legend: [
      buildLegend("definition", "Contrast value", "This is the final difference between the two group means."),
      buildLegend("positive-term", "Safe-group mean", "This is the average activation over the safe examples."),
      buildLegend("negative-term", "Harmful-group mean", "This is the average activation over the harmful examples."),
      buildLegend("dataset", "Group membership", "These sets decide which examples belong to each average.")
    ],
    highlights: [
      buildHighlight("Contrast output", "\\Delta \\mu", "definition", "This is the final mean difference being measured."),
      buildHighlight("Safe-group average", "\\frac{1}{|D_{safe}|}\\sum_{x \\in D_{safe}} a(x)", "positive-term", "This averages the activation across the safe dataset."),
      buildHighlight("Harmful-group average", "\\frac{1}{|D_{harm}|}\\sum_{x \\in D_{harm}} a(x)", "negative-term", "This averages the activation across the harmful dataset.")
    ],
    walkthrough: [
      "Take the activation function a(x) on each example x in the safe set.",
      "Average those activations to get the safe-group mean.",
      "Do the same for the harmful set.",
      "Subtract the harmful mean from the safe mean to get the contrast value."
    ],
    notes: [
      "This example uses a contrastive ML reading where D_safe and D_harm are two labeled subsets of data."
    ]
  }
};

const PROMPT_STYLE_EXAMPLES: PromptStyleExample[] = [SHARED_SUM_EXAMPLE, SIGNALS_DFT_EXAMPLE, ML_CONTRAST_EXAMPLE];

const DOMAIN_GUIDANCE: Record<EquationDomain, string[]> = {
  general: [
    "Prefer concrete structural labels such as quantity, operator, normalizer, or group when the domain is unclear.",
    "Do not invent a named output variable if the expression is only a right-hand-side formula."
  ],
  ml: [
    "Look for averages over datasets, activations, expectations, loss terms, and differences between groups.",
    "When two averaged groups are compared, positive-term and negative-term are usually more useful than one giant definition chunk."
  ],
  signals: [
    "Look for coefficient definitions, normalizers, sample indices, frequency indices, and phase kernels.",
    "In Fourier-style notation, the exponential factor usually behaves like an operator or rotation kernel rather than a plain quantity."
  ],
  calculus: [
    "Look for integrals, derivatives, bounds, and the quantity being accumulated.",
    "Use group only when a visual wrapper like parentheses or absolute value contributes real meaning."
  ]
};

export function getDomainGuidance(domain: EquationDomain): string[] {
  return DOMAIN_GUIDANCE[domain];
}

export function getPromptExamples(domain: EquationDomain): PromptStyleExample[] {
  return PROMPT_STYLE_EXAMPLES.filter((example) => example.domains.includes(domain) || example.id === "shared_sample_mean");
}

function buildLegend(role: EquationRole, label: string, meaning: string) {
  return {
    role,
    label,
    color: ROLE_COLORS[role],
    meaning
  };
}

function buildHighlight(label: string, latex: string, role: EquationRole, explanation: string) {
  return {
    label,
    latex,
    role,
    explanation
  };
}
