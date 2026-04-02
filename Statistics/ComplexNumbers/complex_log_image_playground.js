(function () {
    "use strict";

    const TAU = Math.PI * 2;

    const elements = {
        fileInput: document.getElementById("file-input"),
        loadDemo: document.getElementById("load-demo"),
        resetOperation: document.getElementById("reset-operation"),
        scaleRange: document.getElementById("scale-range"),
        originXRange: document.getElementById("origin-x-range"),
        originYRange: document.getElementById("origin-y-range"),
        innerCutoffRange: document.getElementById("inner-cutoff-range"),
        aReal: document.getElementById("a-real"),
        aImag: document.getElementById("a-imag"),
        bReal: document.getElementById("b-real"),
        bImag: document.getElementById("b-imag"),
        renderSize: document.getElementById("render-size"),
        scaleValue: document.getElementById("scale-value"),
        originXValue: document.getElementById("origin-x-value"),
        originYValue: document.getElementById("origin-y-value"),
        innerCutoffValue: document.getElementById("inner-cutoff-value"),
        mappingSummary: document.getElementById("mapping-summary"),
        sourceCanvas: document.getElementById("source-canvas"),
        logCanvas: document.getElementById("log-canvas"),
        operatedLogCanvas: document.getElementById("operated-log-canvas"),
        outputCanvas: document.getElementById("output-canvas"),
        presets: Array.from(document.querySelectorAll(".preset"))
    };

    const state = {
        sourceCanvas: document.createElement("canvas"),
        sourceContext: null,
        sourceImageData: null,
        sourceWidth: 0,
        sourceHeight: 0,
        sourceLabel: "Demo pattern",
        pixelsPerUnit: 180,
        originX: 0,
        originY: 0,
        innerCutoffPx: 3,
        a: complex(1, 0),
        b: complex(0, 0),
        renderWidth: 420,
        renderScheduled: false,
        maxRadius: 1
    };

    state.sourceContext = state.sourceCanvas.getContext("2d", { willReadFrequently: true });

    function complex(re, im) {
        return { re, im };
    }

    function sub(a, b) {
        return complex(a.re - b.re, a.im - b.im);
    }

    function div(a, b) {
        const denom = b.re * b.re + b.im * b.im;
        if (denom < 1e-10) {
            return null;
        }
        return complex(
            (a.re * b.re + a.im * b.im) / denom,
            (a.im * b.re - a.re * b.im) / denom
        );
    }

    function expComplex(w) {
        const e = Math.exp(w.re);
        return complex(e * Math.cos(w.im), e * Math.sin(w.im));
    }

    function logComplexPrincipal(z) {
        const radius = Math.hypot(z.re, z.im);
        if (radius < 1e-10) {
            return null;
        }
        return complex(Math.log(radius), Math.atan2(z.im, z.re));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function formatNumber(value, digits) {
        return Number(value).toFixed(digits).replace(/\.00$/, "");
    }

    function formatComplex(z) {
        const sign = z.im >= 0 ? "+" : "-";
        return formatNumber(z.re, 2) + " " + sign + " " + formatNumber(Math.abs(z.im), 2) + "i";
    }

    function getPlaneBounds() {
        return {
            left: (0 - state.originX) / state.pixelsPerUnit,
            right: (state.sourceWidth - state.originX) / state.pixelsPerUnit,
            top: state.originY / state.pixelsPerUnit,
            bottom: (state.originY - state.sourceHeight) / state.pixelsPerUnit
        };
    }

    function getLogBounds() {
        const minRadius = Math.max(state.innerCutoffPx / state.pixelsPerUnit, 1e-4);
        const safeMax = Math.max(state.maxRadius, minRadius * 1.01);
        return {
            uMin: Math.log(minRadius),
            uMax: Math.log(safeMax),
            vMin: -Math.PI,
            vMax: Math.PI
        };
    }

    function complexToSourcePixel(z) {
        return {
            x: state.originX + z.re * state.pixelsPerUnit,
            y: state.originY - z.im * state.pixelsPerUnit
        };
    }

    function previewPixelToComplex(x, y, width, height) {
        const bounds = getPlaneBounds();
        const tx = width <= 1 ? 0 : x / (width - 1);
        const ty = height <= 1 ? 0 : y / (height - 1);
        return complex(
            bounds.left + tx * (bounds.right - bounds.left),
            bounds.top - ty * (bounds.top - bounds.bottom)
        );
    }

    function setCanvasResolution(canvas, width, height) {
        const safeWidth = Math.max(1, Math.round(width));
        const safeHeight = Math.max(1, Math.round(height));
        canvas.width = safeWidth;
        canvas.height = safeHeight;
        canvas.style.aspectRatio = safeWidth + " / " + safeHeight;
        return canvas.getContext("2d");
    }

    function readPixel(data, x, y) {
        const index = (y * state.sourceWidth + x) * 4;
        return [data[index], data[index + 1], data[index + 2], data[index + 3]];
    }

    function writePixel(data, index, color) {
        data[index] = Math.round(color[0]);
        data[index + 1] = Math.round(color[1]);
        data[index + 2] = Math.round(color[2]);
        data[index + 3] = Math.round(color[3]);
    }

    function sampleSource(x, y) {
        if (!state.sourceImageData) {
            return [0, 0, 0, 0];
        }
        if (x < 0 || y < 0 || x > state.sourceWidth - 1 || y > state.sourceHeight - 1) {
            return [0, 0, 0, 0];
        }

        const x0 = Math.floor(x);
        const y0 = Math.floor(y);
        const x1 = Math.min(x0 + 1, state.sourceWidth - 1);
        const y1 = Math.min(y0 + 1, state.sourceHeight - 1);
        const tx = x - x0;
        const ty = y - y0;
        const data = state.sourceImageData.data;

        const c00 = readPixel(data, x0, y0);
        const c10 = readPixel(data, x1, y0);
        const c01 = readPixel(data, x0, y1);
        const c11 = readPixel(data, x1, y1);

        return [
            lerp(lerp(c00[0], c10[0], tx), lerp(c01[0], c11[0], tx), ty),
            lerp(lerp(c00[1], c10[1], tx), lerp(c01[1], c11[1], tx), ty),
            lerp(lerp(c00[2], c10[2], tx), lerp(c01[2], c11[2], tx), ty),
            lerp(lerp(c00[3], c10[3], tx), lerp(c01[3], c11[3], tx), ty)
        ];
    }

    function invertAffine(wPrime) {
        return div(sub(wPrime, state.b), state.a);
    }

    function recalculateDerivedState() {
        const corners = [
            complex((0 - state.originX) / state.pixelsPerUnit, (state.originY - 0) / state.pixelsPerUnit),
            complex((state.sourceWidth - state.originX) / state.pixelsPerUnit, (state.originY - 0) / state.pixelsPerUnit),
            complex((0 - state.originX) / state.pixelsPerUnit, (state.originY - state.sourceHeight) / state.pixelsPerUnit),
            complex((state.sourceWidth - state.originX) / state.pixelsPerUnit, (state.originY - state.sourceHeight) / state.pixelsPerUnit)
        ];

        state.maxRadius = Math.max(
            ...corners.map((corner) => Math.hypot(corner.re, corner.im)),
            state.innerCutoffPx / Math.max(state.pixelsPerUnit, 1)
        );
    }

    function updateInputChips() {
        elements.scaleValue.textContent = Math.round(state.pixelsPerUnit) + " px";
        elements.originXValue.textContent = Math.round(state.originX) + " px";
        elements.originYValue.textContent = Math.round(state.originY) + " px";
        elements.innerCutoffValue.textContent = Math.round(state.innerCutoffPx) + " px";
    }

    function updateSummary() {
        const bounds = getPlaneBounds();
        const logBounds = getLogBounds();
        const expB = expComplex(state.b);
        const determinant = state.a.re * state.a.re + state.a.im * state.a.im;
        const lines = [
            "z = ((x - x0) / s) + i((y0 - y) / s)",
            "w = log(z)",
            "w' = a w + b",
            "z' = exp(w')",
            "",
            "a = " + formatComplex(state.a),
            "b = " + formatComplex(state.b),
            "exp(b) = " + formatComplex(expB),
            "|a|^2 = " + formatNumber(determinant, 3),
            "",
            "z-window:",
            "  Re in [" + formatNumber(bounds.left, 2) + ", " + formatNumber(bounds.right, 2) + "]",
            "  Im in [" + formatNumber(bounds.bottom, 2) + ", " + formatNumber(bounds.top, 2) + "]",
            "",
            "log-window:",
            "  Re(w) in [" + formatNumber(logBounds.uMin, 2) + ", " + formatNumber(logBounds.uMax, 2) + "]",
            "  Im(w) in [-pi, pi]"
        ];

        if (determinant < 1e-10) {
            lines.push("", "Warning: a is too close to 0 for a stable inverse preview.");
        }

        elements.mappingSummary.textContent = lines.join("\n");
    }

    function syncStateFromControls() {
        state.pixelsPerUnit = Number(elements.scaleRange.value);
        state.originX = Number(elements.originXRange.value);
        state.originY = Number(elements.originYRange.value);
        state.innerCutoffPx = Number(elements.innerCutoffRange.value);
        state.a = complex(Number(elements.aReal.value), Number(elements.aImag.value));
        state.b = complex(Number(elements.bReal.value), Number(elements.bImag.value));
        state.renderWidth = Number(elements.renderSize.value);
        recalculateDerivedState();
        updateInputChips();
        updateSummary();
    }

    function scheduleRender() {
        if (state.renderScheduled) {
            return;
        }
        state.renderScheduled = true;
        window.requestAnimationFrame(() => {
            state.renderScheduled = false;
            renderAll();
        });
    }

    function renderAll() {
        if (!state.sourceImageData) {
            return;
        }
        drawSourcePreview();
        renderLogPreview(elements.logCanvas, false);
        renderLogPreview(elements.operatedLogCanvas, true);
        renderOutputPreview();
    }

    function drawSourcePreview() {
        const width = state.renderWidth;
        const height = Math.max(220, Math.round(width * state.sourceHeight / state.sourceWidth));
        const ctx = setCanvasResolution(elements.sourceCanvas, width, height);
        const scaleX = width / state.sourceWidth;
        const scaleY = height / state.sourceHeight;
        const originX = state.originX * scaleX;
        const originY = state.originY * scaleY;
        const radius = state.pixelsPerUnit * scaleX;

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(state.sourceCanvas, 0, 0, width, height);
        ctx.save();
        ctx.strokeStyle = "rgba(255, 243, 224, 0.95)";
        ctx.lineWidth = 1.25;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(originX, 0);
        ctx.lineTo(originX, height);
        ctx.moveTo(0, originY);
        ctx.lineTo(width, originY);
        ctx.stroke();
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(originX, originY, radius, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#fff8dc";
        ctx.beginPath();
        ctx.arc(originX, originY, 4, 0, TAU);
        ctx.fill();
        ctx.restore();
    }

    function renderLogPreview(canvas, transformed) {
        const width = state.renderWidth;
        const height = Math.max(220, Math.round(width * 0.72));
        const ctx = setCanvasResolution(canvas, width, height);
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        const bounds = getLogBounds();

        for (let y = 0; y < height; y += 1) {
            const ty = height <= 1 ? 0 : y / (height - 1);
            const imag = bounds.vMax - ty * (bounds.vMax - bounds.vMin);

            for (let x = 0; x < width; x += 1) {
                const tx = width <= 1 ? 0 : x / (width - 1);
                const real = bounds.uMin + tx * (bounds.uMax - bounds.uMin);
                const wPrime = complex(real, imag);
                const w = transformed ? invertAffine(wPrime) : wPrime;
                if (!w) {
                    continue;
                }

                const sourcePoint = complexToSourcePixel(expComplex(w));
                const color = sampleSource(sourcePoint.x, sourcePoint.y);
                writePixel(data, (y * width + x) * 4, color);
            }
        }

        ctx.putImageData(imageData, 0, 0);
        drawLogGrid(ctx, width, height, bounds);
    }

    function drawLogGrid(ctx, width, height, bounds) {
        ctx.save();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
        ctx.lineWidth = 1;

        for (let u = Math.ceil(bounds.uMin); u <= Math.floor(bounds.uMax); u += 1) {
            const x = ((u - bounds.uMin) / (bounds.uMax - bounds.uMin)) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let step = -4; step <= 4; step += 1) {
            const angle = step * Math.PI / 4;
            const y = ((bounds.vMax - angle) / (bounds.vMax - bounds.vMin)) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.fillStyle = "rgba(255, 250, 245, 0.88)";
        ctx.font = "12px Segoe UI";
        ctx.fillText("Re(w)", 10, 18);
        ctx.save();
        ctx.translate(width - 12, 18);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText("Im(w)", 0, 0);
        ctx.restore();
        ctx.restore();
    }

    function renderOutputPreview() {
        const width = state.renderWidth;
        const height = Math.max(220, Math.round(width * state.sourceHeight / state.sourceWidth));
        const ctx = setCanvasResolution(elements.outputCanvas, width, height);
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let y = 0; y < height; y += 1) {
            for (let x = 0; x < width; x += 1) {
                const zOut = previewPixelToComplex(x, y, width, height);
                const wPrime = logComplexPrincipal(zOut);
                if (!wPrime) {
                    continue;
                }

                const w = invertAffine(wPrime);
                if (!w) {
                    continue;
                }

                const sourcePoint = complexToSourcePixel(expComplex(w));
                const color = sampleSource(sourcePoint.x, sourcePoint.y);
                writePixel(data, (y * width + x) * 4, color);
            }
        }

        ctx.putImageData(imageData, 0, 0);
        drawPlaneAxes(ctx, width, height);
    }

    function drawPlaneAxes(ctx, width, height) {
        const bounds = getPlaneBounds();
        if (bounds.left >= 0 || bounds.right <= 0 || bounds.bottom >= 0 || bounds.top <= 0) {
            return;
        }

        const x = ((0 - bounds.left) / (bounds.right - bounds.left)) * width;
        const y = ((bounds.top - 0) / (bounds.top - bounds.bottom)) * height;

        ctx.save();
        ctx.strokeStyle = "rgba(255, 242, 220, 0.6)";
        ctx.lineWidth = 1.25;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.restore();
    }

    async function handleFileInput(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) {
            return;
        }

        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(bitmap, 0, 0);
        commitSourceCanvas(canvas, file.name);
    }

    function configureControlsForSource() {
        const minDimension = Math.min(state.sourceWidth, state.sourceHeight);
        const defaultScale = Math.max(40, Math.round(minDimension / 2.25));
        const scaleMin = Math.max(20, Math.round(minDimension / 8));
        const scaleMax = Math.max(defaultScale + 40, Math.round(minDimension * 2.5));

        elements.scaleRange.min = String(scaleMin);
        elements.scaleRange.max = String(scaleMax);
        elements.scaleRange.value = String(defaultScale);
        elements.originXRange.min = "0";
        elements.originXRange.max = String(state.sourceWidth);
        elements.originXRange.value = String(Math.round(state.sourceWidth / 2));
        elements.originYRange.min = "0";
        elements.originYRange.max = String(state.sourceHeight);
        elements.originYRange.value = String(Math.round(state.sourceHeight / 2));
        elements.innerCutoffRange.min = "1";
        elements.innerCutoffRange.max = String(Math.max(6, Math.round(minDimension / 4)));
        elements.innerCutoffRange.value = String(Math.max(2, Math.round(minDimension / 160)));
    }

    function commitSourceCanvas(canvas, label) {
        state.sourceCanvas.width = canvas.width;
        state.sourceCanvas.height = canvas.height;
        state.sourceContext.clearRect(0, 0, canvas.width, canvas.height);
        state.sourceContext.drawImage(canvas, 0, 0);
        state.sourceWidth = canvas.width;
        state.sourceHeight = canvas.height;
        state.sourceLabel = label;
        state.sourceImageData = state.sourceContext.getImageData(0, 0, canvas.width, canvas.height);
        configureControlsForSource();
        syncStateFromControls();
        scheduleRender();
    }

    function paintCornerMarker(ctx, x, y, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, TAU);
        ctx.fill();
    }

    function loadDemoPattern() {
        const width = 720;
        const height = 540;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const background = ctx.createLinearGradient(0, 0, width, height);
        background.addColorStop(0, "#04131f");
        background.addColorStop(0.55, "#15314c");
        background.addColorStop(1, "#1c514f");
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);

        for (let row = 0; row < 9; row += 1) {
            for (let col = 0; col < 12; col += 1) {
                const x = (col / 12) * width;
                const y = (row / 9) * height;
                const hue = 18 + col * 18 + row * 6;
                ctx.fillStyle = "hsla(" + hue + ", 85%, 62%, 0.22)";
                ctx.fillRect(x, y, width / 12, height / 9);
            }
        }

        const centerX = width / 2;
        const centerY = height / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        for (let ring = 1; ring <= 7; ring += 1) {
            ctx.strokeStyle = "hsla(" + (20 + ring * 24) + ", 92%, 74%, 0.5)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, ring * 34, 0, TAU);
            ctx.stroke();
        }

        for (let spoke = 0; spoke < 24; spoke += 1) {
            const angle = (spoke / 24) * TAU;
            ctx.strokeStyle = spoke % 6 === 0 ? "rgba(255, 253, 240, 0.75)" : "rgba(210, 226, 255, 0.24)";
            ctx.lineWidth = spoke % 6 === 0 ? 2.2 : 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * 260, Math.sin(angle) * 260);
            ctx.stroke();
        }
        ctx.fillStyle = "rgba(255, 246, 228, 0.95)";
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, TAU);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = "rgba(255, 247, 230, 0.88)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.moveTo(centerX, 0);
        ctx.lineTo(centerX, height);
        ctx.stroke();
        ctx.font = "700 40px Segoe UI";
        ctx.fillStyle = "rgba(255, 247, 230, 0.9)";
        ctx.fillText("Complex Log Demo", 34, 56);
        ctx.font = "600 20px Segoe UI";
        ctx.fillStyle = "rgba(229, 242, 255, 0.84)";
        ctx.fillText("rings, spokes, gradients, and asymmetry", 34, 86);

        paintCornerMarker(ctx, 68, 112, "#ff8a00");
        paintCornerMarker(ctx, width - 74, 102, "#38bdf8");
        paintCornerMarker(ctx, 88, height - 88, "#22c55e");
        paintCornerMarker(ctx, width - 82, height - 96, "#f472b6");

        commitSourceCanvas(canvas, "Generated demo pattern");
    }

    function resetOperation() {
        elements.aReal.value = "1";
        elements.aImag.value = "0";
        elements.bReal.value = "0";
        elements.bImag.value = "0";
        syncStateFromControls();
        scheduleRender();
    }

    function attachEvents() {
        elements.fileInput.addEventListener("change", (event) => {
            handleFileInput(event).catch((error) => {
                console.error("Failed to load image:", error);
            });
        });

        elements.loadDemo.addEventListener("click", loadDemoPattern);
        elements.resetOperation.addEventListener("click", resetOperation);

        [
            elements.scaleRange,
            elements.originXRange,
            elements.originYRange,
            elements.innerCutoffRange,
            elements.aReal,
            elements.aImag,
            elements.bReal,
            elements.bImag,
            elements.renderSize
        ].forEach((control) => {
            control.addEventListener("input", () => {
                syncStateFromControls();
                scheduleRender();
            });
        });

        elements.presets.forEach((button) => {
            button.addEventListener("click", () => {
                elements.aReal.value = button.dataset.aReal;
                elements.aImag.value = button.dataset.aImag;
                elements.bReal.value = button.dataset.bReal;
                elements.bImag.value = button.dataset.bImag;
                syncStateFromControls();
                scheduleRender();
            });
        });

        window.addEventListener("resize", scheduleRender);
    }

    attachEvents();
    loadDemoPattern();
})();
