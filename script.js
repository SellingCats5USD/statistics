const canvas = document.getElementById("jointCanvas");
const ctx = canvas.getContext("2d");
const copulaSelect = document.getElementById("copula");
const rhoSlider = document.getElementById("rho");
const rhoValue = document.getElementById("rhoValue");
const smoothingSlider = document.getElementById("smoothing");
const smoothingValue = document.getElementById("smoothingValue");
const randomizeButton = document.getElementById("randomize");
const clearButton = document.getElementById("clear");

const layout = {
  padding: 40,
  topHeight: 120,
  rightWidth: 120,
  jointSize: 400,
};

const dataRange = {
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
};

const gridSize = 80;

let xPoints = [
  { x: -4.5, y: 0.0 },
  { x: -2.8, y: 0.12 },
  { x: -0.5, y: 0.06 },
  { x: 1.2, y: 0.1 },
  { x: 3.5, y: 0.02 },
];

let yPoints = [
  { x: -4.3, y: 0.02 },
  { x: -2.0, y: 0.11 },
  { x: -0.5, y: 0.04 },
  { x: 1.8, y: 0.07 },
  { x: 3.8, y: 0.03 },
];

function map(value, inMin, inMax, outMin, outMax) {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function getJointRect() {
  return {
    x: layout.padding,
    y: layout.padding + layout.topHeight,
    size: layout.jointSize,
  };
}

function sortPoints(points) {
  return points.slice().sort((a, b) => a.x - b.x);
}

function buildPdf(points, min, max, samples, smoothing) {
  const sorted = sortPoints(points).filter((pt) => pt.y >= 0);
  const xs = [];
  const pdf = [];
  for (let i = 0; i < samples; i += 1) {
    const x = min + (i / (samples - 1)) * (max - min);
    xs.push(x);
    pdf.push(interpolateValue(sorted, x));
  }

  if (smoothing > 0) {
    const smoothed = gaussianSmooth(pdf, smoothing);
    for (let i = 0; i < pdf.length; i += 1) {
      pdf[i] = smoothed[i];
    }
  }

  const area = pdf.reduce((sum, value, i) => {
    if (i === 0) {
      return sum;
    }
    const dx = xs[i] - xs[i - 1];
    return sum + 0.5 * dx * (pdf[i] + pdf[i - 1]);
  }, 0);

  if (area > 0) {
    for (let i = 0; i < pdf.length; i += 1) {
      pdf[i] /= area;
    }
  }

  const cdf = [];
  let cumulative = 0;
  cdf.push(0);
  for (let i = 1; i < pdf.length; i += 1) {
    const dx = xs[i] - xs[i - 1];
    cumulative += 0.5 * dx * (pdf[i] + pdf[i - 1]);
    cdf.push(Math.min(1, cumulative));
  }

  return { xs, pdf, cdf };
}

function interpolateValue(points, x) {
  if (points.length === 0) {
    return 0;
  }
  if (x <= points[0].x) {
    return points[0].y;
  }
  if (x >= points[points.length - 1].x) {
    return points[points.length - 1].y;
  }
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    if (x >= left.x && x <= right.x) {
      const t = (x - left.x) / (right.x - left.x);
      return left.y + t * (right.y - left.y);
    }
  }
  return 0;
}

function gaussianSmooth(values, radius) {
  if (radius <= 0) {
    return values;
  }
  const kernel = [];
  const sigma = radius / 2;
  const kernelSize = radius * 4 + 1;
  let sum = 0;
  for (let i = 0; i < kernelSize; i += 1) {
    const x = i - kernelSize / 2;
    const w = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(w);
    sum += w;
  }
  for (let i = 0; i < kernel.length; i += 1) {
    kernel[i] /= sum;
  }
  const smoothed = new Array(values.length).fill(0);
  for (let i = 0; i < values.length; i += 1) {
    let acc = 0;
    for (let k = 0; k < kernel.length; k += 1) {
      const idx = i + k - Math.floor(kernel.length / 2);
      if (idx >= 0 && idx < values.length) {
        acc += values[idx] * kernel[k];
      }
    }
    smoothed[i] = acc;
  }
  return smoothed;
}

function normalInverse(p) {
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

  if (p <= 0) {
    return -Infinity;
  }
  if (p >= 1) {
    return Infinity;
  }

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

function gaussianCopulaDensity(u, v, rho) {
  const clampedU = Math.min(0.9999, Math.max(0.0001, u));
  const clampedV = Math.min(0.9999, Math.max(0.0001, v));
  const z1 = normalInverse(clampedU);
  const z2 = normalInverse(clampedV);
  const rho2 = rho * rho;
  const denom = Math.sqrt(1 - rho2);
  const exponent =
    (rho2 * (z1 * z1 + z2 * z2) - 2 * rho * z1 * z2) /
    (2 * (1 - rho2));
  return Math.exp(-exponent) / denom;
}

function computeJointDensity(marginalX, marginalY) {
  const joint = [];
  const rho = Number(rhoSlider.value);
  const useGaussian = copulaSelect.value === "gaussian";
  const xCount = marginalX.xs.length;
  const yCount = marginalY.xs.length;
  for (let yi = 0; yi < yCount; yi += 1) {
    const row = [];
    for (let xi = 0; xi < xCount; xi += 1) {
      const fx = marginalX.pdf[xi];
      const fy = marginalY.pdf[yi];
      const u = marginalX.cdf[xi];
      const v = marginalY.cdf[yi];
      const copula = useGaussian ? gaussianCopulaDensity(u, v, rho) : 1;
      row.push(copula * fx * fy);
    }
    joint.push(row);
  }
  return joint;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const smoothing = Number(smoothingSlider.value);
  const marginalX = buildPdf(xPoints, dataRange.xMin, dataRange.xMax, 200, smoothing);
  const marginalY = buildPdf(yPoints, dataRange.yMin, dataRange.yMax, 200, smoothing);
  const joint = computeJointDensity(marginalX, marginalY);

  drawJointHeatmap(joint, marginalX, marginalY);
  drawMargins(marginalX, marginalY);
  drawAxes();
  drawPoints();
}

function drawJointHeatmap(joint, marginalX, marginalY) {
  const rect = getJointRect();
  const xCount = joint[0].length;
  const yCount = joint.length;
  const cellSize = rect.size / xCount;
  let maxValue = 0;
  joint.forEach((row) => {
    row.forEach((value) => {
      if (value > maxValue) {
        maxValue = value;
      }
    });
  });
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.size, rect.y);
  gradient.addColorStop(0, "rgba(55, 107, 214, 0.05)");
  gradient.addColorStop(1, "rgba(55, 107, 214, 0.85)");

  for (let yi = 0; yi < yCount; yi += 1) {
    for (let xi = 0; xi < xCount; xi += 1) {
      const value = joint[yi][xi] / (maxValue || 1);
      ctx.fillStyle = `rgba(55, 107, 214, ${0.08 + value * 0.65})`;
      ctx.fillRect(
        rect.x + xi * cellSize,
        rect.y + (yCount - 1 - yi) * cellSize,
        cellSize,
        cellSize
      );
    }
  }

  ctx.strokeStyle = "rgba(55, 107, 214, 0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.x, rect.y, rect.size, rect.size);
}

function drawMargins(marginalX, marginalY) {
  const rect = getJointRect();
  const topRect = {
    x: rect.x,
    y: rect.y - layout.topHeight,
    width: rect.size,
    height: layout.topHeight - 16,
  };
  const rightRect = {
    x: rect.x + rect.size + 16,
    y: rect.y,
    width: layout.rightWidth - 16,
    height: rect.size,
  };

  drawMarginalLine(marginalX, topRect, "x");
  drawMarginalLine(marginalY, rightRect, "y");
}

function drawMarginalLine(marginal, rect, axis) {
  const maxValue = Math.max(...marginal.pdf, 0.0001);
  ctx.strokeStyle = "rgba(55, 107, 214, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  marginal.xs.forEach((xValue, index) => {
    const yValue = marginal.pdf[index];
    const t = axis === "x"
      ? map(xValue, dataRange.xMin, dataRange.xMax, rect.x, rect.x + rect.width)
      : map(xValue, dataRange.yMin, dataRange.yMax, rect.y + rect.height, rect.y);
    const v = axis === "x"
      ? map(yValue, 0, maxValue, rect.y + rect.height, rect.y)
      : map(yValue, 0, maxValue, rect.x, rect.x + rect.width);
    if (index === 0) {
      ctx.moveTo(axis === "x" ? t : v, axis === "x" ? v : t);
    } else {
      ctx.lineTo(axis === "x" ? t : v, axis === "x" ? v : t);
    }
  });
  ctx.stroke();

  ctx.fillStyle = "rgba(55, 107, 214, 0.15)";
  ctx.lineTo(axis === "x" ? rect.x + rect.width : rect.x, axis === "x" ? rect.y + rect.height : rect.y + rect.height);
  ctx.lineTo(axis === "x" ? rect.x : rect.x, axis === "x" ? rect.y + rect.height : rect.y);
  ctx.closePath();
  ctx.fill();
}

function drawAxes() {
  const rect = getJointRect();
  ctx.strokeStyle = "rgba(31, 41, 55, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rect.x, rect.y + rect.size / 2);
  ctx.lineTo(rect.x + rect.size, rect.y + rect.size / 2);
  ctx.moveTo(rect.x + rect.size / 2, rect.y);
  ctx.lineTo(rect.x + rect.size / 2, rect.y + rect.size);
  ctx.stroke();

  ctx.fillStyle = "#334155";
  ctx.font = "12px Inter, system-ui";
  ctx.fillText("x", rect.x + rect.size + 8, rect.y + rect.size / 2 + 4);
  ctx.fillText("y", rect.x + rect.size / 2 - 4, rect.y - 8);
}

function drawPoints() {
  const rect = getJointRect();
  const topRect = {
    x: rect.x,
    y: rect.y - layout.topHeight,
    width: rect.size,
    height: layout.topHeight - 16,
  };
  const rightRect = {
    x: rect.x + rect.size + 16,
    y: rect.y,
    width: layout.rightWidth - 16,
    height: rect.size,
  };

  drawPointSet(xPoints, topRect, "x");
  drawPointSet(yPoints, rightRect, "y");
}

function drawPointSet(points, rect, axis) {
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  points.forEach((pt) => {
    const t = axis === "x"
      ? map(pt.x, dataRange.xMin, dataRange.xMax, rect.x, rect.x + rect.width)
      : map(pt.x, dataRange.yMin, dataRange.yMax, rect.y + rect.height, rect.y);
    const v = axis === "x"
      ? map(pt.y, 0, 0.2, rect.y + rect.height, rect.y)
      : map(pt.y, 0, 0.2, rect.x, rect.x + rect.width);
    const cx = axis === "x" ? t : v;
    const cy = axis === "x" ? v : t;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

function addPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const jointRect = getJointRect();
  const topRect = {
    x: jointRect.x,
    y: jointRect.y - layout.topHeight,
    width: jointRect.size,
    height: layout.topHeight - 16,
  };
  const rightRect = {
    x: jointRect.x + jointRect.size + 16,
    y: jointRect.y,
    width: layout.rightWidth - 16,
    height: jointRect.size,
  };

  if (y >= topRect.y && y <= topRect.y + topRect.height && x >= topRect.x && x <= topRect.x + topRect.width) {
    const dataX = map(x, topRect.x, topRect.x + topRect.width, dataRange.xMin, dataRange.xMax);
    const density = map(y, topRect.y + topRect.height, topRect.y, 0, 0.2);
    xPoints.push({ x: dataX, y: Math.max(0, density) });
    xPoints = sortPoints(xPoints).slice(-12);
    draw();
    return;
  }

  if (x >= rightRect.x && x <= rightRect.x + rightRect.width && y >= rightRect.y && y <= rightRect.y + rightRect.height) {
    const dataY = map(y, rightRect.y + rightRect.height, rightRect.y, dataRange.yMin, dataRange.yMax);
    const density = map(x, rightRect.x, rightRect.x + rightRect.width, 0, 0.2);
    yPoints.push({ x: dataY, y: Math.max(0, density) });
    yPoints = sortPoints(yPoints).slice(-12);
    draw();
  }
}

function randomizePoints() {
  xPoints = generateRandomPoints();
  yPoints = generateRandomPoints();
  draw();
}

function generateRandomPoints() {
  const count = 6 + Math.floor(Math.random() * 4);
  const points = [];
  for (let i = 0; i < count; i += 1) {
    points.push({
      x: dataRange.xMin + Math.random() * (dataRange.xMax - dataRange.xMin),
      y: Math.random() * 0.18,
    });
  }
  return sortPoints(points);
}

function clearPoints() {
  xPoints = [];
  yPoints = [];
  draw();
}

function updateControls() {
  rhoValue.textContent = Number(rhoSlider.value).toFixed(2);
  smoothingValue.textContent = smoothingSlider.value;
  const useGaussian = copulaSelect.value === "gaussian";
  rhoSlider.disabled = !useGaussian;
  rhoSlider.style.opacity = useGaussian ? "1" : "0.4";
}

canvas.addEventListener("click", addPoint);
randomizeButton.addEventListener("click", randomizePoints);
clearButton.addEventListener("click", clearPoints);

[copulaSelect, rhoSlider, smoothingSlider].forEach((control) =>
  control.addEventListener("input", () => {
    updateControls();
    draw();
  })
);

updateControls();
draw();
