# Equation Card Contract

Use this when the user wants a renderable, color-coded explanation instead of free-form prose.

## Goals

- Explain the equation in simple language.
- Reuse the same semantic colors in both the equation and the prose.
- Color meaningful chunks, not every individual symbol.
- Be explicit about uncertainty when notation is underspecified.

## Required JSON shape

```json
{
  "version": "equation-card/v1",
  "title": "Short title",
  "domain": "general",
  "displayLatex": "\\[ ... \\]",
  "summary": "One plain sentence.",
  "intuition": "One intuitive sentence.",
  "legend": [
    {
      "role": "definition",
      "label": "Output",
      "color": "#7f4126",
      "meaning": "What this colored part means."
    }
  ],
  "highlights": [
    {
      "label": "Chunk name",
      "latex": "X_k",
      "role": "definition",
      "explanation": "Short explanation of this chunk."
    }
  ],
  "walkthrough": [
    "Step 1",
    "Step 2"
  ],
  "notes": [
    "Optional caveat or ambiguity."
  ]
}
```

## Field rules

- `version`: Always `equation-card/v1`.
- `domain`: One of `general`, `ml`, `signals`, `calculus`.
- `displayLatex`: Must be ready for MathJax. Use `\class{role-name}{...}` wrappers so the renderer can color the equation without extra parsing.
- `summary`: One sentence. Keep it concrete.
- `intuition`: One sentence. Prefer the operational picture over formal restatement.
- `legend`: 3-6 entries. Only include roles actually used in `displayLatex`.
- `highlights`: 2-6 entries. Each highlight should correspond to a visually meaningful chunk.
- `walkthrough`: 2-6 short steps.
- `notes`: Optional. Use for ambiguity, conventions, or assumptions.

## Role palette

These match the current renderer and the existing Math prototype.

| role | color | use |
| --- | --- | --- |
| `definition` | `#7f4126` | quantity being defined or solved for |
| `quantity` | `#2b5579` | main value, sample, function value, or term body |
| `dataset` | `#0f766e` | set, dataset, or collection |
| `index` | `#8a4fff` | index, binder, iteration variable |
| `operator` | `#c2410c` | sum, integral, transform kernel, major operator |
| `normalizer` | `#a16207` | divide-by-count or scaling factor |
| `contrast` | `#b91c1c` | subtraction or opposing term |
| `positive-term` | `#b45309` | first side of a difference |
| `negative-term` | `#0f766e` | second side of a difference |
| `group` | `#64748b` | grouping wrapper when visually important |

## Good output habits

- Prefer chunk-level groupings like `\class{role-normalizer}{\frac{1}{N}}`, not `\class{role-normalizer}{1}` and `\class{role-normalizer}{N}` separately.
- Keep `displayLatex` close to the user's original notation unless simplification is part of the explanation.
- If the exact semantics are unclear, say so in `notes` instead of pretending certainty.
- If the parser or context is weak, use conservative labels like "sample term", "index", or "weighted sum" rather than inventing domain facts.

## Example

```json
{
  "version": "equation-card/v1",
  "title": "Discrete Fourier coefficient",
  "domain": "signals",
  "displayLatex": "\\[\\class{role-definition}{X_k}=\\class{role-normalizer}{\\frac{1}{N}}\\class{role-operator}{\\sum_{\\class{role-index}{n}=0}^{N-1}}\\class{role-quantity}{x_n}\\class{role-operator}{e^{i 2\\pi k n / N}}\\]",
  "summary": "This computes the amount of frequency k present in the signal.",
  "intuition": "Rotate each sample at frequency k, add the rotated samples, and average the result.",
  "legend": [
    {
      "role": "definition",
      "label": "Output",
      "color": "#7f4126",
      "meaning": "The Fourier coefficient at frequency k."
    },
    {
      "role": "normalizer",
      "label": "Average",
      "color": "#a16207",
      "meaning": "Divide by N so the sum becomes an average."
    },
    {
      "role": "operator",
      "label": "Sweep all samples",
      "color": "#c2410c",
      "meaning": "Add contributions from every sample after rotating them."
    },
    {
      "role": "quantity",
      "label": "Signal sample",
      "color": "#2b5579",
      "meaning": "The nth sample from the original signal."
    },
    {
      "role": "index",
      "label": "Loop variable",
      "color": "#8a4fff",
      "meaning": "n runs through the samples while k chooses the frequency."
    }
  ],
  "highlights": [
    {
      "label": "Coefficient being defined",
      "latex": "X_k",
      "role": "definition",
      "explanation": "This is the answer for the chosen frequency index k."
    },
    {
      "label": "Normalization",
      "latex": "\\frac{1}{N}",
      "role": "normalizer",
      "explanation": "This rescales the total by the signal length."
    },
    {
      "label": "Running sum",
      "latex": "\\sum_{n=0}^{N-1}",
      "role": "operator",
      "explanation": "This loops over every sample index n."
    }
  ],
  "walkthrough": [
    "Pick the frequency index k you want to measure.",
    "For each sample n, rotate x_n by the matching complex phase.",
    "Add all of those rotated samples together.",
    "Divide by N to turn the total into an average-sized coefficient."
  ],
  "notes": [
    "This assumes the standard DFT convention used in signal processing."
  ]
}
```
