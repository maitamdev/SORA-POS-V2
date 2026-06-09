import { Router } from 'express';
import { streamScannerEvents, receiveScanData } from '../controllers/scanner.controller';

const router = Router();

// Route cho POS lắng nghe sự kiện qua SSE (Server-Sent Events)
router.get('/stream', streamScannerEvents);

// Route cho điện thoại POST mã vạch lên
router.post('/scan', receiveScanData);

export default router;
