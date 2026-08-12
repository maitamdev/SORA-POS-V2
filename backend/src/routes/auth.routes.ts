import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { rateLimitMiddleware } from '../middlewares/rateLimit.middleware';
import { validateMiddleware } from '../middlewares/validate.middleware';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '../validations/auth.validation';

const router = Router();

// POST /api/auth/login - Đăng nhập (public)
router.post(
  '/login',
  rateLimitMiddleware({ keyPrefix: 'auth-login', windowMs: 60_000, max: 20 }),
  validateMiddleware(loginSchema),
  AuthController.login
);

// Password recovery is intentionally rate limited and always returns a generic
// success response so the endpoint cannot be used to enumerate accounts.
router.post(
  '/forgot-password',
  rateLimitMiddleware({ keyPrefix: 'auth-forgot-password', windowMs: 15 * 60_000, max: 5 }),
  validateMiddleware(forgotPasswordSchema),
  AuthController.forgotPassword
);

router.post('/reset-password', validateMiddleware(resetPasswordSchema), AuthController.resetPassword);

// POST /api/auth/logout - Đăng xuất (protected)
router.post('/logout', authMiddleware, AuthController.logout);

router.post(
  '/change-password',
  authMiddleware,
  validateMiddleware(changePasswordSchema),
  AuthController.changePassword
);

// GET /api/auth/me - Lấy thông tin user hiện tại (protected)
router.get('/me', authMiddleware, AuthController.getMe);

export default router;
