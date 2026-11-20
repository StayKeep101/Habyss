// Draws the Skia hourglass with the real Skia engine (CanvasKit) for a preview.
const fs = require('fs');
const repo = process.argv[2], out = process.argv[3];
(async () => {
  global.CanvasKit = await require(repo + '/node_modules/canvaskit-wasm/bin/full/canvaskit.js')({ locateFile: f => repo + '/node_modules/canvaskit-wasm/bin/full/' + f });
  const { getSkiaExports, makeOffscreenSurface } = require(repo + '/node_modules/@shopify/react-native-skia/lib/commonjs/headless');
  const { Skia } = getSkiaExports();
  const src = fs.readFileSync(repo + '/components/Home/SkiaHourglass.tsx', 'utf8');
  const OUTLINE = JSON.parse(src.match(/const OUTLINE[^=]*= (\[[\s\S]*?\]);/)[1].replace(/\s+/g, '').replace(/,\]$/, ']'));
  const ink = { pillar: ['#4A5888', '#5C6B9E', '#3F4C7A'], glass: ['#1F2B4C', '#162039', '#1B2747'], rim: '#9BB2F0', rimGlow: '#8FA8EE', cap: ['#7A8DC9', '#4A5A92', '#3A4878'] };
  const W = 622, H = 836, CX = 312, NECK = 435, GT = 87, GB = 747, TOP_FULL = 175, PILE_FULL = 170;
  const glassPath = inset => {
    const p = Skia.Path.Make();
    const pts = [...OUTLINE.map(([y, , r]) => [r - inset, y]), ...[...OUTLINE].reverse().map(([y, l]) => [l + inset, y])];
    p.moveTo(pts[0][0], pts[0][1] + inset);
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; p.quadTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2); }
    p.close(); return p;
  };
  const outer = glassPath(0), inner = glassPath(9);
  const grad = (x0, y0, x1, y1, cols, pos) => Skia.Shader.MakeLinearGradient({ x: x0, y: y0 }, { x: x1, y: y1 }, cols.map(c => Skia.Color(c)), pos ?? null, 0);
  const frames = [];
  for (const [r, tilt] of [[0.45, 0], [0.45, 0.7], [0.85, -0.5]]) {
    const surface = makeOffscreenSurface(W, H + 40);
    const c = surface.getCanvas();
    c.drawColor(Skia.Color('#0B1020'));
    c.translate(0, 20);
    const paint = () => { const p = Skia.Paint(); p.setAntiAlias(true); return p; };
    for (const x of [38, 548]) { const p = paint(); p.setShader(grad(x, 0, x + 37, 0, ink.pillar)); c.drawRRect(Skia.RRectXY(Skia.XYWHRect(x, 80, 37, 680), 10, 10), p); }
    { const p = paint(); p.setShader(grad(0, GT, 0, GB, ink.glass)); c.drawPath(outer, p); }
    // sand
    c.save(); c.clipPath(inner, 1, true);
    const sp = paint(); sp.setShader(grad(0, GT, 0, GB, ['#8F9AF0', '#4F46E5']));
    const level = TOP_FULL + (NECK - TOP_FULL) * r, sway = 9 * (1 - r), t = 1800;
    const top = Skia.Path.Make(); top.moveTo(60, NECK + 4);
    for (let x = 60; x <= W - 60; x += 16) top.lineTo(x, level + sway * Math.sin(x * 0.018 + t * 0.0012) + tilt * (x - CX) * 0.22);
    top.lineTo(W - 60, NECK + 4); top.close(); c.drawPath(top, sp);
    const h = PILE_FULL * r, peakX = CX + tilt * 60;
    const pile = Skia.Path.Make(); pile.moveTo(60, GB + 4); pile.lineTo(60, GB - h * 0.35 + tilt * 20);
    pile.quadTo(peakX, GB - h * 1.65, W - 60, GB - h * 0.35 - tilt * 20); pile.lineTo(W - 60, GB + 4); pile.close(); c.drawPath(pile, sp);
    const gp = paint(); gp.setColor(Skia.Color('#8F9AF0'));
    c.drawRect(Skia.XYWHRect(CX - 3, NECK - 14, 6, 26), gp);
    const land = GB - h * 0.95;
    for (let i = 0; i < 14; i++) { const ph = ((t / 900) + i / 14) % 1, f = ph * ph; gp.setAlphaf(ph < 0.1 ? ph * 10 : ph > 0.9 ? (1 - ph) * 10 : 1); c.drawCircle(CX + tilt * f * 46 + Math.sin(i * 12.9898) * 3, NECK + 12 + f * (land - NECK - 12), 4.2, gp); }
    const band = paint(); const d = 0.35 * (W + 300) - 150 + tilt * 80;
    band.setShader(grad(d - 90, 0, d + 90, H, ['rgba(255,255,255,0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']));
    c.drawRect(Skia.XYWHRect(0, GT, W, GB - GT), band);
    c.restore();
    { const p = paint(); p.setStyle(1); p.setStrokeWidth(14); p.setColor(Skia.Color(ink.rimGlow)); p.setAlphaf(0.35); p.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 10, true)); c.drawPath(outer, p); }
    { const p = paint(); p.setStyle(1); p.setStrokeWidth(6); p.setColor(Skia.Color(ink.rim)); p.setAlphaf(0.85); c.drawPath(outer, p); }
    for (const [d2, w, a] of [['M 130 150 C 118 205 132 255 170 300', 10, 0.18], ['M 128 600 C 118 645 126 690 158 720', 8, 0.12]]) {
      const p = paint(); p.setStyle(1); p.setStrokeWidth(w); p.setStrokeCap(1); p.setColor(Skia.Color('#FFFFFF')); p.setAlphaf(a); p.setMaskFilter(Skia.MaskFilter.MakeBlur(0, 3, true)); c.drawPath(Skia.Path.MakeFromSVGString(d2), p);
    }
    for (const y of [0, H - 88]) { const p = paint(); p.setShader(grad(0, y, 0, y + 87, ink.cap, [0, 0.25, 1])); c.drawRRect(Skia.RRectXY(Skia.XYWHRect(1, y, W - 2, 87), 40, 40), p); }
    surface.flush();
    frames.push(surface.makeImageSnapshot().encodeToBytes());
  }
  frames.forEach((bytes, i) => fs.writeFileSync(`${out}/skia_${i}.png`, Buffer.from(bytes)));
  console.log('rendered', frames.length);
})().catch(e => { console.error(e); process.exit(1); });
