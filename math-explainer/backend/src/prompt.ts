import type { ExplainRequest, ParserGroundingSummary } from "./types";

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
    "Use \\class{role-name}{...} wrappers inside displayLatex.",
    "Color semantic chunks, not isolated symbols, unless the symbol itself is the chunk.",
    `Allowed roles: ${ROLE_GUIDE}.`,
    "legend must contain 3 to 6 entries and only roles used in displayLatex.",
    "highlights must contain 2 to 6 visually meaningful chunks.",
    "walkthrough must contain 2 to 6 short steps.",
    "If notation is ambiguous, stay conservative and explain uncertainty in notes instead of inventing facts."
  ].join(" ");
}

export function buildExplainInput(request: ExplainRequest, grounding: ParserGroundingSummary | null): string {
  const payload = {
    task: "Explain the selected equation for a browser side-panel renderer.",
    request: {
      selected_text: request.selected_text,
      guessed_latex: request.guessed_latex,
      surrounding_text: request.surrounding_text,
      page_title: request.page_title,
      page_url: request.page_url,
      audience: request.audience,
      difficulty: request.difficulty,
      domain_hint: request.domain_hint,
      normalized_domain: request.domain
    },
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
    output_contract: {
      version: "equation-card/v1",
      required_keys: [
        "version",
        "title",
        "domain",
        "displayLatex",
        "summary",
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
