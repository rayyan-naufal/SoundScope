import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_soundscope_icon(size=1024):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    scale = size / 1024.0
    center = size / 2.0

    # 1. Background squircle with drop shadow
    shadow_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow_img)
    margin = 44 * scale
    radius = 210 * scale
    sdraw.rounded_rectangle(
        [margin, margin + 16 * scale, size - margin, size - margin + 16 * scale],
        radius=radius,
        fill=(0, 0, 0, 140)
    )
    shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=28 * scale))
    img.paste(shadow_img, (0, 0), shadow_img)

    # Base squircle with dark gradient
    squircle_mask = Image.new("L", (size, size), 0)
    smask_draw = ImageDraw.Draw(squircle_mask)
    smask_draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        fill=255
    )

    grad_img = Image.new("RGBA", (size, size), (16, 17, 20, 255))
    gdraw = ImageDraw.Draw(grad_img)
    for y in range(int(margin), int(size - margin)):
        t = (y - margin) / float(size - 2 * margin)
        r = int(18 + 10 * (1 - t))
        g = int(19 + 12 * (1 - t))
        b = int(24 + 14 * (1 - t))
        gdraw.line([(margin, y), (size - margin, y)], fill=(r, g, b, 255))

    img.paste(grad_img, (0, 0), squircle_mask)

    # 2. Outer border rim with subtle metallic slate tone
    border_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(border_img)
    bdraw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=radius,
        outline=(58, 65, 80, 220),
        width=int(5 * scale)
    )
    img.paste(border_img, (0, 0), border_img)

    # 3. Vinyl & Scope Grooves (concentric circles)
    vinyl_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vinyl_layer)

    disc_radius = 380 * scale
    vdraw.ellipse(
        [center - disc_radius, center - disc_radius, center + disc_radius, center + disc_radius],
        fill=(22, 24, 30, 255),
        outline=(38, 42, 51, 255),
        width=int(4 * scale)
    )

    groove_radii = [350, 325, 300, 275, 250, 225, 195]
    for r in groove_radii:
        r_scaled = r * scale
        vdraw.ellipse(
            [center - r_scaled, center - r_scaled, center + r_scaled, center + r_scaled],
            outline=(33, 37, 46, 200),
            width=int(2 * scale)
        )

    # 4. SoundScope Waveform bars radiating horizontally
    wave_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    wdraw = ImageDraw.Draw(wave_layer)

    bar_heights = [18, 32, 55, 80, 120, 170, 210, 160, 110, 60, 30]
    bar_width = 16 * scale
    bar_gap = 14 * scale
    num_bars = len(bar_heights)

    for i, h in enumerate(bar_heights):
        bh = h * 1.6 * scale
        x_left = center - 80 * scale - (num_bars - 1 - i) * (bar_width + bar_gap)
        intensity = 0.5 + 0.5 * (i / float(num_bars))
        color = (
            int(232 + 23 * intensity),
            int(163 + 30 * intensity),
            int(61 + 20 * intensity),
            int(180 + 75 * intensity)
        )
        wdraw.rounded_rectangle(
            [x_left, center - bh/2, x_left + bar_width, center + bh/2],
            radius=bar_width/2,
            fill=color
        )

        x_right = center + 80 * scale + (num_bars - 1 - i) * (bar_width + bar_gap) - bar_width
        wdraw.rounded_rectangle(
            [x_right, center - bh/2, x_right + bar_width, center + bh/2],
            radius=bar_width/2,
            fill=color
        )

    # 5. Center Vinyl Core / Scope Dial (Amber Gradient)
    core_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(core_layer)

    glow_radius = 160 * scale
    glow_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow_img)
    g_draw.ellipse(
        [center - glow_radius, center - glow_radius, center + glow_radius, center + glow_radius],
        fill=(232, 163, 61, 80)
    )
    glow_img = glow_img.filter(ImageFilter.GaussianBlur(radius=20 * scale))
    core_layer.paste(glow_img, (0, 0), glow_img)

    disc_core_r = 135 * scale
    for r in range(int(disc_core_r), 0, -1):
        frac = r / disc_core_r
        red = int(201 + 45 * (1 - frac) + 9 * (1 - frac)**2)
        green = int(119 + 60 * (1 - frac) + 11 * (1 - frac)**2)
        blue = int(21 + 40 * (1 - frac))
        cdraw.ellipse(
            [center - r, center - r, center + r, center + r],
            outline=(red, green, blue, 255),
            width=2
        )

    spindle_r = 46 * scale
    cdraw.ellipse(
        [center - spindle_r, center - spindle_r, center + spindle_r, center + spindle_r],
        fill=(16, 17, 20, 255),
        outline=(255, 220, 140, 255),
        width=int(5 * scale)
    )

    reticle_color = (255, 235, 180, 200)
    for angle in [0, 45, 90, 135, 180, 225, 270, 315]:
        rad = math.radians(angle)
        r_in = 68 * scale
        r_out = 92 * scale
        x1 = center + r_in * math.cos(rad)
        y1 = center + r_in * math.sin(rad)
        x2 = center + r_out * math.cos(rad)
        y2 = center + r_out * math.sin(rad)
        cdraw.line([(x1, y1), (x2, y2)], fill=reticle_color, width=int(4 * scale))

    hole_r = 16 * scale
    cdraw.ellipse(
        [center - hole_r, center - hole_r, center + hole_r, center + hole_r],
        fill=(232, 163, 61, 255)
    )

    img.paste(vinyl_layer, (0, 0), vinyl_layer)
    img.paste(wave_layer, (0, 0), wave_layer)
    img.paste(core_layer, (0, 0), core_layer)

    return img

def export_all_icons():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    static_dir = os.path.join(base_dir, 'static')
    os.makedirs(static_dir, exist_ok=True)

    print("Generating SoundScope master icon (1024x1024)...")
    master = create_soundscope_icon(1024)

    sizes = {
        'icon-512x512.png': 512,
        'icon-192x192.png': 192,
        'icon-96x96.png': 96,
        'icon-48x48.png': 48,
        'icon-32x32.png': 32,
        'icon-16x16.png': 16,
    }

    resized_images = {}
    for filename, s in sizes.items():
        resized = master.resize((s, s), Image.Resampling.LANCZOS)
        resized_images[s] = resized
        target_path = os.path.join(static_dir, filename)
        resized.save(target_path, format="PNG", optimize=True)
        print(f"Saved {target_path}")

    root_png = os.path.join(base_dir, 'icon.png')
    resized_images[512].save(root_png, format="PNG", optimize=True)
    print(f"Saved {root_png}")

    ico_sizes = [256, 128, 64, 48, 32, 24, 16]
    ico_images = [master.resize((s, s), Image.Resampling.LANCZOS) for s in ico_sizes]

    fav_ico_path = os.path.join(static_dir, 'favicon.ico')
    ico_images[0].save(
        fav_ico_path,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:]
    )
    print(f"Saved {fav_ico_path}")

    root_ico_path = os.path.join(base_dir, 'icon.ico')
    ico_images[0].save(
        root_ico_path,
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:]
    )
    print(f"Saved {root_ico_path}")

    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1c1f26"/>
      <stop offset="100%" stop-color="#121318"/>
    </linearGradient>
    <linearGradient id="amberGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFBE40"/>
      <stop offset="50%" stop-color="#E8A33D"/>
      <stop offset="100%" stop-color="#C97715"/>
    </linearGradient>
    <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#E8A33D" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#E8A33D" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background Squircle -->
  <rect x="4" y="4" width="92" height="92" rx="22" fill="url(#bgGrad)" stroke="#343a46" stroke-width="2"/>
  <rect x="4" y="4" width="92" height="92" rx="22" fill="none" stroke="#E8A33D" stroke-width="1.5" stroke-dasharray="25 75" opacity="0.6"/>

  <!-- Vinyl Disc Background -->
  <circle cx="50" cy="50" r="36" fill="#16181d" stroke="#262a33" stroke-width="1.5"/>
  <circle cx="50" cy="50" r="30" fill="none" stroke="#21252e" stroke-width="1"/>
  <circle cx="50" cy="50" r="24" fill="none" stroke="#21252e" stroke-width="1"/>

  <!-- Waveform Bars -->
  <!-- Left Side -->
  <rect x="18" y="46" width="2.5" height="8" rx="1.25" fill="#E8A33D" opacity="0.6"/>
  <rect x="22" y="42" width="2.5" height="16" rx="1.25" fill="#E8A33D" opacity="0.75"/>
  <rect x="26" y="37" width="2.5" height="26" rx="1.25" fill="#E8A33D" opacity="0.9"/>
  <rect x="30" y="32" width="2.5" height="36" rx="1.25" fill="#FFBE40"/>

  <!-- Right Side -->
  <rect x="67" y="32" width="2.5" height="36" rx="1.25" fill="#FFBE40"/>
  <rect x="71" y="37" width="2.5" height="26" rx="1.25" fill="#E8A33D" opacity="0.9"/>
  <rect x="75" y="42" width="2.5" height="16" rx="1.25" fill="#E8A33D" opacity="0.75"/>
  <rect x="79" y="46" width="2.5" height="8" rx="1.25" fill="#E8A33D" opacity="0.6"/>

  <!-- Center Core -->
  <circle cx="50" cy="50" r="16" fill="url(#glowGrad)"/>
  <circle cx="50" cy="50" r="13" fill="url(#amberGrad)" stroke="#FFD88A" stroke-width="1"/>
  <circle cx="50" cy="50" r="5" fill="#101114" stroke="#FFE7AB" stroke-width="1.2"/>
  <circle cx="50" cy="50" r="2" fill="#E8A33D"/>

  <!-- Reticle lines -->
  <line x1="50" y1="39" x2="50" y2="42" stroke="#FFE7AB" stroke-width="1" stroke-linecap="round"/>
  <line x1="50" y1="58" x2="50" y2="61" stroke="#FFE7AB" stroke-width="1" stroke-linecap="round"/>
  <line x1="39" y1="50" x2="42" y2="50" stroke="#FFE7AB" stroke-width="1" stroke-linecap="round"/>
  <line x1="58" y1="50" x2="61" y2="50" stroke="#FFE7AB" stroke-width="1" stroke-linecap="round"/>
</svg>
'''
    svg_path = os.path.join(static_dir, 'favicon.svg')
    with open(svg_path, 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print(f"Saved {svg_path}")
    print("All icons successfully generated!")

if __name__ == '__main__':
    export_all_icons()
