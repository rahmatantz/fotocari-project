import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();

const blobToBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = rej;
  r.readAsDataURL(blob);
});

// Save/share a file. On Android: write to app cache then open the share sheet
// (Simpan ke Galeri / Drive / WhatsApp). On web: regular download.
export async function saveFile(blob, name) {
  if (isNative()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const data = await blobToBase64(blob);
    const res = await Filesystem.writeFile({ path: `fotocari/${name}`, data, directory: Directory.Cache, recursive: true });
    try {
      await Filesystem.writeFile({ path: `FotoCari/${name}`, data, directory: Directory.Documents, recursive: true });
    } catch { /* Documents may be unavailable on some Android versions; share sheet still works */ }
    await Share.share({ title: name, files: [res.uri], dialogTitle: 'Simpan / kirim foto' });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
};
