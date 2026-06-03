import bcrypt from 'bcryptjs';
import { AppError } from '../utils/AppError';
import { supabase } from '../config/supabase';
import { emptyToNull, parsePagination } from '../utils/query';
import { UserRole } from '../types/user.type';

type Query = Record<string, unknown>;
type StaffPayload = {
  password?: string;
  full_name?: string;
  phone?: string | null;
  role?: 'cashier' | 'manager' | 'admin';
  is_active?: boolean;
};

const getRoleName = (roles: unknown): UserRole => {
  if (Array.isArray(roles)) return (roles[0] as { name: string }).name as UserRole;
  return (roles as { name: string }).name as UserRole;
};

const sanitizeUser = (user: any) => ({
  id: user.id,
  email: user.email,
  full_name: user.full_name,
  phone: user.phone,
  avatar_url: user.avatar_url,
  role: getRoleName(user.roles),
  is_active: user.is_active,
  last_login: user.last_login,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

export class StaffService {
  private static async getRoleId(roleName: string) {
    const { data, error } = await supabase
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();

    if (error || !data) throw new AppError(500, `Khong tim thay role ${roleName}`);
    return data.id as string;
  }

  private static async generateLoginCode() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', code)
        .maybeSingle();

      if (!error && !data) return code;
    }

    throw new AppError(500, 'Khong tao duoc ma dang nhap nhan vien');
  }

  private static async ensureUserExists(id: string) {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (error || !data) throw new AppError(404, 'Khong tim thay nhan vien');
  }

  static async list(queryParams: Query) {
    const { page, limit, from, to } = parsePagination(queryParams);

    let query = supabase
      .from('users')
      .select(
        'id, email, full_name, phone, avatar_url, is_active, last_login, created_at, updated_at, roles!inner(name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (typeof queryParams.search === 'string' && queryParams.search.trim()) {
      const pattern = queryParams.search.trim().replace(/[%_]/g, '');
      query = query.or(`email.ilike.%${pattern}%,full_name.ilike.%${pattern}%,phone.ilike.%${pattern}%`);
    }

    if (queryParams.is_active !== undefined) {
      query = query.eq('is_active', queryParams.is_active === 'true');
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(500, error.message);

    return {
      items: (data || []).map(sanitizeUser),
      pagination: { page, limit, total: count || 0 },
    };
  }

  static async create(payload: StaffPayload) {
    const roleId = await this.getRoleId(payload.role || 'cashier');
    const password = payload.password || '';
    const loginCode = await this.generateLoginCode();

    const data = emptyToNull({
      email: loginCode,
      password_hash: await bcrypt.hash(password, 10),
      full_name: payload.full_name?.trim(),
      phone: payload.phone,
      role_id: roleId,
      is_active: payload.is_active ?? true,
    });

    const { data: created, error } = await supabase
      .from('users')
      .insert(data)
      .select('id, email, full_name, phone, avatar_url, is_active, last_login, created_at, updated_at, roles!inner(name)')
      .single();

    if (error) throw new AppError(400, error.message);
    return sanitizeUser(created);
  }

  static async update(id: string, payload: StaffPayload) {
    await this.ensureUserExists(id);

    const updates: Record<string, unknown> = {};
    if (payload.full_name !== undefined) updates.full_name = payload.full_name.trim();
    if (payload.phone !== undefined) updates.phone = payload.phone;
    if (payload.is_active !== undefined) updates.is_active = payload.is_active;
    if (payload.password) updates.password_hash = await bcrypt.hash(payload.password, 10);
    if (payload.role) updates.role_id = await this.getRoleId(payload.role);

    if (Object.keys(updates).length === 0) {
      throw new AppError(400, 'Khong co du lieu de cap nhat');
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update(emptyToNull(updates))
      .eq('id', id)
      .select('id, email, full_name, phone, avatar_url, is_active, last_login, created_at, updated_at, roles!inner(name)')
      .single();

    if (error) throw new AppError(400, error.message);
    return sanitizeUser(updated);
  }

  static async deactivate(id: string) {
    await this.ensureUserExists(id);

    const { error } = await supabase
      .from('users')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw new AppError(400, error.message);
    return null;
  }
}
