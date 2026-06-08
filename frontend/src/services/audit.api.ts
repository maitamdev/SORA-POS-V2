import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

export const auditAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<AuditLog>>>(`/audit-logs${buildQuery(params)}`),
};
