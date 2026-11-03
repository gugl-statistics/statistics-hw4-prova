// ===================================================================
// main.js - connects the page controls to welford.js and charts.js
// ===================================================================
const $ = (id) => document.getElementById(id);
const fmt = (x, d = 4) => {
  if (x === null || x === undefined || !isFinite(x)) return "-";
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-4 || a >= 1e9)) return x.toExponential(3);
  return (+x.toPrecision(d)).toLocaleString("en-US", { maximumFractionDigits: 8 });
};
const fix = (x, d = 4) => (isFinite(x) ? x.toFixed(d) : "-");
const normPdf = (x, m, s) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
const NS = [2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

// =================================================== Ex 1: step-through table
let wf = null;
function wfReset() {
  const xs = $("wf-data").value.split(/[,;\s]+/).filter((s) => s.trim() !== "").map(Number).filter(isFinite);
  wf = { xs, i: 0, st: { k: 0, mean: 0, ss: 0 }, rows: [] };
  wfRender();
}
function wfStep() {
  if (!wf) wfReset();
  if (wf.i >= wf.xs.length) return;
  const x = wf.xs[wf.i++];
  const prevMean = wf.st.mean, prevVar = wf.st.k > 1 ? wf.st.ss / (wf.st.k - 1) : NaN;
  const d = welfordUpdate(wf.st, x);
  const k = wf.st.k;
  // variance through its own recurrence, to check it gives the same as ss/(k-1)
  const varRec = k === 1 ? NaN : k === 2 ? (d * d) / k : ((k - 2) / (k - 1)) * prevVar + (d * d) / k;
  wf.rows.push({ k, x, prevMean, d, mean: wf.st.mean, corr: d * (x - wf.st.mean), ss: wf.st.ss, v: sampleVar(wf.st), varRec });
  wfRender();
}
function wfRender() {
  let t = `<tr><th class="num">k</th><th class="num">x<sub>k</sub></th><th class="num">M<sub>k−1</sub></th><th class="num">δ = x<sub>k</sub> − M<sub>k−1</sub></th>` +
          `<th class="num">M<sub>k</sub> = M<sub>k−1</sub> + δ/k</th><th class="num">δ·(x<sub>k</sub> − M<sub>k</sub>)</th><th class="num">S<sub>k</sub></th><th class="num">s²<sub>k</sub> = S<sub>k</sub>/(k−1)</th><th class="num">s²<sub>k</sub> by its recurrence</th></tr>`;
  for (const r of wf.rows) {
    t += `<tr><td class="num">${r.k}</td><td class="num">${fmt(r.x, 6)}</td><td class="num">${fmt(r.prevMean, 6)}</td><td class="num">${fmt(r.d, 6)}</td>` +
         `<td class="num">${fmt(r.mean, 6)}</td><td class="num">${fmt(r.corr, 6)}</td><td class="num">${fmt(r.ss, 6)}</td><td class="num">${fmt(r.v, 6)}</td><td class="num">${fmt(r.varRec, 6)}</td></tr>`;
  }
  if (!wf.rows.length) t += `<tr><td colspan="9" style="color:var(--muted)">press "Next observation" (M<sub>0</sub> = 0, S<sub>0</sub> = 0)</td></tr>`;
  $("wf-table").innerHTML = t;
  const used = wf.xs.slice(0, wf.i);
  if (used.length >= 2) {
    const mean = used.reduce((a, b) => a + b, 0) / used.length;
    const v = used.reduce((a, b) => a + (b - mean) ** 2, 0) / (used.length - 1);
    $("wf-check").innerHTML = `Check with the two-pass definition on the first ${used.length} values: mean = <span class="s">${fmt(mean, 8)}</span>, ` +
      `s² = Σ(x − x̄)²/(n − 1) = <span class="s">${fmt(v, 8)}</span> &nbsp;·&nbsp; Welford: mean = <span class="k">${fmt(wf.st.mean, 8)}</span>, s² = <span class="k">${fmt(sampleVar(wf.st), 8)}</span>`;
  } else $("wf-check").textContent = wf.xs.length ? `${wf.xs.length - wf.i} observations left` : "no valid numbers in the input";
  $("wf-step").disabled = wf.i >= wf.xs.length;
}
$("wf-step").onclick = wfStep;
$("wf-all").onclick = () => { if (!wf) wfReset(); while (wf.i < wf.xs.length) wfStep(); };
$("wf-reset").onclick = wfReset;
$("wf-data").onchange = wfReset;
$("wf-rand").onclick = () => {
  const r = makeRng((Math.random() * 2 ** 32) >>> 0);
  $("wf-data").value = Array.from({ length: 8 }, () => DISTS.beta25.draw(r).toFixed(2)).join(", ");
  wfReset();
};

// =================================================== Ex 1: cancellation
function drawCancel() {
  const e = +$("cc-shift").value;
  $("cc-sv").textContent = e;
  let t = `<tr><th class="num">shift</th><th class="num">naive (Σx² − (Σx)²/n)/(n−1)</th><th class="num">Welford</th><th class="num">true value</th></tr>`;
  for (let j = Math.max(0, e - 3); j <= e; j++) {
    const xs = [4, 7, 13, 16].map((v) => v + 10 ** j);
    const st = { k: 0, mean: 0, ss: 0 };
    xs.forEach((x) => welfordUpdate(st, x));
    const nv = naiveVar(xs), wv = sampleVar(st);
    const bad = (v) => (Math.abs(v - 30) > 1e-6 ? ` class="bad"` : ` class="ok"`);
    t += `<tr${j === e ? ' class="best"' : ""}><td class="num">10^${j}</td><td class="num"><span${bad(nv)}>${fmt(nv, 8)}</span></td><td class="num"><span${bad(wv)}>${fmt(wv, 8)}</span></td><td class="num">30</td></tr>`;
  }
  $("cc-table").innerHTML = t;
}
$("cc-shift").oninput = drawCancel;

// =================================================== Ex 2: pdf chart
function drawPdf() {
  const D = DISTS.beta25, sd = Math.sqrt(D.s2);
  plot($("pdf-chart"), {
    x: [0, 10], y: [0, 0.27], xlabel: "score",
    series: [
      { type: "fn", f: D.pdf, color: COLORS.sky, width: 2.5 },
      { type: "vline", x: D.mu, color: COLORS.orange, width: 2 },
      { type: "vline", x: D.mu - sd, color: COLORS.white, dash: [4, 4], width: 1 },
      { type: "vline", x: D.mu + sd, color: COLORS.white, dash: [4, 4], width: 1 },
    ],
  });
}

// =================================================== Ex 2: simulator
let lastSim = null;
function runSim() {
  const key = $("sim-dist").value, D = DISTS[key], n = +$("sim-n").value, m = +$("sim-m").value;
  $("sim-status").textContent = "simulating…";
  $("sim-run").disabled = true;
  $("sw-dist").textContent = D.name;
  setTimeout(() => {
    const seed = (Math.random() * 2 ** 32) >>> 0, t0 = performance.now();
    const r = simulateHackers(D, n, m, seed, 20);
    lastSim = { D, n, m, r };
    $("sim-status").textContent = `${D.name} · n = ${fmt(n)} systems · m = ${fmt(m)} hackers · ${fmt(n * m)} scores in ${((performance.now() - t0) / 1000).toFixed(2)} s · seed ${seed}`;
    drawSim();
    $("sim-run").disabled = false;
  }, 30);
}
$("sim-run").onclick = runSim;
$("sim-dist").onchange = () => { $("sw-dist").textContent = DISTS[$("sim-dist").value].name; };

function drawSim() {
  if (!lastSim) return;
  const { D, n, m, r } = lastSim;
  const sm = summary(r.means), sv = summary(r.vars);
  const biased = summary(Array.from(r.vars, (v) => (v * (n - 1)) / n));
  const below = r.vars.reduce((c, v) => c + (v < D.s2), 0) / m;
  const se = (s) => s / Math.sqrt(m);
  $("sim-table").innerHTML =
    `<tr><th></th><th class="num">average over the m hackers</th><th class="num">theory</th><th class="num">z</th><th class="num">sd across hackers</th><th class="num">sd (theory)</th></tr>` +
    `<tr><td>sampling mean X̄<sub>n</sub></td><td class="num">${fix(sm.mean)}</td><td class="num">μ = ${fix(D.mu)}</td><td class="num">${fix((sm.mean - D.mu) / se(sm.sd), 2)}</td><td class="num">${fix(sm.sd)}</td><td class="num">${fix(Math.sqrt(D.s2 / n))}</td></tr>` +
    `<tr><td>sampling variance s²<sub>n</sub> (÷ n−1)</td><td class="num">${fix(sv.mean)}</td><td class="num">σ² = ${fix(D.s2)}</td><td class="num">${n > 1 ? fix((sv.mean - D.s2) / se(sv.sd), 2) : "-"}</td><td class="num">${fix(sv.sd)}</td><td class="num">${fix(sdOfS2(D, n))}</td></tr>` +
    `<tr><td>S<sub>n</sub>/n (÷ n)</td><td class="num">${fix(biased.mean)}</td><td class="num">σ²(n−1)/n = ${fix((D.s2 * (n - 1)) / n)}</td><td class="num">-</td><td class="num">${fix(biased.sd)}</td><td class="num">${fix((sdOfS2(D, n) * (n - 1)) / n)}</td></tr>` +
    `<tr><td colspan="6" style="color:var(--muted)">hackers with s² below σ²: ${(100 * below).toFixed(1)}%</td></tr>`;

  // trajectories
  const ks = Array.from({ length: n }, (_, i) => i + 1);
  const xlog = n >= 50;
  const traj = (field, target, lo, hi) => {
    const s = r.paths.map((p, j) => ({ type: "line", x: ks, y: Array.from(p[field]), color: j === 0 ? COLORS.orange : COLORS.sky, alpha: j === 0 ? 1 : 0.35, width: j === 0 ? 2 : 1.2 }));
    s.push(s.shift());
    s.push({ type: "hline", y: target, color: COLORS.white, dash: [5, 4], width: 1.5 });
    return { x: [1, Math.max(n, 2)], y: [lo, hi], xlog, xlabel: xlog ? "k (log scale)" : "k", series: s };
  };
  plot($("tr-mean"), traj("mean", D.mu, 0, 10));
  let vmax = 0;
  for (const p of r.paths) for (const v of p.v) if (isFinite(v) && v > vmax) vmax = v;
  plot($("tr-var"), traj("v", D.s2, 0, Math.min(Math.max(vmax, 2 * D.s2) * 1.05, 60)));

  // histograms
  const hm = histogram(Array.from(r.means), D.discrete ? 1 / n : null);
  const sdm = Math.sqrt(D.s2 / n);
  plot($("h-mean"), {
    x: [Math.max(0, Math.min(hm.lo, D.mu - 4 * sdm)), Math.min(10, Math.max(hm.hi, D.mu + 4 * sdm))],
    y: [0, Math.max(...hm.y, normPdf(D.mu, D.mu, sdm)) * 1.1], xticks: 5,
    series: [
      { type: "bars", x: hm.x, y: hm.y, w: hm.w, color: COLORS.sky, alpha: 0.85 },
      { type: "fn", f: (x) => normPdf(x, D.mu, sdm), color: COLORS.orange, width: 2 },
      { type: "vline", x: D.mu, color: COLORS.white, dash: [5, 4], width: 1.5 },
    ],
  });
  // cut the long right tail of s^2 at the 99.5% quantile so the plot is readable
  const sorted = Float64Array.from(r.vars).sort();
  const cap = sorted[Math.floor(0.995 * (m - 1))];
  const hv = histogram(Array.from(r.vars).filter((v) => v <= cap), null);
  plot($("h-var"), {
    x: [0, Math.max(cap, D.s2 * 1.5)], y: [0, Math.max(...hv.y) * 1.1], xticks: 5,
    series: [
      { type: "bars", x: hv.x, y: hv.y, w: hv.w, color: COLORS.sky, alpha: 0.85 },
      { type: "vline", x: D.s2, color: COLORS.white, dash: [5, 4], width: 1.5 },
      { type: "vline", x: sv.mean, color: COLORS.orange, width: 2 },
    ],
  });
}

// =================================================== Ex 2: comparison table (Python)
function cmpTable() {
  const rows = PY.rows;
  let t = `<tr><th class="num">n</th><th class="num">avg X̄</th><th class="num">z</th><th class="num">avg s² (÷ n−1)</th><th class="num">z</th><th class="num">avg S/n (÷ n)</th><th class="num">σ²(n−1)/n</th>` +
          `<th class="num">% hackers s² &lt; σ²</th><th class="num">95% t-CI coverage</th></tr>`;
  for (const r of rows) {
    t += `<tr><td class="num">${fmt(r.n)}</td><td class="num">${fix(r.avg_mean)}</td><td class="num">${fix((r.avg_mean - PY.mu) / r.se_avg_mean, 2)}</td>` +
         `<td class="num">${fix(r.avg_var)}</td><td class="num">${fix((r.avg_var - PY.var) / r.se_avg_var, 2)}</td>` +
         `<td class="num">${fix(r.avg_var_biased)}</td><td class="num">${fix((PY.var * (r.n - 1)) / r.n)}</td>` +
         `<td class="num">${(100 * r.frac_below).toFixed(1)}</td><td class="num">${(100 * r.coverage).toFixed(1)}%</td></tr>`;
  }
  t += `<tr class="best"><td>theory</td><td class="num">μ = ${fix(PY.mu)}</td><td></td><td class="num">σ² = ${fix(PY.var)}</td><td></td><td></td><td></td><td></td><td class="num">95%</td></tr>`;
  $("cmp-table").innerHTML = t;

  const ns = rows.map((r) => r.n);
  plot($("cmp-chart"), {
    x: [1.5, 1500], y: [1.0, 3.0], xlog: true, xlabel: "n (systems per hacker)", ylabel: "average variance",
    series: [
      { type: "fn", f: () => PY.var, color: COLORS.white, dash: [5, 4], width: 1.5 },
      { type: "fn", f: (n) => (PY.var * (n - 1)) / n, color: COLORS.white, dash: [2, 3], width: 1.5 },
      ...rows.map((r) => ({ type: "line", x: [r.n, r.n], y: [r.avg_var - 2 * r.se_avg_var, r.avg_var + 2 * r.se_avg_var], color: COLORS.orange, width: 2 })),
      { type: "points", x: ns, y: rows.map((r) => r.avg_var), color: COLORS.orange, r: 5 },
      { type: "points", x: ns, y: rows.map((r) => r.avg_var_biased), color: COLORS.sky, r: 5 },
    ],
  });
}

// =================================================== Ex 2: variability vs n
let lastSpread = null;
function drawSpread(rows, D) {
  lastSpread = [rows, D];
  const ns = rows.map((r) => r.n);
  const all = rows.flatMap((r) => [r.sd_mean, r.sd_var]);
  plot($("sd-chart"), {
    x: [1.5, 1500], y: [Math.min(...all) / 2, Math.max(...all) * 2], xlog: true, ylog: true, xlabel: "n (systems per hacker)", ylabel: "sd across hackers",
    series: [
      { type: "fn", f: (n) => Math.sqrt(D.s2 / n), color: COLORS.sky, dash: [5, 4] },
      { type: "fn", f: (n) => sdOfS2(D, Math.max(n, 2)), color: COLORS.orange, dash: [5, 4] },
      { type: "points", x: ns, y: rows.map((r) => r.sd_mean), color: COLORS.sky, r: 5 },
      { type: "points", x: ns, y: rows.map((r) => r.sd_var), color: COLORS.orange, r: 5 },
    ],
  });
  let t = `<tr><th class="num">n</th><th class="num">sd X̄ (sim)</th><th class="num">σ/√n</th><th class="num">sd X̄ / μ</th><th class="num">sd s² (sim)</th><th class="num">sd s² (theory)</th><th class="num">sd s² / σ²</th></tr>`;
  for (const r of rows) {
    t += `<tr><td class="num">${fmt(r.n)}</td><td class="num">${fix(r.sd_mean)}</td><td class="num">${fix(Math.sqrt(D.s2 / r.n))}</td><td class="num">${(100 * r.sd_mean / D.mu).toFixed(1)}%</td>` +
         `<td class="num">${fix(r.sd_var)}</td><td class="num">${fix(sdOfS2(D, r.n))}</td><td class="num">${(100 * r.sd_var / D.s2).toFixed(1)}%</td></tr>`;
  }
  $("sd-table").innerHTML = t;
}
const showPySpread = () => {
  drawSpread(PY.rows, DISTS.beta25);
  $("sw-status").textContent = "Showing the Python results (10·Beta(2, 5), m = 10,000).";
};
$("sw-py").onclick = showPySpread;
$("sw-run").onclick = () => {
  const D = DISTS[$("sim-dist").value], m = +$("sw-m").value;
  $("sw-run").disabled = true;
  $("sw-status").textContent = "simulating…";
  setTimeout(() => {
    const t0 = performance.now(), base = (Math.random() * 2 ** 32) >>> 0;
    const rows = NS.map((n, i) => {
      const r = simulateHackers(D, n, m, base + i);
      const a = summary(r.means), b = summary(r.vars);
      return { n, sd_mean: a.sd, sd_var: b.sd };
    });
    drawSpread(rows, D);
    $("sw-status").textContent = `Browser run: ${D.name}, m = ${fmt(m)} hackers for each n, ${((performance.now() - t0) / 1000).toFixed(1)} s.`;
    $("sw-run").disabled = false;
  }, 30);
};

// =================================================== init
wfReset();
drawCancel();
drawPdf();
cmpTable();
$("sw-dist").textContent = DISTS.beta25.name;
showPySpread();
runSim();

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { drawSim(); drawPdf(); cmpTable(); if (lastSpread) drawSpread(...lastSpread); }, 150);
});

const links = [...document.querySelectorAll("nav.toc a")];
const obs = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id)); });
}, { rootMargin: "-40% 0px -55% 0px" });
document.querySelectorAll("main section").forEach((s) => obs.observe(s));
