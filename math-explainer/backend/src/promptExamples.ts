import type { EquationCard, EquationDomain, EquationLegendEntry, EquationRole, EquationStorySpan } from "./types";

const ROLE_COLORS: Record<EquationRole, string> = {
  definition: "#6a00ff",
  quantity: "#0057ff",
  dataset: "#00a35c",
  index: "#c99500",
  operator: "#ff4d1a",
  normalizer: "#d633ff",
  contrast: "#e11d48",
  "positive-term": "#ff9f0a",
  "negative-term": "#00a6b2",
  group: "#4f5d75"
};

export const PROMPT_VERSION = "backend-prompt-2026-03-11-v5";

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
    selfDescriptiveSpans: [
      textStory("Read this as "),
      textStory("averaging ", "normalizer"),
      latexStory("\\frac{1}{n}", "normalizer"),
      textStory(" the indexed values "),
      latexStory("x_i", "quantity"),
      textStory(" across the running sum "),
      latexStory("\\sum_i", "operator"),
      textStory(".")
    ],
    story: [
      textStory("Take "),
      textStory("the average factor ", "normalizer"),
      latexStory("\\frac{1}{n}", "normalizer"),
      textStory(", "),
      textStory("add the indexed values ", "operator"),
      latexStory("\\sum_i", "operator"),
      textStory(", and keep each "),
      textStory("value term ", "quantity"),
      latexStory("x_i", "quantity"),
      textStory(" aligned with the running "),
      textStory("index ", "index"),
      latexStory("i", "index"),
      textStory(".")
    ],
    summarySpans: [
      textStory("This computes the "),
      textStory("average ", "normalizer"),
      textStory("of the "),
      latexStory("x_i", "quantity"),
      textStory(" terms gathered by "),
      latexStory("\\sum_i", "operator"),
      textStory(".")
    ],
    summary: "This expression computes the average of the values x_i over the indexed items.",
    intuitionSpans: [
      textStory("Add the "),
      latexStory("x_i", "quantity"),
      textStory(" values with "),
      latexStory("\\sum_i", "operator"),
      textStory(" and scale by "),
      latexStory("\\frac{1}{n}", "normalizer"),
      textStory(" so the total becomes a mean.")
    ],
    intuition: "Add all the x_i values together and divide by how many items there are.",
    legend: [
      buildLegend("normalizer", "Divide by n", "This rescales the total sum into an average.", "\\frac{1}{n}"),
      buildLegend("operator", "Summation", "This adds the terms over the running index \\(i\\).", "\\sum_i"),
      buildLegend("quantity", "Value term", "This is the quantity being averaged.", "x_i"),
      buildLegend("index", "Running index", "This marks which item contributes to the sum.", "i")
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
    selfDescriptiveSpans: [
      textStory("To recover the "),
      textStory("Fourier coefficient ", "definition"),
      latexStory("X_k", "definition"),
      textStory(", average "),
      latexStory("\\frac{1}{N}", "normalizer"),
      textStory(" the "),
      textStory("phase-rotated samples ", "operator"),
      latexStory("x_n e^{i 2\\pi k n / N}", "operator"),
      textStory(" as "),
      latexStory("n", "index"),
      textStory(" runs through the signal.")
    ],
    story: [
      textStory("To find "),
      textStory("the coefficient ", "definition"),
      latexStory("X_k", "definition"),
      textStory(", "),
      textStory("average ", "normalizer"),
      latexStory("\\frac{1}{N}", "normalizer"),
      textStory(" the "),
      textStory("rotated sample contributions ", "operator"),
      latexStory("e^{i 2\\pi k n / N}", "operator"),
      textStory(" from each "),
      textStory("signal sample ", "quantity"),
      latexStory("x_n", "quantity"),
      textStory(" as the "),
      textStory("sample index ", "index"),
      latexStory("n", "index"),
      textStory(" runs.")
    ],
    summarySpans: [
      textStory("This computes the "),
      textStory("Fourier coefficient ", "definition"),
      latexStory("X_k", "definition"),
      textStory(" by averaging "),
      latexStory("x_n", "quantity"),
      textStory(" after the "),
      latexStory("e^{i 2\\pi k n / N}", "operator"),
      textStory(" rotation.")
    ],
    summary: "This computes how much of frequency k is present in the signal.",
    intuitionSpans: [
      textStory("Rotate each "),
      latexStory("x_n", "quantity"),
      textStory(" by "),
      latexStory("e^{i 2\\pi k n / N}", "operator"),
      textStory(", add the results, and scale by "),
      latexStory("\\frac{1}{N}", "normalizer"),
      textStory(".")
    ],
    intuition: "Rotate each sample at frequency k, add the rotated samples, and average the result.",
    legend: [
      buildLegend("definition", "Coefficient", "This is the Fourier coefficient for the chosen frequency \\(k\\).", "X_k"),
      buildLegend("normalizer", "Average factor", "This divides by \\(N\\) so the total has the scale of an average.", "\\frac{1}{N}"),
      buildLegend("operator", "Rotation-and-sum", "This sweeps across the signal and applies the complex phase kernel.", "e^{i 2\\pi k n / N}"),
      buildLegend("quantity", "Signal sample", "This is the \\(n\\)th sample from the input signal.", "x_n"),
      buildLegend("index", "Loop index", "This tracks which sample \\(n\\) is currently contributing.", "n")
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
    selfDescriptiveSpans: [
      textStory("This "),
      textStory("contrast ", "definition"),
      latexStory("\\Delta \\mu", "definition"),
      textStory(" takes the "),
      textStory("safe-set mean ", "positive-term"),
      latexStory("\\frac{1}{|D_{safe}|}\\sum_{x \\in D_{safe}} a(x)", "positive-term"),
      textStory(" and subtracts the "),
      textStory("harmful-set mean ", "negative-term"),
      latexStory("\\frac{1}{|D_{harm}|}\\sum_{x \\in D_{harm}} a(x)", "negative-term"),
      textStory(".")
    ],
    story: [
      textStory("Define the "),
      textStory("contrast value ", "definition"),
      latexStory("\\Delta \\mu", "definition"),
      textStory(" by taking the "),
      textStory("safe-set mean ", "positive-term"),
      latexStory("\\frac{1}{|D_{safe}|}\\sum_{x \\in D_{safe}} a(x)", "positive-term"),
      textStory(" and subtracting the "),
      textStory("harmful-set mean ", "negative-term"),
      latexStory("\\frac{1}{|D_{harm}|}\\sum_{x \\in D_{harm}} a(x)", "negative-term"),
      textStory(", with the "),
      textStory("dataset labels ", "dataset"),
      latexStory("D_{safe}, D_{harm}", "dataset"),
      textStory(" determining which examples enter each average.")
    ],
    summarySpans: [
      textStory("This measures the "),
      textStory("difference ", "definition"),
      textStory("between the "),
      textStory("safe-set mean ", "positive-term"),
      latexStory("\\frac{1}{|D_{safe}|}\\sum_{x \\in D_{safe}} a(x)", "positive-term"),
      textStory(" and the "),
      textStory("harmful-set mean ", "negative-term"),
      latexStory("\\frac{1}{|D_{harm}|}\\sum_{x \\in D_{harm}} a(x)", "negative-term"),
      textStory(".")
    ],
    summary: "This computes the difference between the average activation on the safe set and the average activation on the harmful set.",
    intuitionSpans: [
      textStory("Average "),
      latexStory("a(x)", "quantity"),
      textStory(" over "),
      latexStory("D_{safe}", "dataset"),
      textStory(" and "),
      latexStory("D_{harm}", "dataset"),
      textStory(", then subtract the "),
      textStory("harmful mean ", "negative-term"),
      textStory("from the "),
      textStory("safe mean", "positive-term"),
      textStory(".")
    ],
    intuition: "Average the activation over each group, then subtract the harmful-group average from the safe-group average.",
    legend: [
      buildLegend("definition", "Contrast value", "This is the final difference between the two group means.", "\\Delta \\mu"),
      buildLegend("positive-term", "Safe-group mean", "This is the average activation over the safe examples.", "\\frac{1}{|D_{safe}|}\\sum_{x \\in D_{safe}} a(x)"),
      buildLegend("negative-term", "Harmful-group mean", "This is the average activation over the harmful examples.", "\\frac{1}{|D_{harm}|}\\sum_{x \\in D_{harm}} a(x)"),
      buildLegend("dataset", "Group membership", "These sets decide which examples belong to each average.", "D_{safe}, D_{harm}")
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

const CALCULUS_CONTOUR_EXAMPLE: PromptStyleExample = {
  id: "calculus_contour_derivative",
  domains: ["calculus"],
  takeaways: [
    "For contour and limit formulas, separate the derivative being recovered, the shrinking-process limit, the normalization factor, and the contour integral operator.",
    "Prefer domain-aware labels like contour integral, shrinking loop, or area normalization over generic labels like target quantity."
  ],
  requestExample: {
    selected_text: "f'(a) = \\lim_{\\gamma \\to a} \\frac{i}{2A(\\gamma)} \\oint_{\\gamma} f(z) \\, d\\bar z",
    guessed_latex: "f'(a) = \\lim_{\\gamma \\to a} \\frac{i}{2A(\\gamma)} \\oint_{\\gamma} f(z) \\, d\\bar z",
    surrounding_text: "The derivative is recovered from a normalized contour integral as the loop shrinks to the point.",
    page_title: "Complex derivative from contour averages",
    domain_hint: "calculus"
  },
  outputExample: {
    version: "equation-card/v1",
    title: "Derivative from shrinking contour integrals",
    domain: "calculus",
    displayLatex:
      String.raw`\[\class{role-definition}{f'(a)}=\class{role-operator}{\lim_{\gamma \to a}}\class{role-normalizer}{\frac{i}{2A(\gamma)}}\class{role-operator}{\oint_{\gamma}}\class{role-quantity}{f(z)\,d\bar z}\]`,
    selfDescriptiveSpans: [
      textStory("This recovers the "),
      textStory("derivative ", "definition"),
      latexStory("f'(a)", "definition"),
      textStory(" as a "),
      textStory("shrinking-loop limit ", "operator"),
      latexStory("\\lim_{\\gamma \\to a}", "operator"),
      textStory(" of a "),
      textStory("normalized contour integral ", "normalizer"),
      latexStory("\\frac{i}{2A(\\gamma)}\\oint_{\\gamma} f(z)\\,d\\bar z", "normalizer"),
      textStory(".")
    ],
    story: [
      textStory("Recover "),
      latexStory("f'(a)", "definition"),
      textStory(" by taking a "),
      textStory("shrinking-loop limit ", "operator"),
      latexStory("\\lim_{\\gamma \\to a}", "operator"),
      textStory(" of the "),
      textStory("normalized contour integral ", "normalizer"),
      latexStory("\\frac{i}{2A(\\gamma)}\\oint_{\\gamma} f(z)\\,d\\bar z", "normalizer"),
      textStory(".")
    ],
    summarySpans: [
      textStory("This expresses "),
      latexStory("f'(a)", "definition"),
      textStory(" as the limit of a "),
      textStory("contour integral ", "operator"),
      latexStory("\\oint_{\\gamma} f(z)\\,d\\bar z", "operator"),
      textStory(" scaled by "),
      latexStory("\\frac{i}{2A(\\gamma)}", "normalizer"),
      textStory(".")
    ],
    summary: "This writes the derivative at a as a limit of normalized contour integrals around loops shrinking to a.",
    intuitionSpans: [
      textStory("Average the local behavior through the "),
      textStory("contour integral ", "operator"),
      latexStory("\\oint_{\\gamma} f(z)\\,d\\bar z", "operator"),
      textStory(", normalize by "),
      latexStory("\\frac{i}{2A(\\gamma)}", "normalizer"),
      textStory(", and let the loop collapse until the result settles to "),
      latexStory("f'(a)", "definition"),
      textStory(".")
    ],
    intuition: "Take a normalized contour average around smaller and smaller loops until it settles to the derivative at the point.",
    legend: [
      buildLegend("definition", "Derivative at the point", "This is the derivative being recovered at \\(a\\).", "f'(a)"),
      buildLegend("operator", "Shrinking contour process", "These operators say to integrate around the loop \\(\\gamma\\) and then let that loop collapse to the point.", "\\lim_{\\gamma \\to a}, \\oint_{\\gamma}"),
      buildLegend("normalizer", "Area normalization", "This rescales the contour integral by the loop area term.", "\\frac{i}{2A(\\gamma)}"),
      buildLegend("quantity", "Integrated quantity", "This is the local complex quantity carried around the contour.", "f(z)\\,d\\bar z")
    ],
    highlights: [
      buildHighlight("Recovered derivative", "f'(a)", "definition", "This is the derivative value the formula computes."),
      buildHighlight("Shrinking-loop limit", "\\lim_{\\gamma \\to a}", "operator", "This sends the contour toward the point \\(a\\)."),
      buildHighlight("Contour integral", "\\oint_{\\gamma} f(z)\\,d\\bar z", "operator", "This accumulates the complex quantity around the loop."),
      buildHighlight("Normalization", "\\frac{i}{2A(\\gamma)}", "normalizer", "This corrects the contour integral by the loop area scale.")
    ],
    walkthrough: [
      "Start with a closed contour gamma around the point a.",
      "Integrate the complex quantity f(z) d\\bar z around that contour.",
      "Normalize by the loop-area factor i / 2A(gamma).",
      "Shrink the contour toward a and take the limit to obtain f'(a)."
    ],
    notes: [
      "This example uses a complex-analysis reading where A(gamma) denotes the enclosed area of the contour."
    ]
  }
};

const PROMPT_STYLE_EXAMPLES: PromptStyleExample[] = [
  SHARED_SUM_EXAMPLE,
  SIGNALS_DFT_EXAMPLE,
  ML_CONTRAST_EXAMPLE,
  CALCULUS_CONTOUR_EXAMPLE
];

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
    "For contour or limit formulas, prefer labels like derivative, shrinking limit, contour integral, or normalization over generic chunk names.",
    "Use group only when a visual wrapper like parentheses or absolute value contributes real meaning."
  ]
};

export function getDomainGuidance(domain: EquationDomain): string[] {
  return DOMAIN_GUIDANCE[domain];
}

export function getPromptExamples(domain: EquationDomain): PromptStyleExample[] {
  return PROMPT_STYLE_EXAMPLES.filter((example) => example.domains.includes(domain) || example.id === "shared_sample_mean");
}

function buildLegend(role: EquationRole, label: string, meaning: string, latex?: string): EquationLegendEntry {
  return {
    role,
    label,
    color: ROLE_COLORS[role],
    meaning,
    latex: latex || ""
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

function textStory(text: string, role?: EquationRole): EquationStorySpan {
  return {
    text,
    latex: "",
    role: role ?? ""
  };
}

function latexStory(latex: string, role?: EquationRole): EquationStorySpan {
  return {
    text: "",
    latex,
    role: role ?? ""
  };
}
