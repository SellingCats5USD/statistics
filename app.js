const xCanvas = document.getElementById("marginalX");
const yCanvas = document.getElementById("marginalY");
const jointCanvas = document.getElementById("joint");
const rhoInput = document.getElementById("rho");
const rhoValue = document.getElementById("rhoValue");
const covMatrix = document.getElementById("covMatrix");
const mixInput = document.getElementById("mix");
const mixValue = document.getElementById("mixValue");
const visualizerSelect = document.getElementById("visualizer");
const randomizeButton = document.getElementById("randomize");
const clearButton = document.getElementById("clear");
const xModeSelect = document.getElementById("xMode");
const yModeSelect = document.getElementById("yMode");
const xMeanInput = document.getElementById("xMean");
const xMeanValue = document.getElementById("xMeanValue");
const xStdInput = document.getElementById("xStd");
const xStdValue = document.getElementById("xStdValue");
const yMeanInput = document.getElementById("yMean");
const yMeanValue = document.getElementById("yMeanValue");
const yStdInput = document.getElementById("yStd");
const yStdValue = document.getElementById("yStdValue");
const xAreaValue = document.getElementById("xAreaValue");
const yAreaValue = document.getElementById("yAreaValue");

const xCtx = xCanvas.getContext("2d");
const yCtx = yCanvas.getContext("2d");
const jointCtx = jointCanvas.getContext("2d");

const X_RANGE = [-3, 3];
const Y_RANGE = [-3, 3];
const GRID_SIZE = 140;
const SMOOTH_KERNEL = [0.15, 0.7, 0.15];
const DISPLAY_SCALE = 1.05;

let xPoints = [];
let yPoints = [];
let activePoint = null;

function gaussianCdf(z) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function gaussianInv(p) {
  const a1 = -39.69683028665376;
  const a2 = 220.9460984245205;
  const a3 = -275.9285104469687;
  const a4 = 138.357751867269;
  const a5 = -30.66479806614716;
  const a6 = 2.506628277459239;
  const b1 = -54.47609879822406;
  const b2 = 161.5858368580409;
  const b3 = -155.6989798598866;
  const b4 = 66.80131188771972;
  const b5 = -13.28068155288572;
  const c1 = -0.007784894002430293;
  const c2 = -0.3223964580411365;
  const c3 = -2.400758277161838;
  const c4 = -2.549732539343734;
  const c5 = 4.374664141464968;
  const c6 = 2.938163982698783;
  const d1 = 0.007784695709041462;
  const d2 = 0.3224671290700398;
  const d3 = 2.445134137142996;
  const d4 = 3.754408661907416;
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(
      (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) /
      ((((d1 * q + d2) * q + d3) * q + d4) * q + 1)
    );
  }

  const q = p - 0.5;
  const r = q * q;
  return (
    (((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q /
    (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
  );
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * Math.abs(x));
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);
  return sign * y;
}

function drawGrid(ctx, width, height, steps = 4) {
  ctx.strokeStyle = "#e1e6f0";
  ctx.lineWidth = 1;
  for (let i = 1; i < steps; i += 1) {
    const x = (i / steps) * width;
    const y = (i / steps) * height;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function setDefaultPoints() {
  xPoints = randomPoints(X_RANGE, 5);
  yPoints = randomPoints(Y_RANGE, 5);
}

function randomPoints([min, max], count) {
  const points = [];
  for (let i = 0; i < count; i += 1) {
    const x = clamp(randomNormal(0, 1), min, max);
    const y = 0.45 + 0.75 * Math.random();
    points.push({ x, y });
  }
  points.sort((a, b) => a.x - b.x);
  return points;
}

function randomNormal(mean, std) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + std * z;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildNormalPdf(mean, std, range, gridSize) {
  const [min, max] = range;
  const values = new Array(gridSize).fill(0);
  const dx = (max - min) / (gridSize - 1);
  const denom = std * Math.sqrt(2 * Math.PI);
  for (let i = 0; i < gridSize; i += 1) {
    const x = min + i * dx;
    const z = (x - mean) / std;
    values[i] = Math.exp(-0.5 * z * z) / denom;
  }
  const area = values.reduce((sum, v) => sum + v, 0) * dx;
  const pdf = values.map((v) => (area > 0 ? v / area : 0));
  const cdf = new Array(gridSize).fill(0);
  let cumulative = 0;
  for (let i = 0; i < gridSize; i += 1) {
    cumulative += pdf[i] * dx;
    cdf[i] = Math.min(1, cumulative);
  }
  return { pdf, cdf, dx, min, max };
}

function buildPdf(points, range, gridSize) {
  const [min, max] = range;
  const values = new Array(gridSize).fill(0);
  const dx = (max - min) / (gridSize - 1);
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const augmented = [
    { x: min, y: 0 },
    ...sorted,
    { x: max, y: 0 },
  ];

  for (let i = 0; i < gridSize; i += 1) {
    const x = min + i * dx;
    let j = 0;
    while (j < augmented.length - 1 && augmented[j + 1].x < x) {
      j += 1;
    }
    const p1 = augmented[j];
    const p2 = augmented[j + 1];
    const t = p2.x === p1.x ? 0 : (x - p1.x) / (p2.x - p1.x);
    const y = p1.y + t * (p2.y - p1.y);
    values[i] = Math.max(0, y);
  }

  const smoothed = new Array(gridSize).fill(0);
  for (let i = 0; i < gridSize; i += 1) {
    let acc = 0;
    let weight = 0;
    for (let k = 0; k < SMOOTH_KERNEL.length; k += 1) {
      const idx = i + k - Math.floor(SMOOTH_KERNEL.length / 2);
      if (idx >= 0 && idx < gridSize) {
        acc += values[idx] * SMOOTH_KERNEL[k];
        weight += SMOOTH_KERNEL[k];
      }
    }
    smoothed[i] = acc / weight;
  }

  const area = smoothed.reduce((sum, v) => sum + v, 0) * dx;
  const pdf = smoothed.map((v) => (area > 0 ? v / area : 0));
  const cdf = new Array(gridSize).fill(0);
  let cumulative = 0;
  for (let i = 0; i < gridSize; i += 1) {
    cumulative += pdf[i] * dx;
    cdf[i] = Math.min(1, cumulative);
  }
  return { pdf, cdf, dx, min, max };
}

function lookupPdf(pdfData, x) {
  const { min, max, dx, pdf } = pdfData;
  if (x <= min || x >= max) return 0;
  const idx = (x - min) / dx;
  const i0 = Math.floor(idx);
  const i1 = Math.min(pdf.length - 1, i0 + 1);
  const t = idx - i0;
  return pdf[i0] * (1 - t) + pdf[i1] * t;
}

function lookupCdf(pdfData, x) {
  const { min, max, dx, cdf } = pdfData;
  if (x <= min) return 0;
  if (x >= max) return 1;
  const idx = (x - min) / dx;
  const i0 = Math.floor(idx);
  const i1 = Math.min(cdf.length - 1, i0 + 1);
  const t = idx - i0;
  return cdf[i0] * (1 - t) + cdf[i1] * t;
}

function gaussianCopulaDensity(u, v, rho) {
  const z1 = gaussianInv(Math.min(Math.max(u, 1e-6), 1 - 1e-6));
  const z2 = gaussianInv(Math.min(Math.max(v, 1e-6), 1 - 1e-6));
  const denom = Math.sqrt(1 - rho * rho);
  const exponent =
    (-(z1 * z1 - 2 * rho * z1 * z2 + z2 * z2) / (2 * (1 - rho * rho))) +
    (z1 * z1 + z2 * z2) / 2;
  return Math.exp(exponent) / denom;
}

function renderMarginal(ctx, points, pdfData, orientation = "x", showPoints = true) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  drawGrid(ctx, ctx.canvas.width, ctx.canvas.height, 4);
  ctx.fillStyle = "rgba(59, 108, 196, 0.2)";
  ctx.strokeStyle = "#3b6cc4";
  ctx.lineWidth = 2;

  const { pdf, min, max } = pdfData;
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.beginPath();
  for (let i = 0; i < pdf.length; i += 1) {
    const t = i / (pdf.length - 1);
    const value = pdf[i];
    if (orientation === "x") {
      const x = t * width;
      const y = height - value * height * DISPLAY_SCALE;
      if (i === 0) ctx.moveTo(x, height);
      ctx.lineTo(x, y);
    } else {
      const y = height - t * height;
      const x = value * width * DISPLAY_SCALE;
      if (i === 0) ctx.moveTo(0, height);
      ctx.lineTo(x, y);
    }
  }
  if (orientation === "x") {
    ctx.lineTo(width, height);
  } else {
    ctx.lineTo(0, 0);
    ctx.lineTo(0, height);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (showPoints) {
    ctx.fillStyle = "#1f3b6f";
    points.forEach((point) => {
      const px = ((point.x - min) / (max - min)) * width;
      if (orientation === "x") {
        const py = height - point.y * height * DISPLAY_SCALE;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const py = height - ((point.x - min) / (max - min)) * height;
        const px2 = point.y * width * DISPLAY_SCALE;
        ctx.beginPath();
        ctx.arc(px2, py, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

function renderJoint(xPdf, yPdf, rho, mix, visualizer) {
  const width = jointCanvas.width;
  const height = jointCanvas.height;
  jointCtx.clearRect(0, 0, width, height);
  drawGrid(jointCtx, width, height, 4);

  let maxDensity = 0;
  const densities = [];

  for (let i = 0; i < GRID_SIZE; i += 1) {
    const x = X_RANGE[0] + (X_RANGE[1] - X_RANGE[0]) * (i / (GRID_SIZE - 1));
    const fx = lookupPdf(xPdf, x);
    const u = lookupCdf(xPdf, x);
    for (let j = 0; j < GRID_SIZE; j += 1) {
      const y = Y_RANGE[0] + (Y_RANGE[1] - Y_RANGE[0]) * (j / (GRID_SIZE - 1));
      const fy = lookupPdf(yPdf, y);
      const v = lookupCdf(yPdf, y);
      const copula = gaussianCopulaDensity(u, v, rho);
      const density = fx * fy * ((1 - mix) * copula + mix);
      densities.push(density);
      if (density > maxDensity) maxDensity = density;
    }
  }

  const scaleX = width / GRID_SIZE;
  const scaleY = height / GRID_SIZE;
  if (visualizer === "dots") {
    jointCtx.save();
    jointCtx.fillStyle = "rgba(59, 108, 196, 0.7)";
    jointCtx.translate(0, height);
    jointCtx.scale(1, -1);
    let idx = 0;
    for (let i = 0; i < GRID_SIZE; i += 1) {
      for (let j = 0; j < GRID_SIZE; j += 1) {
        const density = densities[idx] / maxDensity;
        const radius = density * 6;
        if (radius > 0.6) {
          const x = i * scaleX + scaleX / 2;
          const y = j * scaleY + scaleY / 2;
          jointCtx.beginPath();
          jointCtx.arc(x, y, radius, 0, Math.PI * 2);
          jointCtx.fill();
        }
        idx += 1;
      }
    }
    jointCtx.restore();
    return;
  }

  const imgData = jointCtx.createImageData(width, height);
  if (visualizer === "contours") {
    const levels = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
    const band = 0.03;
    let idx = 0;
    for (let i = 0; i < GRID_SIZE; i += 1) {
      for (let j = 0; j < GRID_SIZE; j += 1) {
        const density = densities[idx] / maxDensity;
        const levelIndex = levels.findIndex((level) => Math.abs(density - level) < band);
        const x = Math.floor(i * scaleX);
        const y = Math.floor((GRID_SIZE - 1 - j) * scaleY);
        const color = levelIndex === -1 ? [235, 242, 250, 140] : [59, 108, 196, 240];
        for (let dx = 0; dx < scaleX; dx += 1) {
          for (let dy = 0; dy < scaleY; dy += 1) {
            const px = x + dx;
            const py = y + dy;
            const offset = (py * width + px) * 4;
            imgData.data[offset] = color[0];
            imgData.data[offset + 1] = color[1];
            imgData.data[offset + 2] = color[2];
            imgData.data[offset + 3] = color[3];
          }
        }
        idx += 1;
      }
    }
  } else {
    let idx = 0;
    for (let i = 0; i < GRID_SIZE; i += 1) {
      for (let j = 0; j < GRID_SIZE; j += 1) {
        const density = densities[idx] / maxDensity;
        const color = colorScale(density);
        const x = Math.floor(i * scaleX);
        const y = Math.floor((GRID_SIZE - 1 - j) * scaleY);
        for (let dx = 0; dx < scaleX; dx += 1) {
          for (let dy = 0; dy < scaleY; dy += 1) {
            const px = x + dx;
            const py = y + dy;
            const offset = (py * width + px) * 4;
            imgData.data[offset] = color[0];
            imgData.data[offset + 1] = color[1];
            imgData.data[offset + 2] = color[2];
            imgData.data[offset + 3] = color[3];
          }
        }
        idx += 1;
      }
    }
  }
  jointCtx.putImageData(imgData, 0, 0);
}

function colorScale(t) {
  const clamped = Math.max(0, Math.min(1, t));
  const base = [66, 120, 199];
  const light = [235, 242, 250];
  const r = Math.round(light[0] + (base[0] - light[0]) * clamped);
  const g = Math.round(light[1] + (base[1] - light[1]) * clamped);
  const b = Math.round(light[2] + (base[2] - light[2]) * clamped);
  const alpha = 200 + Math.round(55 * clamped);
  return [r, g, b, alpha];
}

function update() {
  const rho = parseFloat(rhoInput.value);
  const mix = parseFloat(mixInput.value);
  const visualizer = visualizerSelect.value;
  const xMean = parseFloat(xMeanInput.value);
  const yMean = parseFloat(yMeanInput.value);
  const xStd = parseFloat(xStdInput.value);
  const yStd = parseFloat(yStdInput.value);
  rhoValue.textContent = rho.toFixed(2);
  mixValue.textContent = mix.toFixed(2);
  xMeanValue.textContent = xMean.toFixed(2);
  yMeanValue.textContent = yMean.toFixed(2);
  xStdValue.textContent = xStd.toFixed(2);
  yStdValue.textContent = yStd.toFixed(2);

  const xIsNormal = xModeSelect.value === "normal";
  const yIsNormal = yModeSelect.value === "normal";
  const xPdf = xIsNormal
    ? buildNormalPdf(xMean, xStd, X_RANGE, GRID_SIZE)
    : buildPdf(xPoints, X_RANGE, GRID_SIZE);
  const yPdf = yIsNormal
    ? buildNormalPdf(yMean, yStd, Y_RANGE, GRID_SIZE)
    : buildPdf(yPoints, Y_RANGE, GRID_SIZE);

  renderMarginal(xCtx, xPoints, xPdf, "x", !xIsNormal);
  renderMarginal(yCtx, yPoints, yPdf, "y", !yIsNormal);
  renderJoint(xPdf, yPdf, rho, mix, visualizer);

  const xArea = xPdf.pdf.reduce((sum, v) => sum + v, 0) * xPdf.dx;
  const yArea = yPdf.pdf.reduce((sum, v) => sum + v, 0) * yPdf.dx;
  xAreaValue.textContent = xArea.toFixed(2);
  yAreaValue.textContent = yArea.toFixed(2);
  covMatrix.textContent = `[[${(xStd * xStd).toFixed(2)}, ${(rho * xStd * yStd).toFixed(
    2,
  )}], [${(rho * xStd * yStd).toFixed(2)}, ${(yStd * yStd).toFixed(2)}]]`;
}

function getPointFromEvent(event, canvas, range, orientation) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  const y = (event.clientY - rect.top) / rect.height;
  const dataX = range[0] + x * (range[1] - range[0]);
  const density = Math.max(0, 1 - y) * (DISPLAY_SCALE + 0.1);
  if (orientation === "x") {
    return { x: dataX, y: density };
  }
  return {
    x: range[0] + (1 - y) * (range[1] - range[0]),
    y: x * (DISPLAY_SCALE + 0.1),
  };
}

function findClosestPoint(points, pos, range, canvas, orientation) {
  const threshold = 18;
  let closest = null;
  points.forEach((point) => {
    let px = 0;
    let py = 0;
    if (orientation === "x") {
      px = ((point.x - range[0]) / (range[1] - range[0])) * canvas.width;
      py = canvas.height - point.y * canvas.height * DISPLAY_SCALE;
    } else {
      py = canvas.height - ((point.x - range[0]) / (range[1] - range[0])) * canvas.height;
      px = point.y * canvas.width * DISPLAY_SCALE;
    }
    const dx = pos.x - px;
    const dy = pos.y - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < threshold && (!closest || dist < closest.dist)) {
      closest = { point, dist };
    }
  });
  return closest ? closest.point : null;
}

function attachPointHandlers(canvas, points, range, orientation) {
  const handlePointerDown = (event) => {
    if (orientation === "x" && xModeSelect.value === "normal") return;
    if (orientation === "y" && yModeSelect.value === "normal") return;
    const rect = canvas.getBoundingClientRect();
    const pos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const hit = findClosestPoint(points, pos, range, canvas, orientation);
    if (hit) {
      activePoint = { point: hit, orientation };
    } else {
      const newPoint = getPointFromEvent(event, canvas, range, orientation);
      points.push(newPoint);
      points.sort((a, b) => a.x - b.x);
      update();
    }
  };

  const handlePointerMove = (event) => {
    if (!activePoint || activePoint.orientation !== orientation) return;
    const rect = canvas.getBoundingClientRect();
    const pos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const newPoint = getPointFromEvent(event, canvas, range, orientation);
    activePoint.point.x = clamp(newPoint.x, range[0], range[1]);
    activePoint.point.y = clamp(newPoint.y, 0, 1.2);
    points.sort((a, b) => a.x - b.x);
    update();
  };

  const handlePointerUp = () => {
    activePoint = null;
  };

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);

  canvas.addEventListener("dblclick", (event) => {
    if (orientation === "x" && xModeSelect.value === "normal") return;
    if (orientation === "y" && yModeSelect.value === "normal") return;
    const rect = canvas.getBoundingClientRect();
    const pos = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const hit = findClosestPoint(points, pos, range, canvas, orientation);
    if (hit) {
      const index = points.indexOf(hit);
      if (index >= 0) {
        points.splice(index, 1);
        update();
      }
    }
  });
}

rhoInput.addEventListener("input", update);
mixInput.addEventListener("input", update);
visualizerSelect.addEventListener("change", update);
xModeSelect.addEventListener("change", update);
yModeSelect.addEventListener("change", update);
xMeanInput.addEventListener("input", update);
yMeanInput.addEventListener("input", update);
xStdInput.addEventListener("input", update);
yStdInput.addEventListener("input", update);
randomizeButton.addEventListener("click", () => {
  setDefaultPoints();
  update();
});
clearButton.addEventListener("click", () => {
  xPoints = [];
  yPoints = [];
  update();
});

setDefaultPoints();
attachPointHandlers(xCanvas, xPoints, X_RANGE, "x");
attachPointHandlers(yCanvas, yPoints, Y_RANGE, "y");
update();
