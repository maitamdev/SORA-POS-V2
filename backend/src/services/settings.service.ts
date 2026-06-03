import { supabase } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { OperationSettings, operationSettingsSchema } from '../validations/settings.validation';

const OPERATION_SETTINGS_KEY = 'operation';

export const defaultOperationSettings: OperationSettings = operationSettingsSchema.parse({
  storeName: 'SORA MART',
  branchName: '',
  taxCode: '',
  address: '',
  hotline: '',
  businessHours: '08:00 - 22:00',
  currency: 'VND',
  locale: 'vi-VN',
  defaultPaymentMethod: 'cash',
  allowDiscount: true,
  maxDiscountPercent: 20,
  requireCustomerPhone: false,
  autoPrintReceipt: true,
  receiptPaperSize: 'k80',
  receiptCopies: 1,
  receiptFooter: 'Cảm ơn quý khách đã mua sắm!',
  lowStockWarning: true,
  defaultMinStockLevel: 10,
  allowSellOutOfStock: false,
  barcodeAutoAdd: true,
  productPageSize: 20,
  confirmBeforeCheckout: false,
  sessionLockMinutes: 30,
  compactMode: false,
});

const normalizeSettings = (value: unknown): OperationSettings => {
  return operationSettingsSchema.parse({
    ...defaultOperationSettings,
    ...(typeof value === 'object' && value ? value : {}),
  });
};

const handleMissingTable = (message: string) => {
  if (message.includes('app_settings') || message.includes('Could not find the table')) {
    throw new AppError(
      500,
      'Chưa có bảng app_settings. Vui lòng chạy SQL trong docs/app_settings.sql trên Supabase.'
    );
  }
};

export class SettingsService {
  static async getOperationSettings() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value, updated_at, updated_by')
      .eq('key', OPERATION_SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      handleMissingTable(error.message);
      throw new AppError(500, error.message);
    }

    return {
      settings: normalizeSettings(data?.value),
      updated_at: data?.updated_at || null,
      updated_by: data?.updated_by || null,
    };
  }

  static async updateOperationSettings(settings: OperationSettings, userId: string) {
    const normalized = normalizeSettings(settings);
    const payload = {
      key: OPERATION_SETTINGS_KEY,
      value: normalized,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('app_settings')
      .upsert(payload, { onConflict: 'key' })
      .select('value, updated_at, updated_by')
      .single();

    if (error) {
      handleMissingTable(error.message);
      throw new AppError(500, error.message);
    }

    return {
      settings: normalizeSettings(data.value),
      updated_at: data.updated_at,
      updated_by: data.updated_by,
    };
  }

  static getDefaults() {
    return defaultOperationSettings;
  }
}
