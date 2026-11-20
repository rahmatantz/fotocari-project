import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal, Sparkles, WandSparkles, Crop, Layers, Download, ImagePlus, Sun, Moon, Wifi, WifiOff,
  Undo2, RotateCcw, Columns2, Building, User, Check, X, Trash, Save, LoaderCircle, Stamp, CloudSun, Plus, Aperture,
} from 'lucide-react';
import JSZip from 'jszip';
import { DEFAULTS, PRESETS, ASPECTS, loadImage, thumbnail, analyze, render, canvasToBlob } from './engine.js';
import { saveFile, store } from './platform.js';

const EXPORT_SIZES = [
  { id: 'listing', label: 'Listing', px: 1600, hint: '1600px · ringan' },
  { id: 'hd', label: 'HD', px: 2560, hint: '2560px' },
  { id: 'full', label: 'Penuh', px: 4096, hint: 'hingga 4096px' },
];

const TABS = [
  { id: 'adjust', label: 'Atur', icon: SlidersHorizontal },
  { id: 'preset', label: 'Preset', icon: Sparkles },
  { id: 'retouch', label: 'Retouch', icon: WandSparkles },
  { id: 'frame', label: 'Bingkai', icon: Crop },
  { id: 'batch', label: 'Batch', icon: Layers },
];

const GROUPS = {
  light: [
    { k: 'auto', label: 'Auto Enhance', min: 0, max: 100 },
    { k: 'exposure', label: 'Eksposur', min: -2, max: 2, step: 0.05, fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(2)} EV` },
    { k: 'contrast', label: 'Kontras', min: -100, max: 100 },
    { k: 'highlights', label: 'Highlight', min: -100, max: 100 },
    { k: 'shadows', label: 'Bayangan', min: -100, max: 100 },
    { k: 'whites', label: 'Putih', min: -100, max: 100 },
    { k: 'blacks', label: 'Hitam', min: -100, max: 100 },
  ],
  color: [
    { k: 'warmth', label: 'Suhu Warna', min: -100, max: 100, track: 'from-sky-400 via-white/40 to-amber-400' },
    { k: 'tint', label: 'Tint', min: -100, max: 100, track: 'from-emerald-400 via-white/40 to-fuchsia-400' },
    { k: 'saturation', label: 'Saturasi', min: -100, max: 100 },
    { k: 'vibrance', label: 'Vibrance', min: -100, max: 100 },
  ],
  detail: [
    { k: 'clarity', label: 'Kejernihan', min: -100, max: 100 },
    { k: 'sharpen', label: 'Ketajaman', min: 0, max: 100 },
    { k: 'vignette', label: 'Vignette', min: -100, max: 100 },
  ],
  property: [
    { k: 'sky', label: 'Langit Biru', min: 0, max: 100 },
    { k: 'rotate', label: 'Luruskan', min: -15, max: 15, step: 0.1, fmt: (v) => `${v.toFixed(1)}°` },
    { k: 'keystone', label: 'Tegakkan Vertikal', min: -50, max: 50 },
  ],
  portrait: [
    { k: 'skinSmooth', label: 'Haluskan Kulit', min: 0, max: 100 },
    { k: 'skinBright', label: 'Cerahkan Kulit', min: 0, max: 100 },
  ],
};

const uid = () => Math.random().toString(36).slice(2, 10);
const cx = (...a) => a.filter(Boolean).join(' ');

export default function App() {
  const [dark, setDark] = useState(() => store.get('fc.dark', true));
  const [mode, setMode] = useState(() => store.get('fc.mode', 'properti'));
  const [tab, setTab] = useState('preset');
  const [photos, setPhotos] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [importing, setImporting] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [compare, setCompare] = useState(false);
  const [split, setSplit] = useState(50);
  const [rendering, setRendering] = useState(false);
  const [toast, setToast] = useState(null);
  const [progress, setProgress] = useState(null);
  const [exportSize, setExportSize] = useState(() => store.get('fc.size', 'listing'));
  const [quality, setQuality] = useState(() => store.get('fc.q', 90));
  const [wm, setWm] = useState(() => store.get('fc.wm', { enabled: false, text: 'rumahcari.com', sub: '', pos: 'br', size: 45, opacity: 85 }));
  const [myPresets, setMyPresets] = useState(() => store.get('fc.mine', []));
  const [activePreset, setActivePreset] = useState(null);

  const fileRef = useRef(null);
  const viewRef = useRef(null);
  const beforeRef = useRef(null);
  const stageRef = useRef(null);
  const history = useRef({});
  const raf = useRef(0);

  const active = useMemo(() => photos.find((p) => p.id === activeId) || null, [photos, activeId]);

  useEffect(() => { document.documentElement.classList.toggle('dark', dark); store.set('fc.dark', dark); }, [dark]);
  useEffect(() => store.set('fc.mode', mode), [mode]);
  useEffect(() => store.set('fc.wm', wm), [wm]);
  useEffect(() => store.set('fc.mine', myPresets), [myPresets]);
  useEffect(() => { store.set('fc.size', exportSize); store.set('fc.q', quality); }, [exportSize, quality]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const notify = useCallback((msg, kind = 'ok') => {
    setToast({ msg, kind, id: uid() });
    setTimeout(() => setToast((t) => (t && t.msg === msg ? null : t)), 2600);
  }, []);

  // ---------- preview rendering ----------
  const previewMax = typeof window !== 'undefined' && window.innerWidth < 768 ? 1080 : 1600;
  useEffect(() => {
    if (!active) return;
    cancelAnimationFrame(raf.current);
    setRendering(true);
    raf.current = requestAnimationFrame(() => {
      const t = setTimeout(() => {
        const out = render(active.img, active.s, active.a, { maxSize: previewMax, watermark: wm });
        const v = viewRef.current;
        if (v) { v.width = out.width; v.height = out.height; v.getContext('2d').drawImage(out, 0, 0); }
        setRendering(false);
      }, 0);
      return () => clearTimeout(t);
    });
  }, [active, wm, previewMax]);

  const geoKey = active ? `${active.id}|${active.s.rotate}|${active.s.keystone}|${active.s.aspect}` : '';
  useEffect(() => {
    if (!active || !compare) return;
    const out = render(active.img, active.s, active.a, { maxSize: previewMax, pixels: false });
    const b = beforeRef.current;
    if (b) { b.width = out.width; b.height = out.height; b.getContext('2d').drawImage(out, 0, 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey, compare, previewMax]);

  // ---------- settings ----------
  const snapshot = useCallback(() => {
    if (!active) return;
    const h = (history.current[active.id] ||= []);
    h.push(active.s); if (h.length > 40) h.shift();
  }, [active]);

  const patch = useCallback((p) => {
    setPhotos((ps) => ps.map((ph) => (ph.id === activeId ? { ...ph, s: { ...ph.s, ...p } } : ph)));
  }, [activeId]);

  const undo = () => {
    const h = active && history.current[active.id];
    if (!h || !h.length) return notify('Tidak ada langkah untuk dibatalkan', 'info');
    const prev = h.pop();
    setPhotos((ps) => ps.map((ph) => (ph.id === activeId ? { ...ph, s: prev } : ph)));
  };

  const resetAll = () => { if (!active) return; snapshot(); patch({ ...DEFAULTS, aspect: active.s.aspect }); setActivePreset(null); };

  const applyPreset = (p) => {
    if (!active) return;
    snapshot();
    const keep = { rotate: active.s.rotate, keystone: active.s.keystone, aspect: active.s.aspect };
    patch({ ...DEFAULTS, ...p.s, ...keep });
    setActivePreset(p.id);
  };

  const saveMine = () => {
    if (!active) return;
    const name = `Preset Saya ${myPresets.length + 1}`;
    const { rotate, keystone, aspect, ...rest } = active.s;
    setMyPresets((m) => [...m, { id: `mine-${uid()}`, name, desc: mode === 'properti' ? 'Properti' : 'Potret', s: rest }]);
    notify(`"${name}" tersimpan di perangkat`);
  };

  // ---------- import ----------
  const onFiles = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    if (!list.length) return;
    setImporting(list.length);
    const added = [];
    for (const f of list) {
      try {
        const img = await loadImage(f);
        const item = { id: uid(), name: f.name.replace(/\.[^.]+$/, ''), img, thumb: thumbnail(img), a: analyze(img), s: { ...DEFAULTS, auto: 60 } };
        added.push(item);
        setPhotos((ps) => [...ps, item]);
        setImporting((n) => Math.max(0, n - 1));
        setActiveId((id) => id || item.id);
      } catch {
        setImporting((n) => Math.max(0, n - 1));
        notify(`Gagal membuka ${f.name} (format tidak didukung)`, 'err');
      }
    }
    if (added.length) notify(`${added.length} foto siap diedit`);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removePhoto = (id) => {
    setPhotos((ps) => {
      const rest = ps.filter((p) => p.id !== id);
      if (id === activeId) setActiveId(rest[0]?.id || null);
      return rest;
    });
  };

  const applyToAll = () => {
    if (!active) return;
    const { rotate, keystone, ...rest } = active.s;
    setPhotos((ps) => ps.map((p) => (p.id === active.id ? p : { ...p, s: { ...p.s, ...rest } })));
    notify(`Pengaturan diterapkan ke ${photos.length - 1} foto lain`);
  };

  // ---------- export ----------
  const maxPx = EXPORT_SIZES.find((e) => e.id === exportSize)?.px || 1600;
  const exportOne = async () => {
    if (!active) return;
    setProgress({ done: 0, total: 1 });
    try {
      await new Promise((r) => setTimeout(r, 30));
      const c = render(active.img, active.s, active.a, { maxSize: maxPx, watermark: wm });
      const blob = await canvasToBlob(c, quality / 100);
      const how = await saveFile(blob, `${active.name}_fotocari.jpg`);
      notify(how === 'shared' ? 'Foto disimpan — pilih tujuan di menu bagikan' : 'Foto diunduh');
    } catch (e) { notify('Ekspor gagal: ' + (e?.message || e), 'err'); }
    setProgress(null);
  };

  const exportAll = async () => {
    if (!photos.length) return;
    if (photos.length === 1) return exportOne();
    const zip = new JSZip();
    setProgress({ done: 0, total: photos.length });
    try {
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        await new Promise((r) => setTimeout(r, 15));
        const c = render(p.img, p.s, p.a, { maxSize: maxPx, watermark: wm });
        zip.file(`${String(i + 1).padStart(2, '0')}_${p.name}.jpg`, await canvasToBlob(c, quality / 100));
        setProgress({ done: i + 1, total: photos.length });
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const stamp = new Date().toISOString().slice(0, 10);
      const how = await saveFile(blob, `fotocari_${stamp}_${photos.length}foto.zip`);
      notify(how === 'shared' ? 'ZIP siap — pilih tujuan simpan' : `${photos.length} foto diunduh (ZIP)`);
    } catch (e) { notify('Ekspor gagal: ' + (e?.message || e), 'err'); }
    setProgress(null);
  };

  // ---------- compare drag ----------
  const dragSplit = (e) => {
    const r = stageRef.current?.getBoundingClientRect(); if (!r) return;
    setSplit(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };

  const presets = [...PRESETS[mode === 'properti' ? 'properti' : 'potret'], ...myPresets];

  // ---------- UI pieces ----------
  const slider = (def) => {
    const v = active ? active.s[def.k] : 0;
    const pct = ((v - def.min) / (def.max - def.min)) * 100;
    const zero = ((0 - def.min) / (def.max - def.min)) * 100;
    return (
      <div key={def.k} className="group py-2">
        <div className="mb-1.5 flex items-center justify-between text-[13px]">
          <span className="text-slate-600 dark:text-slate-300">{def.label}</span>
          <button
            onClick={() => { snapshot(); patch({ [def.k]: 0 }); }}
            className={cx('rounded-md px-1.5 py-0.5 font-mono text-[12px] tabular-nums transition',
              v ? 'text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500')}
            title="Ketuk untuk reset"
          >
            {def.fmt ? def.fmt(v) : `${v > 0 && def.min < 0 ? '+' : ''}${Math.round(v)}`}
          </button>
        </div>
        <div className="relative flex h-7 items-center">
          <div className={cx('absolute inset-x-0 h-1.5 rounded-full', def.track ? `bg-gradient-to-r ${def.track} opacity-60` : 'bg-slate-200 dark:bg-white/10')} />
          {!def.track && (
            <div className="absolute h-1.5 rounded-full bg-indigo-500"
              style={{ left: `${Math.min(pct, zero)}%`, width: `${Math.abs(pct - zero)}%` }} />
          )}
          <input
            type="range" min={def.min} max={def.max} step={def.step || 1} value={v} disabled={!active}
            onPointerDown={snapshot}
            onChange={(e) => { patch({ [def.k]: parseFloat(e.target.value) }); setActivePreset(null); }}
            className="fc-range relative w-full"
            aria-label={def.label}
          />
        </div>
      </div>
    );
  };

  const section = ({ title, icon: Icon, items, extra }) => (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {Icon && <Icon size={14} />}{title}
      </div>
      {extra}
      {items.map((d) => slider(d))}
    </div>
  );

  const chip = ({ on, children, ...p }) => (
    <button {...p} className={cx('min-h-[44px] rounded-xl border px-3.5 text-[13px] font-medium transition active:scale-[0.97]',
      on ? 'border-indigo-500 bg-indigo-500/15 text-indigo-700 dark:text-indigo-200'
        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5')}>
      {children}
    </button>
  );

  const panel = (
    <AnimatePresence mode="wait">
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="space-y-3">
        {tab === 'adjust' && (<>
          {section({ title: 'Cahaya', icon: Sun, items: GROUPS.light })}
          {section({ title: 'Warna', icon: Aperture, items: GROUPS.color })}
          {section({ title: 'Detail', icon: Sparkles, items: GROUPS.detail })}
        </>)}

        {tab === 'preset' && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] text-slate-500 dark:text-slate-400">Satu ketukan, lalu sesuaikan di tab Atur.</p>
              <button onClick={saveMine} disabled={!active}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-indigo-600 hover:bg-indigo-500/10 disabled:opacity-40 dark:text-indigo-300">
                <Save size={15} /> Simpan
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {presets.map((p) => (
                <motion.button key={p.id} whileTap={{ scale: 0.97 }} onClick={() => applyPreset(p)} disabled={!active}
                  className={cx('relative min-h-[76px] overflow-hidden rounded-2xl border p-3 text-left transition disabled:opacity-40',
                    activePreset === p.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.03]')}>
                  <div className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">{p.name}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">{p.desc}</div>
                  {activePreset === p.id && <Check size={16} className="absolute right-2.5 top-2.5 text-indigo-500" />}
                  {p.id.startsWith('mine-') && (
                    <span onClick={(e) => { e.stopPropagation(); setMyPresets((m) => m.filter((x) => x.id !== p.id)); }}
                      className="absolute bottom-2 right-2 rounded-md p-1 text-slate-400 hover:text-rose-400"><Trash size={14} /></span>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {tab === 'retouch' && (<>
          {mode === 'properti' ? (<>
            {section({ title: 'Properti', icon: Building, items: GROUPS.property, extra: <p className="mb-1 text-[12px] text-slate-500 dark:text-slate-400">Tegakkan Vertikal memperbaiki dinding yang “miring ke dalam” karena kamera mendongak.</p> })}
            {section({ title: 'Potret', icon: User, items: GROUPS.portrait })}
          </>) : (<>
            {section({ title: 'Potret', icon: User, items: GROUPS.portrait, extra: <p className="mb-1 text-[12px] text-slate-500 dark:text-slate-400">Area kulit dideteksi otomatis; tepi mata, rambut, dan baju tetap tajam.</p> })}
            {section({ title: 'Komposisi', icon: Building, items: GROUPS.property })}
          </>)}
        </>)}

        {tab === 'frame' && (<>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"><Crop size={14} />Rasio</div>
            <div className="flex flex-wrap gap-2">
              {ASPECTS.map((a) => <React.Fragment key={a.id}>{chip({ on: active?.s.aspect === a.id, onClick: () => { snapshot(); patch({ aspect: a.id }); }, disabled: !active, children: a.label })}</React.Fragment>)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"><Stamp size={14} />Watermark</div>
              <button onClick={() => setWm((w) => ({ ...w, enabled: !w.enabled }))} aria-label="Aktifkan watermark"
                className={cx('relative h-7 w-12 rounded-full transition', wm.enabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-white/15')}>
                <motion.span layout className="absolute top-1 h-5 w-5 rounded-full bg-white shadow" style={{ left: wm.enabled ? 24 : 4 }} />
              </button>
            </div>
            <div className={cx('space-y-3 transition', !wm.enabled && 'pointer-events-none opacity-40')}>
              <input value={wm.text} onChange={(e) => setWm((w) => ({ ...w, text: e.target.value }))} placeholder="rumahcari.com"
                className="h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-[14px] outline-none focus:border-indigo-500 dark:border-white/10 dark:text-slate-100" />
              <input value={wm.sub} onChange={(e) => setWm((w) => ({ ...w, sub: e.target.value }))} placeholder="Nama agen · No. WA (opsional)"
                className="h-11 w-full rounded-xl border border-slate-200 bg-transparent px-3 text-[14px] outline-none focus:border-indigo-500 dark:border-white/10 dark:text-slate-100" />
              <div className="grid grid-cols-5 gap-1.5">
                {[['tl', '↖'], ['tr', '↗'], ['c', '●'], ['bl', '↙'], ['br', '↘']].map(([k, l]) => (
                  <React.Fragment key={k}>{chip({ on: wm.pos === k, onClick: () => setWm((w) => ({ ...w, pos: k })), children: l })}</React.Fragment>
                ))}
              </div>
              {[['size', 'Ukuran', 20, 100], ['opacity', 'Transparansi', 20, 100]].map(([k, l, mn, mx]) => (
                <label key={k} className="block text-[13px] text-slate-600 dark:text-slate-300">
                  <div className="mb-1 flex justify-between"><span>{l}</span><span className="font-mono text-slate-400">{wm[k]}</span></div>
                  <input type="range" min={mn} max={mx} value={wm[k]} onChange={(e) => setWm((w) => ({ ...w, [k]: +e.target.value }))} className="fc-range w-full" />
                </label>
              ))}
            </div>
          </div>
        </>)}

        {tab === 'batch' && (<>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((p) => (
              <motion.div key={p.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className={cx('group relative aspect-square overflow-hidden rounded-xl border-2 transition',
                  p.id === activeId ? 'border-indigo-500' : 'border-transparent')}>
                <button onClick={() => setActiveId(p.id)} className="h-full w-full">
                  <img src={p.thumb} alt={p.name} className="h-full w-full object-cover" />
                </button>
                <button onClick={() => removePhoto(p.id)} aria-label="Hapus"
                  className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-lg bg-black/55 text-white opacity-90 backdrop-blur">
                  <X size={14} />
                </button>
              </motion.div>
            ))}
            {Array.from({ length: importing }).map((_, i) => <div key={`sk${i}`} className="fc-skeleton aspect-square rounded-xl" />)}
            <button onClick={() => fileRef.current?.click()}
              className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-400 dark:border-white/15">
              <Plus size={22} />
            </button>
          </div>
          <button onClick={applyToAll} disabled={photos.length < 2}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-[14px] font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-40 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/5">
            <Layers size={16} /> Terapkan pengaturan foto ini ke semua
          </button>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Ukuran ekspor</div>
            <div className="grid grid-cols-3 gap-2">
              {EXPORT_SIZES.map((e) => (
                <button key={e.id} onClick={() => setExportSize(e.id)}
                  className={cx('min-h-[56px] rounded-xl border px-2 text-left transition',
                    exportSize === e.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-200 dark:border-white/10')}>
                  <div className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{e.label}</div>
                  <div className="text-[11px] text-slate-500">{e.hint}</div>
                </button>
              ))}
            </div>
            <label className="mt-3 block text-[13px] text-slate-600 dark:text-slate-300">
              <div className="mb-1 flex justify-between"><span>Kualitas JPEG</span><span className="font-mono text-slate-400">{quality}%</span></div>
              <input type="range" min={60} max={100} value={quality} onChange={(e) => setQuality(+e.target.value)} className="fc-range w-full" />
            </label>
          </div>
          <button onClick={exportAll} disabled={!photos.length || !!progress}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 text-[15px] font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 active:scale-[0.99] disabled:opacity-40">
            <Download size={18} /> Ekspor {photos.length > 1 ? `semua (${photos.length}) · ZIP` : 'foto'}
          </button>
        </>)}
      </motion.div>
    </AnimatePresence>
  );

  // ---------- layout ----------
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased dark:bg-[#07080c] dark:text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-indigo-500/[0.07] via-transparent to-cyan-500/[0.05] dark:from-indigo-500/[0.12] dark:to-cyan-400/[0.06]" />
      <div className="fc-grid pointer-events-none fixed inset-0 opacity-[0.35] dark:opacity-100" />

      {/* status bar */}
      <div className="relative z-10 flex h-7 items-center justify-between border-b border-slate-200/70 px-4 text-[11px] text-slate-500 dark:border-white/5 dark:text-slate-400" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={cx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', online ? 'bg-emerald-400' : 'bg-amber-400')} />
            <span className={cx('relative inline-flex h-2 w-2 rounded-full', online ? 'bg-emerald-400' : 'bg-amber-400')} />
          </span>
          {online ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{online ? 'Online' : 'Offline'} · diproses di perangkat</span>
        </div>
        <div className="flex items-center gap-1.5">
          {rendering && <LoaderCircle size={12} className="animate-spin" />}
          <span>{photos.length} foto</span>
          <button onClick={resetAll} disabled={!active} className="ml-1 rounded px-1.5 py-0.5 disabled:opacity-30 sm:hidden" aria-label="Reset">Reset</button>
          <button onClick={() => setDark((d) => !d)} className="rounded p-1 sm:hidden" aria-label="Tema">{dark ? <Sun size={12} /> : <Moon size={12} />}</button>
        </div>
      </div>

      {/* header */}
      <header className="relative z-10 flex items-center gap-2 border-b border-slate-200/70 px-3 py-2.5 backdrop-blur-xl dark:border-white/10 sm:px-5">
        <div className="flex items-center gap-2.5 pr-1">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 shadow-lg shadow-indigo-500/30">
            <Aperture size={18} className="text-white" />
          </div>
          <div className="hidden leading-tight sm:block">
            <div className="text-[15px] font-semibold tracking-tight">FotoCari</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">editor foto rumahcari</div>
          </div>
        </div>
        <div className="relative ml-1 flex rounded-xl border border-slate-200 bg-white/60 p-1 dark:border-white/10 dark:bg-white/[0.04]">
          {[['properti', 'Properti', Building], ['potret', 'Potret', User]].map(([k, l, I]) => (
            <button key={k} onClick={() => { setMode(k); setActivePreset(null); }}
              className={cx('relative flex h-9 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-[13px] font-medium transition', mode === k ? 'text-white' : 'text-slate-500 dark:text-slate-400')}>
              {mode === k && <motion.span layoutId="modepill" className="absolute inset-0 rounded-lg bg-indigo-500" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
              <I size={15} className="relative" /><span className="relative text-[12px] sm:text-[13px]">{l}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <IconBtn label="Batalkan" onClick={undo} disabled={!active}><Undo2 size={18} /></IconBtn>
          <span className="hidden sm:contents"><IconBtn label="Reset" onClick={resetAll} disabled={!active}><RotateCcw size={18} /></IconBtn></span>
          <IconBtn label="Bandingkan" onClick={() => setCompare((c) => !c)} disabled={!active} on={compare}><Columns2 size={18} /></IconBtn>
          <span className="hidden sm:contents"><IconBtn label="Tema" onClick={() => setDark((d) => !d)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</IconBtn></span>
          <button onClick={exportOne} disabled={!active || !!progress}
            className="ml-1 hidden h-10 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-[13px] font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-400 disabled:opacity-40 sm:flex">
            <Download size={16} /> Ekspor
          </button>
        </div>
      </header>

      <div className="relative z-0 flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* stage */}
        <main className="relative flex min-h-0 flex-1 items-center justify-center p-3 sm:p-6">
          {!active ? (
            importing ? (
              <div className="fc-skeleton aspect-[4/3] w-full max-w-3xl rounded-3xl" />
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
                className="w-full max-w-xl rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center backdrop-blur dark:border-white/15 dark:bg-white/[0.03] sm:p-12">
                <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-400/20 text-indigo-500 dark:text-indigo-300">
                  {mode === 'properti' ? <CloudSun size={30} /> : <User size={30} />}
                </div>
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{mode === 'properti' ? 'Foto listing jadi siap tayang' : 'Retouch potret dalam sekali ketuk'}</h1>
                <p className="mx-auto mt-2 max-w-sm text-[14px] text-slate-500 dark:text-slate-400">
                  Pilih satu atau banyak foto. Semua diproses langsung di HP — tanpa upload, tanpa kuota.
                </p>
                <button onClick={() => fileRef.current?.click()}
                  className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-indigo-500 px-6 text-[15px] font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400 active:scale-[0.98]">
                  <ImagePlus size={18} /> Pilih Foto
                </button>
                <div className="mt-6 flex flex-wrap justify-center gap-2 text-[12px] text-slate-500 dark:text-slate-400">
                  {['Auto enhance', 'HDR jendela', 'Langit biru', 'Haluskan kulit', 'Watermark', 'Batch ZIP'].map((t) => (
                    <span key={t} className="rounded-full border border-slate-200 px-2.5 py-1 dark:border-white/10">{t}</span>
                  ))}
                </div>
              </motion.div>
            )
          ) : (
            <div ref={stageRef} className="relative flex h-full w-full touch-none items-center justify-center"
              onPointerDown={(e) => { if (compare) { e.currentTarget.setPointerCapture(e.pointerId); dragSplit(e); } }}
              onPointerMove={(e) => { if (compare && e.buttons) dragSplit(e); }}>
              <div className="relative max-h-full max-w-full">
                <canvas ref={viewRef} className="block max-h-[calc(56dvh-8rem)] max-w-full rounded-2xl shadow-2xl shadow-black/40 ring-1 ring-black/5 dark:ring-white/10 lg:max-h-[calc(100dvh-9rem)]" />
                {compare && (<>
                  <canvas ref={beforeRef} className="pointer-events-none absolute inset-0 h-full w-full rounded-2xl"
                    style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }} />
                  <div className="pointer-events-none absolute inset-y-0" style={{ left: `${split}%` }}>
                    <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow" />
                    <div className="absolute top-1/2 -ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full bg-white text-slate-900 shadow-xl"><Columns2 size={16} /></div>
                  </div>
                  <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">Sebelum</span>
                  <span className="absolute right-3 top-3 rounded-md bg-indigo-500/90 px-2 py-1 text-[11px] font-medium text-white">Sesudah</span>
                </>)}
              </div>
            </div>
          )}
      {/* mobile FABs */}
          {active && (
            <div className="absolute bottom-3 right-3 z-20 flex gap-2 sm:hidden">
              <motion.button whileTap={{ scale: 0.92 }} onClick={() => fileRef.current?.click()} aria-label="Tambah foto"
                className="grid h-12 w-12 place-items-center rounded-2xl border border-slate-200 bg-white/90 text-slate-700 shadow-lg backdrop-blur dark:border-white/10 dark:bg-white/10 dark:text-white"><ImagePlus size={20} /></motion.button>
              <motion.button whileTap={{ scale: 0.92 }} onClick={exportOne} aria-label="Ekspor"
                className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/40"><Download size={20} /></motion.button>
            </div>
          )}

        </main>

        {/* panel */}
        <aside className="relative z-10 flex max-h-[44dvh] flex-col border-t border-slate-200 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-[#0b0d13]/85 lg:max-h-none lg:w-[400px] lg:border-l lg:border-t-0">
          <nav className="hidden gap-1 border-b border-slate-200 p-2 dark:border-white/10 lg:flex">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cx('relative flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium transition',
                  tab === t.id ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200')}>
                {tab === t.id && <motion.span layoutId="tabpill" className="absolute inset-0 rounded-xl bg-slate-100 dark:bg-white/[0.07]" />}
                <t.icon size={15} className="relative" /><span className="relative">{t.label}</span>
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 pb-24 sm:p-4 lg:pb-6">{panel}</div>
        </aside>
      </div>

      {/* bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#090a0f]/90 lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1">
              {tab === t.id && <motion.span layoutId="navdot" className="absolute top-0 h-0.5 w-8 rounded-full bg-indigo-500" />}
              <t.icon size={20} className={tab === t.id ? 'text-indigo-500 dark:text-indigo-300' : 'text-slate-400'} />
              <span className={cx('text-[11px] font-medium', tab === t.id ? 'text-slate-900 dark:text-white' : 'text-slate-500')}>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />

      {/* progress + toast */}
      <AnimatePresence>
        {progress && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 grid place-items-center bg-black/50 backdrop-blur-sm">
            <div className="w-72 rounded-2xl border border-white/10 bg-[#0f1118] p-5 text-white shadow-2xl">
              <div className="flex items-center gap-2 text-[14px] font-medium"><LoaderCircle size={16} className="animate-spin" /> Memproses {progress.done}/{progress.total}</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400" animate={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
            </div>
          </motion.div>
        )}
        {toast && (
          <motion.div key={toast.id} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            className={cx('fixed left-1/2 top-[7.5rem] z-50 -translate-x-1/2 rounded-xl border px-4 py-2.5 text-[13px] font-medium shadow-xl backdrop-blur-xl',
              toast.kind === 'err' ? 'border-rose-500/30 bg-rose-500/15 text-rose-200' : 'border-white/10 bg-slate-900/90 text-white')}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IconBtn({ children, label, on, ...p }) {
  return (
    <button {...p} aria-label={label} title={label}
      className={cx('grid h-11 w-11 place-items-center rounded-xl transition active:scale-95 disabled:opacity-30',
        on ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white')}>
      {children}
    </button>
  );
}
