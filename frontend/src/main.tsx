import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

const hadServiceWorkerController = Boolean(navigator.serviceWorker?.controller);
let reloadedForServiceWorkerUpdate = false;

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    void updateSW(true);
  },
  onRegisteredSW(swUrl, registration) {
    if (import.meta.env.DEV) console.log('[PWA] Service Worker registered:', swUrl);
    if (registration) {
      void registration.update();
      setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onOfflineReady() {
    if (import.meta.env.DEV) console.log('[PWA] App is ready for offline use');
  },
});

// When an already-open POS tab is claimed by a newer worker, reload once so
// public invoices do not keep rendering a stale cached bundle.
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (!hadServiceWorkerController || reloadedForServiceWorkerUpdate) return;
  reloadedForServiceWorkerUpdate = true;
  window.location.reload();
});

// Lắng nghe sự kiện preload error của Vite khi có bản cập nhật mới (file hash cũ bị xóa khỏi server)
window.addEventListener('vite:preloadError' as any, (event: any) => {
  console.warn('[Vite] Preload error detected. Reloading page...', event);
  const lastReload = localStorage.getItem('last_preload_error_reload');
  const now = Date.now();
  if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
    localStorage.setItem('last_preload_error_reload', now.toString());
    window.location.reload();
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
