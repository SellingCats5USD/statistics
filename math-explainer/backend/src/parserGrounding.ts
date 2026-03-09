import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { EquationDomain, ParserGroundingSummary } from "./types";

const execFileAsync = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, "../../..");
const ANALYZER_SCRIPT = path.join(REPO_ROOT, "skills", "explain-equations", "scripts", "analyze_equation.js");

export async function analyzeEquation(options: {
  latex: string;
  domain: EquationDomain;
}): Promise<ParserGroundingSummary | null> {
  const latex = options.latex.trim();
  if (!latex) {
    return null;
  }

  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [ANALYZER_SCRIPT, "--latex", latex, "--domain", options.domain],
      {
        cwd: REPO_ROOT,
        maxBuffer: 1024 * 1024
      }
    );

    const payload = JSON.parse(stdout) as ParserGroundingSummary;
    return {
      version: payload.version,
      input: payload.input,
      stats: payload.stats,
      summaryLines: Array.isArray(payload.summaryLines) ? payload.summaryLines.slice(0, 4) : [],
      topLevelNodes: Array.isArray(payload.topLevelNodes) ? payload.topLevelNodes.slice(0, 6) : [],
      semanticNodes: Array.isArray(payload.semanticNodes) ? payload.semanticNodes.slice(0, 6) : []
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parser error";
    console.warn(`[parser] grounding unavailable: ${message}`);
    return null;
  }
}
