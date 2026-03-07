---
name: explain-equations
description: Produce simple, color-coded equation explanations from LaTeX or math notation. Use this when the user wants an equation interpreted, broken into meaningful chunks, rendered with semantic colors, or emitted as structured JSON for a lightweight renderer, browser extension, or teaching UI.
---

# Explain Equations

Use this skill to turn a math expression into a small, renderable explanation artifact rather than a long prose answer.

## Default workflow

1. Identify the equation input.
   Accept raw LaTeX, a copied equation, or math already present in a file.
2. Choose the closest domain lens.
   Use `signals` for Fourier/transform notation, `ml` for paper-style indexed activations and dataset averages, `calculus` for integrals and derivatives, otherwise `general`.
3. Ground on structure when helpful.
   Run:

   ```bash
   node skills/explain-equations/scripts/analyze_equation.js --latex "<LATEX>" --domain <DOMAIN> --pretty
   ```

   Use the script when the expression is nontrivial, when you want the existing parser's node/role hints, or when you are generating JSON for a renderer. If the parser is shallow or wrong, continue manually and say so.
4. Produce the final answer in the smallest useful form.
   Prefer the JSON contract in [references/response-contract.md](references/response-contract.md) when the output is meant for rendering or reuse. Prefer short prose only when the user did not ask for a renderable artifact.

## Output rules

- Color semantic chunks, not isolated symbols, unless the symbol itself is the chunk.
- Reuse the same roles in the equation and the explanation text.
- Prefer operational explanations such as "average over all samples" or "subtract the safe mean from the harmful mean" over token-by-token glosses.
- Do not overclaim semantics that are not present in the notation. Put assumptions in `notes`.
- Keep the artifact compact. A small JSON object should be enough for most equations.

## JSON mode

When the user wants something that a simple renderer or extension can consume, follow [references/response-contract.md](references/response-contract.md).

Important:

- Put MathJax-ready LaTeX in `displayLatex`.
- Use `\class{role-name}{...}` so the renderer does not need to parse the equation.
- Keep `legend`, `highlights`, and `walkthrough` short.

The companion renderer for this repo lives at `Statistics/Math/equation_story_renderer.html`.

## Failure mode

If the notation is too ambiguous, still produce a useful artifact:

- keep the chunking conservative,
- use generic labels such as "index", "sample term", or "normalizing factor",
- add a brief note about what depends on surrounding context.
