import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { supabase, SCANNER_CHANNEL, SCANNER_EVENT } from './src/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SCAN_BOX_SIZE = SCREEN_WIDTH * 0.7;

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [facing, setFacing] = useState<'front' | 'back'>('back');

  const channelRef = useRef<RealtimeChannel | null>(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Scan line animation
  useEffect(() => {
    if (isScanning) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [isScanning]);

  // Pulse animation for status dot
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.5,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  // Setup Supabase channel
  useEffect(() => {
    const channel = supabase.channel(SCANNER_CHANNEL);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        console.log('✅ Connected to Supabase Broadcast');
      } else {
        setIsConnected(false);
      }
    });
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const showFlash = (message: string, type: 'success' | 'error' = 'success') => {
    setFlashMessage(message);
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1500),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setFlashMessage(null));
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const { data: decodedText } = result;

    // Haptic feedback
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setLastScanned(decodedText);
    setScanCount((prev) => prev + 1);

    try {
      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: SCANNER_EVENT,
          payload: { barcode: decodedText, timestamp: Date.now() },
        });
        showFlash('✅ Đã gửi lên máy tính!', 'success');
      } else {
        showFlash('❌ Chưa kết nối', 'error');
      }
    } catch (error) {
      showFlash('❌ Lỗi gửi dữ liệu', 'error');
      console.error(error);
    }

    // Cooldown to prevent duplicate scans
    setTimeout(() => {
      setIsProcessing(false);
    }, 1500);
  };

  const toggleCamera = () => {
    setFacing((prev) => (prev === 'back' ? 'front' : 'back'));
  };

  // Permission screen
  if (!permission) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <Text style={styles.permissionText}>Đang tải...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>Cần quyền Camera</Text>
          <Text style={styles.permissionDesc}>
            Sora Scanner cần truy cập Camera để quét mã vạch sản phẩm.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Cấp quyền Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" translucent />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.logoText}>⚡</Text>
          <View>
            <Text style={styles.headerTitle}>Sora Scanner</Text>
            <Text style={styles.headerSubtitle}>Quét mã nhanh • Gửi lên POS</Text>
          </View>
        </View>
        <View style={styles.connectionBadge}>
          <Animated.View
            style={[
              styles.connectionDot,
              {
                backgroundColor: isConnected ? '#34d399' : '#f87171',
                transform: [{ scale: isConnected ? pulseAnim : 1 }],
              },
            ]}
          />
          <Text style={[styles.connectionText, { color: isConnected ? '#34d399' : '#f87171' }]}>
            {isConnected ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        {isScanning ? (
          <CameraView
            style={styles.camera}
            facing={facing}
            barcodeScannerSettings={{
              barcodeTypes: [
                'qr',
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'code128',
                'code39',
                'code93',
                'itf14',
                'codabar',
                'datamatrix',
                'pdf417',
              ],
            }}
            onBarcodeScanned={isProcessing ? undefined : handleBarCodeScanned}
          >
            {/* Overlay darkened corners */}
            <View style={styles.overlay}>
              {/* Top */}
              <View style={styles.overlayTop} />
              {/* Middle row */}
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                {/* Scan box with corners */}
                <View style={styles.scanBox}>
                  {/* Corner decorations */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />

                  {/* Scan line */}
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        transform: [
                          {
                            translateY: scanLineAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, SCAN_BOX_SIZE - 4],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
                <View style={styles.overlaySide} />
              </View>
              {/* Bottom */}
              <View style={styles.overlayBottom}>
                <Text style={styles.scanHint}>
                  {isProcessing ? '⏳ Đang xử lý...' : '📦 Đưa mã vạch / QR vào khung'}
                </Text>
              </View>
            </View>
          </CameraView>
        ) : (
          <View style={styles.cameraOff}>
            <Text style={styles.cameraOffIcon}>📷</Text>
            <Text style={styles.cameraOffText}>Camera đang tắt</Text>
            <Text style={styles.cameraOffHint}>Nhấn "Bắt đầu quét" để mở camera</Text>
          </View>
        )}
      </View>

      {/* Flash notification */}
      {flashMessage && (
        <Animated.View style={[styles.flashContainer, { opacity: flashAnim }]}>
          <Text style={styles.flashText}>{flashMessage}</Text>
        </Animated.View>
      )}

      {/* Info panel */}
      <View style={styles.infoPanel}>
        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{scanCount}</Text>
            <Text style={styles.statLabel}>Đã quét</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={[styles.statItem, { flex: 2 }]}>
            <Text style={styles.lastScannedText} numberOfLines={1} ellipsizeMode="middle">
              {lastScanned || '—'}
            </Text>
            <Text style={styles.statLabel}>Mã gần nhất</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          {isScanning ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.stopButton]}
              onPress={() => setIsScanning(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonIcon}>⏹</Text>
              <Text style={styles.buttonText}>Dừng quét</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={() => setIsScanning(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonIcon}>▶️</Text>
              <Text style={styles.buttonText}>Bắt đầu quét</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.switchButton]}
            onPress={toggleCamera}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonIcon}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },

  // Permission screen
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  permissionDesc: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  permissionText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  permissionButton: {
    backgroundColor: '#34d399',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  permissionButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 12 : 12,
    paddingBottom: 12,
    backgroundColor: '#0f172a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoText: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Camera
  cameraContainer: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#1e293b',
  },
  camera: {
    flex: 1,
  },
  cameraOff: {
    flex: 1,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  cameraOffIcon: {
    fontSize: 48,
    opacity: 0.5,
  },
  cameraOffText: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraOffHint: {
    color: '#475569',
    fontSize: 13,
  },

  // Overlay
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 20,
  },
  scanHint: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },

  // Scan box
  scanBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#34d399',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: '#34d399',
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 5,
  },

  // Flash notification
  flashContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) + 70 : 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    zIndex: 100,
  },
  flashText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Info panel
  infoPanel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'android' ? 16 : 8,
    backgroundColor: '#0f172a',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#34d399',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#334155',
    marginHorizontal: 12,
  },
  lastScannedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
    textAlign: 'center',
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  startButton: {
    flex: 1,
    backgroundColor: '#34d399',
    shadowColor: '#34d399',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  switchButton: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buttonIcon: {
    fontSize: 18,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
