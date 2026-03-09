# Equation Explainer Backend

Backend scaffold for the equation color-coder project.

## What it does

- Exposes `POST /api/explain` for equation explanation requests.
- Validates the request shape before calling the model.
- Reuses the local parser at `skills/explain-equations/scripts/analyze_equation.js` as optional grounding.
- Validates the model output against the existing `equation-card/v1` contract.

## Quick start

```bash
npm install
npm run dev
```

The service defaults to `http://localhost:8787`.

Before starting the server, copy `.env.example` to `.env` and fill in `OPENAI_API_KEY`.

## Environment

- `OPENAI_API_KEY`: required for `POST /api/explain`
- `OPENAI_MODEL`: optional, defaults to `gpt-4.1-mini`
- `PORT`: optional, defaults to `8787`

## Endpoints

### `GET /health`

Returns a lightweight readiness payload.

### `POST /api/explain`

Example request body:

```json
{
  "selected_text": "\\frac{1}{n}\\sum_i x_i",
  "guessed_latex": "\\frac{1}{n}\\sum_i x_i",
  "surrounding_text": "We define the mean feature activation as ...",
  "page_title": "Some paper title",
  "page_url": "https://arxiv.org/abs/example",
  "audience": "undergraduate",
  "difficulty": "standard",
  "domain_hint": "machine learning"
}
```

Successful responses return a validated `equation-card/v1` JSON object.

## Notes

- The model wrapper is intentionally isolated in `src/openaiClient.ts`.
- The parser grounding is best-effort. If the local parser fails, the backend still asks the model to continue conservatively.
