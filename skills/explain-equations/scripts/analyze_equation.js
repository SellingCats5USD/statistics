#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT_DIR = path.resolve(__dirname, "..", "..", "..");
const PARSER_PATH = path.join(ROOT_DIR, "Statistics", "Math", "equation_explainer_v1.js");
const CSS_PATH = path.join(ROOT_DIR, "Statistics", "Math", "equation_explainer_v1.css");
const DEFAULT_DOMAIN = "general";
const VALID_DOMAINS = new Set(["general", "ml", "signals", "calculus"]);
const DEFAULT_TREE_LIMIT = 120;
const ROLE_ORDER = [
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
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const latex = await resolveLatex(options);
  if (!latex) {
    throw new Error("Provide LaTeX with --latex, --latex-file, or stdin.");
  }

  const helpers = loadBrowserAnalyzer();
  const analysis = helpers.analyzeLatex(latex, options.domain);
  const payload = {
    version: "equation-analysis/v1",
    source: {
      parser: path.relative(ROOT_DIR, PARSER_PATH).replace(/\\/g, "/"),
      css: path.relative(ROOT_DIR, CSS_PATH).replace(/\\/g, "/")
    },
    input: {
      latex,
      domain: options.domain
    },
    stats: {
      tokenCount: analysis.tokenCount,
      nodeCount: analysis.nodeCount
    },
    palette: buildPalette(helpers.humanizeRole),
    summaryLines: analysis.summaryLines.slice(0, 4),
    topLevelNodes: analysis.topLevelNodes.map((node) => summarizeNode(node, helpers)),
    semanticNodes: analysis.semanticNodes.map((node) => summarizeNode(node, helpers)),
    tree: projectTree(analysis.root, helpers, {
      remaining: options.maxTreeNodes,
      truncated: false
    })
  };

  const spacer = options.pretty ? 2 : 0;
  process.stdout.write(`${JSON.stringify(payload, null, spacer)}\n`);
}

function parseArgs(argv) {
  const options = {
    domain: DEFAULT_DOMAIN,
    pretty: false,
    latex: "",
    latexFile: "",
    maxTreeNodes: DEFAULT_TREE_LIMIT
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--pretty") {
      options.pretty = true;
      continue;
    }
    if (arg === "--latex") {
      options.latex = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--latex-file") {
      options.latexFile = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg === "--domain") {
      options.domain = normalizeDomain(argv[index + 1] || "");
      index += 1;
      continue;
    }
    if (arg === "--max-tree-nodes") {
      options.maxTreeNodes = normalizePositiveInteger(argv[index + 1], DEFAULT_TREE_LIMIT);
      index += 1;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  const lines = [
    "Usage: node skills/explain-equations/scripts/analyze_equation.js [options]",
    "",
    "Options:",
    "  --latex <string>            Analyze a LaTeX string",
    "  --latex-file <path>         Read LaTeX from a file",
    "  --domain <name>             general | ml | signals | calculus",
    "  --max-tree-nodes <count>    Limit JSON tree size (default 120)",
    "  --pretty                    Pretty-print JSON output",
    "  -h, --help                  Show help",
    "",
    "If no input option is provided, the script reads stdin when available."
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function normalizeDomain(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return DEFAULT_DOMAIN;
  }
  return VALID_DOMAINS.has(normalized) ? normalized : DEFAULT_DOMAIN;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

async function resolveLatex(options) {
  if (options.latex) {
    return options.latex.trim();
  }

  if (options.latexFile) {
    const filePath = path.resolve(process.cwd(), options.latexFile);
    return fs.readFileSync(filePath, "utf8").trim();
  }

  if (process.stdin.isTTY) {
    return "";
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8").trim();
}

function loadBrowserAnalyzer() {
  const source = fs.readFileSync(PARSER_PATH, "utf8");
  const context = {
    console,
    setTimeout,
    clearTimeout,
    window: {
      setTimeout,
      clearTimeout,
      MathJax: null
    },
    document: {
      addEventListener() {},
      getElementById() {
        return null;
      }
    }
  };

  context.globalThis = context;
  context.global = context;

  vm.createContext(context);
  vm.runInContext(source, context, { filename: PARSER_PATH });

  const requiredFunctions = [
    "analyzeLatex",
    "getChildNodes",
    "nodeToLatex",
    "humanizeRole"
  ];

  requiredFunctions.forEach((name) => {
    if (typeof context[name] !== "function") {
      throw new Error(`Analyzer bootstrap failed: missing ${name}().`);
    }
  });

  return {
    analyzeLatex: context.analyzeLatex,
    getChildNodes: context.getChildNodes,
    humanizeRole: context.humanizeRole,
    nodeToLatex: context.nodeToLatex
  };
}

function summarizeNode(node, helpers) {
  const latex = collapseWhitespace(helpers.nodeToLatex(node, { decorate: false })).trim();
  return {
    id: node.id,
    type: node.type,
    role: node.role || "quantity",
    roleLabel: helpers.humanizeRole(node.role),
    semanticType: node.semanticType || null,
    title: node.title || "",
    description: node.description || "",
    depth: typeof node.depth === "number" ? node.depth : null,
    childCount: helpers.getChildNodes(node).length,
    latex
  };
}

function projectTree(node, helpers, budget) {
  const summary = summarizeNode(node, helpers);
  if (budget.remaining <= 0) {
    budget.truncated = true;
    return {
      ...summary,
      truncated: true,
      children: []
    };
  }

  budget.remaining -= 1;
  const children = helpers.getChildNodes(node);

  return {
    ...summary,
    truncated: false,
    children: children.map((child) => projectTree(child, helpers, budget))
  };
}

function buildPalette(humanizeRole) {
  const css = fs.readFileSync(CSS_PATH, "utf8");
  return ROLE_ORDER.map((role) => ({
    role,
    label: humanizeRole(role),
    cssVariable: `--${role}`,
    color: readCssVariable(css, role) || null
  }));
}

function readCssVariable(css, role) {
  const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`--${escaped}:\\s*([^;]+);`));
  return match ? match[1].trim() : "";
}

function collapseWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
