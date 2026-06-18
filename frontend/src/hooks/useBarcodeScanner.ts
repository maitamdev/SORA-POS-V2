import { useEffect, useState } from 'react';
import { supabaseClient } from '../services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Global registries to share channel connections and state/event callbacks across hooks
const channelScanListeners = new Map<string, Set<(barcode: string) => void>>();
const channelStatusListeners = new Map<string, Set<(isConnected: boolean) => void>>();
const activeChannels = new Map<string, RealtimeChannel>();
const channelConnectionStates = new Map<string, boolean>();
const intentionallyClosingChannels = new Set<string>();

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

    const channelName = `scanner-events:${code}`;

    // Callback nhận mã vạch quét
    const onScan = (barcode: string) => {
      setScannedBarcode(barcode);
      // Reset mã vạch sau 1 giây để có thể quét lại cùng một mã
      setTimeout(() => {
        setScannedBarcode(null);
      }, 1000);
    };

    // Callback nhận cập nhật trạng thái kết nối
    const onStatusChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    // Đăng ký listeners
    if (!channelScanListeners.has(channelName)) {
      channelScanListeners.set(channelName, new Set());
    }
    if (!channelStatusListeners.has(channelName)) {
      channelStatusListeners.set(channelName, new Set());
    }

    channelScanListeners.get(channelName)!.add(onScan);
    channelStatusListeners.get(channelName)!.add(onStatusChange);

    // Thiết lập trạng thái kết nối ban đầu dựa trên trạng thái hiện tại của kênh dùng chung
    const currentStatus = channelConnectionStates.get(channelName) || false;
    setIsConnected(currentStatus);

    let channel = activeChannels.get(channelName);

    if (!channel) {
      // Tạo và subscribe nếu chưa tồn tại kênh dùng chung này
      channel = supabaseClient.channel(channelName);
      activeChannels.set(channelName, channel);
      channelConnectionStates.set(channelName, false);

      channel
        .on('broadcast', { event: 'barcode_scanned' }, (payload) => {
          try {
            const barcode = payload.payload?.barcode;
            if (barcode) {
              const listeners = channelScanListeners.get(channelName);
              if (listeners) {
                listeners.forEach((cb) => cb(barcode));
              }
            }
          } catch (error) {
            console.error('Error parsing barcode data:', error);
          }
        })
        .subscribe((status, err) => {
          const connected = status === 'SUBSCRIBED';
          channelConnectionStates.set(channelName, connected);

          if (status === 'SUBSCRIBED') {
            console.log(`Barcode scanner connected via Supabase Realtime channel: ${channelName}`);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            if (intentionallyClosingChannels.has(channelName)) {
              console.log(`Barcode scanner channel closed intentionally: ${channelName}`);
              intentionallyClosingChannels.delete(channelName);
            } else {
              console.error('Supabase Realtime scanner connection error/closed:', status, err);
            }
          }

          // Cập nhật trạng thái cho tất cả listeners đang kết nối
          const statusListeners = channelStatusListeners.get(channelName);
          if (statusListeners) {
            statusListeners.forEach((cb) => cb(connected));
          }
        });
    }

    return () => {
      // Dọn dẹp listener của hook instance này
      const scanListeners = channelScanListeners.get(channelName);
      const statusListeners = channelStatusListeners.get(channelName);

      if (scanListeners) {
        scanListeners.delete(onScan);
      }
      if (statusListeners) {
        statusListeners.delete(onStatusChange);
      }

      // Nếu không còn hook nào lắng nghe kênh này, ta mới đóng kết nối
      const activeScanCount = scanListeners?.size || 0;
      const activeStatusCount = statusListeners?.size || 0;

      if (activeScanCount === 0 && activeStatusCount === 0) {
        channelScanListeners.delete(channelName);
        channelStatusListeners.delete(channelName);
        channelConnectionStates.delete(channelName);

        const activeChannel = activeChannels.get(channelName);
        if (activeChannel) {
          intentionallyClosingChannels.add(channelName);
          supabaseClient.removeChannel(activeChannel);
          activeChannels.delete(channelName);
        }
      }
    };
  }, []);

  return { scannedBarcode, isConnected, pairingCode, setScannedBarcode };
};
