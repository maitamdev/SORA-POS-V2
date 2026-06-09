import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { MdCameraswitch, MdOutlineQrCodeScanner } from 'react-icons/md';
import api from '../services/api';
import { supabaseClient } from '../services/supabase';
import toast from 'react-hot-toast';

const ScannerPage: React.FC = () => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string>('');

  useEffect(() => {
    // Chỉ khởi tạo khi component mount
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

    // Khởi tạo kênh Supabase Broadcast và subscribe để có thể gửi dữ liệu
    const channel = supabaseClient.channel('scanner-events');
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Scanner Page Ready to Broadcast');
      }
    });

    return () => {
      // Dọn dẹp scanner khi unmount
      if (scannerRef.current && scannerRef.current.getState() === Html5QrcodeScannerState.SCANNING) {
        scannerRef.current.stop().catch(console.error);
      }
      supabaseClient.removeChannel(channel);
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
          // Thành công
          if (isProcessing) return;
          setIsProcessing(true);
          
          // Rung điện thoại báo hiệu
          if (navigator.vibrate) {
            navigator.vibrate(200);
          }

          toast.success(`Quét thành công: ${decodedText}`);

          try {
            // Thay vì gọi API (không ổn định trên Vercel do timeout), ta dùng Supabase Broadcast
            const channel = supabaseClient.channel('scanner-events');
            await channel.send({
              type: 'broadcast',
              event: 'barcode_scanned',
              payload: { barcode: decodedText, timestamp: Date.now() },
            });
            toast.success('Đã gửi mã lên máy tính!');
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
        <div className="flex items-center gap-2 mb-6">
          <MdOutlineQrCodeScanner className="text-3xl text-emerald-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Sora Mobile Scanner
          </h1>
        </div>

        <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border-2 border-gray-700 flex items-center justify-center shadow-inner">
          <div id="reader" className="w-full h-full absolute inset-0 z-0"></div>
          
          {!isScanning && (
            <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center text-gray-400 gap-3">
              <MdOutlineQrCodeScanner className="text-6xl opacity-50" />
              <p>Camera đang tắt</p>
            </div>
          )}
          
          {/* Lớp overlay mô phỏng quét xịn xò (glassmorphism) */}
          {isScanning && (
            <div className="pointer-events-none absolute inset-0 z-10 border-4 border-emerald-500/30 rounded-xl">
              {/* Vạch quét chuyển động */}
              <div className="w-full h-0.5 bg-emerald-400 absolute top-1/2 left-0 shadow-[0_0_10px_2px_rgba(52,211,153,0.8)] animate-scan-line"></div>
            </div>
          )}
        </div>

        <div className="mt-6 w-full space-y-4">
          <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
            <span className="text-sm text-gray-400">Trạng thái:</span>
            <span className={`text-sm font-semibold flex items-center gap-1 ${isScanning ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
              {isScanning ? 'Đang quét...' : 'Đã dừng'}
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
      
      <p className="mt-8 text-xs text-gray-500 text-center max-w-xs">
        * Truy cập trang này bằng HTTPS hoặc cùng chung mạng LAN WiFi để bật camera.
      </p>
    </div>
  );
};

export default ScannerPage;
