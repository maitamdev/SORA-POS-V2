import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Đăng ký Service Worker cho PWA (chế độ offline)
import { registerSW } from 'virtual:pwa-register';

registerSW({
  onRegisteredSW(swUrl, registration) {
    console.log('[PWA] Service Worker đã đăng ký:', swUrl);
    // Tự động kiểm tra cập nhật mỗi 1 giờ
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);
    }
  },
  onOfflineReady() {
    console.log('[PWA] Ứng dụng đã sẵn sàng hoạt động ngoại tuyến');
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
