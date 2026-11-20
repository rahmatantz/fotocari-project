// FotoCari image engine — pure Canvas 2D, runs 100% on-device (offline).

export const DEFAULTS = {
  auto: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0,
  warmth: 0, tint: 0, saturation: 0, vibrance: 0, clarity: 0, sharpen: 0, vignette: 0,
  sky: 0, skinSmooth: 0, skinBright: 0,
  rotate: 0, keystone: 0, aspect: 'original',
};

export const PRESETS = {
  properti: [
    { id: 'auto-listing', name: 'Auto Listing', desc: 'Seimbang, siap upload', s: { auto: 80, shadows: 30, highlights: -35, vibrance: 15, clarity: 15, sharpen: 25 } },
    { id: 'interior', name: 'Interior Terang', desc: 'Ruangan gelap jadi lapang', s: { auto: 70, exposure: 0.35, shadows: 50, highlights: -45, whites: 10, warmth: -4, vibrance: 10, sharpen: 20 } },
    { id: 'langit', name: 'Langit Biru', desc: 'Fasad & langit lebih hidup', s: { auto: 60, sky: 70, highlights: -40, vibrance: 22, clarity: 20, contrast: 8, sharpen: 20 } },
    { id: 'hdr', name: 'HDR Natural', desc: 'Jendela tidak gosong', s: { auto: 60, shadows: 65, highlights: -70, clarity: 30, vibrance: 12, contrast: -5, sharpen: 25 } },
    { id: 'senja', name: 'Senja Hangat', desc: 'Suasana sore yang nyaman', s: { auto: 40, warmth: 28, tint: 5, contrast: 10, vibrance: 15, shadows: 20, vignette: 18 } },
    { id: 'putih', name: 'Bersih Putih', desc: 'Dinding putih benar-benar putih', s: { auto: 90, exposure: 0.2, warmth: -12, saturation: -8, whites: 15, shadows: 25, sharpen: 15 } },
  ],
  potret: [
    { id: 'glow', name: 'Natural Glow', desc: 'Kulit halus, tetap natural', s: { auto: 50, skinSmooth: 45, skinBright: 18, warmth: 5, vibrance: 8, sharpen: 10 } },
    { id: 'studio', name: 'Studio Clean', desc: 'Headshot profil agen', s: { auto: 70, skinSmooth: 35, skinBright: 12, contrast: 10, clarity: 8, warmth: -3, sharpen: 15 } },
    { id: 'hangat', name: 'Hangat Lembut', desc: 'Tone hangat & lembut', s: { auto: 40, skinSmooth: 40, warmth: 15, tint: 4, contrast: -8, shadows: 15, vignette: 12 } },
    { id: 'wisuda', name: 'Wisuda Cerah', desc: 'Cerah untuk outdoor', s: { auto: 60, exposure: 0.15, skinSmooth: 35, skinBright: 15, vibrance: 18, highlights: -25, sky: 30 } },
    { id: 'bw', name: 'Hitam Putih', desc: 'Klasik dan tegas', s: { auto: 60, saturation: -100, contrast: 22, clarity: 12, vignette: 20 } },
    { id: 'moody', name: 'Moody', desc: 'Dramatis, kontras', s: { auto: 30, contrast: 18, saturation: -15, shadows: -10, highlights: -20, warmth: 6, vignette: 30, skinSmooth: 25 } },
  ],
};

export const ASPECTS = [
  { id: 'original', label: 'Asli', r: null },
  { id: '4:3', label: '4:3', r: 4 / 3 },
  { id: '3:2', label: '3:2', r: 3 / 2 },
  { id: '16:9', label: '16:9', r: 16 / 9 },
  { id: '1:1', label: '1:1', r: 1 },
  { id: '4:5', label: '4:5 IG', r: 4 / 5 },
  { id: '9:16', label: '9:16', r: 9 / 16 },
];

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
let filterSupport;
const hasFilter = () => {
  if (filterSupport === undefined) { const c = mk(1, 1).getContext('2d'); filterSupport = typeof c.filter === 'string'; }
  return filterSupport;
};

export async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export function thumbnail(img, size = 160) {
  const s = size / Math.max(img.naturalWidth, img.naturalHeight);
  const c = mk(img.naturalWidth * s, img.naturalHeight * s);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

// Histogram-based auto analysis (levels + gray-world white balance)
export function analyze(img) {
  const s = 256 / Math.max(img.naturalWidth, img.naturalHeight);
  const c = mk(img.naturalWidth * s, img.naturalHeight * s);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const hist = new Uint32Array(256); let sr = 0, sg = 0, sb = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    hist[(0.299 * r + 0.587 * g + 0.114 * b) | 0]++;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx < 245 && mn > 10) { sr += r; sg += g; sb += b; n++; }
  }
  const total = d.length / 4; let acc = 0, lo = 0, hi = 255;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.005) { lo = i; break; } }
  acc = 0;
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.005) { hi = i; break; } }
  n = n || 1; const mr = sr / n, mg = sg / n, mb = sb / n, m = (mr + mg + mb) / 3;
  const cl = (v) => Math.min(1.2, Math.max(0.83, v));
  return { lo: lo / 255, hi: Math.max(lo + 40, hi) / 255, gr: cl(m / mr), gg: cl(m / mg), gb: cl(m / mb) };
}

function blur(src, r) {
  const W = src.width, H = src.height;
  const f = Math.max(1, r / 3);
  const small = mk(W / f, H / f);
  const sx = small.getContext('2d'); sx.imageSmoothingQuality = 'high';
  if (hasFilter()) sx.filter = `blur(${Math.max(0.5, r / f)}px)`;
  sx.drawImage(src, -2, -2, small.width + 4, small.height + 4);
  const out = mk(W, H); const ox = out.getContext('2d', { willReadFrequently: true });
  ox.imageSmoothingQuality = 'high'; ox.drawImage(small, 0, 0, W, H);
  return ox.getImageData(0, 0, W, H).data;
}

// Geometry: crop to aspect + straighten (rotate) + vertical perspective (keystone)
function geometry(img, s, maxSize) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  // crop region in source
  let cw = iw, ch = ih;
  const asp = ASPECTS.find((a) => a.id === s.aspect)?.r;
  if (asp) { if (iw / ih > asp) cw = ih * asp; else ch = iw / asp; }
  const sc = Math.min(1, maxSize / Math.max(cw, ch));
  const W = Math.round(cw * sc), H = Math.round(ch * sc);
  const out = mk(W, H); const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  const th = (s.rotate * Math.PI) / 180, k = (s.keystone / 100) * 0.3;
  if (!th && !k) {
    ctx.drawImage(img, (iw - cw) / 2, (ih - ch) / 2, cw, ch, 0, 0, W, H);
    return out;
  }
  // rotation cover-scale
  const c = Math.abs(Math.cos(th)), sn = Math.abs(Math.sin(th));
  const cover = Math.max((W * c + H * sn) / W, (W * sn + H * c) / H);
  const stage = mk(W, H); const st = stage.getContext('2d'); st.imageSmoothingQuality = 'high';
  st.translate(W / 2, H / 2); st.rotate(th); st.scale(cover, cover);
  st.drawImage(img, (iw - cw) / 2, (ih - ch) / 2, cw, ch, -W / 2, -H / 2, W, H);
  if (!k) { ctx.drawImage(stage, 0, 0); return out; }
  // keystone: per-row horizontal scaling, then zoom to hide empty edges
  const ks = mk(W, H); const kx = ks.getContext('2d');
  for (let y = 0; y < H; y++) {
    const f = 1 + k * (1 - (2 * y) / H);
    if (f >= 1) { const sw = W / f; kx.drawImage(stage, (W - sw) / 2, y, sw, 1, 0, y, W, 1); }
    else kx.drawImage(stage, 0, y, W, 1, (W - W * f) / 2, y, W * f, 1);
  }
  const z = 1 / (1 - Math.abs(k));
  ctx.drawImage(ks, (W - W / z) / 2, (H - H / z) / 2, W / z, H / z, 0, 0, W, H);
  return out;
}

export function render(img, s, a, { maxSize = 1400, watermark = null, pixels = true } = {}) {
  const canvas = geometry(img, s, maxSize);
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (pixels) {
    const id = ctx.getImageData(0, 0, W, H); const d = id.data;
    const base = Math.max(W, H);
    const need = (v) => Math.abs(v) > 0.5;
    const local = need(s.shadows) || need(s.highlights) ? blur(canvas, base * 0.025) : null;
    const mid = need(s.clarity) ? blur(canvas, base * 0.015) : null;
    const skin = need(s.skinSmooth) ? blur(canvas, base * 0.006) : null;
    const fine = need(s.sharpen) ? blur(canvas, 1.3) : null;

    const at = (s.auto || 0) / 100;
    const A = a || { lo: 0, hi: 1, gr: 1, gg: 1, gb: 1 };
    const lo = A.lo * at, hi = 1 - (1 - A.hi) * at, lr = 1 / Math.max(0.2, hi - lo);
    const gr = 1 + (A.gr - 1) * at, gg = 1 + (A.gg - 1) * at, gb = 1 + (A.gb - 1) * at;
    const ev = Math.pow(2, s.exposure || 0);
    const bp = -(s.blacks / 100) * 0.08, wp = 1 - (s.whites / 100) * 0.1, wr = 1 / (wp - bp);
    const con = 1 + s.contrast / 100;
    const sh = s.shadows / 100, hl = s.highlights / 100;
    const cla = s.clarity / 100 * 1.2, shp = s.sharpen / 100 * 1.6;
    const wm = s.warmth / 100, tn = s.tint / 100;
    const rM = 1 + wm * 0.12, bM = 1 - wm * 0.12, gM = 1 - tn * 0.08;
    const sat = 1 + s.saturation / 100, vib = s.vibrance / 100;
    const sky = s.sky / 100, ss = s.skinSmooth / 100, sbr = s.skinBright / 100;
    const vg = s.vignette / 100, cx = W / 2, cy = H / 2, maxD = Math.hypot(cx, cy);
    const inv = 1 / 255;

    for (let y = 0, i = 0; y < H; y++) {
      const skyY = sky ? clamp01(1.25 - (y / H) * 1.6) : 0;
      for (let x = 0; x < W; x++, i += 4) {
        let r = d[i] * inv, g = d[i + 1] * inv, b = d[i + 2] * inv;
        // skin retouch first (works on original tones)
        if (ss || sbr) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          const cb = 128 - 0.168736 * R - 0.331264 * G + 0.5 * B;
          const cr = 128 + 0.5 * R - 0.418688 * G - 0.081312 * B;
          let m = clamp01(1 - Math.abs(cb - 102) / 28) * clamp01(1 - Math.abs(cr - 153) / 24);
          m = Math.min(1, m * 2.2);
          if (m > 0.01) {
            if (ss) {
              const br = skin[i] * inv, bg = skin[i + 1] * inv, bb = skin[i + 2] * inv;
              const diff = Math.abs(br - r) + Math.abs(bg - g) + Math.abs(bb - b);
              const edge = clamp01(1 - diff * 3.5);
              const w = ss * m * edge * 0.9;
              r += (br - r) * w; g += (bg - g) * w; b += (bb - b) * w;
            }
            if (sbr) { const w = sbr * m * 0.18; r += (1 - r) * w; g += (1 - g) * w; b += (1 - b) * w * 0.9; }
          }
        }
        // auto WB + levels
        r = (r * gr - lo) * lr; g = (g * gg - lo) * lr; b = (b * gb - lo) * lr;
        // exposure
        r *= ev; g *= ev; b *= ev;
        // whites / blacks
        r = (r - bp) * wr; g = (g - bp) * wr; b = (b - bp) * wr;
        // local shadows / highlights (HDR-like)
        if (local) {
          const L = 0.299 * r + 0.587 * g + 0.114 * b + 1e-4;
          const Ll = clamp01(0.5 * (0.299 * local[i] + 0.587 * local[i + 1] + 0.114 * local[i + 2]) * inv * ev + 0.5 * L);
          const sm = (1 - Ll) * (1 - Ll), hm = Ll * Ll;
          let Ln = L + sh * 0.45 * sm * (sh > 0 ? Math.sqrt(Math.max(0, L)) : L) + hl * 0.4 * hm * L;
          const f = Math.max(0, Ln) / L; r *= f; g *= f; b *= f;
        }
        // clarity & sharpen (high-pass)
        if (mid) { r += (r - mid[i] * inv * ev) * cla; g += (g - mid[i + 1] * inv * ev) * cla; b += (b - mid[i + 2] * inv * ev) * cla; }
        if (fine) { r += (d[i] * inv - fine[i] * inv) * shp; g += (d[i + 1] * inv - fine[i + 1] * inv) * shp; b += (d[i + 2] * inv - fine[i + 2] * inv) * shp; }
        // contrast
        r = (r - 0.5) * con + 0.5; g = (g - 0.5) * con + 0.5; b = (b - 0.5) * con + 0.5;
        // white balance creative
        r *= rM; g *= gM; b *= bM;
        // sky
        if (skyY > 0) {
          const L = 0.299 * r + 0.587 * g + 0.114 * b;
          const blu = clamp01((b - Math.max(r, g)) * 6) * clamp01((L - 0.3) * 3) * skyY * sky;
          if (blu > 0) { r -= r * 0.28 * blu; g -= g * 0.12 * blu; b += (1 - b) * 0.08 * blu; }
        }
        // saturation & vibrance
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        let sf = sat;
        if (vib) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); sf *= 1 + vib * (1 - clamp01((mx - mn) * 2)); }
        r = L + (r - L) * sf; g = L + (g - L) * sf; b = L + (b - L) * sf;
        // vignette
        if (vg) { const dd = Math.hypot(x - cx, y - cy) / maxD; const f = 1 - vg * 0.55 * dd * dd * dd; r *= f; g *= f; b *= f; }
        d[i] = r * 255; d[i + 1] = g * 255; d[i + 2] = b * 255;
      }
    }
    ctx.putImageData(id, 0, 0);
  }
  if (watermark && watermark.enabled && (watermark.text || watermark.sub)) drawWatermark(ctx, W, H, watermark);
  return canvas;
}

function drawWatermark(ctx, W, H, w) {
  const base = Math.min(W, H);
  const fs = Math.max(12, base * (w.size / 1000));
  const pad = base * 0.035;
  ctx.save();
  ctx.globalAlpha = w.opacity / 100;
  ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
  const tw = ctx.measureText(w.text || '').width;
  ctx.font = `500 ${fs * 0.55}px Inter, system-ui, sans-serif`;
  const sw = ctx.measureText(w.sub || '').width;
  const bw = Math.max(tw, sw), bh = fs * (w.sub ? 1.75 : 1.05);
  let x = pad, y = H - pad - bh;
  if (w.pos === 'br') x = W - pad - bw;
  if (w.pos === 'tl') y = pad;
  if (w.pos === 'tr') { x = W - pad - bw; y = pad; }
  if (w.pos === 'c') { x = (W - bw) / 2; y = (H - bh) / 2; }
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = fs * 0.25;
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'top';
  const ax = w.pos === 'br' || w.pos === 'tr' ? bw : w.pos === 'c' ? bw / 2 : 0;
  ctx.textAlign = w.pos === 'br' || w.pos === 'tr' ? 'right' : w.pos === 'c' ? 'center' : 'left';
  ctx.font = `700 ${fs}px Inter, system-ui, sans-serif`;
  ctx.fillText(w.text || '', x + ax, y);
  if (w.sub) { ctx.font = `500 ${fs * 0.55}px Inter, system-ui, sans-serif`; ctx.fillText(w.sub, x + ax, y + fs * 1.12); }
  ctx.restore();
}

export const canvasToBlob = (c, q = 0.9) => new Promise((res) => c.toBlob(res, 'image/jpeg', q));
