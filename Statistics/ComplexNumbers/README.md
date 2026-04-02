# Complex Log Image Playground

This folder contains a first standalone prototype for experimenting with image transforms in the complex plane.

## Pipeline

The current playground follows this mapping:

1. Treat each source pixel as a complex coordinate
   - `z = ((x - x0) / s) + i((y0 - y) / s)`
2. Move into the log plane
   - `w = log(z)`
3. Apply a complex affine operation in the log plane
   - `w' = a * w + b`
4. Map back to the image plane
   - `z' = exp(w')`

## Files

- `complex_log_image_pipeline.ipynb`
  - Pedagogical notebook that walks through the pipeline stage by stage.
- `complex_log_image_pipeline.py`
  - Reusable helper functions that keep the notebook modular and compact.
- `complex_log_image_playground.html`
  - Standalone shell for the app.
- `complex_log_image_playground.css`
  - Layout, controls, panels, and responsive styling.
- `complex_log_image_playground.js`
  - Image loading, demo-pattern generation, complex arithmetic, log-plane rendering, and inverse mapping back to the `z`-plane.

## What This Prototype Does

- Loads an uploaded image or a generated demo pattern.
- Includes a notebook-first path for studying the geometry with explicit intermediate plots.
- Lets you choose the complex origin inside the image.
- Lets you choose the pixel-to-complex scale.
- Applies the principal branch of the complex logarithm.
- Shows:
  - the source image with the chosen origin and unit circle,
  - the unwrapped log-plane preview,
  - the transformed log-plane preview after `w' = a * w + b`,
  - the image mapped back through the exponential.
- Updates previews live as you change the parameters.

## Notes

- The current version uses the principal branch of `log`, so the inverse-mapped image has a visible branch cut.
- The operation is currently an affine map in log space because it covers the main experiments cleanly:
  - setting `b = 0` gives pure multiplication by a complex number,
  - setting `a = 1` gives pure addition,
  - combining both gives a flexible first pipeline.
- The output preview stays on the same complex window as the original image plane so comparisons are easy.

## Next Good Steps

- Add branch-aware inverse sampling for richer multi-valued behavior.
- Add draggable origin selection directly on the canvas.
- Add more operation presets such as powers, roots, and Moebius-style experiments in separate stages.
- Add export for the transformed image.
