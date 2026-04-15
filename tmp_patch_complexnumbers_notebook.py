import json
from pathlib import Path


NOTEBOOK = Path(
    r"c:\Users\norwa\OneDrive\Documents\student\kode\.venv\Scripts\interference\statistics\Statistics\ComplexNumbers\complex_log_image_pipeline.ipynb"
)


CELL_9 = """# Build a genuinely doubly periodic operated W-plane.
# Choose a rectangle in the source log plane
#   w = u + i v,  with u = log|z| and v = arg(z).
# Under the affine map
#   w' = a*w + b,
# this rectangle becomes a parallelogram in the operated W-plane.
# Its two lattice-period vectors are
#   T_u = a * L
#   T_v = a * (i * V),
# where L is the chosen horizontal width and V is the chosen vertical height.

horizontal_axis = "log_radius"  # "log_radius" or "radius"

# Choose the rectangle in the source log plane.
u_min = -1.55
u_max = 0.50

radius_min = 0.35
radius_max = 1.80

angle_min = -1.0 * np.pi
angle_max = 1.0 * np.pi

tile_shape = (360, 480)

# Choose an axis-aligned window only for visualizing the operated W-plane lattice.
periodic_view_u_min = -8.0
periodic_view_u_max = 0.5
periodic_view_v_min = -np.pi
periodic_view_v_max = np.pi

operated_w_plane = log_step["image"]
full_h, full_w = operated_w_plane.shape[:2]
full_u0, full_u1 = map(float, log_step["u_range"])
full_v0, full_v1 = map(float, log_step["v_range"])
background = np.zeros(operated_w_plane.shape[2], dtype=np.float64)

if horizontal_axis == "log_radius":
    if not (u_max > u_min):
        raise ValueError("Need u_max > u_min when horizontal_axis='log_radius'.")
    tile_u0 = float(u_min)
    tile_u1 = float(u_max)
    radius_min = np.exp(tile_u0)
    radius_max = np.exp(tile_u1)
elif horizontal_axis == "radius":
    if not (0.0 < radius_min < radius_max):
        raise ValueError("Need 0 < radius_min < radius_max when horizontal_axis='radius'.")
    tile_u0 = np.log(radius_min)
    tile_u1 = np.log(radius_max)
else:
    raise ValueError("horizontal_axis must be 'log_radius' or 'radius'.")

tile_v0 = float(angle_min)
tile_v1 = float(angle_max)
tile_h, tile_w = tile_shape
L = tile_u1 - tile_u0
V = tile_v1 - tile_v0

if not (L > 0.0):
    raise ValueError("Need tile_u1 > tile_u0.")
if not (V > 0.0):
    raise ValueError("Need tile_v1 > tile_v0.")
if not (periodic_view_u_max > periodic_view_u_min):
    raise ValueError("Need periodic_view_u_max > periodic_view_u_min.")
if not (periodic_view_v_max > periodic_view_v_min):
    raise ValueError("Need periodic_view_v_max > periodic_view_v_min.")

# This is the chosen source-log rectangle:
#   tile_u0 < Re(w) < tile_u1,
#   tile_v0 < Im(w) < tile_v1.
tile_u = np.linspace(tile_u0, tile_u1, tile_w)
tile_v = np.linspace(tile_v0, tile_v1, tile_h)
W_source_tile = tile_u[None, :] + 1j * tile_v[:, None]

# The source-log tile is sampled directly from z = exp(w).
Z_source_tile = np.exp(W_source_tile)
selected_w_tile = cip.sample_source_from_complex(
    image,
    Z_source_tile,
    origin_px,
    pixels_per_unit,
    fill_value=background,
)

# Complex multiplication maps that source rectangle to a parallelogram in the operated W-plane.
source_anchor = tile_u0 + 1j * tile_v0
operated_anchor = a * source_anchor + b
period_u = a * L
period_v = a * (1j * V)

if abs(period_u.real * period_v.imag - period_u.imag * period_v.real) < 1e-12:
    raise ValueError("The two operated-plane period vectors became linearly dependent.")

# The operated parallelogram corners are the image of the source rectangle corners under w' = a*w + b.
parallelogram = np.array(
    [
        operated_anchor,
        operated_anchor + period_u,
        operated_anchor + period_u + period_v,
        operated_anchor + period_v,
        operated_anchor,
    ],
    dtype=np.complex128,
)

# The intrinsic tile coordinates (s, t) run across the source rectangle.
# After multiplication by a, those same coordinates parametrize the operated parallelogram.
s = np.linspace(0.0, 1.0, tile_w)
t = np.linspace(0.0, 1.0, tile_h)
S, T = np.meshgrid(s, t)
W_operated_tile = operated_anchor + S * period_u + T * period_v

# This is only a display coverage check: it tells us how much of the chosen parallelogram
# lies inside the finite rendered operated preview log_step["image"].
u_from_full_tile = (np.real(W_operated_tile) - full_u0) / (full_u1 - full_u0) * (full_w - 1)
v_from_full_tile = (np.imag(W_operated_tile) - full_v0) / (full_v1 - full_v0) * (full_h - 1)
tile_inside_preview = (
    (u_from_full_tile >= 0.0)
    & (u_from_full_tile <= full_w - 1)
    & (v_from_full_tile >= 0.0)
    & (v_from_full_tile <= full_h - 1)
)
tile_preview_coverage = float(np.mean(tile_inside_preview))

# Any operated-plane point satisfies
#   w' - operated_anchor = alpha * T_u + beta * T_v.
# Solving for (alpha, beta) gives lattice coordinates in the period basis.
basis = np.array(
    [
        [period_u.real, period_v.real],
        [period_u.imag, period_v.imag],
    ],
    dtype=np.float64,
)
basis_inv = np.linalg.inv(basis)

def lattice_coordinates(w_complex):
    du = np.real(w_complex) - operated_anchor.real
    dv = np.imag(w_complex) - operated_anchor.imag
    alpha = basis_inv[0, 0] * du + basis_inv[0, 1] * dv
    beta = basis_inv[1, 0] * du + basis_inv[1, 1] * dv
    return alpha, beta

# Double periodicity means
#   G(w' + m*T_u + n*T_v) = G(w')
# for all integers m, n.
pixels_per_u = (full_w - 1) / (full_u1 - full_u0)
pixels_per_v = (full_h - 1) / (full_v1 - full_v0)
periodic_w = int(np.ceil((periodic_view_u_max - periodic_view_u_min) * pixels_per_u)) + 1
periodic_h = int(np.ceil((periodic_view_v_max - periodic_view_v_min) * pixels_per_v)) + 1
periodic_u = np.linspace(periodic_view_u_min, periodic_view_u_max, periodic_w)
periodic_v = np.linspace(periodic_view_v_min, periodic_view_v_max, periodic_h)
U_periodic, V_periodic = np.meshgrid(periodic_u, periodic_v)
W_periodic = U_periodic + 1j * V_periodic

alpha_periodic, beta_periodic = lattice_coordinates(W_periodic)
alpha_wrapped = np.mod(alpha_periodic, 1.0)
beta_wrapped = np.mod(beta_periodic, 1.0)

u_from_tile_periodic = alpha_wrapped * (tile_w - 1)
v_from_tile_periodic = beta_wrapped * (tile_h - 1)
periodic_w_plane = cip.bilinear_sample(
    selected_w_tile,
    u_from_tile_periodic,
    v_from_tile_periodic,
    fill_value=background,
)

# The final z-plane output samples the lattice-periodic operated W-plane at
#   w' = log(z') = log|z'| + i arg(z').
out_h, out_w = image.shape[:2]
cx, cy = origin_px
Y, X = np.mgrid[0:out_h, 0:out_w]
dx = X - cx
dy = cy - Y
r_pixels = np.sqrt(dx * dx + dy * dy)
valid = r_pixels > 1e-12
theta = np.arctan2(dy, dx)

alpha_world = np.full_like(r_pixels, np.nan, dtype=np.float64)
beta_world = np.full_like(r_pixels, np.nan, dtype=np.float64)
w_prime_world = np.full(r_pixels.shape, np.nan + 1j * np.nan, dtype=np.complex128)
w_prime_world[valid] = np.log(r_pixels[valid] / pixels_per_unit) + 1j * theta[valid]

alpha_valid, beta_valid = lattice_coordinates(w_prime_world[valid])
alpha_world[valid] = np.mod(alpha_valid, 1.0)
beta_world[valid] = np.mod(beta_valid, 1.0)

u_from_tile_output = alpha_world * (tile_w - 1)
v_from_tile_output = beta_world * (tile_h - 1)
periodic_output = cip.bilinear_sample(
    selected_w_tile,
    u_from_tile_output,
    v_from_tile_output,
    fill_value=background,
)
periodic_output[~valid] = background

source_box_u = [tile_u0, tile_u1, tile_u1, tile_u0, tile_u0]
source_box_v = [tile_v0, tile_v0, tile_v1, tile_v1, tile_v0]
parallelogram_u = np.real(parallelogram)
parallelogram_v = np.imag(parallelogram)

fig, axes = plt.subplots(2, 2, figsize=(14.5, 10.5))

axes[0, 0].imshow(operated_w_plane, extent=(full_u0, full_u1, full_v0, full_v1), origin="lower")
axes[0, 0].plot(parallelogram_u, parallelogram_v, color="white", linewidth=2)
axes[0, 0].quiver(
    [operated_anchor.real, operated_anchor.real],
    [operated_anchor.imag, operated_anchor.imag],
    [period_u.real, period_v.real],
    [period_u.imag, period_v.imag],
    angles="xy",
    scale_units="xy",
    scale=1.0,
    color=["white", "gold"],
    width=0.004,
)
axes[0, 0].set_title(f"Operated W-plane after w' = a*w + b, a={a}, b={b}")
axes[0, 0].set_xlabel("u' = Re(w')")
axes[0, 0].set_ylabel("v' = Im(w')")
axes[0, 0].grid(color="white", alpha=0.12)

axes[0, 1].imshow(selected_w_tile, extent=(tile_u0, tile_u1, tile_v0, tile_v1), origin="lower")
axes[0, 1].set_title("Chosen source rectangle in the log plane")
axes[0, 1].set_xlabel("u = log|z|")
axes[0, 1].set_ylabel("v = arg(z)")
axes[0, 1].grid(color="white", alpha=0.12)

axes[1, 0].imshow(
    periodic_w_plane,
    extent=(periodic_view_u_min, periodic_view_u_max, periodic_view_v_min, periodic_view_v_max),
    origin="lower",
)
axes[1, 0].plot(parallelogram_u, parallelogram_v, color="white", linewidth=1.6)
axes[1, 0].set_title("Lattice-periodic operated W-plane")
axes[1, 0].set_xlabel("u' = Re(w')")
axes[1, 0].set_ylabel("v' = Im(w')")
axes[1, 0].grid(color="white", alpha=0.12)

axes[1, 1].imshow(np.clip(periodic_output, 0.0, 1.0))
axes[1, 1].set_title("z-plane sampled from the doubly periodic operated W-plane")
axes[1, 1].set_xticks([])
axes[1, 1].set_yticks([])

def fmt_period(z):
    return f"{z.real:.3f} {'+' if z.imag >= 0 else '-'} {abs(z.imag):.3f}i"

print(f"Chosen source-log rectangle: {tile_u0:.3f} < Re(w) < {tile_u1:.3f}")
print(f"Equivalent radius interval: {radius_min:.3f} < |z| < {radius_max:.3f}")
print(f"Chosen source angle interval: {tile_v0:.3f} < Im(w) < {tile_v1:.3f}")
print(f"Operated-plane period T_u = {fmt_period(period_u)}")
print(f"Operated-plane period T_v = {fmt_period(period_v)}")
print(f"Horizontal source period L gives scale factor exp(L) = {np.exp(L):.3f}")
print(f"Display coverage of the operated parallelogram inside log_step preview: {tile_preview_coverage:.1%}")
if abs(V - 2.0 * np.pi) > 1e-6:
    print("Note: choose a vertical period of 2*pi for exact exp-periodicity in the angle direction.")

plt.tight_layout()
"""


CELL_11 = """# Compare the plain exp-map output to the output obtained from the doubly periodic operated W-plane.
# Plain output: apply w' = a*w + b and then return with z = exp(w).
plain_output = cip.render_output_plane(
    image,
    origin_px,
    pixels_per_unit,
    a=a,
    b=b,
    output_shape=image.shape[:2],
)

fig, axes = plt.subplots(2, 3, figsize=(17, 10.5))

cip.plot_image(axes[0, 0], image, "Source z-plane")
cip.annotate_source_plane(axes[0, 0], image.shape, origin_px, pixels_per_unit)

axes[0, 1].imshow(log_preview["image"], extent=(u0, u1, v0, v1), origin="lower")
axes[0, 1].plot(source_box_u, source_box_v, color="white", linewidth=2)
axes[0, 1].set_title("Chosen source rectangle in the log plane")
axes[0, 1].set_xlabel("Re(w)")
axes[0, 1].set_ylabel("Im(w)")

axes[0, 2].imshow(operated_w_plane, extent=(full_u0, full_u1, full_v0, full_v1), origin="lower")
axes[0, 2].plot(parallelogram_u, parallelogram_v, color="white", linewidth=2)
axes[0, 2].quiver(
    [operated_anchor.real, operated_anchor.real],
    [operated_anchor.imag, operated_anchor.imag],
    [period_u.real, period_v.real],
    [period_u.imag, period_v.imag],
    angles="xy",
    scale_units="xy",
    scale=1.0,
    color=["white", "gold"],
    width=0.004,
)
axes[0, 2].set_title("Operated W-plane with its fundamental parallelogram")
axes[0, 2].set_xlabel("u' = Re(w')")
axes[0, 2].set_ylabel("v' = Im(w')")

axes[1, 0].imshow(
    periodic_w_plane,
    extent=(periodic_view_u_min, periodic_view_u_max, periodic_view_v_min, periodic_view_v_max),
    origin="lower",
)
axes[1, 0].plot(parallelogram_u, parallelogram_v, color="white", linewidth=1.6)
axes[1, 0].set_title("Doubly periodic operated W-plane")
axes[1, 0].set_xlabel("u' = Re(w')")
axes[1, 0].set_ylabel("v' = Im(w')")

cip.plot_image(axes[1, 1], plain_output["image"], "Plain exp-map output")
cip.annotate_source_plane(axes[1, 1], plain_output["image"].shape, origin_px, pixels_per_unit)

cip.plot_image(axes[1, 2], periodic_output, "Output from the doubly periodic operated W-plane")
cip.annotate_source_plane(axes[1, 2], periodic_output.shape, origin_px, pixels_per_unit)

plt.tight_layout()
"""


nb = json.loads(NOTEBOOK.read_text(encoding="utf-8"))
nb["cells"][9]["source"] = CELL_9.splitlines(keepends=True)
nb["cells"][9]["execution_count"] = None
nb["cells"][9]["outputs"] = []
nb["cells"][11]["source"] = CELL_11.splitlines(keepends=True)
nb["cells"][11]["execution_count"] = None
nb["cells"][11]["outputs"] = []

NOTEBOOK.write_text(json.dumps(nb, indent=2), encoding="utf-8")
