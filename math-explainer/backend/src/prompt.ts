import type { ExplainRequest, ParserGroundingSummary } from "./types";
import { getDomainGuidance, getPromptExamples, PROMPT_VERSION } from "./promptExamples";

const ROLE_GUIDE = [
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
].join(", ");

export function buildExplainInstructions(): string {
  return [
    "You generate equation-card/v1 JSON for a math explanation UI.",
    "Return JSON only. Do not include markdown fences or extra prose.",
    "Preserve the user's notation as much as possible.",
    "displayLatex must be MathJax-ready and wrapped in \\[ ... \\].",
    "selfDescriptiveSpans must be a polished, single self-descriptive sentence of 5 to 20 spans that sits directly under the equation and reads naturally to a human.",
    "story must be a short self-descriptive caption made of 4 to 16 spans that can reuse the same semantic colors as the equation.",
    "Treat selfDescriptiveSpans as the primary Stuart-Riffle-style explanatory sentence. story can mirror it more compactly for backward compatibility.",
    "summarySpans and intuitionSpans must each be 3 to 12 short spans that color-code the Plain Reading and Intuition text using the same semantic roles as the equation.",
    "Each story span may contain text or inline latex, and role-colored spans should line up with the main semantic chunks in the equation.",
    "Write selfDescriptiveSpans as elegant explanatory prose, not as a legend dump, debug list, or 'key pieces' scaffold.",
    "Use summary and intuition as compact plain-string fallbacks, but make summarySpans and intuitionSpans the richer explanatory text the UI should display.",
    "Do not dump an entire summary or intuition into one giant colored span. Alternate plain connective text with role-colored semantic chunks.",
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
    "If selected_text is empty and an image or PDF is attached, identify the target equation from the attached material and explain that specific visible equation.",
    "If multiple images are attached, treat the first image as the tight crop of the target equation. Later images, if any, are only zoomed or local-context variants of that same equation.",
    "If the attached image is ambiguous and you cannot confidently identify one equation, say so conservatively in notes instead of switching to a different equation from the page.",
    "Use legend.latex when a legend item points to a specific visual chunk worth showing.",
    "Write legend meanings and highlight explanations so they can include inline MathJax like \\(x_i\\) when helpful.",
    `Allowed roles: ${ROLE_GUIDE}.`,
    "legend must contain 3 to 6 entries and only roles used in displayLatex.",
    "highlights must contain 2 to 6 visually meaningful chunks.",
    "walkthrough must contain 2 to 6 short steps.",
    "If notation is ambiguous, stay conservative and explain uncertainty in notes instead of inventing facts."
  ].join(" ");
}

export function buildExplainInput(request: ExplainRequest, grounding: ParserGroundingSummary | null): string {
  const payload = {
    prompt_version: PROMPT_VERSION,
    task: "Explain the selected equation for a browser side-panel renderer.",
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
      domain_hint: request.domain_hint,
      normalized_domain: request.domain
    },
    domain_guidance: getDomainGuidance(request.domain),
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
    style_examples: getPromptExamples(request.domain),
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
        "walkthrough"
      ],
      optional_keys: ["notes"]
    }
  };

  return JSON.stringify(payload, null, 2);
}
