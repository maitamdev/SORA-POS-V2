import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { UserRole } from '../types/user.type';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
}

/**
 * ProtectedRoute - Bảo vệ trang khỏi truy cập trái phép
 *
 * - Nếu đang loading (checkAuth) → hiển thị loading spinner
 * - Nếu chưa đăng nhập → redirect về /login
 * - Nếu không đủ quyền → hiển thị trang 403
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRoles }) => {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  // Đang kiểm tra auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">Đang xác thực...</p>
        </div>
      </div>
    );
  }

  // Chưa đăng nhập → redirect về login (giữ lại URL gốc)
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Kiểm tra quyền (nếu có yêu cầu)
  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center animate-fadeIn">
          <div className="text-8xl mb-4">🚫</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">403 - Không có quyền truy cập</h1>
          <p className="text-slate-500 mb-6">
            Bạn không có quyền truy cập trang này.
            <br />
            Vai trò hiện tại: <span className="font-semibold text-primary-600">{user.role}</span>
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
          >
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
