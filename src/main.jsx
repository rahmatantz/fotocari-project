import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(<App />);

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor?.isNativePlatform?.() && !import.meta.env.VITE_SINGLE) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
