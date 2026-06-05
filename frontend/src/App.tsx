import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import POSPage from './pages/pos/POSPage';
import ProductsPage from './pages/products/ProductsPage';
import CategoriesPage from './pages/categories/CategoriesPage';
import OrdersPage from './pages/orders/OrdersPage';
import StockPage from './pages/stock/StockPage';
import CustomersPage from './pages/customers/CustomersPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import ReportsPage from './pages/reports/ReportsPage';
import ShiftsPage from './pages/shifts/ShiftsPage';
import MyShiftPage from './pages/shifts/MyShiftPage';
import AIRecommendationsPage from './pages/ai/AIRecommendationsPage';
import SettingsPage from './pages/settings/SettingsPage';
import StaffPage from './pages/staff/StaffPage';
import NotFoundPage from './pages/NotFoundPage';
import { useAuthStore } from './stores/auth.store';

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

        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
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
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
