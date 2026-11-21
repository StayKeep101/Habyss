"""
Each rank's empty hourglass frame, ready for the live Skia sand
(components/Home/SkiaHourglass.tsx): scaled to 840 tall (the sand's own grid,
so its physics constants hold), saved to assets/images/hourglasses/frames, and
its glass traced from the transparent gaps either side of it, row by row.
Writes theme/hourglassFrames.ts.

    python3 scripts/trace-hourglass-frames.py "<folder of empty frames>"
"""
import os, sys
from PIL import Image

SRC = sys.argv[1]
FILES = {
    'Lost': '../Empty Stone Hourglass Icon.png',
    'Beginner': '../Empty Purple-Glass Hourglass Emblem.png',
    'Consistent': '../Empty Blue Hourglass Icon.png',
    'Growing': 'Empty Ornate Bronze Hourglass Icon.png',
    'Disciplined': 'Futuristic Empty Hourglass Emblem.png',
    'Focused': 'Empty Teal Hourglass Emblem.png',
    'Master': 'Empty Golden Hourglass Badge.png',
    'Unbreakable': 'Empty Titan Hourglass Icon.png',
    'Timekeeper': 'Empty Ornate Marble Hourglass.png',
    'Eternal': 'Empty Iridescent Crystal Hourglass.png',
}
H = 840
# How bright each frame stands on Home's night scene: 80%, and the three darker-born
# ones (on black, brighter glass) 70%, so every frame sits in the scene alike.
BRIGHTNESS = {'Lost': 0.7, 'Beginner': 0.7, 'Consistent': 0.7}

def keyed(im):
    """Art drawn on black instead of transparency: the black made clear, softly at its edge."""
    if im.mode == 'RGBA' and im.getextrema()[3][0] < 250: return im
    im = im.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, _ = px[x, y]
            m = max(r, g, b)
            if m < 12: px[x, y] = (r, g, b, max(0, (m - 3) * 255 // 9))
    return im
STEP = 12

def trace(im):
    w, h = im.size
    a = im.split()[3].load()
    cx0 = w // 2
    rows = {}
    for y in range(h):
        if a[cx0, y] <= 128: continue
        l = cx0
        while l > 0 and a[l - 1, y] > 128: l -= 1
        r = cx0
        while r < w - 1 and a[r + 1, y] > 128: r += 1
        # Glass is never wider than 0.6 of the art; wider is a cap, a base, or a pillar touching it.
        if r - l < w * 0.6: rows[y] = (l, r)
    # The run of glass rows around the middle.
    y = h // 2
    while y not in rows: y += 1
    top = y
    while top - 1 in rows: top -= 1
    bottom = y
    while bottom + 1 in rows: bottom += 1
    # Where a pillar's base overlaps the lower bulb (the Titan glass) there is no gap
    # below some row: carry on down the glass by its colour instead (glass and rim are
    # grey; the frame is not), until the floor.
    px = im.load()
    sat = lambda x, yy: max(px[x, yy][:3]) - min(px[x, yy][:3])
    cut = bottom
    while True:
        yy = bottom + 1
        if yy >= h or sat(cx0, yy) >= 20: break
        l = cx0
        while l > 0 and sat(l - 1, yy) < 20: l -= 1
        r = cx0
        while r < w - 1 and sat(r + 1, yy) < 20: r += 1
        if r - l >= w * 0.6: break
        rows[yy] = (l, r)
        bottom = yy
    if bottom - cut < 8: bottom = cut
    mid = [yy for yy in range(top + (bottom - top) * 3 // 10, top + (bottom - top) * 7 // 10)]
    neck = min(mid, key=lambda yy: rows[yy][1] - rows[yy][0])
    cx = round((rows[neck][0] + rows[neck][1]) / 2)
    outline = [[yy, rows[yy][0], rows[yy][1]] for yy in range(top, bottom + 1, STEP)]
    if outline[-1][0] != bottom: outline.append([bottom, rows[bottom][0], rows[bottom][1]])
    # How bright the empty glass is: its own light is laid back over the sand, less of it
    # the brighter it is, or light glass washes light sand out (the crystal).
    lum = [sum(px[x, yy][:3]) / 765 for yy in range(top + 20, bottom - 20, 6) for x in range(rows[yy][0] + 15, rows[yy][1] - 15, 6)]
    glass = sum(lum) / len(lum)
    light = round(max(0.25, min(0.75, 0.75 - (glass - 0.25) * 2.5)), 2)
    # Where the base ends: it stands on the podium there, covering the step's light.
    foot = max(yy for yy in range(h) if any(a[x, yy] > 128 for x in range(0, w, 3)))
    return dict(width=w, height=h, cx=cx, neck=neck, top=top, bottom=bottom, light=light, foot=foot, outline=outline)

out = []
for rank, name in FILES.items():
    im = keyed(Image.open(os.path.join(SRC, name)))
    im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    # The glass 30% less see-through: what shows through anything partly clear is cut by 30%.
    a = im.split()[3].point(lambda v: v if v in (0, 255) else round(255 - 0.7 * (255 - v)))
    im.putalpha(a)
    im.save(f'assets/images/hourglasses/frames/{rank.lower()}.png', optimize=True)
    g = trace(im)
    rows = ', '.join(f'[{y}, {l}, {r}]' for y, l, r in g['outline'])
    out.append(f"""    {rank}: {{
        image: require('@/assets/images/hourglasses/frames/{rank.lower()}.png'),
        width: {g['width']}, height: {g['height']}, cx: {g['cx']}, neck: {g['neck']}, top: {g['top']}, bottom: {g['bottom']}, light: {g['light']}, foot: {g['foot']}, brightness: {BRIGHTNESS.get(rank, 0.8)},
        outline: [{rows}],
    }},""")
    print(rank, {k: v for k, v in g.items() if k != 'outline'})

open('theme/hourglassFrames.ts', 'w').write("""import type { ImageSourcePropType } from 'react-native';

/**
 * Each rank's empty hourglass frame, for the live sand drawn with Skia inside
 * it (components/Home/SkiaHourglass.tsx), on Home and in Focus. Generated by
 * scripts/trace-hourglass-frames.py: the art scaled to 840 tall, and its glass
 * traced from the transparent gaps either side of it ([y, left, right] rows),
 * its neck and its centre, all on the art's own grid. A rank without a frame
 * keeps the drawn blue hourglass.
 */
export interface GlassFrame {
    image: ImageSourcePropType;
    width: number;
    height: number;
    cx: number;
    neck: number;
    top: number;
    bottom: number;
    /** How much of the glass's own light goes back over the sand (less for light glass). */
    light: number;
    /** Where the base ends (it stands on the podium there). */
    foot: number;
    /** How bright the whole hourglass stands in the night scene (1 is as drawn). */
    brightness: number;
    outline: [number, number, number][];
}

export const HOURGLASS_FRAMES: Record<string, GlassFrame> = {
""" + '\n'.join(out) + '\n};\n')
