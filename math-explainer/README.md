# Math Explainer

Hosted equation explanation stack.

- `backend/` exposes `POST /api/explain`, runs parser grounding, calls OpenAI with the app prompt and `equation-card/v1` schema, and validates the response.
- `extension/` is an unpacked Microsoft Edge extension that stores a personal OpenAI API key locally, calls OpenAI directly, and renders the returned card.

For personal browser use, load `extension/` unpacked in Edge and configure the OpenAI key in the extension options. For shared/distributed use, prefer the backend path so the OpenAI key stays server-side.
