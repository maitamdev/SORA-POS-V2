import { useEffect, useState } from 'react';
import { supabaseClient } from '../services/supabase';

export const useBarcodeScanner = () => {
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    // Kết nối đến kênh Supabase Realtime 'scanner-events'
    // Đây là giải pháp hoàn hảo cho Vercel vì không bị giới hạn timeout như SSE
    const channel = supabaseClient.channel('scanner-events');

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
          console.log('Barcode scanner connected via Supabase Realtime');
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

  return { scannedBarcode, isConnected, setScannedBarcode };
};
