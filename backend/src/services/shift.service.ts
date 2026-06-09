import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { parsePagination, toNumber } from '../utils/query';
import { UserRole } from '../types/user.type';
import {
  calculateShiftCash,
  summarizePayments,
} from '../utils/posCalculations';

type ShiftStatus = 'opened' | 'checked_in' | 'closed' | 'cancelled';

type ShiftInput = {
  employee_id: string;
  shift_date?: string;
  shift_name?: string | null;
};

type CloseShiftInput = {
  closing_cash: number;
  note?: string | null;
};

const getRoleName = (roles: unknown): UserRole => {
  if (Array.isArray(roles)) return (roles[0] as { name: string }).name as UserRole;
  return (roles as { name: string }).name as UserRole;
};

const todayString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const generateShiftCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
};

const mapShift = (shift: any) => ({
  ...shift,
  opening_cash: Number(shift.opening_cash || 0),
  closing_cash: shift.closing_cash === null ? null : Number(shift.closing_cash || 0),
  expected_cash: shift.expected_cash === null ? null : Number(shift.expected_cash || 0),
  cash_difference: shift.cash_difference === null ? null : Number(shift.cash_difference || 0),
});

export class ShiftService {
  private static async attachUsers<T extends { employee_id: string; opened_by: string }>(shifts: T[]) {
    if (shifts.length === 0) return shifts;

    const userIds = Array.from(new Set(shifts.flatMap((shift) => [shift.employee_id, shift.opened_by]).filter(Boolean)));
    const { data: users, error } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', userIds);

    if (error) throw new AppError(500, error.message);
    const userMap = new Map((users || []).map((user) => [user.id, user]));

    return shifts.map((shift) => ({
      ...shift,
      employee: userMap.get(shift.employee_id) || null,
      opener: userMap.get(shift.opened_by) || null,
    }));
  }

  private static async getUserRole(userId: string): Promise<UserRole> {
    const { data, error } = await supabase
      .from('users')
      .select('id, roles!inner(name)')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) throw new AppError(404, 'Không tìm thấy nhân viên');
    return getRoleName(data.roles);
  }

  private static async ensureCashier(employeeId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, roles!inner(name)')
      .eq('id', employeeId)
      .eq('is_active', true)
      .single();

    if (error || !data) throw new AppError(404, 'Không tìm thấy nhân viên');
    if (getRoleName(data.roles) !== 'cashier') {
      throw new AppError(400, 'Chỉ có thể mở ca cho tài khoản thu ngân');
    }

    return data;
  }

  private static async getActiveShift(employeeId: string) {
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('*')
      .eq('employee_id', employeeId)
      .in('status', ['opened', 'checked_in'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new AppError(500, error.message);
    return data ? mapShift(data) : null;
  }

  static async verifyCashierLogin(employeeId: string) {
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('shift_date', todayString())
      .in('status', ['opened', 'checked_in'])
      .maybeSingle();

    if (error) throw new AppError(500, error.message);
    if (!data) throw new AppError(403, 'Quản lý cần mở ca hôm nay trước khi thu ngân đăng nhập');
  }

  static async open(input: ShiftInput, managerId: string) {
    await this.ensureCashier(input.employee_id);

    const activeShift = await this.getActiveShift(input.employee_id);
    if (activeShift) {
      throw new AppError(400, 'Nhân viên này đang có ca chưa chốt');
    }

    let shiftCode = generateShiftCode();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const { data } = await supabase
        .from('shift_sessions')
        .select('id')
        .eq('shift_date', input.shift_date || todayString())
        .eq('shift_code', shiftCode)
        .maybeSingle();
      if (!data) break;
      shiftCode = generateShiftCode();
    }

    const { data, error } = await supabase
      .from('shift_sessions')
      .insert({
        employee_id: input.employee_id,
        opened_by: managerId,
        shift_date: input.shift_date || todayString(),
        shift_name: input.shift_name || null,
        shift_code: shiftCode,
        status: 'opened',
      })
      .select('*')
      .single();

    if (error || !data) throw new AppError(400, error?.message || 'Không mở được ca');
    const [shift] = await this.attachUsers([mapShift(data)]);
    return shift;
  }

  static async list(queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);

    let query = supabase
      .from('shift_sessions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.date) query = query.eq('shift_date', String(queryParams.date));
    if (queryParams.employee_id) query = query.eq('employee_id', String(queryParams.employee_id));
    if (queryParams.status) query = query.eq('status', String(queryParams.status));

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);

    const enriched = await this.attachUsers((data || []).map(mapShift));
    const items = await Promise.all(enriched.map(async (shift) => ({
      ...mapShift(shift),
      summary: await this.summary(shift.id),
    })));

    return { items, pagination: { page, limit, total: count || 0 } };
  }

  static async listForEmployee(employeeId: string, queryParams: Record<string, unknown>) {
    const { page, limit, from, to } = parsePagination(queryParams);

    let query = supabase
      .from('shift_sessions')
      .select('*', { count: 'exact' })
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.date) query = query.eq('shift_date', String(queryParams.date));
    if (queryParams.status) query = query.eq('status', String(queryParams.status));

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);

    const enriched = await this.attachUsers((data || []).map(mapShift));
    const items = await Promise.all(enriched.map(async (shift) => ({
      ...shift,
      summary: await this.summary(shift.id),
      orders: await this.orders(shift.id),
    })));

    return { items, pagination: { page, limit, total: count || 0 } };
  }

  static async getById(id: string) {
    const { data, error } = await supabase
      .from('shift_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) throw new AppError(404, 'Không tìm thấy ca làm');
    const [shift] = await this.attachUsers([mapShift(data)]);
    return { ...shift, summary: await this.summary(id), orders: await this.orders(id) };
  }

  static async activeForUser(userId: string) {
    const shift = await this.getActiveShift(userId);
    if (!shift) return null;
    return { ...shift, summary: await this.summary(shift.id) };
  }

  static async checkIn(userId: string, openingCash: number) {
    const shift = await this.getActiveShift(userId);
    if (!shift) throw new AppError(404, 'Không có ca nào đang mở cho nhân viên này');
    if (shift.status !== 'opened') throw new AppError(400, 'Ca này đã được nhận hoặc đã chốt');

    const { data, error } = await supabase
      .from('shift_sessions')
      .update({
        opening_cash: toNumber(openingCash),
        status: 'checked_in',
        started_at: new Date().toISOString(),
        checked_in_at: new Date().toISOString(),
      })
      .eq('id', shift.id)
      .select('*')
      .single();

    if (error || !data) throw new AppError(400, error?.message || 'Không nhận được ca');
    return { ...mapShift(data), summary: await this.summary(data.id) };
  }

  static async close(userId: string, input: CloseShiftInput) {
    const shift = await this.getActiveShift(userId);
    if (!shift) throw new AppError(404, 'Không có ca đang bán hàng');
    if (shift.status !== 'checked_in') throw new AppError(400, 'Nhân viên cần nhận ca trước khi chốt ca');

    const summary = await this.summary(shift.id);
    const openingCash = Number(shift.opening_cash || 0);
    const closingCash = toNumber(input.closing_cash);
    const cashSummary = calculateShiftCash(openingCash, summary.payments.cash, closingCash);

    const { data, error } = await supabase
      .from('shift_sessions')
      .update({
        status: 'closed',
        closing_cash: closingCash,
        expected_cash: cashSummary.expected_cash,
        cash_difference: cashSummary.cash_difference,
        note: input.note || null,
        closed_at: new Date().toISOString(),
      })
      .eq('id', shift.id)
      .select('*')
      .single();

    if (error || !data) throw new AppError(400, error?.message || 'Không chốt được ca');
    return { ...mapShift(data), summary: await this.summary(data.id), orders: await this.orders(data.id) };
  }

  static async closeByManager(shiftId: string, input: CloseShiftInput, managerId: string) {
    const { data: shift, error: getErr } = await supabase
      .from('shift_sessions')
      .select('*')
      .eq('id', shiftId)
      .single();

    if (getErr || !shift) throw new AppError(404, 'Không tìm thấy ca làm');
    if (shift.status !== 'checked_in') throw new AppError(400, 'Ca này chưa được nhận hoặc đã chốt');

    const summary = await this.summary(shiftId);
    const openingCash = Number(shift.opening_cash || 0);
    const closingCash = toNumber(input.closing_cash);
    const cashSummary = calculateShiftCash(openingCash, summary.payments.cash, closingCash);

    const { data, error } = await supabase
      .from('shift_sessions')
      .update({
        status: 'closed',
        closing_cash: closingCash,
        expected_cash: cashSummary.expected_cash,
        cash_difference: cashSummary.cash_difference,
        note: shift.note || `Được chốt bởi quản lý`,
        manager_note: input.note || null,
        closed_at: new Date().toISOString(),
      })
      .eq('id', shiftId)
      .select('*')
      .single();

    if (error || !data) throw new AppError(400, error?.message || 'Không chốt được ca');
    const [enriched] = await this.attachUsers([mapShift(data)]);
    return { ...enriched, summary: await this.summary(data.id), orders: await this.orders(data.id) };
  }

  static async requireActiveShiftForOrder(userId: string) {
    const role = await this.getUserRole(userId);
    if (role !== 'cashier') return null;

    const shift = await this.getActiveShift(userId);
    if (!shift || shift.status !== 'checked_in') {
      throw new AppError(403, 'Thu ngân cần nhận ca và nhập tiền đầu ca trước khi bán hàng');
    }

    return shift.id as string;
  }

  static async summary(shiftId: string) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, final_amount, total_amount, discount_amount, status, created_at')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: true });

    if (error) throw new AppError(500, error.message);
    const orderItems = orders || [];
    const completed = orderItems.filter((order) => order.status === 'completed');
    const cancelled = orderItems.filter((order) => order.status === 'cancelled');
    const orderIds = orderItems.map((order) => order.id);

    let payments: Array<{ method: string; amount: number }> = [];
    let topProducts: Array<{ product_id: string; product_name: string; quantity: number; revenue: number }> = [];

    if (orderIds.length > 0) {
      const [{ data: paymentRows, error: paymentError }, { data: details, error: detailError }] = await Promise.all([
        supabase.from('payments').select('order_id, method, amount, status').in('order_id', orderIds),
        supabase.from('order_details').select('order_id, product_id, product_name, quantity, subtotal').in('order_id', orderIds),
      ]);

      if (paymentError) throw new AppError(500, paymentError.message);
      if (detailError) throw new AppError(500, detailError.message);

      const completedIds = new Set(completed.map((order) => order.id));
      payments = (paymentRows || [])
        .filter((payment) => completedIds.has(payment.order_id) && payment.status === 'completed')
        .map((payment) => ({ method: payment.method, amount: Number(payment.amount || 0) }));

      const grouped = new Map<string, { product_id: string; product_name: string; quantity: number; revenue: number }>();
      for (const detail of details || []) {
        if (!completedIds.has(detail.order_id)) continue;
        const current = grouped.get(detail.product_id) || {
          product_id: detail.product_id,
          product_name: detail.product_name,
          quantity: 0,
          revenue: 0,
        };
        current.quantity += Number(detail.quantity || 0);
        current.revenue += Number(detail.subtotal || 0);
        grouped.set(detail.product_id, current);
      }
      topProducts = Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    }

    const hourly = new Map<string, { hour: string; revenue: number; orders: number }>();
    for (const order of completed) {
      const date = new Date(order.created_at);
      const hourVal = date.getHours();
      const hour = `${String(hourVal).padStart(2, '0')}:00`;
      const current = hourly.get(hour) || { hour, revenue: 0, orders: 0 };
      current.revenue += Number(order.final_amount || 0);
      current.orders += 1;
      hourly.set(hour, current);
    }

    return {
      revenue: completed.reduce((sum, order) => sum + Number(order.final_amount || 0), 0),
      gross_revenue: completed.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      discount: completed.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0),
      order_count: completed.length,
      cancelled_count: cancelled.length,
      average_order_value: completed.length
        ? completed.reduce((sum, order) => sum + Number(order.final_amount || 0), 0) / completed.length
        : 0,
      payments: summarizePayments(payments),
      hourly: Array.from(hourly.values()),
      top_products: topProducts,
    };
  }

  static async orders(shiftId: string) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, total_amount, discount_amount, final_amount, status, payment_status, created_at, payments(method, amount)')
      .eq('shift_id', shiftId)
      .order('created_at', { ascending: false });

    if (error) throw new AppError(500, error.message);
    return data || [];
  }
}
