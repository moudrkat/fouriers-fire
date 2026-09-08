// Shared drawing: the palette, painting a temperature field, colouring a word by its heat.
// Used by index.html (the page) and record.html (the video), so they cannot drift apart.
const PAL = new Uint8ClampedArray(256 * 4);
{
  const stops = [[0, [0, 0, 0]], [.18, [70, 4, 0]], [.36, [190, 30, 0]], [.55, [245, 110, 10]], [.75, [255, 200, 60]], [.9, [255, 240, 180]], [1, [255, 255, 255]]];
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let a = stops[0], b = stops[1];
    for (let s = 1; s < stops.length; s++) { if (t <= stops[s][0]) { a = stops[s - 1]; b = stops[s]; break; } }
    const f = (t - a[0]) / (b[0] - a[0] || 1);
    for (let c = 0; c < 3; c++) PAL[4 * i + c] = a[1][c] + (b[1][c] - a[1][c]) * f;
    PAL[4 * i + 3] = 255;
  }
}
function paintField(img, T, n) {
  const p = img.data;
  for (let i = 0; i < n; i++) { const c = 4 * Math.min(255, T[i] * 255 | 0); p[4 * i] = PAL[c]; p[4 * i + 1] = PAL[c + 1]; p[4 * i + 2] = PAL[c + 2]; p[4 * i + 3] = 255; }
}
// a word's heat on the bottom row, from the sentence score s and the word's share
function wordHeat(s, share) { return Math.max(.15, Math.min(1, .6 + .25 * s + 1.8 * share)); }
function wordColor(h, share) { return share < -.05 ? '#4E8FCB' : `rgb(${Math.max(125, Math.round(255 * h))},${Math.round(110 + 120 * h * h)},${Math.round(92 + 40 * h)})`; }
// the per-column ember heat for a fluid of width W
function emberHeat(W, words, shares, s) {
  const heat = new Float32Array(W), x0 = W * .12, x1 = W * .88, span = (x1 - x0) / words.length;
  words.forEach((w, i) => { const h = wordHeat(s, shares[i]); for (let x = Math.round(x0 + i * span); x < Math.round(x0 + (i + 1) * span) - 1; x++) heat[x] = h; });
  return heat;
}
// the 1990s trick, as on the long page: Fourier with a constant updraft. Used here only for its brightness.
function makeTrick(W, H) {
  const h = new Float32Array(W * (H + 4)), ember = new Float32Array(W), K = { D: .3, k: .012, p: .5 }; let mean = 0;
  function step() {
    for (let x = 0; x < W; x++) { if (Math.random() < .08) ember[x] = Math.random() < K.p ? 1 : 0; for (let y = H; y < H + 4; y++) h[y * W + x] = ember[x]; }
    let sum = 0;
    for (let y = 0; y < H; y++) { const r = (y + 1) * W; for (let x = 0; x < W; x++) {
      const xc = Math.min(W - 1, Math.max(0, x + (Math.random() * 3 | 0) - 1)), xl = xc ? xc - 1 : 0, xr = xc < W - 1 ? xc + 1 : xc;
      const s = (1 - K.D) * h[r + xc] + K.D * .5 * (h[r + xl] + h[r + xr]) - K.k * (.5 + Math.random()); const t = s > 0 ? s : 0; h[y * W + x] = t; sum += t; } }
    mean = sum / (W * H);
  }
  return { step, K, mean: () => mean };
}
// a sparkline of the last N samples, drawn into a small canvas
function sparkline(canvas, buf, n, i, color) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  if (n < 2) return;
  let lo = Infinity, hi = -Infinity; for (let j = 0; j < n; j++) { const v = buf[(i - n + j + buf.length) % buf.length]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo || 1e-6;
  g.strokeStyle = color; g.lineWidth = 1.5; g.beginPath();
  for (let j = 0; j < n; j++) { const v = buf[(i - n + j + buf.length) % buf.length]; const x = j / (buf.length - 1) * W, y = H - 2 - (v - lo) / span * (H - 4); j ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
}
