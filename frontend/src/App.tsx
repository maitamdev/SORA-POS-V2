import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';

// Layout
import MainLayout from './components/layout/MainLayout';

// Routes
import ProtectedRoute from './routes/ProtectedRoute';

// Pages
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';

// Store
import { useAuthStore } from './stores/auth.store';

function App() {
  const { isAuthenticated, checkAuth } = useAuthStore();

  // Kiểm tra auth khi app load (reload trang)
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <BrowserRouter>
      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#0f172a',
            color: '#f8fafc',
            borderRadius: '0',
            border: '1px solid #1e293b',
            fontSize: '14px',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#f0fdf4',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fef2f2',
            },
          },
        }}
      />

      <Routes>
        {/* Public: Login */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
          }
        />

        {/* Protected: Main App */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />

          {/* Placeholder routes cho các tuần tiếp theo */}
          {/* Tuần 3: Products & Categories */}
          {/* Tuần 5: POS & Orders */}
          {/* Tuần 6: Stock Management */}
          {/* Tuần 8: Reports */}
          {/* Tuần 9: AI Recommendations */}
        </Route>

        {/* Fallback: redirect về dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
