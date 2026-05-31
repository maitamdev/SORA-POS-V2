import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import { loginSchema } from '../validations/auth.validation';

const router = Router();

// POST /api/auth/login - Đăng nhập (public)
router.post('/login', validateMiddleware(loginSchema), AuthController.login);

// POST /api/auth/logout - Đăng xuất (protected)
router.post('/logout', authMiddleware, AuthController.logout);

// GET /api/auth/me - Lấy thông tin user hiện tại (protected)
router.get('/me', authMiddleware, AuthController.getMe);

export default router;
