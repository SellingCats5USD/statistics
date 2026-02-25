import numpy as np

# -------------------------
# 1) Define the two Gaussians
# -------------------------
m0, s0 = 0.5, 2.0     # mu = N(m0, s0^2)
m1, s1 = -1.0, 0.7    # nu = N(m1, s1^2)

# -------------------------
# 2) Define the optimal Monge map T(x)
#    T(x) = m1 + (s1/s0) * (x - m0)
# -------------------------
def T(x):
    return m1 + (s1 / s0) * (x - m0)

# -------------------------
# 3) Sample X ~ mu
# -------------------------
n = 200_000
rng = np.random.default_rng(0)
X = rng.normal(loc=m0, scale=s0, size=n)

# -------------------------
# 4) Push forward via the OT map: Y = T(X)
# -------------------------
Y = T(X)

# -------------------------
# 5) Empirical checks: mean/variance of Y should match nu
# -------------------------
print("Empirical mean(X), std(X):", X.mean(), X.std())
print("Empirical mean(Y), std(Y):", Y.mean(), Y.std())
print("Target mean(Y), std(Y):   ", m1, s1)

# -------------------------
# 6) Empirical transport cost E[(X-Y)^2]
# -------------------------
emp_cost = np.mean((X - Y)**2)

# Analytic W2^2 for 1D Gaussians under squared cost:
analytic_cost = (m0 - m1)**2 + (s0 - s1)**2

print("Empirical cost:", emp_cost)
print("Analytic  cost:", analytic_cost)
