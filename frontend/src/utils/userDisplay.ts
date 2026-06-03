import { User, UserRole } from '../types/user.type';

export const getRoleLabel = (role?: UserRole | string) => {
  switch (role) {
    case 'admin':
      return 'Quản trị viên';
    case 'manager':
      return 'Quản lý';
    case 'cashier':
      return 'Thu ngân';
    default:
      return role || 'Người dùng';
  }
};

export const getUserInitials = (user?: Pick<User, 'full_name'> | null) => {
  const name = user?.full_name?.trim();
  if (!name) return 'ND';

  return name
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};
