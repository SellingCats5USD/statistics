# Equation Explainer v1

This folder contains a standalone prototype for the "text first, not image first" equation explainer discussed in the project notes.

## Files

- `equation_explainer_v1.html`
  - Static shell for the app.
  - Loads MathJax from a CDN and mounts the interactive UI.
- `equation_explainer_v1.css`
  - Layout, visual language, role-color system, selection styling, and responsive behavior.
- `equation_explainer_v1.js`
  - Lightweight LaTeX tokenizer/parser for a focused subset.
  - Semantic annotation layer.
  - Interactive tree, term cards, summary generation, and click selection.

## What v1 does

- Paste LaTeX and render it with MathJax.
- Build a local parse tree instead of treating LaTeX as final meaning.
- Color the rendered equation by semantic / structural role.
- Show a structural tree view.
- Explain the currently selected subexpression.
- Provide a short plain-English summary of the whole expression.
- Include seeded examples for:
  - ML contrast / mean-difference notation
  - DFT / Fourier-style summation
  - Expectation as a weighted sum
  - A simple calculus integral

## Supported subset

The parser is intentionally narrow. It currently handles:

- Fractions via `\frac`
- Square roots via `\sqrt`
- Summations and integrals with subscripts / superscripts
- Parentheses, brackets, brace groups, `\left ... \right`, and absolute bars
- Subscripts, superscripts, and prime marks
- Function-style application such as `f(x)` or `x_i^{(l)}(p)`
- Implicit products, explicit `*`, `/`, `\cdot`, and `\times`
- Relation operators such as `=`, `\in`, `\to`, `\mapsto`, `\approx`
- Styling wrappers such as `\mathbb`, `\mathcal`, `\mathrm`, `\mathbf`, `\text`

## Not included in v1

- Audio or "read aloud" output
- OCR / screenshot / PDF ingestion
- Full TeX macro support
- CAS-like symbolic algebra
- LLM-backed explanation generation
- Browser-extension injection or ChatGPT / MCP tool wiring

## How to use

1. Open `equation_explainer_v1.html` in a browser.
2. Paste or edit a LaTeX expression.
3. Choose the explanation lens:
   - `General math`
   - `ML paper notation`
   - `Signals / Fourier`
   - `Calculus`
4. Click `Parse + Render`, or just type and wait for the debounce update.
5. Inspect the rendered expression by:
   - clicking the equation,
   - clicking a tree node,
   - clicking a term card,
   - toggling semantic color layers.

## Notes

- MathJax is loaded from `cdn.jsdelivr.net`, so rendering requires network access in the browser.
- The semantic layer is heuristic. It is strongest on the included examples and on expressions that are structurally similar to them.
- The current architecture is meant to be the v1 core that later versions can reuse for:
  - richer domain dictionaries,
  - browser-extension overlays,
  - OCR fallback,
  - service / tool endpoints for agents.
