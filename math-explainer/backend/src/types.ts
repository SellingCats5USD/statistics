export const DOMAIN_VALUES = ["general", "ml", "signals", "calculus"] as const;
export const ROLE_VALUES = [
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
] as const;

export type EquationDomain = (typeof DOMAIN_VALUES)[number];
export type EquationRole = (typeof ROLE_VALUES)[number];

export interface ExplainRequestBody {
  selected_text?: string;
  guessed_latex?: string;
  surrounding_text?: string;
  page_title?: string;
  page_url?: string;
  page_snapshot_data_url?: string;
  page_snapshot_variant_data_urls?: string[];
  audience?: string;
  difficulty?: string;
  domain_hint?: string;
}

export interface ExplainRequest {
  selected_text: string;
  guessed_latex: string;
  surrounding_text: string;
  page_title: string;
  page_url: string;
  page_snapshot_data_url: string;
  page_snapshot_variant_data_urls: string[];
  audience: string;
  difficulty: string;
  domain_hint: string;
  domain: EquationDomain;
}

export interface EquationLegendEntry {
  role: EquationRole;
  label: string;
  color: string;
  meaning: string;
  latex?: string;
}

export interface EquationHighlight {
  label: string;
  latex: string;
  role: EquationRole;
  explanation: string;
}

export interface EquationStorySpan {
  text?: string;
  latex?: string;
  role?: EquationRole;
}

export interface EquationCard {
  version: "equation-card/v1";
  title: string;
  domain: EquationDomain;
  displayLatex: string;
  selfDescriptiveSpans: EquationStorySpan[];
  story: EquationStorySpan[];
  summarySpans: EquationStorySpan[];
  summary: string;
  intuitionSpans: EquationStorySpan[];
  intuition: string;
  legend: EquationLegendEntry[];
  highlights: EquationHighlight[];
  walkthrough: string[];
  notes?: string[];
}

export interface ParserNodeSummary {
  id: string;
  type: string;
  role: string;
  roleLabel: string;
  semanticType: string | null;
  title: string;
  description: string;
  depth: number | null;
  childCount: number;
  latex: string;
}

export interface ParserGroundingSummary {
  version: string;
  input: {
    latex: string;
    domain: EquationDomain;
  };
  stats: {
    tokenCount: number;
    nodeCount: number;
  };
  summaryLines: string[];
  topLevelNodes: ParserNodeSummary[];
  semanticNodes: ParserNodeSummary[];
}
