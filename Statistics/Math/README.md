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
- `equation_story_renderer.html`
  - Thin renderer for AI-emitted equation explanation JSON.
  - Expects `displayLatex` plus a small structured explanation payload.
- `equation_story_renderer.css`
  - Renderer layout and the shared semantic color palette.
- `equation_story_renderer.js`
  - JSON validation, sample payload loading, and MathJax rendering.
- `equation_story_extension/`
  - Manifest V3 browser extension shell for the same JSON contract.
  - Popup preview plus injected floating panel on the active page.
  - Uses a sandboxed renderer page so MathJax can stay isolated from extension code.

## Skill-based path

The next step is no longer "make the heuristic parser infinitely smart."
Instead, the repo now also contains a reusable Codex skill:

- `skills/explain-equations/`
  - `SKILL.md` defines the workflow for turning LaTeX into a compact explanation artifact.
  - `scripts/analyze_equation.js` optionally grounds the AI on the existing local parser.
  - `references/response-contract.md` defines the JSON contract that the renderer consumes.
- Installed copy:
  - `C:\Users\norwa\.codex\skills\explain-equations`
  - Restart Codex to pick up the installed skill in future sessions.

The intended split is:

- The local parser provides structure when it can.
- The AI provides the real pedagogical explanation and chunking.
- The renderer stays simple and only displays the returned JSON.

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
- LLM-backed explanation generation inside the `equation_explainer_v1.*` app itself
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

## JSON renderer path

1. Open `equation_story_renderer.html` in a browser.
2. Paste an `equation-card/v1` JSON payload.
3. Render the card to inspect the equation, legend, highlights, and walkthrough.

## Browser extension path

1. Open your Chromium-based browser extension page.
2. Load `Statistics/Math/equation_story_extension/` as an unpacked extension.
3. Open the extension popup.
4. Paste an `equation-card/v1` JSON payload.
5. Click `Preview` to render inside the popup, or `Inject Into Page` to place a floating explanation card on the current tab.

## Notes

- MathJax is loaded from `cdn.jsdelivr.net`, so rendering requires network access in the browser.
- The semantic layer is heuristic. It is strongest on the included examples and on expressions that are structurally similar to them.
- The current architecture is meant to be the v1 core that later versions can reuse for:
  - richer domain dictionaries,
  - browser-extension overlays,
  - OCR fallback,
  - service / tool endpoints for agents.
- The new `equation_story_renderer.html` is intentionally much thinner than `equation_explainer_v1.html`.
  It assumes a smart model already produced the explanation JSON and only handles rendering.
- The extension uses a sandboxed page to load MathJax. That keeps the popup and content script simple, but it still depends on browser network access to `cdn.jsdelivr.net`.
