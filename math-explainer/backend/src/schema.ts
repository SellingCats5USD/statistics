import { z } from "zod";
import { DOMAIN_VALUES, ROLE_VALUES, type EquationDomain, type ExplainRequest, type ExplainRequestBody } from "./types";

const trimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength);

export const explainRequestSchema = z.object({
  selected_text: trimmedString(8000).optional().default(""),
  guessed_latex: trimmedString(8000).optional(),
  surrounding_text: trimmedString(12000).optional().default(""),
  page_title: trimmedString(500).optional().default(""),
  page_url: trimmedString(2000).optional().default(""),
  page_snapshot_data_url: trimmedString(4_000_000).optional().default(""),
  audience: trimmedString(100).optional().default("undergraduate"),
  difficulty: trimmedString(100).optional().default("standard"),
  domain_hint: trimmedString(100).optional().default("general")
}).superRefine((value, context) => {
  if (!value.selected_text.trim() && !value.page_snapshot_data_url.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide selected_text or page_snapshot_data_url."
    });
  }
});

const roleSchema = z.enum(ROLE_VALUES);
const domainSchema = z.enum(DOMAIN_VALUES);

export const equationLegendEntrySchema = z.object({
  role: roleSchema,
  label: trimmedString(120).min(1),
  color: trimmedString(32).min(1),
  meaning: trimmedString(240).min(1)
});

export const equationHighlightSchema = z.object({
  label: trimmedString(120).min(1),
  latex: trimmedString(500).min(1),
  role: roleSchema,
  explanation: trimmedString(240).min(1)
});

export const equationCardSchema = z.object({
  version: z.literal("equation-card/v1"),
  title: trimmedString(160).min(1),
  domain: domainSchema,
  displayLatex: trimmedString(12000).min(1),
  summary: trimmedString(240).min(1),
  intuition: trimmedString(240).min(1),
  legend: z.array(equationLegendEntrySchema).min(3).max(6),
  highlights: z.array(equationHighlightSchema).min(2).max(6),
  walkthrough: z.array(trimmedString(240).min(1)).min(2).max(6),
  notes: z.array(trimmedString(240).min(1)).max(6).optional()
});

export function normalizeExplainRequest(input: ExplainRequestBody): ExplainRequest {
  const parsed = explainRequestSchema.parse(input);

  return {
    ...parsed,
    guessed_latex: parsed.guessed_latex || parsed.selected_text,
    page_snapshot_data_url: parsed.page_snapshot_data_url,
    domain: normalizeDomainHint(parsed.domain_hint)
  };
}

export function normalizeDomainHint(value: string): EquationDomain {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return "general";
  }

  if (normalized === "ml" || normalized.includes("machine learning")) {
    return "ml";
  }
  if (normalized === "signals" || normalized.includes("signal") || normalized.includes("fourier")) {
    return "signals";
  }
  if (normalized === "calculus" || normalized.includes("integral") || normalized.includes("derivative")) {
    return "calculus";
  }

  return "general";
}
