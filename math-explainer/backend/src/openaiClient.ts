import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent, ResponseInputItem } from "openai/resources/responses/responses";
import { equationCardSchema } from "./schema";
import { buildExplainInput, buildExplainInstructions } from "./prompt";
import type { EquationCard, ExplainRequest, ParserGroundingSummary } from "./types";

const MAX_PDF_BYTES = 12 * 1024 * 1024;

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
    const responseInput = await buildResponseInput(input.request, input.grounding);
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: buildExplainInstructions(),
      input: responseInput,
      text: {
        format: zodTextFormat(equationCardSchema, "equation_card")
      }
    });

    const payload = response.output_parsed;
    if (!payload) {
      const outputText = readOutputText(response);
      if (!outputText) {
        throw new Error("The model returned an empty response.");
      }
      throw new Error(`The model did not return parseable structured output. Raw output: ${outputText}`);
    }

    return equationCardSchema.parse(normalizeEquationCard(payload));
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

function normalizeEquationCard(card: EquationCard): EquationCard {
  return {
    ...card,
    displayLatex: normalizeDisplayLatexRoleClasses(card.displayLatex)
  };
}

function normalizeDisplayLatexRoleClasses(displayLatex: string): string {
  return displayLatex.replace(/\\class\{([a-z][a-z-]*)\}\{/gi, (_match, roleName: string) => {
    if (roleName.startsWith("role-")) {
      return `\\class{${roleName}}{`;
    }

    return `\\class{role-${roleName}}{`;
  });
}

async function buildResponseInput(
  request: ExplainRequest,
  grounding: ParserGroundingSummary | null
): Promise<string | ResponseInputItem[]> {
  const content: ResponseInputContent[] = [
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

  const pdfInput = await buildPdfInput(request.page_url);
  if (pdfInput) {
    content.push(pdfInput);
  }

  return [
    {
      role: "user",
      content
    }
  ];
}

async function buildPdfInput(pageUrl: string): Promise<ResponseInputContent | null> {
  if (!isPdfUrl(pageUrl)) {
    return null;
  }

  try {
    const response = await fetch(pageUrl, {
      headers: {
        Accept: "application/pdf"
      }
    });

    if (!response.ok) {
      throw new Error(`PDF download failed with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("Downloaded PDF was empty.");
    }
    if (arrayBuffer.byteLength > MAX_PDF_BYTES) {
      throw new Error(`Downloaded PDF exceeded ${MAX_PDF_BYTES} bytes.`);
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return {
      type: "input_file",
      filename: inferPdfFilename(pageUrl),
      file_data: `data:application/pdf;base64,${base64}`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[pdf] attachment unavailable: ${message}`);
    return null;
  }
}

function isPdfUrl(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.includes(".pdf") || normalized.includes("/pdf/");
}

function inferPdfFilename(pageUrl: string): string {
  try {
    const parsed = new URL(pageUrl);
    const candidate = parsed.pathname.split("/").filter(Boolean).pop();
    if (candidate) {
      return candidate.endsWith(".pdf") ? candidate : `${candidate}.pdf`;
    }
  } catch (_error) {
    // Fall through to the default filename.
  }

  return "document.pdf";
}
