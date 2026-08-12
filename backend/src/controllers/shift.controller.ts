import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/response';
import { AppError } from '../utils/AppError';
import { ShiftService } from '../services/shift.service';
import { EmailService } from '../services/email.service';

export class ShiftController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await ShiftService.list(req.query), 'Lấy danh sách ca làm thành công');
  });

  static get = asyncHandler(async (req: Request, res: Response) => {
    successResponse(res, await ShiftService.getById(req.params.id), 'Lấy chi tiết ca làm thành công');
  });

  static open = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    const shift = await ShiftService.open(req.body, req.user.userId);
    let emailNotification: 'sent' | 'skipped' | 'failed' = 'skipped';
    const configuredEmail = shift.employee?.notification_email || shift.employee?.email;
    const employeeEmail = typeof configuredEmail === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(configuredEmail)
      ? configuredEmail
      : '';

    if (employeeEmail) {
      try {
        await EmailService.sendShiftNotification(
          employeeEmail,
          shift.employee.full_name,
          shift
        );
        emailNotification = 'sent';
      } catch (error) {
        // Creating a shift must not fail just because SMTP is unavailable.
        emailNotification = 'failed';
        console.error('[ShiftController.open] Không thể gửi email thông báo ca:', error);
      }
    }

    successResponse(
      res,
      { ...shift, email_notification: emailNotification },
      emailNotification === 'sent'
        ? 'Mở ca làm thành công và đã gửi email cho nhân viên'
        : 'Mở ca làm thành công',
      201
    );
  });

  static active = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.activeForUser(req.user.userId), 'Lấy ca đang mở thành công');
  });

  static myShifts = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.listForEmployee(req.user.userId, req.query), 'Lấy ca làm của tôi thành công');
  });

  static checkIn = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.checkIn(req.user.userId, req.body.opening_cash), 'Nhận ca thành công');
  });

  static close = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.close(req.user.userId, req.body), 'Chốt ca thành công');
  });

  static closeByManager = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.closeByManager(req.params.id, req.body, req.user.userId), 'Quản lý chốt ca thành công');
  });

  static cancel = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(res, await ShiftService.cancelByManager(req.params.id, req.user.userId, req.body.reason), 'Hủy ca thành công');
  });

  static logCashDrawerTxActive = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(
      res,
      await ShiftService.logCashDrawerTxActive(req.body, req.user.userId),
      'Ghi nhận giao dịch két tiền thành công',
      201
    );
  });

  static logCashDrawerTx = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw new AppError(401, 'Chưa xác thực');
    successResponse(
      res,
      await ShiftService.logCashDrawerTx(req.params.id, req.body, req.user.userId),
      'Ghi nhận giao dịch két tiền thành công',
      201
    );
  });
}
