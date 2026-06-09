import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { lazy, Suspense, useEffect } from 'react';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useAuthStore } from './stores/auth.store';
import { syncAllDataToLocal } from './services/offlineSync';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const POSPage = lazy(() => import('./pages/pos/POSPage'));
const ProductsPage = lazy(() => import('./pages/products/ProductsPage'));
const CategoriesPage = lazy(() => import('./pages/categories/CategoriesPage'));
const OrdersPage = lazy(() => import('./pages/orders/OrdersPage'));
const StockPage = lazy(() => import('./pages/stock/StockPage'));
const CustomersPage = lazy(() => import('./pages/customers/CustomersPage'));
const SuppliersPage = lazy(() => import('./pages/suppliers/SuppliersPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const ShiftsPage = lazy(() => import('./pages/shifts/ShiftsPage'));
const MyShiftPage = lazy(() => import('./pages/shifts/MyShiftPage'));
const AIRecommendationsPage = lazy(() => import('./pages/ai/AIRecommendationsPage'));
const AuditLogsPage = lazy(() => import('./pages/audit/AuditLogsPage'));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'));
const StaffPage = lazy(() => import('./pages/staff/StaffPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ScannerPage = lazy(() => import('./pages/ScannerPage'));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 animate-spin" />
  </div>
);

const HomePage = () => {
  const { user } = useAuthStore();

  if (user?.role === 'cashier') {
    return <Navigate to="/my-shift" replace />;
  }

  return <DashboardPage />;
};

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Đồng bộ dữ liệu xuống IndexedDB khi đăng nhập thành công (chuẩn bị cho offline)
  useEffect(() => {
    if (isAuthenticated) {
      syncAllDataToLocal();
    }
  }, [isAuthenticated]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#0f172a',
              color: '#f8fafc',
              borderRadius: '0px',
              border: '1px solid #1e293b',
              fontSize: '14px',
            },
          }}
        />

        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/pos" element={<POSPage />} />
            <Route
              path="/my-shift"
              element={
                <ProtectedRoute requiredRoles={['cashier']}>
                  <MyShiftPage />
                </ProtectedRoute>
              }
            />
            <Route path="/products" element={<ProductsPage />} />
            <Route
              path="/categories"
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <CategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <SuppliersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shifts"
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <ShiftsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ai"
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <AIRecommendationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <AuditLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute requiredRoles={['admin', 'manager']}>
                  <StaffPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
