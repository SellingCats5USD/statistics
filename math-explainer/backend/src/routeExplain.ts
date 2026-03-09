import { Router, type Request, type Response } from "express";
import { analyzeEquation } from "./parserGrounding";
import { explainRequestSchema, normalizeExplainRequest } from "./schema";
import type { ExplainModelClient } from "./openaiClient";

export function createExplainRouter(options: {
  client: ExplainModelClient | null;
}): Router {
  const router = Router();

  router.post("/api/explain", async (request: Request, response: Response) => {
    if (!options.client) {
      response.status(503).json({
        error: "OPENAI_API_KEY is not configured for this backend."
      });
      return;
    }

    const parsed = explainRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: "Invalid request body.",
        details: parsed.error.flatten()
      });
      return;
    }

    const explainRequest = normalizeExplainRequest(parsed.data);

    try {
      const grounding = await analyzeEquation({
        latex: explainRequest.guessed_latex,
        domain: explainRequest.domain
      });

      const card = await options.client.explainEquation({
        request: explainRequest,
        grounding
      });

      response.json(card);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown backend error";
      response.status(500).json({
        error: "Failed to explain equation.",
        message
      });
    }
  });

  return router;
}
