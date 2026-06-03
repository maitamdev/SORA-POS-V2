import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, StaffUser } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export interface StaffPayload {
  password?: string;
  full_name?: string;
  phone?: string | null;
  role?: 'cashier' | 'manager' | 'admin';
  is_active?: boolean;
}

export const staffAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<StaffUser>>>(`/staff${buildQuery(params)}`),
  create: (data: StaffPayload) => api.post<ApiResponse<StaffUser>>('/staff', data),
  update: (id: string, data: StaffPayload) => api.put<ApiResponse<StaffUser>>(`/staff/${id}`, data),
  deactivate: (id: string) => api.delete<ApiResponse<null>>(`/staff/${id}`),
};
