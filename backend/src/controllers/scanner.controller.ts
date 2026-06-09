import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';

// Mảng lưu trữ các client đang kết nối (POS frontend)
let clients: Response[] = [];

/**
 * Endpoint để Frontend POS (Laptop) kết nối và lắng nghe sự kiện Server-Sent Events (SSE)
 * GET /api/scanner/stream
 */
export const streamScannerEvents = (req: Request, res: Response) => {
  // Bắt buộc headers cho SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Trong production nên config cụ thể

  // Gửi một sự kiện khởi tạo ngay lập tức để giữ kết nối
  res.write('event: connected\n');
  res.write(`data: ${JSON.stringify({ message: 'Connected to scanner stream', timestamp: Date.now() })}\n\n`);

  // Thêm client hiện tại vào mảng
  clients.push(res);

  // Khi client ngắt kết nối
  req.on('close', () => {
    clients = clients.filter((client) => client !== res);
    res.end();
  });
};

/**
 * Endpoint để Điện thoại đẩy mã vạch lên
 * POST /api/scanner/scan
 */
export const receiveScanData = asyncHandler(async (req: Request, res: Response) => {
  const { barcode } = req.body;

  if (!barcode) {
    res.status(400).json({ success: false, message: 'Barcode is required' });
    return;
  }

  // Đẩy mã vạch tới TẤT CẢ các client POS đang kết nối
  const eventData = JSON.stringify({ barcode, timestamp: Date.now() });
  
  clients.forEach((client) => {
    // Format SSE: event: [tên event]\ndata: [dữ liệu string]\n\n
    client.write(`event: barcode_scanned\n`);
    client.write(`data: ${eventData}\n\n`);
  });

  res.status(200).json({ 
    success: true, 
    message: 'Barcode broadcasted successfully',
    clientsNotified: clients.length 
  });
});
