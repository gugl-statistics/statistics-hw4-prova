// ===================================================================
// welford.js - Welford's recurrences, score distributions, hacker simulation
// ===================================================================

// ---------- Ex. 1: the recurrences ----------
// state = { k, mean, ss }   (start with k = 0, mean = 0, ss = 0)
function welfordUpdate(st, x) {
  st.k += 1;
  const d = x - st.mean;         // x_k - M_{k-1}
  st.mean += d / st.k;           // M_k = M_{k-1} + (x_k - M_{k-1}) / k
  st.ss += d * (x - st.mean);    // S_k = S_{k-1} + (x_k - M_{k-1}) (x_k - M_k)
  return d;
}
const sampleVar = (st) => (st.k > 1 ? st.ss / (st.k - 1) : NaN);

// one-pass "textbook" formula, to show why Welford is needed
function naiveVar(xs) {
  let s = 0, s2 = 0;
  for (const x of xs) { s += x; s2 += x * x; }
  const n = xs.length;
  return (s2 - (s * s) / n) / (n - 1);
}

// ---------- seeded random numbers (mulberry32) ----------
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- score distributions on [0, 10] ----------
// mu, s2 = mean and variance, mu4 = 4th central moment (needed for Var(s^2))
function betaMoments(a, b) {
  const mu = a / (a + b), v = (a * b) / ((a + b) ** 2 * (a + b + 1));
  const exk = (6 * ((a - b) ** 2 * (a + b + 1) - a * b * (a + b + 2))) / (a * b * (a + b + 2) * (a + b + 3));
  const skew = (2 * (b - a) * Math.sqrt(a + b + 1)) / ((a + b + 2) * Math.sqrt(a * b));
  return { mu: 10 * mu, s2: 100 * v, mu3: skew * Math.pow(100 * v, 1.5), mu4: (exk + 3) * (100 * v) ** 2 };
}

const DISTS = {
  beta25: {
    name: "10·Beta(2, 5)",
    ...betaMoments(2, 5),
    // Beta(2,5) = 2nd smallest of 6 independent uniforms (order statistic)
    draw(rng) {
      let a = 2, b = 2;
      for (let i = 0; i < 6; i++) {
        const u = rng();
        if (u < a) { b = a; a = u; } else if (u < b) b = u;
      }
      return 10 * b;
    },
    pdf: (x) => (x <= 0 || x >= 10 ? 0 : 0.1 * 30 * (x / 10) * Math.pow(1 - x / 10, 4)),
    discrete: false,
  },
  uniform: {
    name: "Uniform(0, 10)",
    mu: 5, s2: 100 / 12, mu3: 0, mu4: 10000 / 80,
    draw: (rng) => 10 * rng(),
    pdf: (x) => (x < 0 || x > 10 ? 0 : 0.1),
    discrete: false,
  },
  binom: {
    name: "Binomial(10, 0.3)",
    mu: 3, s2: 2.1, mu3: 10 * 0.3 * 0.7 * (1 - 0.6), mu4: 2.1 * (1 + 3 * 8 * 0.21),
    draw(rng) { let c = 0; for (let i = 0; i < 10; i++) if (rng() < 0.3) c++; return c; },
    pmf(k) { let c = 1; for (let i = 0; i < k; i++) c = (c * (10 - i)) / (i + 1); return c * 0.3 ** k * 0.7 ** (10 - k); },
    discrete: true,
  },
  arcsine: {
    name: "10·Beta(½, ½)",
    ...betaMoments(0.5, 0.5),
    draw: (rng) => 10 * Math.sin((Math.PI * rng()) / 2) ** 2,
    pdf: (x) => (x <= 0 || x >= 10 ? 0 : 1 / (Math.PI * Math.sqrt(x * (10 - x)))),
    discrete: false,
  },
};

// theoretical standard deviation of the sample variance s^2 (n-1 denominator)
const sdOfS2 = (D, n) => Math.sqrt((D.mu4 - (D.s2 * D.s2 * (n - 3)) / (n - 1)) / n);

// ---------- Ex. 2: m hackers, n systems each ----------
// returns per-hacker sample means and variances (from Welford),
// plus the running mean / variance paths of the first K hackers
function simulateHackers(D, n, m, seed, K = 0) {
  const rng = makeRng(seed);
  const means = new Float64Array(m), vars = new Float64Array(m);
  const paths = [];
  const st = { k: 0, mean: 0, ss: 0 };
  for (let h = 0; h < m; h++) {
    st.k = 0; st.mean = 0; st.ss = 0;
    const rec = h < K ? { mean: new Float64Array(n), v: new Float64Array(n) } : null;
    for (let i = 0; i < n; i++) {
      welfordUpdate(st, D.draw(rng));
      if (rec) { rec.mean[i] = st.mean; rec.v[i] = sampleVar(st); }
    }
    means[h] = st.mean;
    vars[h] = st.ss / (n - 1);
    if (rec) paths.push(rec);
  }
  return { means, vars, paths };
}

// mean and standard deviation of an array, computed with Welford too
function summary(a) {
  const st = { k: 0, mean: 0, ss: 0 };
  for (const v of a) welfordUpdate(st, v);
  return { mean: st.mean, sd: Math.sqrt(sampleVar(st)) };
}

if (typeof module !== "undefined") module.exports = { welfordUpdate, sampleVar, naiveVar, makeRng, DISTS, sdOfS2, simulateHackers, summary };
