import { supabase } from '../config/supabase';
import { AppError } from '../utils/AppError';
import { parsePagination } from '../utils/query';

type Query = Record<string, unknown>;

export class AuditService {
  static async list(queryParams: Query) {
    const { page, limit, from, to } = parsePagination(queryParams);
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (queryParams.action) query = query.eq('action', String(queryParams.action));
    if (queryParams.entity_type) query = query.eq('entity_type', String(queryParams.entity_type));
    if (queryParams.entity_id) query = query.eq('entity_id', String(queryParams.entity_id));
    if (queryParams.date_from) query = query.gte('created_at', String(queryParams.date_from));
    if (queryParams.date_to) query = query.lte('created_at', `${queryParams.date_to}T23:59:59.999Z`);

    const { data, error, count } = await query;
    if (error) {
      if (error.message.includes('audit_logs')) {
        throw new AppError(500, 'Chua chay migration database/enterprise_pos_core.sql tren Supabase');
      }
      throw new AppError(500, error.message);
    }

    const items = data || [];
    const actorIds = Array.from(new Set(items.map((item) => item.actor_id).filter(Boolean)));
    const actorMap = new Map<string, { id: string; full_name: string; email: string }>();

    if (actorIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', actorIds);

      if (userError) throw new AppError(500, userError.message);
      for (const user of users || []) actorMap.set(user.id, user);
    }

    return {
      items: items.map((item) => ({
        ...item,
        actor: item.actor_id ? actorMap.get(item.actor_id) || null : null,
      })),
      pagination: { page, limit, total: count || 0 },
    };
  }
}
