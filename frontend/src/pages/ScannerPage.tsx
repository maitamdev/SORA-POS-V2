import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { MdCameraswitch, MdOutlineQrCodeScanner, MdOutlineCheckCircle } from 'react-icons/md';
import { supabaseClient } from '../services/supabase';
import toast from 'react-hot-toast';

const ScannerPage: React.FC = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const channelRef = useRef<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string>('');
  
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Set up Supabase Realtime connection to 'scanner-events'
  useEffect(() => {
    const channelName = 'scanner-events';
    const channel = supabaseClient.channel(channelName);

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Scanner Page connected to channel: ${channelName}`);
        setIsConnected(true);
      } else {
        console.error(`Scanner Page connection status: ${status}`, err);
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabaseClient.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Khởi tạo camera khi component mount
    Html5Qrcode.getCameras().then(devices => {
      if (devices && devices.length) {
        setCameras(devices);
        // Chọn camera sau (environment) mặc định, nếu có
        let defaultCameraId = devices[0].id;
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('sau'));
        if (backCamera) {
          defaultCameraId = backCamera.id;
        }
        setCurrentCameraId(defaultCameraId);
      }
    }).catch(err => {
      console.error("Lỗi lấy danh sách camera", err);
      toast.error('Không tìm thấy Camera. Vui lòng cấp quyền.');
    });

    return () => {
      // Dọn dẹp scanner khi unmount
      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = async () => {
    if (!currentCameraId) {
      toast.error('Chưa có camera nào được chọn');
      return;
    }

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode("reader");
      }

      await scannerRef.current.start(
        currentCameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0
        },
        async (decodedText, decodedResult) => {
          if (isProcessing) return;
          setIsProcessing(true);
          
          // Rung điện thoại báo hiệu
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }

          toast.success(`Quét thành công: ${decodedText}`);

          try {
            if (channelRef.current && isConnected) {
              await channelRef.current.send({
                type: 'broadcast',
                event: 'barcode_scanned',
                payload: { barcode: decodedText, timestamp: Date.now() },
              });
              toast.success('Đã gửi mã lên máy tính!');
            } else {
              toast.error('Lỗi: Chưa kết nối hoặc mất mạng');
            }
          } catch (error) {
            toast.error('Lỗi khi gửi mã qua Supabase');
            console.error(error);
          }

          // Delay một chút trước khi cho quét mã tiếp theo để tránh gọi API liên tục
          setTimeout(() => {
            setIsProcessing(false);
          }, 1500);
        },
        (errorMessage) => {
          // Bỏ qua các lỗi cảnh báo quét không thấy mã (chạy liên tục theo fps)
        }
      );
      setIsScanning(true);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khởi động máy quét');
    }
  };

  const stopScanning = async () => {
    try {
      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        await scannerRef.current.stop();
        setIsScanning(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCamera = async () => {
    if (cameras.length <= 1) return;
    
    await stopScanning();
    const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setCurrentCameraId(cameras[nextIndex].id);
    
    // Tự động bật lại sau khi đổi
    setTimeout(() => startScanning(), 300);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 font-sans">
      <div className="w-full max-w-md bg-gray-800/80 backdrop-blur-md border border-gray-700 p-6 rounded-2xl shadow-2xl flex flex-col items-center">
        
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <MdOutlineQrCodeScanner className="text-3xl text-emerald-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Sora Mobile Scanner
          </h1>
        </div>

        {/* Connection Status Header */}
        <div className="w-full mb-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/60 border border-slate-700/50 text-xs">
            <MdOutlineCheckCircle className="text-emerald-400 text-base" />
            <span className="text-slate-300">Kết nối POS: </span>
            <span className={`flex items-center gap-1 font-semibold ${isConnected ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
              {isConnected ? 'Sẵn sàng' : 'Chưa kết nối'}
            </span>
          </div>
        </div>

        {/* Camera Scanner Box */}
        <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border-2 border-gray-700 flex items-center justify-center shadow-inner">
          <div id="reader" className="w-full h-full absolute inset-0 z-0"></div>
          
          {!isScanning && (
            <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center text-gray-400 gap-3">
              <MdOutlineQrCodeScanner className="text-6xl opacity-50" />
              <p className="text-sm">Camera đang tắt</p>
            </div>
          )}
          
          {/* Scan line simulation */}
          {isScanning && (
            <div className="pointer-events-none absolute inset-0 z-10 border-4 border-emerald-500/30 rounded-xl">
              <div className="w-full h-0.5 bg-emerald-400 absolute top-1/2 left-0 shadow-[0_0_10px_2px_rgba(52,211,153,0.8)] animate-scan-line"></div>
            </div>
          )}
        </div>

        {/* Camera Helper Text */}
        {isScanning && (
          <p className="mt-3 text-xs text-slate-400 text-center px-4 leading-relaxed">
            📦 Đưa mã vạch hoặc mã QR sản phẩm vào khung để quét tự động gửi lên POS máy tính
          </p>
        )}

        {/* Controls */}
        <div className="mt-6 w-full space-y-4">
          <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
            <span className="text-sm text-gray-400">Trạng thái Camera:</span>
            <span className={`text-sm font-semibold flex items-center gap-1 ${isScanning ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
              {isScanning ? 'Đang mở' : 'Đang tắt'}
            </span>
          </div>

          <div className="flex gap-3">
            {!isScanning ? (
              <button
                onClick={startScanning}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                Bắt đầu quét
              </button>
            ) : (
              <button
                onClick={stopScanning}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95"
              >
                Dừng quét
              </button>
            )}

            {cameras.length > 1 && (
              <button
                onClick={toggleCamera}
                className="bg-gray-700 hover:bg-gray-600 text-white p-3 rounded-xl border border-gray-600 transition-all active:scale-95 flex items-center justify-center"
                title="Đổi Camera"
              >
                <MdCameraswitch className="text-2xl" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-xs text-gray-500 text-center max-w-xs leading-relaxed">
        * Truy cập trang này bằng HTTPS hoặc qua mạng nội bộ LAN WiFi thì thiết bị mới cho phép cấp quyền mở Camera.
      </p>
    </div>
  );
};

export default ScannerPage;
