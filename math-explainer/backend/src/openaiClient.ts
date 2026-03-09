import OpenAI from "openai";
import { equationCardSchema } from "./schema";
import { buildExplainInput, buildExplainInstructions } from "./prompt";
import type { EquationCard, ExplainRequest, ParserGroundingSummary } from "./types";

export interface ExplainModelClient {
  explainEquation(input: {
    request: ExplainRequest;
    grounding: ParserGroundingSummary | null;
  }): Promise<EquationCard>;
}

export class OpenAIExplainClient implements ExplainModelClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: { apiKey: string; model: string }) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model;
  }

  async explainEquation(input: {
    request: ExplainRequest;
    grounding: ParserGroundingSummary | null;
  }): Promise<EquationCard> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: buildExplainInstructions(),
      input: buildExplainInput(input.request, input.grounding)
    });

    const outputText = readOutputText(response);
    if (!outputText) {
      throw new Error("The model returned an empty response.");
    }

    const payload = JSON.parse(stripMarkdownFence(outputText));
    return equationCardSchema.parse(payload);
  }
}

function readOutputText(response: unknown): string {
  if (typeof response !== "object" || response === null) {
    return "";
  }

  const directText = (response as { output_text?: unknown }).output_text;
  if (typeof directText === "string") {
    return directText.trim();
  }

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  const fragments: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== "object") {
        continue;
      }

      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && text.trim()) {
        fragments.push(text.trim());
      }
    }
  }

  return fragments.join("\n").trim();
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}
