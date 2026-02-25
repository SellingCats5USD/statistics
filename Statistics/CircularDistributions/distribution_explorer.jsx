import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const N_POINTS = 300;
const DOMAIN = [-Math.PI, Math.PI];

// Modified Bessel I0
function besselI0(x) {
  const ax = Math.abs(x);
  if (ax < 3.75) {
    const y = (x / 3.75) ** 2;
    return 1 + y*(3.5156229 + y*(3.0899424 + y*(1.2067492 + y*(0.2659732 + y*(0.0360768 + y*0.0045813)))));
  } else {
    const y = 3.75 / ax;
    return (Math.exp(ax)/Math.sqrt(ax)) * (0.39894228 + y*(0.01328592 + y*(0.00225319 + y*(-0.00157565 + y*(0.00916281 + y*(-0.02057706 + y*(0.02635537 + y*(-0.01647633 + y*0.00392377))))))));
  }
}

// Normal pdf
function normalPdf(x, mu, sigma) {
  return Math.exp(-0.5*((x-mu)/sigma)**2) / (sigma * Math.sqrt(2*Math.PI));
}

// Wrapped normal: sum over k wraps
function wrappedNormal(x, sigma, nWraps = 15) {
  let sum = 0;
  for (let k = -nWraps; k <= nWraps; k++) {
    sum += normalPdf(x + 2*Math.PI*k, 0, sigma);
  }
  return sum;
}

// Truncated normal on [-pi, pi]
function truncatedNormal(x, sigma) {
  const lo = DOMAIN[0], hi = DOMAIN[1];
  // CDF of standard normal
  function erf(z) {
    const t = 1/(1+0.3275911*Math.abs(z));
    const poly = t*(0.254829592 + t*(-0.284496736 + t*(1.421413741 + t*(-1.453152027 + t*1.061405429))));
    const val = 1 - poly*Math.exp(-z*z);
    return z >= 0 ? val : -val;
  }
  function Phi(z) { return 0.5*(1 + erf(z/Math.sqrt(2))); }
  const Z = Phi(hi/sigma) - Phi(lo/sigma);
  return normalPdf(x, 0, sigma) / Z;
}

// Censored normal: pile mass at boundaries
function censoredNormal(x, sigma, bins) {
  // Returns density + delta masses at boundaries
  // We'll represent as a continuous density + boundary spikes
  function erf(z) {
    const t = 1/(1+0.3275911*Math.abs(z));
    const poly = t*(0.254829592 + t*(-0.284496736 + t*(1.421413741 + t*(-1.453152027 + t*1.061405429))));
    const val = 1 - poly*Math.exp(-z*z);
    return z >= 0 ? val : -val;
  }
  function Phi(z) { return 0.5*(1 + erf(z/Math.sqrt(2))); }
  const lo = DOMAIN[0], hi = DOMAIN[1];
  const massBelow = Phi(lo/sigma);
  const massAbove = 1 - Phi(hi/sigma);
  const massInside = normalPdf(x, 0, sigma);
  // distribute boundary mass into edge bins
  return { continuous: massInside, massBelow, massAbove };
}

// Von Mises: exp(kappa*cos(x)) / (2pi*I0(kappa))
function vonMises(x, kappa) {
  if (kappa < 1e-6) return 1/(2*Math.PI);
  return Math.exp(kappa * Math.cos(x)) / (2*Math.PI*besselI0(kappa));
}

// Total variation distance from uniform (1/(2pi))
function tvFromUniform(densityArr, dx) {
  const unif = 1/(2*Math.PI);
  return 0.5 * densityArr.reduce((s, d) => s + Math.abs(d - unif)*dx, 0);
}

const COLORS = {
  wrapped: "#6366f1",
  truncated: "#f59e0b",
  censored: "#ef4444",
  vonMises: "#10b981",
  uniform: "#94a3b8",
};

export default function App() {
  const [sigma, setSigma] = useState(1.0);
  const [showConvergence, setShowConvergence] = useState(false);

  const kappa = 1 / (sigma * sigma);
  const xs = useMemo(() => Array.from({length: N_POINTS}, (_, i) => DOMAIN[0] + (i/(N_POINTS-1))*(DOMAIN[1]-DOMAIN[0])), []);
  const dx = (DOMAIN[1]-DOMAIN[0])/(N_POINTS-1);

  const densityData = useMemo(() => {
    return xs.map((x, i) => {
      const wr = wrappedNormal(x, sigma);
      const tr = truncatedNormal(x, sigma);
      const vm = vonMises(x, kappa);
      const { continuous: cens, massBelow, massAbove } = censoredNormal(x, sigma);
      // Add boundary spikes to first/last bins
      let censVal = cens;
      if (i === 0) censVal += massBelow / dx * 0.15; // visual spike
      if (i === N_POINTS-1) censVal += massAbove / dx * 0.15;
      return {
        x: parseFloat(x.toFixed(3)),
        wrapped: parseFloat(wr.toFixed(5)),
        truncated: parseFloat(tr.toFixed(5)),
        vonMises: parseFloat(vm.toFixed(5)),
        censored: parseFloat(censVal.toFixed(5)),
        uniform: parseFloat((1/(2*Math.PI)).toFixed(5)),
      };
    });
  }, [sigma, kappa, xs]);

  // Convergence curves over range of sigmas
  const convergenceData = useMemo(() => {
    const sigmas = Array.from({length: 80}, (_, i) => 0.3 + i * 0.08);
    return sigmas.map(s => {
      const k = 1/(s*s);
      const wrArr = xs.map(x => wrappedNormal(x, s));
      const trArr = xs.map(x => truncatedNormal(x, s));
      const vmArr = xs.map(x => vonMises(x, k));
      return {
        sigma: parseFloat(s.toFixed(2)),
        wrapped: parseFloat(tvFromUniform(wrArr, dx).toFixed(5)),
        truncated: parseFloat(tvFromUniform(trArr, dx).toFixed(5)),
        vonMises: parseFloat(tvFromUniform(vmArr, dx).toFixed(5)),
      };
    });
  }, [xs, dx]);

  const uniformVal = (1/(2*Math.PI)).toFixed(4);

  return (
    <div style={{fontFamily: "system-ui, sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", padding: "24px"}}>
      <h1 style={{fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#f1f5f9"}}>
        Circular vs Bounded Distribution Explorer
      </h1>
      <p style={{fontSize: 13, color: "#94a3b8", marginBottom: 20}}>
        Compare how distributions on [−π, π] approach uniformity as σ grows.
      </p>

      {/* Controls */}
      <div style={{display: "flex", alignItems: "center", gap: 24, marginBottom: 24, flexWrap: "wrap"}}>
        <div style={{display: "flex", flexDirection: "column", gap: 6}}>
          <label style={{fontSize: 13, color: "#94a3b8"}}>
            σ = <strong style={{color: "#f1f5f9"}}>{sigma.toFixed(2)}</strong>
            <span style={{fontSize: 11, marginLeft: 8, color: "#64748b"}}>
              (κ = {kappa.toFixed(3)} for von Mises)
            </span>
          </label>
          <input type="range" min={0.2} max={6} step={0.05} value={sigma}
            onChange={e => setSigma(parseFloat(e.target.value))}
            style={{width: 260, accentColor: "#6366f1"}}
          />
          <div style={{display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", width: 260}}>
            <span>concentrated</span><span>spread</span>
          </div>
        </div>

        <div style={{display: "flex", gap: 8}}>
          <button onClick={() => setShowConvergence(false)}
            style={{padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
              background: !showConvergence ? "#6366f1" : "#1e293b", color: !showConvergence ? "white" : "#94a3b8"}}>
            Density
          </button>
          <button onClick={() => setShowConvergence(true)}
            style={{padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13,
              background: showConvergence ? "#6366f1" : "#1e293b", color: showConvergence ? "white" : "#94a3b8"}}>
            Convergence to Uniform
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap"}}>
        {[
          {key: "wrapped", label: "Wrapped Normal"},
          {key: "truncated", label: "Truncated Normal"},
          {key: "censored", label: "Censored Normal"},
          {key: "vonMises", label: "Von Mises"},
          {key: "uniform", label: `Uniform (${uniformVal})`},
        ].map(({key, label}) => (
          <div key={key} style={{display: "flex", alignItems: "center", gap: 6}}>
            <div style={{width: 20, height: 3, background: COLORS[key], borderRadius: 2}}/>
            <span style={{fontSize: 12, color: "#94a3b8"}}>{label}</span>
          </div>
        ))}
      </div>

      {!showConvergence ? (
        <>
          <div style={{background: "#1e293b", borderRadius: 12, padding: "16px 8px 8px", marginBottom: 16}}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={densityData} margin={{top: 5, right: 20, left: 0, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="x" tickFormatter={v => {
                  const labels = {"-3.142": "-π", "-1.571": "-π/2", "0": "0", "1.571": "π/2", "3.142": "π"};
                  return labels[v] || "";
                }} tick={{fill: "#64748b", fontSize: 11}} />
                <YAxis tick={{fill: "#64748b", fontSize: 11}} width={50} />
                <Tooltip
                  contentStyle={{background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12}}
                  labelFormatter={v => `θ = ${parseFloat(v).toFixed(3)}`}
                />
                <Line type="monotone" dataKey="wrapped" stroke={COLORS.wrapped} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="truncated" stroke={COLORS.truncated} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="censored" stroke={COLORS.censored} dot={false} strokeWidth={2} strokeDasharray="4 2" />
                <Line type="monotone" dataKey="vonMises" stroke={COLORS.vonMises} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="uniform" stroke={COLORS.uniform} dot={false} strokeWidth={1} strokeDasharray="6 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* TV distance badges */}
          <div style={{display: "flex", gap: 12, flexWrap: "wrap"}}>
            {[
              {key: "wrapped", label: "Wrapped Normal", arr: densityData.map(d=>d.wrapped)},
              {key: "truncated", label: "Truncated Normal", arr: densityData.map(d=>d.truncated)},
              {key: "vonMises", label: "Von Mises", arr: densityData.map(d=>d.vonMises)},
            ].map(({key, label, arr}) => {
              const tv = tvFromUniform(arr, dx);
              return (
                <div key={key} style={{background: "#1e293b", borderRadius: 8, padding: "10px 16px", borderLeft: `3px solid ${COLORS[key]}`}}>
                  <div style={{fontSize: 11, color: "#64748b"}}>{label}</div>
                  <div style={{fontSize: 18, fontWeight: 700, color: COLORS[key]}}>{tv.toFixed(4)}</div>
                  <div style={{fontSize: 10, color: "#475569"}}>TV distance from uniform</div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{background: "#1e293b", borderRadius: 12, padding: "16px 8px 8px", marginBottom: 12}}>
            <p style={{fontSize: 12, color: "#64748b", margin: "0 0 8px 40px"}}>Total Variation distance from uniform vs σ (log scale)</p>
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={convergenceData} margin={{top: 5, right: 20, left: 0, bottom: 5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="sigma" tick={{fill: "#64748b", fontSize: 11}} label={{value: "σ", position: "insideRight", fill: "#64748b", fontSize: 12}} />
                <YAxis scale="log" domain={["auto","auto"]} tick={{fill: "#64748b", fontSize: 11}} width={60}
                  tickFormatter={v => v < 0.001 ? v.toExponential(0) : v.toFixed(3)} />
                <Tooltip
                  contentStyle={{background: "#0f172a", border: "1px solid #334155", borderRadius: 8, fontSize: 12}}
                  labelFormatter={v => `σ = ${v}`}
                  formatter={(v, n) => [v.toExponential(4), n]}
                />
                {/* Current sigma marker */}
                <Line type="monotone" dataKey="wrapped" stroke={COLORS.wrapped} dot={false} strokeWidth={2.5} />
                <Line type="monotone" dataKey="truncated" stroke={COLORS.truncated} dot={false} strokeWidth={2.5} />
                <Line type="monotone" dataKey="vonMises" stroke={COLORS.vonMises} dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{background: "#1e293b", borderRadius: 10, padding: 14, fontSize: 13, color: "#94a3b8", lineHeight: 1.7}}>
            <strong style={{color: "#f1f5f9"}}>Rate summary:</strong>{" "}
            Wrapped normal TV ∝ e<sup>−σ²/2</sup> (exponential in σ²).{" "}
            Von Mises TV ∝ e<sup>−κ</sup> = e<sup>−1/σ²</sup> (exponential in 1/σ²).{" "}
            Truncated normal TV ∝ σ<sup>−2</sup> (polynomial). The log-scale gap is the{" "}
            <em>topological advantage</em> of the circle — no boundary, no pile-up.
          </div>
        </>
      )}
    </div>
  );
}
