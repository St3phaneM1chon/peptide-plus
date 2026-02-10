#!/usr/bin/env python3
"""
Generate professional placeholder product images for BioCycle Peptides.
Each product gets a main image + one image per format.
"""

import os
import json
from PIL import Image, ImageDraw, ImageFont
import math

# Output directory
OUTPUT_DIR = "/Volumes/AI_Project/peptide-plus/public/images/products"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Color schemes by category
CATEGORY_COLORS = {
    "peptides-recherche": {
        "bg_start": (15, 23, 42),      # slate-900
        "bg_end": (30, 58, 138),        # blue-900
        "accent": (59, 130, 246),       # blue-500
        "highlight": (96, 165, 250),    # blue-400
        "text": (255, 255, 255),
    },
    "peptides-performance": {
        "bg_start": (15, 23, 42),
        "bg_end": (88, 28, 135),        # purple-900
        "accent": (168, 85, 247),       # purple-500
        "highlight": (192, 132, 252),   # purple-400
        "text": (255, 255, 255),
    },
    "peptides-anti-age": {
        "bg_start": (15, 23, 42),
        "bg_end": (6, 78, 59),          # emerald-900
        "accent": (16, 185, 129),       # emerald-500
        "highlight": (52, 211, 153),    # emerald-400
        "text": (255, 255, 255),
    },
    "peptides-metabolisme": {
        "bg_start": (15, 23, 42),
        "bg_end": (120, 53, 15),        # amber-900
        "accent": (245, 158, 11),       # amber-500
        "highlight": (251, 191, 36),    # amber-400
        "text": (255, 255, 255),
    },
    "supplements": {
        "bg_start": (15, 23, 42),
        "bg_end": (14, 116, 144),       # cyan-800
        "accent": (6, 182, 212),        # cyan-500
        "highlight": (34, 211, 238),    # cyan-400
        "text": (255, 255, 255),
    },
    "accessoires": {
        "bg_start": (15, 23, 42),
        "bg_end": (55, 65, 81),         # gray-700
        "accent": (156, 163, 175),      # gray-400
        "highlight": (209, 213, 219),   # gray-300
        "text": (255, 255, 255),
    },
}

# Format type display info
FORMAT_INFO = {
    "VIAL_2ML": {"icon": "2ml", "shape": "vial"},
    "VIAL_5ML": {"icon": "5ml", "shape": "vial"},
    "VIAL_10ML": {"icon": "10ml", "shape": "vial"},
    "CARTRIDGE_3ML": {"icon": "3ml", "shape": "cartridge"},
    "KIT_10": {"icon": "10pk", "shape": "kit"},
    "KIT_50": {"icon": "50pk", "shape": "kit"},
    "CAPSULE_60": {"icon": "60cap", "shape": "capsule"},
    "CAPSULE_120": {"icon": "120cap", "shape": "capsule"},
    "CREAM": {"icon": "cream", "shape": "cream"},
    "NASAL_SPRAY": {"icon": "spray", "shape": "spray"},
}

# Product data from DB
PRODUCTS = [
    {"name": "AOD-9604", "slug": "aod-9604", "cat": "peptides-metabolisme",
     "formats": [{"sku": "AOD9604-5MG", "label": "5mg Vial"}]},
    {"name": "BPC-157", "slug": "bpc-157", "cat": "peptides-recherche",
     "formats": [{"sku": "BPC157-5MG", "label": "5mg Vial"}, {"sku": "BPC157-10MG", "label": "10mg Vial"}, {"sku": "BPC157-20MG", "label": "20mg Vial"}]},
    {"name": "BPC-157 + TB-500", "slug": "bpc-157-tb-500-blend", "cat": "peptides-recherche",
     "formats": [{"sku": "BLEND-BPC-TB-10MG", "label": "10mg Blend"}, {"sku": "BLEND-BPC-TB-20MG", "label": "20mg Blend"}]},
    {"name": "CJC-1295 DAC", "slug": "cjc-1295-dac", "cat": "peptides-performance",
     "formats": [{"sku": "CJC1295-DAC-2MG", "label": "2mg Vial"}, {"sku": "CJC1295-DAC-5MG", "label": "5mg Vial"}]},
    {"name": "CJC-1295 + Ipamorelin", "slug": "cjc-1295-ipamorelin-blend", "cat": "peptides-performance",
     "formats": [{"sku": "BLEND-CJC-IPA-10MG", "label": "10mg Blend"}]},
    {"name": "Eau Bacteriostatique", "slug": "eau-bacteriostatique", "cat": "accessoires",
     "formats": [{"sku": "BAC-WATER-10ML", "label": "10ml"}, {"sku": "BAC-WATER-30ML", "label": "30ml"}]},
    {"name": "Epitalon", "slug": "epitalon", "cat": "peptides-anti-age",
     "formats": [{"sku": "EPITALON-10MG", "label": "10mg Vial"}, {"sku": "EPITALON-50MG", "label": "50mg Vial"}]},
    {"name": "GHK-Cu", "slug": "ghk-cu", "cat": "peptides-anti-age",
     "formats": [{"sku": "GHKCU-50MG", "label": "50mg Vial"}, {"sku": "GHKCU-100MG", "label": "100mg Vial"}, {"sku": "GHKCU-CREAM-1PCT", "label": "Creme 1%"}]},
    {"name": "Ipamorelin", "slug": "ipamorelin", "cat": "peptides-performance",
     "formats": [{"sku": "IPA-5MG", "label": "5mg Vial"}, {"sku": "IPA-10MG", "label": "10mg Vial"}]},
    {"name": "Kit Seringues", "slug": "kit-seringues-insuline", "cat": "accessoires",
     "formats": [{"sku": "SYRINGE-29G-10PK", "label": "10 Pack"}, {"sku": "SYRINGE-29G-50PK", "label": "50 Pack"}]},
    {"name": "MK-677", "slug": "mk-677-ibutamoren", "cat": "peptides-performance",
     "formats": [{"sku": "MK677-10MG-60", "label": "10mg x60"}, {"sku": "MK677-25MG-60", "label": "25mg x60"}]},
    {"name": "MOTS-c", "slug": "mots-c", "cat": "peptides-metabolisme",
     "formats": [{"sku": "MOTSC-5MG", "label": "5mg Vial"}]},
    {"name": "NAD+ Sublingual", "slug": "nad-plus", "cat": "supplements",
     "formats": [{"sku": "NAD-250MG-60", "label": "250mg x60"}, {"sku": "NAD-250MG-120", "label": "250mg x120"}]},
    {"name": "Semaglutide", "slug": "semaglutide", "cat": "peptides-metabolisme",
     "formats": [{"sku": "SEMA-3MG", "label": "3mg Vial"}, {"sku": "SEMA-5MG", "label": "5mg Vial"}, {"sku": "SEMA-10MG", "label": "10mg Vial"}]},
    {"name": "SS-31", "slug": "ss-31-elamipretide", "cat": "peptides-anti-age",
     "formats": [{"sku": "SS31-5MG", "label": "5mg Vial"}]},
    {"name": "TB-500", "slug": "tb-500", "cat": "peptides-recherche",
     "formats": [{"sku": "TB500-5MG", "label": "5mg Vial"}, {"sku": "TB500-10MG", "label": "10mg Vial"}]},
    {"name": "Tirzepatide", "slug": "tirzepatide", "cat": "peptides-metabolisme",
     "formats": [{"sku": "TIRZ-5MG", "label": "5mg Vial"}, {"sku": "TIRZ-10MG", "label": "10mg Vial"}, {"sku": "TIRZ-15MG", "label": "15mg Vial"}]},
]

def lerp_color(c1, c2, t):
    """Interpolate between two colors."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

def draw_gradient(draw, width, height, color_start, color_end):
    """Draw a vertical gradient."""
    for y in range(height):
        t = y / height
        color = lerp_color(color_start, color_end, t)
        draw.line([(0, y), (width, y)], fill=color)

def draw_hexagon(draw, cx, cy, radius, fill, outline=None):
    """Draw a hexagonal shape."""
    points = []
    for i in range(6):
        angle = math.radians(60 * i - 30)
        x = cx + radius * math.cos(angle)
        y = cy + radius * math.sin(angle)
        points.append((x, y))
    draw.polygon(points, fill=fill, outline=outline)

def draw_molecule_pattern(draw, width, height, accent_color, alpha=30):
    """Draw decorative molecular structure pattern."""
    nodes = []
    for i in range(8):
        angle = math.radians(i * 45 + 15)
        r = min(width, height) * 0.3
        cx = width // 2 + int(r * math.cos(angle))
        cy = height // 2 + int(r * math.sin(angle))
        nodes.append((cx, cy))

    faint = (*accent_color[:3], alpha) if len(accent_color) == 4 else accent_color

    # Draw connections
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            dist = math.sqrt((nodes[i][0] - nodes[j][0])**2 + (nodes[i][1] - nodes[j][1])**2)
            if dist < min(width, height) * 0.45:
                draw.line([nodes[i], nodes[j]], fill=faint, width=1)

    # Draw nodes
    for node in nodes:
        draw.ellipse([node[0]-4, node[1]-4, node[0]+4, node[1]+4], fill=faint)

def draw_vial_shape(draw, cx, cy, size, accent_color, highlight_color):
    """Draw a stylized vial shape."""
    w = size * 0.25
    h = size * 0.6
    neck_h = size * 0.15
    neck_w = w * 0.5

    # Vial body
    body_top = cy - h//2 + neck_h
    body_bottom = cy + h//2
    draw.rounded_rectangle(
        [cx - w, body_top, cx + w, body_bottom],
        radius=8,
        fill=(*accent_color, 40),
        outline=accent_color,
        width=2
    )

    # Vial neck
    draw.rectangle(
        [cx - neck_w, cy - h//2, cx + neck_w, body_top + 5],
        fill=(*accent_color, 40),
        outline=accent_color,
        width=2
    )

    # Cap
    cap_h = size * 0.06
    draw.rounded_rectangle(
        [cx - neck_w - 3, cy - h//2 - cap_h, cx + neck_w + 3, cy - h//2 + 2],
        radius=3,
        fill=highlight_color,
        outline=highlight_color,
    )

    # Liquid level (60% full)
    liquid_top = body_top + (body_bottom - body_top) * 0.4
    draw.rounded_rectangle(
        [cx - w + 2, int(liquid_top), cx + w - 2, body_bottom - 2],
        radius=6,
        fill=(*accent_color, 80),
    )

    # Reflection line
    draw.line(
        [(cx - w + 6, body_top + 10), (cx - w + 6, body_bottom - 10)],
        fill=(*highlight_color, 60),
        width=2
    )


def get_font(size, bold=False):
    """Try to get a nice font, fallback to default."""
    font_paths = [
        "/System/Library/Fonts/SFNSMono.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSText.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ]
    if bold:
        bold_paths = [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/Library/Fonts/Arial Bold.ttf",
        ]
        font_paths = bold_paths + font_paths

    for path in font_paths:
        try:
            return ImageFont.truetype(path, size)
        except (IOError, OSError):
            continue
    return ImageFont.load_default()


def create_product_image(product_name, category_slug, width=800, height=800):
    """Create a main product image."""
    colors = CATEGORY_COLORS.get(category_slug, CATEGORY_COLORS["peptides-recherche"])

    img = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # Background gradient
    draw_gradient(draw, width, height, colors["bg_start"], colors["bg_end"])

    # Molecular pattern
    draw_molecule_pattern(draw, width, height, colors["accent"])

    # Central hexagonal glow
    for r in range(120, 0, -2):
        alpha = int(20 * (1 - r / 120))
        c = (*colors["accent"], alpha)
        draw_hexagon(draw, width//2, height//2 - 30, r, fill=c)

    # Vial shape in center
    draw_vial_shape(draw, width//2, height//2 - 20, 320, colors["accent"], colors["highlight"])

    # Brand name at top
    font_brand = get_font(16)
    draw.text((width//2, 40), "BIOCYCLE PEPTIDES", fill=(*colors["accent"], 180), font=font_brand, anchor="mt")

    # Decorative line under brand
    line_w = 100
    draw.line([(width//2 - line_w, 60), (width//2 + line_w, 60)], fill=colors["accent"], width=1)

    # Product name
    font_name = get_font(38, bold=True)
    # Handle long names - wrap if needed
    name_parts = product_name.split(" + ")
    if len(name_parts) > 1:
        y_start = height - 180
        for i, part in enumerate(name_parts):
            prefix = "+ " if i > 0 else ""
            draw.text((width//2, y_start + i * 45), prefix + part, fill=colors["text"], font=font_name, anchor="mt")
    else:
        draw.text((width//2, height - 160), product_name, fill=colors["text"], font=font_name, anchor="mt")

    # "Research Peptide" subtitle
    font_sub = get_font(18)
    cat_labels = {
        "peptides-recherche": "Research Peptide",
        "peptides-performance": "Performance Peptide",
        "peptides-anti-age": "Anti-Aging Peptide",
        "peptides-metabolisme": "Metabolic Peptide",
        "supplements": "Supplement",
        "accessoires": "Accessory",
    }
    subtitle = cat_labels.get(category_slug, "Product")
    draw.text((width//2, height - 110), subtitle, fill=colors["highlight"], font=font_sub, anchor="mt")

    # Bottom decorative line
    draw.line([(width//2 - line_w, height - 90), (width//2 + line_w, height - 90)], fill=(*colors["accent"], 100), width=1)

    # Purity badge
    font_purity = get_font(14)
    draw.text((width//2, height - 70), "Purity ≥ 98%  |  Lab Tested  |  GMP", fill=(*colors["text"], 150), font=font_purity, anchor="mt")

    # Corner accents
    corner_size = 30
    draw.line([(20, 20), (20 + corner_size, 20)], fill=colors["accent"], width=2)
    draw.line([(20, 20), (20, 20 + corner_size)], fill=colors["accent"], width=2)
    draw.line([(width - 20, 20), (width - 20 - corner_size, 20)], fill=colors["accent"], width=2)
    draw.line([(width - 20, 20), (width - 20, 20 + corner_size)], fill=colors["accent"], width=2)
    draw.line([(20, height - 20), (20 + corner_size, height - 20)], fill=colors["accent"], width=2)
    draw.line([(20, height - 20), (20, height - 20 - corner_size)], fill=colors["accent"], width=2)
    draw.line([(width - 20, height - 20), (width - 20 - corner_size, height - 20)], fill=colors["accent"], width=2)
    draw.line([(width - 20, height - 20), (width - 20, height - 20 - corner_size)], fill=colors["accent"], width=2)

    # Convert to RGB for saving as PNG (no alpha artifacts)
    final = Image.new("RGB", (width, height), (0, 0, 0))
    final.paste(img, mask=img.split()[3])
    return final


def create_format_image(product_name, format_label, category_slug, sku, width=400, height=400):
    """Create a format-specific image (smaller, with format info)."""
    colors = CATEGORY_COLORS.get(category_slug, CATEGORY_COLORS["peptides-recherche"])

    img = Image.new("RGBA", (width, height), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # Background gradient
    draw_gradient(draw, width, height, colors["bg_start"], colors["bg_end"])

    # Subtle molecule pattern
    draw_molecule_pattern(draw, width, height, colors["accent"])

    # Hexagonal glow (smaller)
    for r in range(60, 0, -2):
        alpha = int(15 * (1 - r / 60))
        c = (*colors["accent"], alpha)
        draw_hexagon(draw, width//2, height//2 - 20, r, fill=c)

    # Vial shape
    draw_vial_shape(draw, width//2, height//2 - 15, 180, colors["accent"], colors["highlight"])

    # Brand
    font_brand = get_font(12)
    draw.text((width//2, 25), "BIOCYCLE PEPTIDES", fill=(*colors["accent"], 150), font=font_brand, anchor="mt")

    # Product name
    font_name = get_font(22, bold=True)
    draw.text((width//2, height - 110), product_name, fill=colors["text"], font=font_name, anchor="mt")

    # Format label (prominent)
    font_format = get_font(28, bold=True)
    draw.text((width//2, height - 75), format_label, fill=colors["highlight"], font=font_format, anchor="mt")

    # SKU
    font_sku = get_font(11)
    draw.text((width//2, height - 40), f"SKU: {sku}", fill=(*colors["text"], 120), font=font_sku, anchor="mt")

    # Corner accents (smaller)
    cs = 15
    draw.line([(10, 10), (10 + cs, 10)], fill=colors["accent"], width=1)
    draw.line([(10, 10), (10, 10 + cs)], fill=colors["accent"], width=1)
    draw.line([(width - 10, 10), (width - 10 - cs, 10)], fill=colors["accent"], width=1)
    draw.line([(width - 10, 10), (width - 10, 10 + cs)], fill=colors["accent"], width=1)
    draw.line([(10, height - 10), (10 + cs, height - 10)], fill=colors["accent"], width=1)
    draw.line([(10, height - 10), (10, height - 10 - cs)], fill=colors["accent"], width=1)
    draw.line([(width - 10, height - 10), (width - 10 - cs, height - 10)], fill=colors["accent"], width=1)
    draw.line([(width - 10, height - 10), (width - 10, height - 10 - cs)], fill=colors["accent"], width=1)

    final = Image.new("RGB", (width, height), (0, 0, 0))
    final.paste(img, mask=img.split()[3])
    return final


def main():
    results = []
    total_images = 0

    for product in PRODUCTS:
        slug = product["slug"]
        name = product["name"]
        cat = product["cat"]

        # Create product directory
        prod_dir = os.path.join(OUTPUT_DIR, slug)
        os.makedirs(prod_dir, exist_ok=True)

        # Main product image (800x800)
        main_path = os.path.join(prod_dir, "main.png")
        img = create_product_image(name, cat)
        img.save(main_path, "PNG", optimize=True)
        total_images += 1

        product_result = {
            "slug": slug,
            "main_image": f"/images/products/{slug}/main.png",
            "formats": []
        }

        # Format-specific images (400x400)
        for fmt in product["formats"]:
            sku = fmt["sku"]
            label = fmt["label"]
            safe_sku = sku.lower().replace(" ", "-")
            fmt_path = os.path.join(prod_dir, f"{safe_sku}.png")
            img = create_format_image(name, label, cat, sku)
            img.save(fmt_path, "PNG", optimize=True)
            total_images += 1

            product_result["formats"].append({
                "sku": sku,
                "image": f"/images/products/{slug}/{safe_sku}.png"
            })

        results.append(product_result)

    # Output JSON for DB update script
    output_json = os.path.join(OUTPUT_DIR, "image-manifest.json")
    with open(output_json, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Generated {total_images} images for {len(PRODUCTS)} products")
    print(f"Manifest saved to: {output_json}")

    # Print summary
    for r in results:
        print(f"  {r['slug']}: main + {len(r['formats'])} formats")


if __name__ == "__main__":
    main()
