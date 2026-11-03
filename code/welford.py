"""
Homework 4 - Welford's recurrences + sampling mean and variance of the hackers' scores.
Python 3 + numpy + scipy.  Run:  python3 welford.py
"""
import json, math
import numpy as np
from scipy import stats

# ------------------------------------------------------------------ Ex. 1
def welford(xs):
    mean, ss = 0.0, 0.0
    for k, x in enumerate(xs, start=1):
        d = x - mean            # x_k - M_{k-1}
        mean += d / k           # M_k = M_{k-1} + (x_k - M_{k-1}) / k   (Knuth)
        ss += d * (x - mean)    # S_k = S_{k-1} + (x_k - M_{k-1})(x_k - M_k)   (Welford)
    n = len(xs)
    return mean, ss, (ss / (n - 1) if n > 1 else float("nan"))

def naive(xs):                  # textbook one-pass formula: (sum x^2 - (sum x)^2 / n) / (n-1)
    n = len(xs); s = sum(xs); s2 = sum(x * x for x in xs)
    return (s2 - s * s / n) / (n - 1)

rng = np.random.default_rng(2026)

def check_ex1():
    print("=== Ex. 1 checks")
    x = rng.normal(5, 2, 1000)
    m, ss, v = welford(x)
    print("welford mean/var", m, v, " numpy", x.mean(), x.var(ddof=1), " diff", abs(v - x.var(ddof=1)))
    small = [4, 7, 13, 16]
    print("small example", small, welford(small))
    rows = []
    for shift in [0, 1e4, 1e6, 1e8, 1e9, 1e10]:
        data = [shift + v for v in (4, 7, 13, 16)]          # true variance = 30
        rows.append(dict(shift=shift, welford=welford(data)[2], naive=naive(data)))
        print(f"shift {shift:>8.0e}: welford {rows[-1]['welford']:.6f}  naive {rows[-1]['naive']:.6f}")
    return rows

# ------------------------------------------------------------------ Ex. 2
# score distribution: X = 10 * Beta(2, 5)  (most attempts score low, a few score high)
A, B = 2.0, 5.0
def draw(size): return 10 * rng.beta(A, B, size)
MU  = 10 * A / (A + B)
VAR = 100 * A * B / ((A + B) ** 2 * (A + B + 1))
# 4th central moment from the Beta excess kurtosis
EXK = 6 * ((A - B) ** 2 * (A + B + 1) - A * B * (A + B + 2)) / (A * B * (A + B + 2) * (A + B + 3))
MU4 = (EXK + 3) * VAR ** 2

def welford_vec(X):             # X has shape (m, n): one row per hacker, Welford along the row
    m, n = X.shape
    mean = np.zeros(m); ss = np.zeros(m)
    for k in range(1, n + 1):
        x = X[:, k - 1]
        d = x - mean
        mean += d / k
        ss += d * (x - mean)
    return mean, ss / (n - 1), ss / n

def ex2():
    print(f"\n=== Ex. 2   X = 10*Beta({A:g},{B:g})   mu = {MU:.5f}   sigma^2 = {VAR:.5f}   mu4 = {MU4:.5f}")
    M = 10000
    rows = []
    for n in [2, 3, 5, 10, 20, 50, 100, 200, 500, 1000]:
        X = draw((M, n))
        mean, s2, s2_biased = welford_vec(X)
        # sanity: same as numpy
        assert np.allclose(s2, X.var(axis=1, ddof=1))
        se_mean = math.sqrt(VAR / n)
        sd_var_th = math.sqrt((MU4 - VAR ** 2 * (n - 3) / (n - 1)) / n)
        t = stats.t.ppf(0.975, n - 1)
        cover = np.mean(np.abs(mean - MU) <= t * np.sqrt(s2 / n))
        r = dict(n=n, avg_mean=mean.mean(), avg_var=s2.mean(), avg_var_biased=s2_biased.mean(),
                 sd_mean=mean.std(ddof=1), sd_mean_th=se_mean,
                 sd_var=s2.std(ddof=1), sd_var_th=sd_var_th,
                 err_mean=abs(mean.mean() - MU), err_var=abs(s2.mean() - VAR),
                 se_avg_mean=mean.std(ddof=1) / math.sqrt(M), se_avg_var=s2.std(ddof=1) / math.sqrt(M),
                 coverage=float(cover),
                 frac_below=float(np.mean(s2 < VAR)), corr=float(np.corrcoef(mean, s2)[0, 1]))
        rows.append(r)
        print(f"n={n:5d}  avg xbar={r['avg_mean']:.4f}  avg s2={r['avg_var']:.4f}  avg s2(/n)={r['avg_var_biased']:.4f}  "
              f"sd xbar={r['sd_mean']:.4f} (th {se_mean:.4f})  sd s2={r['sd_var']:.4f} (th {sd_var_th:.4f})  "
              f"95% t-CI coverage={cover:.3f}  P(s2<sigma2)={r['frac_below']:.3f}  corr(xbar,s2)={r['corr']:.3f}")
    return dict(mu=MU, var=VAR, mu4=MU4, m=M, rows=rows)

if __name__ == "__main__":
    ex1 = check_ex1()
    res = ex2()
    res["cancellation"] = ex1
    with open("../js/results.js", "w") as f:
        f.write("// numbers produced by code/welford.py (m = 10,000 hackers for each n)\n")
        f.write("const PY = " + json.dumps(res) + ";\n")
