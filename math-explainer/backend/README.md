# Equation Explainer Backend

Backend scaffold for the equation color-coder project.

## What it does

- Exposes `POST /api/explain` for equation explanation requests.
- Validates the request shape before calling the model.
- Reuses the local parser at `skills/explain-equations/scripts/analyze_equation.js` as optional grounding.
- Validates the model output against the existing `equation-card/v1` contract.
- Includes prompt examples for core ML and Fourier-style equations.
- Includes regression fixtures so canonical equations can be rechecked as the backend evolves.

## Quick start

```bash
npm install
npm run dev
```

The service defaults to `http://localhost:8787`.

Before starting the server, copy `.env.example` to `.env` and fill in `OPENAI_API_KEY`.

## Regression fixtures

Run the offline fixture checks:

```bash
npm run fixtures
```

This validates the regression fixture file and checks that the local parser can still ground each fixture.
If the current environment blocks child-process execution, the script falls back to fixture validation and prints a warning instead of failing hard.

Run the live fixture checks:

```bash
npm run fixtures:live
```

This also calls the model and asserts a few structural expectations for the canonical backend examples.

## Environment

- `OPENAI_API_KEY`: required for `POST /api/explain`
- `OPENAI_MODEL`: optional, defaults to `gpt-4.1-mini`
- `HOST`: optional, defaults to `0.0.0.0`
- `PORT`: optional, defaults to `8787`
- `EQUATION_STORY_SHARED_SECRET`: optional for local use, recommended for any public deployment; when set, requests must include the same value in `X-Equation-Story-Key` or `Authorization: Bearer ...`

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

## Hosted deployment

If you deploy this backend to a public HTTPS host, set `EQUATION_STORY_SHARED_SECRET` so strangers cannot use your OpenAI-backed endpoint.

This repository includes a Render Blueprint file at [render.yaml](/C:/Users/norwa/OneDrive/Documents/student/kode/.venv/Scripts/interference/statistics/render.yaml) for a simple hosted path:

1. Push this repo to GitHub.
2. In Render, create a new Blueprint or Web Service from that repo.
3. Use `math-explainer/backend` as the service root if you create the service manually.
4. Set these environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `EQUATION_STORY_SHARED_SECRET`
5. After deploy, copy the Render HTTPS URL into the extension backend field.
6. Put the same shared secret into the extension's `Backend Access Key` field.

For local development, leave `EQUATION_STORY_SHARED_SECRET` empty.

## Notes

- The model wrapper is intentionally isolated in `src/openaiClient.ts`.
- The parser grounding is best-effort. If the local parser fails, the backend still asks the model to continue conservatively.
- `src/promptExamples.ts` is the place to strengthen domain-specific prompting without coupling that logic to the renderer.
