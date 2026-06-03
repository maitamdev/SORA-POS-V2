/**
 * Custom Error class cho ứng dụng
 * Thay thế throw plain object { status, message } trong toàn bộ services
 */
export class AppError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
