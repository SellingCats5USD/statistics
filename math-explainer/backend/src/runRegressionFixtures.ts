import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { analyzeEquation } from "./parserGrounding";
import { OpenAIExplainClient } from "./openaiClient";
import { equationCardSchema, explainRequestSchema, normalizeExplainRequest } from "./schema";
import { ROLE_VALUES, type EquationCard, type EquationRole } from "./types";

const expectationSchema = z.object({
  expectedDomain: z.enum(["general", "ml", "signals", "calculus"]),
  requiredLegendRoles: z.array(z.enum(ROLE_VALUES)).min(1),
  requiredDisplayLatexSubstrings: z.array(z.string().min(1)).min(1),
  forbiddenDisplayLatexSubstrings: z.array(z.string().min(1)).optional(),
  minWalkthroughSteps: z.number().int().min(2).max(6),
  minSelfDescriptiveSpans: z.number().int().min(5).max(20),
  minStorySpans: z.number().int().min(4).max(16),
  minSummarySpans: z.number().int().min(3).max(12),
  minIntuitionSpans: z.number().int().min(3).max(12)
});

const fixtureSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  request: explainRequestSchema,
  expectations: expectationSchema
});

const fixturesSchema = z.array(fixtureSchema).min(1);
type RegressionFixture = z.infer<typeof fixtureSchema>;

async function main() {
  const live = process.argv.includes("--live");
  const fixtures = await loadFixtures();

  const client = createClient(live);
  let failures = 0;

  for (const fixture of fixtures) {
    try {
      await runFixture(fixture, {
        live,
        client
      });
      console.log(`[ok] ${fixture.id}`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[fail] ${fixture.id}: ${message}`);
    }
  }

  if (failures > 0) {
    process.exitCode = 1;
    return;
  }

  if (live) {
    console.log(`Checked ${fixtures.length} live regression fixtures.`);
    return;
  }

  console.log(`Checked ${fixtures.length} offline regression fixtures.`);
}

async function loadFixtures() {
  const fixturePath = path.resolve(__dirname, "../fixtures/regression-cases.json");
  const raw = await fs.readFile(fixturePath, "utf8");
  return fixturesSchema.parse(JSON.parse(raw));
}

function createClient(live: boolean) {
  if (!live) {
    return null;
  }

  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for --live fixture runs.");
  }

  return new OpenAIExplainClient({
    apiKey,
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini"
  });
}

async function runFixture(
  fixture: RegressionFixture,
  options: {
    live: boolean;
    client: OpenAIExplainClient | null;
  }
) {
  const normalizedRequest = normalizeExplainRequest(fixture.request);
  const grounding = await analyzeEquation({
    latex: normalizedRequest.guessed_latex,
    domain: normalizedRequest.domain
  });

  if (!options.live) {
    if (!grounding) {
      console.warn(`  parser grounding skipped for ${fixture.id} in the current environment.`);
      return;
    }

    assertGroundingLooksUseful(grounding);
    return;
  }

  if (!grounding) {
    throw new Error("Parser grounding failed for the fixture request.");
  }

  if (!options.client) {
    throw new Error("Live fixture run requested without a model client.");
  }

  const card = equationCardSchema.parse(
    await options.client.explainEquation({
      request: normalizedRequest,
      grounding
    })
  );

  assertCardAgainstExpectations(card, fixture);
}

function assertGroundingLooksUseful(grounding: NonNullable<Awaited<ReturnType<typeof analyzeEquation>>>) {
  if (!grounding.topLevelNodes.length) {
    throw new Error("Grounding returned no top-level nodes.");
  }
}

function assertCardAgainstExpectations(card: EquationCard, fixture: RegressionFixture) {
  if (card.domain !== fixture.expectations.expectedDomain) {
    throw new Error(`Expected domain ${fixture.expectations.expectedDomain}, received ${card.domain}.`);
  }

  assertAllRoleClassesArePrefixed(card.displayLatex);

  const legendRoles = new Set(card.legend.map((entry) => entry.role));
  fixture.expectations.requiredLegendRoles.forEach((role) => {
    if (!legendRoles.has(role as EquationRole)) {
      throw new Error(`Missing legend role ${role}.`);
    }
  });

  fixture.expectations.requiredDisplayLatexSubstrings.forEach((snippet) => {
    if (!card.displayLatex.includes(snippet)) {
      throw new Error(`displayLatex is missing required snippet: ${snippet}`);
    }
  });

  fixture.expectations.forbiddenDisplayLatexSubstrings?.forEach((snippet) => {
    if (card.displayLatex.includes(snippet)) {
      throw new Error(`displayLatex contains forbidden snippet: ${snippet}`);
    }
  });

  if (card.walkthrough.length < fixture.expectations.minWalkthroughSteps) {
    throw new Error(
      `Expected at least ${fixture.expectations.minWalkthroughSteps} walkthrough steps, received ${card.walkthrough.length}.`
    );
  }

  if (!Array.isArray(card.story) || card.story.length < fixture.expectations.minStorySpans) {
    throw new Error(
      `Expected at least ${fixture.expectations.minStorySpans} story spans, received ${Array.isArray(card.story) ? card.story.length : 0}.`
    );
  }

  if (!Array.isArray(card.selfDescriptiveSpans) || card.selfDescriptiveSpans.length < fixture.expectations.minSelfDescriptiveSpans) {
    throw new Error(
      `Expected at least ${fixture.expectations.minSelfDescriptiveSpans} self-descriptive spans, received ${Array.isArray(card.selfDescriptiveSpans) ? card.selfDescriptiveSpans.length : 0}.`
    );
  }

  if (!Array.isArray(card.summarySpans) || card.summarySpans.length < fixture.expectations.minSummarySpans) {
    throw new Error(
      `Expected at least ${fixture.expectations.minSummarySpans} summary spans, received ${Array.isArray(card.summarySpans) ? card.summarySpans.length : 0}.`
    );
  }

  if (!Array.isArray(card.intuitionSpans) || card.intuitionSpans.length < fixture.expectations.minIntuitionSpans) {
    throw new Error(
      `Expected at least ${fixture.expectations.minIntuitionSpans} intuition spans, received ${Array.isArray(card.intuitionSpans) ? card.intuitionSpans.length : 0}.`
    );
  }
}

function assertAllRoleClassesArePrefixed(displayLatex: string) {
  const classMatches = displayLatex.matchAll(/\\class\{([^}]+)\}\{/g);
  for (const match of classMatches) {
    const className = match[1];
    if (!className.startsWith("role-")) {
      throw new Error(`Found non-prefixed MathJax class: ${className}`);
    }
  }
}

void main();
