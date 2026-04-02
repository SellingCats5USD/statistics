from __future__ import annotations

import numpy as np
from matplotlib.patches import Circle
from PIL import Image


def load_image(path, max_size=None):
    image = Image.open(path).convert("RGB")
    if max_size is not None:
        image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
    return np.asarray(image, dtype=np.float64) / 255.0


def save_image(path, image):
    clipped = np.clip(image, 0.0, 1.0)
    Image.fromarray((clipped * 255).astype(np.uint8)).save(path)


def make_demo_image(width=720, height=540):
    x = np.linspace(-1.0, 1.0, width)[None, :]
    y = np.linspace(1.0, -1.0, height)[:, None]

    radius = np.sqrt(x ** 2 + y ** 2)
    angle = np.arctan2(y, x)

    image = np.zeros((height, width, 3), dtype=np.float64)
    image[..., 0] = 0.15 + 0.55 * (x + 1.0) / 2.0
    image[..., 1] = 0.12 + 0.45 * (y + 1.0) / 2.0
    image[..., 2] = 0.25 + 0.55 * (1.0 - radius / np.sqrt(2.0))

    ring_signal = 0.5 + 0.5 * np.cos(18.0 * np.pi * radius)
    spoke_signal = 0.5 + 0.5 * np.cos(16.0 * angle)
    swirl = 0.5 + 0.5 * np.sin(7.0 * angle + 15.0 * radius)

    image[..., 0] += 0.25 * ring_signal
    image[..., 1] += 0.20 * spoke_signal
    image[..., 2] += 0.20 * swirl

    image[:, width // 2 - 2:width // 2 + 2, :] = np.array([1.0, 0.97, 0.88])
    image[height // 2 - 2:height // 2 + 2, :, :] = np.array([1.0, 0.97, 0.88])

    corners = [
        (80, 90, np.array([1.0, 0.48, 0.05])),
        (width - 90, 105, np.array([0.22, 0.75, 0.96])),
        (100, height - 95, np.array([0.14, 0.78, 0.33])),
        (width - 95, height - 110, np.array([0.95, 0.45, 0.72])),
    ]

    yy, xx = np.mgrid[0:height, 0:width]
    for cx, cy, color in corners:
        mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= 24 ** 2
        image[mask] = 0.7 * image[mask] + 0.3 * color

    return np.clip(image, 0.0, 1.0)


def plane_bounds(image_shape, origin_px, pixels_per_unit):
    height, width = image_shape[:2]
    origin_x, origin_y = origin_px
    return {
        "left": (0.0 - origin_x) / pixels_per_unit,
        "right": (width - origin_x) / pixels_per_unit,
        "top": origin_y / pixels_per_unit,
        "bottom": (origin_y - height) / pixels_per_unit,
    }


def complex_grid(image_shape, origin_px, pixels_per_unit):
    height, width = image_shape[:2]
    origin_x, origin_y = origin_px
    x = (np.arange(width, dtype=np.float64) - origin_x) / pixels_per_unit
    y = (origin_y - np.arange(height, dtype=np.float64)) / pixels_per_unit
    return x[None, :] + 1j * y[:, None]


def complex_grid_from_bounds(bounds, output_shape):
    height, width = output_shape
    re = np.linspace(bounds["left"], bounds["right"], width)
    im = np.linspace(bounds["top"], bounds["bottom"], height)
    return re[None, :] + 1j * im[:, None]


def principal_log_decomposition(image_shape, origin_px, pixels_per_unit, inner_cutoff_px=3.0):
    z = complex_grid(image_shape, origin_px, pixels_per_unit)
    radius = np.abs(z)
    angle = np.angle(z)
    min_radius = inner_cutoff_px / pixels_per_unit
    valid = radius >= min_radius

    w = np.full(z.shape, np.nan + 1j * np.nan, dtype=np.complex128)
    w[valid] = np.log(radius[valid]) + 1j * angle[valid]

    return {
        "z": z,
        "radius": radius,
        "angle": angle,
        "w": w,
        "valid_mask": valid,
        "min_radius": min_radius,
    }


def log_bounds(image_shape, origin_px, pixels_per_unit, inner_cutoff_px=3.0):
    parts = principal_log_decomposition(image_shape, origin_px, pixels_per_unit, inner_cutoff_px)
    valid_radius = parts["radius"][parts["valid_mask"]]
    return {
        "u_min": float(np.log(parts["min_radius"])),
        "u_max": float(np.log(valid_radius.max())),
        "v_min": float(-np.pi),
        "v_max": float(np.pi),
    }


def bilinear_sample(image, x, y, fill_value=0.0):
    image = np.asarray(image, dtype=np.float64)
    height, width, channels = image.shape

    fill = np.asarray(fill_value, dtype=np.float64)
    if fill.ndim == 0:
        fill = np.full(channels, float(fill))

    out = np.broadcast_to(fill, x.shape + (channels,)).copy()
    valid = (x >= 0.0) & (x <= width - 1.0) & (y >= 0.0) & (y <= height - 1.0)
    if not np.any(valid):
        return out

    xv = x[valid]
    yv = y[valid]

    x0 = np.floor(xv).astype(int)
    y0 = np.floor(yv).astype(int)
    x1 = np.clip(x0 + 1, 0, width - 1)
    y1 = np.clip(y0 + 1, 0, height - 1)

    dx = xv - x0
    dy = yv - y0

    c00 = image[y0, x0]
    c10 = image[y0, x1]
    c01 = image[y1, x0]
    c11 = image[y1, x1]

    w00 = ((1.0 - dx) * (1.0 - dy))[:, None]
    w10 = (dx * (1.0 - dy))[:, None]
    w01 = ((1.0 - dx) * dy)[:, None]
    w11 = (dx * dy)[:, None]

    out[valid] = c00 * w00 + c10 * w10 + c01 * w01 + c11 * w11
    return out


def sample_source_from_complex(image, z, origin_px, pixels_per_unit, fill_value=0.0):
    origin_x, origin_y = origin_px
    x = origin_x + np.real(z) * pixels_per_unit
    y = origin_y - np.imag(z) * pixels_per_unit
    return bilinear_sample(image, x, y, fill_value=fill_value)


def render_log_plane_preview(
    image,
    origin_px,
    pixels_per_unit,
    output_shape=(320, 480),
    u_range=None,
    v_range=(-np.pi, np.pi),
    a=1.0 + 0.0j,
    b=0.0 + 0.0j,
    inverse_affine=False,
    inner_cutoff_px=3.0,
    fill_value=0.0,
):
    if abs(a) < 1e-12 and inverse_affine:
        raise ValueError("a must be non-zero when inverse_affine=True.")

    if u_range is None:
        bounds = log_bounds(image.shape, origin_px, pixels_per_unit, inner_cutoff_px)
        u_range = (bounds["u_min"], bounds["u_max"])

    u = np.linspace(u_range[0], u_range[1], output_shape[1])
    v = np.linspace(v_range[1], v_range[0], output_shape[0])
    w_prime = u[None, :] + 1j * v[:, None]

    if inverse_affine:
        w = (w_prime - b) / a
    else:
        w = w_prime

    z = np.exp(w)
    preview = sample_source_from_complex(image, z, origin_px, pixels_per_unit, fill_value=fill_value)

    return {
        "image": preview,
        "w_prime": w_prime,
        "w_source": w,
        "u_range": u_range,
        "v_range": v_range,
    }


def render_output_plane(
    image,
    origin_px,
    pixels_per_unit,
    a=1.0 + 0.0j,
    b=0.0 + 0.0j,
    output_shape=None,
    fill_value=0.0,
):
    if abs(a) < 1e-12:
        raise ValueError("a must be non-zero for the inverse mapping.")

    if output_shape is None:
        output_shape = image.shape[:2]

    bounds = plane_bounds(image.shape, origin_px, pixels_per_unit)
    z_prime = complex_grid_from_bounds(bounds, output_shape)
    valid = np.abs(z_prime) > 1e-12

    w_prime = np.full(z_prime.shape, np.nan + 1j * np.nan, dtype=np.complex128)
    w_prime[valid] = np.log(np.abs(z_prime[valid])) + 1j * np.angle(z_prime[valid])

    w = np.full_like(w_prime, np.nan + 1j * np.nan)
    w[valid] = (w_prime[valid] - b) / a

    z_source = np.full_like(z_prime, np.nan + 1j * np.nan)
    z_source[valid] = np.exp(w[valid])

    preview = np.broadcast_to(np.asarray(fill_value), output_shape + (image.shape[2],)).astype(np.float64).copy()
    preview[valid] = sample_source_from_complex(
        image,
        z_source[valid].reshape(-1, 1),
        origin_px,
        pixels_per_unit,
        fill_value=fill_value,
    ).reshape(-1, image.shape[2])

    return {
        "image": preview,
        "z_prime": z_prime,
        "w_prime": w_prime,
        "w_source": w,
    }


def plot_image(ax, image, title="", extent=None):
    ax.imshow(np.clip(image, 0.0, 1.0), extent=extent)
    ax.set_title(title)
    ax.set_xticks([])
    ax.set_yticks([])


def annotate_source_plane(ax, image_shape, origin_px, pixels_per_unit, show_circle=True):
    height, width = image_shape[:2]
    origin_x, origin_y = origin_px
    ax.axvline(origin_x, color="white", linestyle="--", linewidth=1.2, alpha=0.85)
    ax.axhline(origin_y, color="white", linestyle="--", linewidth=1.2, alpha=0.85)
    ax.plot(origin_x, origin_y, marker="o", color="#fff4d6", markersize=5)
    if show_circle:
        ax.add_patch(
            Circle(
                (origin_x, origin_y),
                radius=pixels_per_unit,
                fill=False,
                color="#ffe7b3",
                linestyle=(0, (4, 4)),
                linewidth=1.3,
            )
        )
    ax.set_xlim(0, width)
    ax.set_ylim(height, 0)


def describe_mapping(image_shape, origin_px, pixels_per_unit, a=1.0 + 0.0j, b=0.0 + 0.0j, inner_cutoff_px=3.0):
    z_bounds = plane_bounds(image_shape, origin_px, pixels_per_unit)
    w_bounds = log_bounds(image_shape, origin_px, pixels_per_unit, inner_cutoff_px)
    return "\n".join(
        [
            "z = ((x - x0) / s) + i((y0 - y) / s)",
            "w = log(z)",
            "w' = a w + b",
            "z' = exp(w')",
            "",
            f"origin_px = ({origin_px[0]:.1f}, {origin_px[1]:.1f})",
            f"pixels_per_unit = {pixels_per_unit:.2f}",
            f"inner_cutoff_px = {inner_cutoff_px:.2f}",
            f"a = {a.real:.3f} + {a.imag:.3f}i",
            f"b = {b.real:.3f} + {b.imag:.3f}i",
            "",
            f"Re(z) in [{z_bounds['left']:.2f}, {z_bounds['right']:.2f}]",
            f"Im(z) in [{z_bounds['bottom']:.2f}, {z_bounds['top']:.2f}]",
            f"Re(w) in [{w_bounds['u_min']:.2f}, {w_bounds['u_max']:.2f}]",
            "Im(w) in [-pi, pi]",
        ]
    )
