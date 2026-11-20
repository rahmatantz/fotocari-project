import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// VITE_SINGLE=1 → one self-contained HTML (preview). Default → normal build for Android/PWA.
export default defineConfig({
  base: './',
  plugins: [react(), ...(process.env.VITE_SINGLE ? [viteSingleFile()] : [])],
  build: { outDir: process.env.VITE_SINGLE ? 'dist-single' : 'dist', chunkSizeWarningLimit: 1500 },
});
