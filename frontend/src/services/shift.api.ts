import api from './api';
import { ApiResponse } from '../types/user.type';
import { ListResponse, ShiftSession } from '../types/domain.type';
import { buildQuery } from './catalog.api';

export interface OpenShiftPayload {
  employee_id: string;
  shift_date?: string;
  shift_name?: string | null;
}

export const shiftAPI = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<ShiftSession>>>(`/shifts${buildQuery(params)}`),
  my: (params?: Record<string, unknown>) =>
    api.get<ApiResponse<ListResponse<ShiftSession>>>(`/shifts/my${buildQuery(params)}`),
  get: (id: string) => api.get<ApiResponse<ShiftSession>>(`/shifts/${id}`),
  open: (data: OpenShiftPayload) => api.post<ApiResponse<ShiftSession>>('/shifts', data),
  active: () => api.get<ApiResponse<ShiftSession | null>>('/shifts/active'),
  checkIn: (opening_cash: number) =>
    api.post<ApiResponse<ShiftSession>>('/shifts/active/check-in', { opening_cash }),
  close: (data: { closing_cash: number; note?: string | null }) =>
    api.post<ApiResponse<ShiftSession>>('/shifts/active/close', data),
  closeByManager: (id: string, data: { closing_cash: number; note?: string | null }) =>
    api.post<ApiResponse<ShiftSession>>(`/shifts/${id}/close`, data),
};
