# Equation Explainer Edge Extension

Static Manifest V3 extension that calls OpenAI directly with the Equation Explainer prompt and schema.

## What it does

- Reads the current page selection, nearby text, visible text, page title, URL, metadata, and headings as context.
- Optionally includes a visible-page screenshot for image-based equation capture.
- Supports screen snips: click `Snip Equation`, drag around an equation on the page, reopen the popup, and explain the attached crop.
- Runs the bundled local equation analyzer as parser grounding.
- Sends the prompt, grounding, examples, and JSON schema directly to the OpenAI Responses API.
- Renders the returned `equation-card/v1` payload in the popup with local MathJax.

The OpenAI API key is stored in Edge extension local storage. This is convenient for personal use, but it is not appropriate for distributing the extension to other users with a shared key.

## Load in Edge

1. Open `edge://extensions`.
2. Enable `Developer mode`.
3. Choose `Load unpacked`.
4. Select this folder: `math-explainer/extension`.
5. Open the extension options.
6. Paste your OpenAI API key.
7. Choose the model, audience, difficulty, and default domain hint.
8. Click `Test OpenAI`, then `Save`.

## Usage

- Select an equation on the page and click `Use Selection`, then `Explain`.
- Paste LaTeX directly into the equation box and click `Explain`.
- Click `Snip Equation`, drag a rectangle around the equation on the page, reopen the popup, and click `Explain`.
- Leave the equation box blank when using a snip, or add a short hint if the crop needs context.

## Bundled assets

The extension vendors MathJax under `vendor/mathjax` because Manifest V3 extension pages should not depend on remote script execution.

If `vendor/mathjax` is missing, run:

```bash
npm install
```

Then copy `node_modules/mathjax/es5` to `vendor/mathjax/es5`.
