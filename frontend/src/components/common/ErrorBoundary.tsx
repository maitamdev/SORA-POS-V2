import React from 'react';
import { HiOutlineExclamation } from 'react-icons/hi';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary — Bắt lỗi render của React component con
 * Tránh trắng trang khi 1 component bị crash
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('❌ ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', color: '#f59e0b' }}>
              <HiOutlineExclamation style={{ width: '4rem', height: '4rem' }} />
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Đã xảy ra lỗi
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Ứng dụng gặp sự cố không mong muốn. Vui lòng thử tải lại trang.
            </p>
            {this.state.error && !import.meta.env.PROD && (
              <pre style={{
                background: '#1e293b',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#f87171',
                textAlign: 'left',
                overflow: 'auto',
                marginBottom: '1.5rem',
                maxHeight: 200,
              }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.625rem 1.5rem',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Tải lại trang
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '0.625rem 1.5rem',
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
