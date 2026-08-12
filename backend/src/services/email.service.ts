import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';

export class EmailService {
  private static transporter = nodemailer.createTransport({
    host: env.smtpHost || '',
    port: env.smtpPort || 587,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser || '',
      pass: env.smtpPass || '',
    },
  });

  static isConfigured(): boolean {
    return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
  }

  /**
   * Gửi email hóa đơn bán hàng tới khách hàng
   * @param email Địa chỉ nhận email
   * @param order Đối tượng hóa đơn đầy đủ thông tin (kèm order_details, payments, customers, users)
   */
  static async sendInvoice(email: string, order: any): Promise<boolean> {
    const html = this.generateInvoiceHtml(order);

    const mailOptions = {
      from: env.smtpFrom || 'Sora POS <noreply@sorapos.com>',
      to: email.trim(),
      subject: `[Sora POS] Cảm ơn bạn đã mua hàng #${order.order_number}`,
      html: html,
    };

    if (!this.isConfigured()) {
      console.warn('⚠️ SMTP config missing. Fallback log email to console in development:');
      console.log('----------------------------------------');
      console.log(`To: ${email}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Body (HTML length: ${html.length} chars)`);
      console.log('----------------------------------------');
      return true;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] Gửi email hóa đơn thành công tới ${email}`);
      return true;
    } catch (error: any) {
      console.error('[EmailService] Lỗi khi gửi email hóa đơn:', error);
      throw new AppError(400, error.message || 'Lỗi gửi email qua máy chủ SMTP');
    }
  }

  static async sendPasswordReset(email: string, fullName: string | null | undefined, resetUrl: string): Promise<boolean> {
    const safeName = this.escapeHtml(fullName || 'bạn');
    const safeUrl = this.escapeHtml(resetUrl);
    const html = `
      <!DOCTYPE html>
      <html lang="vi">
        <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;padding:24px">
          <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:28px">
            <p style="margin:0;color:#2563eb;font-weight:700;letter-spacing:.08em;font-size:12px">SORA POS</p>
            <h1 style="font-size:22px;margin:12px 0 8px">Khôi phục mật khẩu</h1>
            <p style="color:#475569;line-height:1.6">Xin chào ${safeName}, chúng tôi nhận được yêu cầu đặt lại mật khẩu tài khoản SORA POS của bạn.</p>
            <p style="color:#475569;line-height:1.6">Liên kết chỉ có hiệu lực trong 15 phút và chỉ sử dụng được một lần.</p>
            <p style="margin:24px 0"><a href="${safeUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:9px;font-weight:700">Đặt lại mật khẩu</a></p>
            <p style="color:#64748b;font-size:12px;line-height:1.5">Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email. Không chia sẻ liên kết khôi phục cho người khác.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendConfiguredEmail(
      { from: env.smtpFrom || 'Sora POS <noreply@sorapos.com>', to: email.trim(), subject: '[Sora POS] Khôi phục mật khẩu', html },
      'email khôi phục mật khẩu'
    );
  }

  static async sendShiftNotification(
    email: string,
    employeeName: string | null | undefined,
    shift: { shift_date?: string; shift_name?: string | null; shift_code?: string | null }
  ): Promise<boolean> {
    const safeName = this.escapeHtml(employeeName || 'nhân viên');
    const shiftName = this.escapeHtml(shift.shift_name || 'Ca bán hàng');
    const shiftDate = this.escapeHtml(
      shift.shift_date
        ? new Date(`${shift.shift_date}T00:00:00`).toLocaleDateString('vi-VN')
        : 'Chưa xác định'
    );
    const shiftCode = this.escapeHtml(shift.shift_code || '—');
    const html = `
      <!DOCTYPE html>
      <html lang="vi">
        <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;padding:24px">
          <div style="max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
            <div style="background:#0f172a;color:#fff;padding:24px 28px">
              <p style="margin:0;color:#93c5fd;font-weight:700;letter-spacing:.08em;font-size:12px">SORA POS</p>
              <h1 style="font-size:22px;margin:10px 0 0">Bạn đã được tạo ca làm</h1>
            </div>
            <div style="padding:28px">
              <p style="color:#475569;line-height:1.6">Xin chào ${safeName}, quản lý đã tạo ca làm cho tài khoản của bạn.</p>
              <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
                <tr><td style="padding:9px 0;color:#64748b">Ca làm</td><td style="padding:9px 0;text-align:right;font-weight:700">${shiftName}</td></tr>
                <tr><td style="padding:9px 0;color:#64748b">Ngày</td><td style="padding:9px 0;text-align:right;font-weight:700">${shiftDate}</td></tr>
                <tr><td style="padding:9px 0;color:#64748b">Mã ca</td><td style="padding:9px 0;text-align:right;font-weight:700;font-family:monospace">${shiftCode}</td></tr>
              </table>
              <p style="color:#475569;line-height:1.6">Vui lòng đăng nhập SORA POS, nhận ca và nhập tiền đầu ca trước khi bán hàng.</p>
            </div>
            <div style="background:#f1f5f9;padding:18px 28px;color:#64748b;font-size:12px">Email tự động từ hệ thống SORA POS.</div>
          </div>
        </body>
      </html>
    `;

    return this.sendConfiguredEmailStrict(
      {
        from: env.smtpFrom || 'Sora POS <noreply@sorapos.com>',
        to: email.trim(),
        subject: `[Sora POS] Bạn được tạo ${shift.shift_name || 'ca bán hàng'} ngày ${shift.shift_date || ''}`,
        html,
      },
      'email thông báo ca làm'
    );
  }

  private static async sendConfiguredEmailStrict(
    mailOptions: { from: string; to: string; subject: string; html: string },
    label: string
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new AppError(503, 'Máy chủ chưa cấu hình SMTP để gửi email');
    }
    return this.sendConfiguredEmail(mailOptions, label);
  }

  private static async sendConfiguredEmail(
    mailOptions: { from: string; to: string; subject: string; html: string },
    label: string
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      console.warn(`⚠️ SMTP config missing. Fallback log ${label} to console in development:`);
      console.log('----------------------------------------');
      console.log(`To: ${mailOptions.to}`);
      console.log(`Subject: ${mailOptions.subject}`);
      console.log(`Body (HTML length: ${mailOptions.html.length} chars)`);
      console.log('----------------------------------------');
      return true;
    }

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`[EmailService] Gửi ${label} thành công tới ${mailOptions.to}`);
      return true;
    } catch (error: any) {
      console.error(`[EmailService] Lỗi khi gửi ${label}:`, error);
      throw new AppError(400, error.message || `Lỗi gửi ${label} qua máy chủ SMTP`);
    }
  }

  private static escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }[character] || character));
  }

  /**
   * Tạo mẫu HTML hóa đơn thanh toán
   */
  private static generateInvoiceHtml(order: any): string {
    const storeName = 'SORA MART';
    const cashierName = order.users?.full_name || 'Nhân viên thu ngân';
    const customerName = order.customers?.name || 'Khách lẻ';
    const customerPhone = order.customers?.phone || '';
    const dateFormatted = new Date(order.created_at).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    const formatVND = (value: number) => {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
    };

    // Chi tiết sản phẩm
    const itemsHtml = (order.order_details || [])
      .map((item: any, idx: number) => {
        const itemTotal = Number(item.unit_price) * item.quantity;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
            <td style="padding: 10px 0; color: #1e293b; font-weight: 500;">
              ${item.product_name}
            </td>
            <td style="padding: 10px 0; text-align: center; color: #475569;">
              ${item.quantity}
            </td>
            <td style="padding: 10px 0; text-align: right; color: #475569;">
              ${formatVND(Number(item.unit_price))}
            </td>
            <td style="padding: 10px 0; text-align: right; color: #0f172a; font-weight: 600;">
              ${formatVND(itemTotal)}
            </td>
          </tr>
        `;
      })
      .join('');

    // Thông tin thanh toán
    const mainPayment = order.payments?.[0];
    const paymentMethodText =
      mainPayment?.method === 'cash'
        ? 'Tiền mặt'
        : mainPayment?.method === 'transfer'
        ? 'Chuyển khoản QR'
        : mainPayment?.method === 'card'
        ? 'Thẻ ngân hàng'
        : 'Ví điện tử';

    const receivedAmount = mainPayment?.received_amount || order.final_amount;
    const changeAmount = mainPayment?.change_amount || 0;

    // Chi tiết điểm thưởng nếu có sử dụng/tích lũy
    let loyaltyHtml = '';
    if (order.loyalty_points_earned > 0 || order.loyalty_points_used > 0) {
      loyaltyHtml = `
        <div style="margin-top: 15px; padding: 12px; background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px;">
          <h4 style="margin: 0 0 8px 0; color: #15803d; font-size: 13px; font-weight: bold;">TÍCH ĐIỂM SORA MEMBER</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            ${
              order.loyalty_points_used > 0
                ? `<tr>
                    <td style="color: #64748b; padding: 2px 0;">Điểm đã sử dụng:</td>
                    <td style="text-align: right; color: #ef4444; font-weight: bold;">-${order.loyalty_points_used} điểm</td>
                  </tr>`
                : ''
            }
            <tr>
              <td style="color: #64748b; padding: 2px 0;">Điểm tích lũy mới:</td>
              <td style="text-align: right; color: #16a34a; font-weight: bold;">+${order.loyalty_points_earned} điểm</td>
            </tr>
          </table>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Hóa đơn Sora POS</title>
        <style>
          body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f8fafc;
            margin: 0;
            padding: 0;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
          }
          .header {
            background-color: #0f172a;
            color: #ffffff;
            padding: 30px 24px;
            text-align: center;
          }
          .content {
            padding: 24px;
          }
          .footer {
            background-color: #f1f5f9;
            padding: 20px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
            border-top: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <!-- Header -->
          <div class="header">
            <h1 style="margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">${storeName}</h1>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #94a3b8; font-weight: 500;">HÓA ĐƠN THANH TOÁN ĐIỆN TỬ</p>
            <p style="margin: 15px 0 0 0; font-size: 14px; font-weight: bold; color: #38bdf8;">Mã số: ${order.order_number}</p>
          </div>

          <!-- Content -->
          <div class="content">
            <!-- Thông tin chung -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Khách hàng:</td>
                <td style="padding: 4px 0; text-align: right; color: #1f2937; font-weight: bold;">
                  ${customerName} ${customerPhone ? `(${customerPhone})` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Thu ngân:</td>
                <td style="padding: 4px 0; text-align: right; color: #1f2937;">${cashierName}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Ngày giờ thanh toán:</td>
                <td style="padding: 4px 0; text-align: right; color: #1f2937;">${dateFormatted}</td>
              </tr>
            </table>

            <!-- Bảng sản phẩm -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border-bottom: 2px solid #cbd5e1;">
              <thead>
                <tr style="border-bottom: 2px solid #cbd5e1; font-size: 11px; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">
                  <th style="padding: 8px 0; text-align: left; font-weight: bold;">Sản phẩm</th>
                  <th style="padding: 8px 0; text-align: center; font-weight: bold; width: 50px;">SL</th>
                  <th style="padding: 8px 0; text-align: right; font-weight: bold; width: 100px;">Đơn giá</th>
                  <th style="padding: 8px 0; text-align: right; font-weight: bold; width: 100px;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <!-- Tổng cộng tiền -->
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 13px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Tạm tính:</td>
                <td style="padding: 6px 0; text-align: right; color: #1e293b; font-weight: 500;">
                  ${formatVND(Number(order.total_amount))}
                </td>
              </tr>
              ${
                Number(order.discount_amount) > 0
                  ? `<tr>
                      <td style="padding: 6px 0; color: #64748b;">Chiết khấu:</td>
                      <td style="padding: 6px 0; text-align: right; color: #ef4444; font-weight: 500;">
                        -${formatVND(Number(order.discount_amount))}
                      </td>
                    </tr>`
                  : ''
              }
              <tr style="font-size: 16px; font-weight: bold; border-top: 1px solid #cbd5e1;">
                <td style="padding: 12px 0 6px 0; color: #0f172a;">TỔNG CỘNG:</td>
                <td style="padding: 12px 0 6px 0; text-align: right; color: #059669;">
                  ${formatVND(Number(order.final_amount))}
                </td>
              </tr>
            </table>

            <!-- Chi tiết thanh toán -->
            <div style="margin-top: 20px; border-top: 1px dashed #cbd5e1; padding-top: 15px; font-size: 13px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Hình thức thanh toán:</td>
                  <td style="text-align: right; color: #1e293b; font-weight: 500;">${paymentMethodText}</td>
                </tr>
                ${
                  mainPayment?.method === 'cash'
                    ? `
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Khách đưa:</td>
                    <td style="text-align: right; color: #1e293b;">${formatVND(Number(receivedAmount))}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Tiền thừa:</td>
                    <td style="text-align: right; color: #059669; font-weight: 500;">${formatVND(Number(changeAmount))}</td>
                  </tr>
                `
                    : ''
                }
                ${
                  mainPayment?.reference_code
                    ? `
                  <tr>
                    <td style="color: #64748b; padding: 4px 0;">Mã giao dịch:</td>
                    <td style="text-align: right; color: #475569; font-family: monospace; font-size: 12px;">
                      ${mainPayment.reference_code}
                    </td>
                  </tr>
                `
                    : ''
                }
              </table>
            </div>

            <!-- Tích điểm -->
            ${loyaltyHtml}
          </div>

          <!-- Footer -->
          <div class="footer">
            <p style="margin: 0; font-weight: bold; font-size: 12px; color: #475569;">Cảm ơn quý khách đã mua sắm tại ${storeName}!</p>
            <p style="margin: 5px 0 0 0;">Mọi thắc mắc vui lòng liên hệ bộ phận hỗ trợ khách hàng để được giải đáp.</p>
            <p style="margin: 15px 0 0 0; font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8;">
              Powered by Sora POS System
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
