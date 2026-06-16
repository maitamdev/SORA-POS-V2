import { useEffect, useState } from 'react';
import { supabaseClient } from '../services/supabase';

export const useBarcodeScanner = () => {
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [pairingCode, setPairingCode] = useState<string>('');

  useEffect(() => {
    // Lấy hoặc sinh mã ghép đôi ngẫu nhiên 6 ký tự
    let code = localStorage.getItem('sora_scanner_pairing_code');
    if (!code) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      localStorage.setItem('sora_scanner_pairing_code', code);
    }
    setPairingCode(code);

    // Kết nối đến kênh Supabase Realtime riêng tư cho mã ghép đôi này
    const channelName = `scanner-events:${code}`;
    const channel = supabaseClient.channel(channelName);

    channel
      .on('broadcast', { event: 'barcode_scanned' }, (payload) => {
        try {
          if (payload.payload?.barcode) {
            setScannedBarcode(payload.payload.barcode);
            
            // Reset mã vạch sau 1 giây để có thể quét lại cùng một mã
            setTimeout(() => {
              setScannedBarcode(null);
            }, 1000);
          }
        } catch (error) {
          console.error('Error parsing barcode data:', error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Barcode scanner connected via Supabase Realtime channel: ${channelName}`);
          setIsConnected(true);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.error('Supabase Realtime scanner connection error/closed');
          setIsConnected(false);
        }
      });

    return () => {
      // Đóng kết nối khi component bị unmount
      supabaseClient.removeChannel(channel);
      setIsConnected(false);
    };
  }, []);

  return { scannedBarcode, isConnected, pairingCode, setScannedBarcode };
};
